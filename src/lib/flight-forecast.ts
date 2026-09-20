import type { FlightDayStatus, LocalDate } from "./graphql-types";
import type { Flight, RiskFactor, RiskLevel } from "./flight-data";
import { clamp, clampInt, hash32, noise, normal, pick, round5, unit } from "./seeded-random";

/**
 * Plausible-looking analytics for a flight the schedule API has no analytics
 * for. Every number is a pure function of the flight's identity and its date,
 * so the card survives a reload, a re-search and server rendering unchanged.
 *
 * Two rules run through the whole module. Derived numbers are derived, never
 * drawn separately — a score and an on-time rate that disagree give the game
 * away instantly. And the risk percentage is built from the same quantities as
 * the factor list, so the text can never contradict the number above it.
 */

/** Every constant that shapes the output, gathered so the feel can be retuned in one place. */
export const TUNING = {
  /** Risk is a truncated normal on 0..70: most flights sit around the mean. */
  risk: { mean: 26, sd: 12, min: 0, max: 70 },
  /** Thresholds for the three levels the card can render. */
  level: { high: 25, critical: 50 },
  /**
   * Centring constants for the two inputs that are not born standard-normal.
   * Measured over 50k synthetic flights. They are what keeps the risk a bell
   * rather than a lump, so anything that changes the weather or rotation
   * formulas above has to re-measure them: sample the two quantities over a
   * wide spread of flights and put their mean and standard deviation here.
   */
  centre: { weatherMean: 0.523, weatherSd: 0.063, rotationMean: 17.8, rotationSd: 15.0 },
  /** How much each input pushes the risk. Divided out again so the sum stays ~N(0,1). */
  weights: { weather: 1.0, rotation: 0.95, history: 0.85, shift: 0.9, luck: 0.75 },
  /**
   * When weather is worth a line of its own — a little above the mean impact of
   * ~0.52, so roughly a third of flights carry one. Only ever one line, for
   * whichever end of the route is worse: quoting both turned a list of flights
   * into the same crosswind sentence repeated, which is the clearest tell that
   * the text is generated.
   */
  weatherFactor: { show: 0.55, high: 0.7 },
} as const;

const WEEKDAYS = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
] as const;

/**
 * Where the aircraft could plausibly be arriving from on its previous leg.
 * Both cases are spelled out: the factor reads "из Нижнего Новгорода", and
 * declining a Russian city name by rule is not something worth attempting here.
 */
const INBOUND_CITIES = [
  { city: "Екатеринбург", from: "Екатеринбурга" },
  { city: "Новосибирск", from: "Новосибирска" },
  { city: "Казань", from: "Казани" },
  { city: "Самара", from: "Самары" },
  { city: "Уфа", from: "Уфы" },
  { city: "Пермь", from: "Перми" },
  { city: "Челябинск", from: "Челябинска" },
  { city: "Ростов-на-Дону", from: "Ростова-на-Дону" },
  { city: "Краснодар", from: "Краснодара" },
  { city: "Минеральные Воды", from: "Минеральных Вод" },
  { city: "Нижний Новгород", from: "Нижнего Новгорода" },
  { city: "Тюмень", from: "Тюмени" },
  { city: "Омск", from: "Омска" },
  { city: "Красноярск", from: "Красноярска" },
  { city: "Волгоград", from: "Волгограда" },
  { city: "Саратов", from: "Саратова" },
  { city: "Калининград", from: "Калининграда" },
  { city: "Мурманск", from: "Мурманска" },
  { city: "Архангельск", from: "Архангельска" },
  { city: "Астрахань", from: "Астрахани" },
] as const;

/**
 * How busy a departure airport is by hour, 0..1 — the morning and evening waves
 * every hub runs. Drives the queue-on-departure factor.
 */
const PEAK_BY_HOUR = [
  0.2, 0.15, 0.1, 0.1, 0.15, 0.3, 0.6, 0.85, 0.9, 0.8, 0.6, 0.55, 0.6, 0.6, 0.55, 0.6, 0.7, 0.85,
  0.95, 0.9, 0.8, 0.65, 0.45, 0.3,
] as const;

export type ForecastInput = {
  /** "SU 1402" or plain "1402" — both parse. */
  flightNumber: string;
  carrierCode: string | null;
  airline: string;
  fromCity: string;
  /** IATA of the departure airport: Moscow has three, and they queue separately. */
  fromAirport: string;
  toCity: string;
  date: LocalDate;
  /** Local departure, "18:40". */
  departure: string;
  /** Real: how far the airline has already moved the flight since publishing it. */
  shiftMinutes: number;
  /** Real. */
  status: FlightDayStatus;
};

const clamp01 = (value: number) => clamp(value, 0, 1);

/**
 * Date and time onto one continuous axis of hours since the epoch. Continuous
 * across midnight on purpose: 23:50 and 00:10 are twenty minutes apart and must
 * get near-identical weather, which a separate day-and-hour key would break.
 * Parsed by hand through Date.UTC — `new Date(string)` drags in the machine's
 * time zone, the same trap `toLocalDate` avoids in api.ts.
 */
function timeAxis(date: LocalDate, departure: string) {
  const [yy, mm, dd] = date.split("-");
  const year = Number(yy) || 1970;
  const month = Number(mm) || 1;
  const dayOfMonth = Number(dd) || 1;

  const [hourText, minuteText] = departure.split(":");
  const hour = clamp(Number(hourText) || 0, 0, 23);
  const minute = clamp(Number(minuteText) || 0, 0, 59);

  const day = Date.UTC(year, month - 1, dayOfMonth) / 86_400_000;
  const dayOfYear = day - Date.UTC(year, 0, 1) / 86_400_000;

  return { hours: day * 24 + hour + minute / 60, hour, dayOfYear };
}

type Weather = {
  wind: number;
  fog: number;
  precip: number;
  storm: number;
  gustMs: number;
  visibilityKm: number;
  kind: "снег" | "дождь";
  /** Single 0..1 summary of how much this weather threatens the schedule. */
  impact: number;
};

/**
 * Two octaves per channel: the slow one is a front sitting over the city for a
 * day or two, the fast one the swings inside it. Weights sum to 1, so the result
 * stays in [0, 1). A six-hour node means two flights on the same evening share
 * their weather while a morning and an evening flight do not.
 */
const track = (place: string, channel: string, t: number) =>
  0.65 * noise(`${place}|${channel}`, t / 6) + 0.35 * noise(`${place}|${channel}|slow`, t / 30);

function weatherAt(place: string, hours: number, dayOfYear: number): Weather {
  // Constant in time: Sochi stays milder than Novosibirsk on every date rather
  // than drifting as the reader pages through the calendar.
  const climate = unit(hash32(place, "climate"));
  // 1 in January, 0 in July.
  const season = 0.5 + 0.5 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365);
  const summer = 1 - season;

  const wind = clamp01(0.6 * track(place, "wind", hours) + 0.25 * climate + 0.15 * season);
  const fog = clamp01(0.6 * track(place, "fog", hours) + 0.2 * climate + 0.2 * season);
  const precip = clamp01(0.6 * track(place, "precip", hours) + 0.2 * climate + 0.2 * season);
  // Thunderstorms are a summer thing; snow and fog lean the other way. Without
  // this the generator hands out a thunderstorm over Novosibirsk in January.
  const storm = clamp01(track(place, "storm", hours) * (0.45 + 0.55 * summer));

  return {
    wind,
    fog,
    precip,
    storm,
    gustMs: Math.round(3 + 19 * wind),
    visibilityKm: Math.round((10 - 9.3 * fog) * 10) / 10,
    kind: season > 0.55 ? "снег" : "дождь",
    // Crosswind closes a runway more often than anything else, so it weighs
    // most; a storm piles on top. The weights sum past 1 deliberately — fog and
    // a storm together should hit the ceiling rather than run past it.
    impact: clamp01(0.4 * wind + 0.25 * fog + 0.15 * precip + 0.35 * storm),
  };
}

/**
 * How many legs the aircraft has already flown today. Derived from the clock
 * rather than a hash because it is rotation, not chance: an evening flight has
 * to inherit delays more often than a dawn one. The flying day starts around
 * 06:00 and runs in roughly four-hour legs; anything before 05:00 is the tail
 * of the previous day.
 */
const legsFlownBy = (hour: number) =>
  clampInt(Math.floor(((hour < 5 ? hour + 24 : hour) - 6) / 4), 0, 5);

/**
 * "SU 1402" -> "SU 1401": carriers number the two halves of a rotation in
 * sequence.
 *
 * The digits are matched as the trailing run, with the carrier prefix taking
 * whatever is left. A prefix pattern that could itself contain digits would
 * swallow one when the number is written without a space — "SU1006" splitting
 * into "SU1" and "006" — and the subtraction would then apply to the last
 * digits alone. That reads correctly until the tail has to borrow, at which
 * point SU10 claims to arrive as SU11.
 */
function inboundNumber(flightNumber: string): string | null {
  const parsed = /^(.*?)(\d{1,4})([A-Za-z]?)$/.exec(flightNumber.trim());
  if (!parsed) return null;
  const [, prefix = "", digits = "", suffix = ""] = parsed;
  const value = Number(digits);
  const previous = value > 1 ? value - 1 : value + 1;
  // Only a number that was written with leading zeros keeps its width.
  const printed = digits.startsWith("0")
    ? String(previous).padStart(digits.length, "0")
    : String(previous);
  return `${prefix}${printed}${suffix}`;
}

type Rotation = { legs: number; delay: number; number: string | null; city: string };

function rotationOf(input: ForecastInput, hour: number, originImpact: number): Rotation {
  const legs = legsFlownBy(hour);
  // Half-normal, mean ~0.8: the spread between one flight's chain and the next.
  const chain = Math.abs(normal(hash32(input.flightNumber, input.date, "chain")));
  const delay = clampInt(
    legs * 7 * chain + 10 * originImpact + 0.6 * Math.max(0, input.shiftMinutes),
    0,
    90,
  );

  const pool = INBOUND_CITIES.filter(
    (entry) => entry.city !== input.fromCity && entry.city !== input.toCity,
  );
  return {
    legs,
    delay,
    number: inboundNumber(input.flightNumber),
    city: pick(hash32(input.flightNumber, input.date, "inbound"), pool).from,
  };
}

/**
 * Punctuality over the last 30 days — a property of the route and the carrier,
 * so the date is deliberately not part of the seed. Paging through dates must
 * leave this block still, or the numbers read as invented.
 */
function historyOf(input: ForecastInput): Flight["history"] {
  const carrierKey = input.carrierCode ?? input.airline;
  // Same for every flight the carrier operates, so one airline stays reliably
  // better than another across all its routes — which is what a reader expects.
  const carrierBase = unit(hash32(carrierKey, "punctuality"));
  const routeBase = normal(hash32(input.fromAirport, input.toCity, "route"));

  const onTimeRate = clampInt(53 + 28 * carrierBase + 5 * routeBase, 36, 92);
  const late = 100 - onTimeRate;
  const severeShare =
    0.18 + 0.22 * unit(hash32(carrierKey, input.fromAirport, input.toCity, "severe"));
  const severe = clampInt(late * severeShare, 1, late - 1);
  // The remainder, never a third draw: the card labels these as shares of one
  // distribution, and three independent numbers would visibly add up to 97 or 102.
  const medium = 100 - onTimeRate - severe;

  const avgDelay = Math.round(7 + late * 0.5 + severe * 0.9);
  const score = Math.round(clamp(onTimeRate / 11 + 1.5 - avgDelay / 45, 1.2, 9.6) * 10) / 10;

  return {
    score,
    onTimeRate,
    avgDelay,
    distribution: { onTime: onTimeRate, medium, severe },
    worstDay: pick(hash32(carrierKey, input.fromAirport, input.toCity, "worstday"), WEEKDAYS),
  };
}

const levelFor = (probability: number): RiskLevel =>
  probability >= TUNING.level.critical
    ? "CRITICAL"
    : probability >= TUNING.level.high
      ? "HIGH"
      : "LOW";

/**
 * The percentage. Each input is standardised to roughly N(0,1), the weighted sum
 * is divided by the norm of its weights so the variance comes back to 1, and the
 * result is mapped onto the 0..70 scale. Because the inputs run on separate hash
 * tracks they are near-independent, so the central limit theorem pulls the sum
 * into a bell even where a single term is not normal on its own.
 */
function probabilityOf(
  input: ForecastInput,
  weather: { origin: Weather; destination: Weather },
  rotation: Rotation,
  onTimeRate: number,
) {
  const { centre, weights, risk } = TUNING;

  // The receiving airport stops more flights than the departing one.
  const combined = 0.45 * weather.origin.impact + 0.55 * weather.destination.impact;
  const z = {
    weather: (combined - centre.weatherMean) / centre.weatherSd,
    rotation: (rotation.delay - centre.rotationMean) / centre.rotationSd,
    history: (68 - onTimeRate) / 13,
    shift: clamp((input.shiftMinutes - 4) / 22, -1.5, 3),
    luck: normal(hash32(input.flightNumber, input.date, input.departure, "luck")),
  };

  const weighted =
    weights.weather * z.weather +
    weights.rotation * z.rotation +
    weights.history * z.history +
    weights.shift * z.shift +
    weights.luck * z.luck;
  const norm = Math.hypot(
    weights.weather,
    weights.rotation,
    weights.history,
    weights.shift,
    weights.luck,
  );

  const drawn = clampInt(risk.mean + risk.sd * (weighted / norm), risk.min, risk.max);
  // A flight the carrier has pulled is not a 12%-risk flight; that reads as a bug.
  const removed =
    input.status === "REMOVED_FROM_SCHEDULE" || input.status === "REMOVED_LONG_BEFORE";
  return removed ? risk.max : drawn;
}

function destinationWeatherText(weather: Weather, city: string): string {
  if (weather.storm > 0.55) {
    return `Гроза в районе аэропорта прилёта (${city}), возможны ограничения на приём`;
  }
  if (weather.wind >= weather.fog && weather.wind >= weather.precip) {
    return `В аэропорту прилёта (${city}) прогнозируется сильный боковой ветер, порывы до ${weather.gustMs} м/с`;
  }
  if (weather.fog >= weather.precip) {
    return `Низкая видимость в ${city} — ${weather.visibilityKm} км, возможен уход на запасной`;
  }
  return `Интенсивный ${weather.kind} в ${city}: аэропорт снижает интенсивность приёма`;
}

function originWeatherText(weather: Weather, city: string, airport: string): string {
  if (weather.storm > 0.55) {
    return `Грозовой фронт над ${city}: возможна приостановка наземного обслуживания`;
  }
  if (weather.wind >= weather.fog && weather.wind >= weather.precip) {
    return `Порывы до ${weather.gustMs} м/с в ${airport}: ограничения при буксировке и загрузке`;
  }
  if (weather.fog >= weather.precip) {
    return `Видимость в ${airport} ${weather.visibilityKm} км — вылеты по процедурам низкой видимости`;
  }
  return weather.kind === "снег"
    ? `Снегопад в ${city}: борту потребуется противообледенительная обработка`
    : `Сильный дождь в ${city}: замедлено наземное обслуживание`;
}

/** Same channels the percentage was built from, turned into the lines under it. */
function factorsOf(
  input: ForecastInput,
  weather: { origin: Weather; destination: Weather },
  rotation: Rotation,
  history: Flight["history"],
  hours: number,
  hour: number,
): RiskFactor[] {
  const candidates: RiskFactor[] = [];
  const pinned: RiskFactor[] = [];

  if (input.status === "REMOVED_FROM_SCHEDULE" || input.status === "REMOVED_LONG_BEFORE") {
    pinned.push({ severity: "high", text: "Рейс снят с расписания перевозчиком" });
  }
  if (input.status === "COMPLETED") {
    pinned.push({ severity: "low", text: "Рейс уже выполнен — прогноз носит справочный характер" });
  }

  const inbound = rotation.number ? `рейсом ${rotation.number}` : "предыдущим рейсом борта";
  if (rotation.legs === 0) {
    candidates.push({
      severity: "low",
      text: `Борт ночует в ${input.fromAirport} — задержки с предыдущих рейсов не переносятся`,
    });
  } else if (rotation.delay >= 10) {
    candidates.push({
      severity: rotation.delay >= 35 ? "high" : "medium",
      text: `Самолёт задерживается на предыдущем сегменте (приходит ${inbound} из ${rotation.city}, +${rotation.delay} мин)`,
    });
  } else {
    candidates.push({
      severity: "low",
      text: `Борт приходит ${inbound} из ${rotation.city} по расписанию`,
    });
  }

  if (input.shiftMinutes >= 10) {
    candidates.push({
      severity: input.shiftMinutes >= 40 ? "high" : "medium",
      text: `Перевозчик уже сдвинул вылет на +${input.shiftMinutes} мин от первоначального расписания`,
    });
  }

  // Whichever end of the route is worse gets the line; the other stays quiet.
  const atDestination = weather.destination.impact >= weather.origin.impact;
  const worst = atDestination ? weather.destination : weather.origin;
  if (worst.impact > TUNING.weatherFactor.show) {
    candidates.push({
      severity: worst.impact > TUNING.weatherFactor.high ? "high" : "medium",
      text: atDestination
        ? destinationWeatherText(worst, input.toCity)
        : originWeatherText(worst, input.fromCity, input.fromAirport),
    });
  }

  const load =
    (PEAK_BY_HOUR[hour] ?? 0.5) * (0.6 + 0.4 * noise(`${input.fromAirport}|load`, hours / 4));
  if (load > 0.55) {
    const partOfDay = hour < 11 ? "Утренний" : hour < 16 ? "Дневной" : "Вечерний";
    candidates.push({
      severity: "low",
      text: `${partOfDay} пик в ${input.fromAirport}: очередь на вылет до ${Math.round(4 + 14 * load)} минут`,
    });
  }

  // A route that runs late two days in three is a real driver of the number
  // above, not a footnote — it carries medium weight once it gets that bad.
  if (history.onTimeRate < 65) {
    candidates.push({
      severity: history.onTimeRate < 55 ? "medium" : "low",
      text: `На маршруте ${input.fromCity} — ${input.toCity} вовремя уходят ${history.onTimeRate}% рейсов за 30 дней`,
    });
  }

  if (candidates.length + pinned.length < 2) {
    const visibility = Math.min(weather.origin.visibilityKm, weather.destination.visibilityKm);
    candidates.push({
      severity: "low",
      text: `Метеоусловия в ${input.fromCity} и ${input.toCity} в норме, видимость более ${visibility} км`,
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  // Status leads whatever else is on the list: "already operated" reframes the
  // whole card, and its low severity would otherwise drop it off the end.
  return [...pinned, ...candidates.sort((a, b) => rank[a.severity] - rank[b.severity])].slice(0, 4);
}

/** The whole analytics half of the card for one flight on one date. */
export function forecastFor(input: ForecastInput): Pick<Flight, "history" | "risk"> {
  const { hours, hour, dayOfYear } = timeAxis(input.date, input.departure);

  const weather = {
    origin: weatherAt(input.fromAirport, hours, dayOfYear),
    // The API gives no IATA code for the destination, so the city names it.
    destination: weatherAt(input.toCity, hours, dayOfYear),
  };
  const rotation = rotationOf(input, hour, weather.origin.impact);
  const history = historyOf(input);
  const probability = probabilityOf(input, weather, rotation, history.onTimeRate);
  const level = levelFor(probability);

  // The span follows the percentage and the inherited delay rather than being
  // drawn: "60% risk, 0...10 minutes" would be nonsense.
  const delayTo = round5(clamp(8 + probability * 1.35 + rotation.delay * 0.55, 10, 180));

  return {
    history,
    risk: {
      level,
      probability,
      delayFrom: level === "LOW" ? 0 : round5(delayTo * 0.45),
      delayTo,
      factors: factorsOf(input, weather, rotation, history, hours, hour),
    },
  };
}
