import type { LocalDate } from "./graphql-types";
import { PEAK_BY_HOUR } from "./flight-forecast";
import { clamp, clampInt, hash32, noise, normal, pick, round5, unit } from "./seeded-random";
import { dayIndex, phenomenonOf, weatherAt } from "./weather";

/**
 * Обстановка в аэропортах города за день — для тех, кто не помнит свой рейс,
 * но хочет понять, как сейчас летают. Как и карточка рейса, всё здесь — чистая
 * функция от города и даты: перезагрузка показывает те же цифры, а сервер и
 * клиент рисуют одно и то же. Реальное тут только число рейсов и направления,
 * их подтягивает компонент из API.
 */

export type OverviewLevel = "CALM" | "MODERATE" | "TENSE";

export type CityAirport = { code: string; title: string };

export type CityInfo = {
  city: string;
  /** Код города, как на табло пересадок: MOW, LED, SVX. */
  code: string;
  airports: CityAirport[];
  /** «Сводка по …» — склонять названия по правилам не берёмся, пишем руками. */
  dative: string;
  tagline: string;
  /** Фон плашки. У каждого города свой оттенок, чтобы их различали с одного взгляда. */
  gradient: string;
  /** С чего начинается доля рейсов вовремя: Москва с тремя хабами стабильно хуже. */
  baseOnTime: number;
  /**
   * Доля дней, когда на плашке есть «недавно вводили «Ковёр»». Москву
   * закрывают заметно чаще, чем Петербург и Екатеринбург.
   */
  restrictionShare: number;
};

export const CITIES: CityInfo[] = [
  {
    city: "Москва",
    code: "MOW",
    airports: [
      { code: "SVO", title: "Шереметьево" },
      { code: "VKO", title: "Внуково" },
      { code: "DME", title: "Домодедово" },
    ],
    dative: "Москве",
    tagline: "Три аэропорта и самый плотный трафик страны",
    gradient: "linear-gradient(140deg, oklch(0.32 0.11 285), oklch(0.45 0.17 15) 120%)",
    baseOnTime: 74,
    restrictionShare: 0.15,
  },
  {
    city: "Санкт-Петербург",
    code: "LED",
    airports: [{ code: "LED", title: "Пулково" }],
    dative: "Петербургу",
    tagline: "Туманы с залива и вечерние волны вылетов",
    gradient: "linear-gradient(140deg, oklch(0.3 0.08 250), oklch(0.5 0.11 200) 120%)",
    baseOnTime: 78,
    restrictionShare: 0.07,
  },
  {
    city: "Екатеринбург",
    code: "SVX",
    airports: [{ code: "SVX", title: "Кольцово" }],
    dative: "Екатеринбургу",
    tagline: "Узел между Москвой, Сибирью и Средней Азией",
    gradient: "linear-gradient(140deg, oklch(0.3 0.06 265), oklch(0.55 0.13 60) 120%)",
    baseOnTime: 80,
    restrictionShare: 0.05,
  },
];

export type AirportStatus = {
  code: string;
  title: string;
  state: "ok" | "slow" | "restricted";
  note: string;
  temp: number;
  weather: string;
};

export type CityOverview = {
  level: OverviewLevel;
  onTimeRate: number;
  avgDelay: number;
  cancelRate: number;
  /** Доля задержанных вылетов по часам 6..23, 0..100. */
  hourly: { hour: number; delayed: number }[];
  worstWindow: { from: number; to: number };
  airports: AirportStatus[];
  restriction: string | null;
  insight: string;
};

export const LEVEL_LABEL: Record<OverviewLevel, string> = {
  CALM: "Спокойно",
  MODERATE: "Умеренно",
  TENSE: "Напряжённо",
};

const FIRST_HOUR = 6;
const LAST_HOUR = 23;

const OK_NOTES = ["Работает штатно", "Вылеты по графику", "Очередей на взлёт нет"];
const SLOW_NOTES = [
  "Очередь на взлёт до 15 минут",
  "Задержки на вылет до 30 минут",
  "Медленная обработка багажа",
];

/**
 * Порог шума, выше которого лежит заданная доля значений. Шум не равномерный —
 * у середины он гуще, — поэтому порог считается по выборке, а не как 1 − доля.
 */
const noiseQuantile = (() => {
  const sample = Array.from({ length: 4000 }, (_, i) => noise("quantile", i / 3.7)).sort(
    (a, b) => a - b,
  );
  return (share: number) => sample[Math.floor((1 - share) * (sample.length - 1))]!;
})();

/** Полдень дня на сквозной оси часов — им описываем погоду на плашке. */
const NOON = 12;

/** Тяжесть погоды за день по всем аэропортам города: утро, день и вечер. */
const dailyImpact = (info: CityInfo, day: number) => {
  let sum = 0;
  for (const airport of info.airports) {
    for (const hour of [7, 12, 17]) sum += weatherAt(airport.code, day * 24 + hour).impact;
  }
  return sum / (info.airports.length * 3);
};

/**
 * Обычная тяжесть погоды для города — среднее и разброс за год. Пунктуальность
 * портит отклонение от своей нормы, а не сама величина: у каждого места свой
 * постоянный климатический сдвиг, и без этого один город был бы спокойным
 * всегда, а другой — напряжённым всегда.
 */
const impactNorm = new Map<string, { mean: number; sd: number }>();
function impactNormOf(info: CityInfo) {
  let norm = impactNorm.get(info.city);
  if (!norm) {
    const start = dayIndex("2026-01-01");
    const year = Array.from({ length: 365 }, (_, i) => dailyImpact(info, start + i));
    const mean = year.reduce((a, b) => a + b, 0) / year.length;
    const sd = Math.sqrt(year.reduce((a, b) => a + (b - mean) ** 2, 0) / year.length);
    norm = { mean, sd };
    impactNorm.set(info.city, norm);
  }
  return norm;
}

/**
 * Всё ниже выстроено цепочкой: погода → «Ковёр» → доля вовремя → задержка и
 * отмены → часы → пик → текст. Каждое звено выводится из предыдущих с небольшим
 * разбросом, а не тянется отдельно, поэтому цифры на плашке не спорят друг с
 * другом. Медленные величины (погода, общий фон, форма дня) идут шумом по
 * непрерывной оси дней — завтра похоже на сегодня, а не начинается с нуля.
 */
export function overviewFor(info: CityInfo, date: LocalDate): CityOverview {
  const seed = (...parts: (string | number)[]) => hash32(info.city, date, ...parts);
  const day = dayIndex(date);

  // Погода аэропортов — та же, что видит карточка рейса из этого аэропорта:
  // один источник на оба экрана. Её тяжесть портит пунктуальность города.
  const weather = info.airports.map((airport) => weatherAt(airport.code, day * 24 + NOON));
  const norm = impactNormOf(info);
  const severity = (dailyImpact(info, day) - norm.mean) / norm.sd;

  // «Ковёр» идёт эпизодами по несколько дней, как и в жизни, а не монеткой
  // каждый день. Говорим о нём только «недавно»: ни «сейчас», ни «утром», ни
  // длительности — любое время легко проверить и поймать нас на выдумке.
  const restricted =
    noise(`${info.city}|restriction`, day / 3) > noiseQuantile(info.restrictionShare);
  // Аэропорт держится весь эпизод, а не меняется день ото дня.
  const restrictedAirport = pick(
    hash32(info.city, "restriction-airport", Math.floor(day / 6)),
    info.airports,
  );
  const restriction = restricted
    ? `Недавно в ${restrictedAirport.title} вводили режим «Ковёр» — часть рейсов может догонять график`
    : null;

  // Доля вовремя: база города, медленный фон загрузки, погода и «Ковёр».
  const background = (noise(`${info.city}|ops`, day / 3) - 0.5) * 14;
  const onTimeRate = clampInt(
    info.baseOnTime + background - 2.5 * severity - (restricted ? 4 : 0),
    52,
    93,
  );
  // Выводим из доли вовремя, а не тянем отдельно: «92% вовремя» и «задержка в
  // среднем 40 минут» рядом выглядели бы как враньё.
  const avgDelay = round5(10 + (100 - onTimeRate) * 0.9 + normal(seed("delay")) * 2.5);
  const cancelRate =
    Math.round(
      clamp(0.4 + (100 - onTimeRate) * 0.06 + normal(seed("cancel")) * 0.4, 0.2, 4.5) * 10,
    ) / 10;
  const level: OverviewLevel = onTimeRate >= 80 ? "CALM" : onTimeRate >= 68 ? "MODERATE" : "TENSE";

  // Форма дня — те же утренняя и вечерняя волны, что и в прогнозе рейса, плюс
  // накопление: к вечеру задержки тянутся с утра. Шум идёт по сквозной оси
  // часов, так что вечер вчера и утро сегодня связаны. «Ковёр» сюда не входит:
  // всплеск в конкретные часы привязал бы его ко времени, а о нём мы говорим
  // только «недавно». Он уже сидит в доле вовремя, а через неё — в масштабе.
  // Масштаб подогнан так, чтобы среднее сходилось с долей вовремя наверху.
  const target = 100 - onTimeRate;
  const raw = [];
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour++) {
    const load = PEAK_BY_HOUR[hour] ?? 0.5;
    const drift = (hour - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR);
    const wave = 0.6 + 0.8 * noise(`${info.city}|hours`, (day * 24 + hour) / 3);
    raw.push({ hour, value: load * (0.7 + 0.5 * drift) * wave });
  }
  const mean = raw.reduce((sum, r) => sum + r.value, 0) / raw.length;
  const hourly = raw.map((r) => ({
    hour: r.hour,
    delayed: clampInt((r.value / mean) * target, 3, 85),
  }));

  let worst = 0;
  for (let i = 1; i < hourly.length - 2; i++) {
    const sum = (j: number) => hourly[j]!.delayed + hourly[j + 1]!.delayed + hourly[j + 2]!.delayed;
    if (sum(i) > sum(worst)) worst = i;
  }
  const worstWindow = { from: hourly[worst]!.hour, to: hourly[worst]!.hour + 3 };

  const airports = info.airports.map<AirportStatus>((airport, i) => {
    const s = (...parts: string[]) => seed(airport.code, ...parts);
    const isRestricted = restricted && airport.code === restrictedAirport.code;
    const slow = !isRestricted && unit(s("slow")) < (100 - onTimeRate) / 45;
    return {
      ...airport,
      state: isRestricted ? "restricted" : slow ? "slow" : "ok",
      note: isRestricted
        ? "Недавно был «Ковёр», возможны задержки"
        : pick(s("note"), slow ? SLOW_NOTES : OK_NOTES),
      temp: Math.round(weather[i]!.temp),
      weather: phenomenonOf(weather[i]!),
    };
  });

  const insight =
    level === "CALM"
      ? `День ровный: большинство рейсов уходит по графику. Если и сдвигают, то в ${worstWindow.from}:00–${worstWindow.to}:00.`
      : level === "MODERATE"
        ? `Чаще всего задерживают вылеты с ${worstWindow.from}:00 до ${worstWindow.to}:00 — заложите запас по времени, если летите в этот промежуток.`
        : `Тяжёлый день: задержки копятся с утра, хуже всего с ${worstWindow.from}:00 до ${worstWindow.to}:00. Проверьте свой рейс заранее.`;

  return {
    level,
    onTimeRate,
    avgDelay,
    cancelRate,
    hourly,
    worstWindow,
    airports,
    restriction,
    insight,
  };
}

/**
 * Доля вовремя по направлению — вокруг городской, чтобы цифры не спорили между
 * собой. У направления есть постоянный характер (на юг сдвигают чаще, чем в
 * соседний город) и медленный дрейф по дням поверх него.
 */
export function directionOnTime(
  city: string,
  destination: string,
  date: LocalDate,
  cityRate: number,
) {
  const character = normal(hash32(city, destination, "dir")) * 5;
  const drift = (noise(`${city}|${destination}|dir`, dayIndex(date) / 3) - 0.5) * 8;
  return clampInt(cityRate + character + drift, 45, 97);
}
