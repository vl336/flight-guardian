import { formatTime, type FoundFlight } from "./api";

export type RiskLevel = "LOW" | "HIGH" | "CRITICAL";

export type RiskFactor = {
  severity: "low" | "medium" | "high";
  text: string;
};

export type Flight = {
  id: string;
  flightNumber: string;
  airline: string;
  from: { city: string; code: string };
  to: { city: string; code: string };
  departure: string;
  arrival: string;
  history: {
    score: number;
    onTimeRate: number;
    avgDelay: number;
    distribution: { onTime: number; medium: number; severe: number };
    worstDay: string;
  };
  risk: {
    level: RiskLevel;
    probability: number;
    delayFrom: number;
    delayTo: number;
    factors: RiskFactor[];
  };
};

export const FLIGHTS: Flight[] = [
  {
    id: "SU1402",
    flightNumber: "SU 1402",
    airline: "Аэрофлот",
    from: { city: "Москва", code: "SVO" },
    to: { city: "Казань", code: "KZN" },
    departure: "18:40",
    arrival: "20:25",
    history: {
      score: 7.2,
      onTimeRate: 68,
      avgDelay: 27,
      distribution: { onTime: 68, medium: 24, severe: 8 },
      worstDay: "Пятница",
    },
    risk: {
      level: "HIGH",
      probability: 78,
      delayFrom: 40,
      delayTo: 60,
      factors: [
        {
          severity: "high",
          text: "Самолёт задерживается на предыдущем сегменте (рейс SU 1401 из Екатеринбурга, +45 мин)",
        },
        {
          severity: "medium",
          text: "В аэропорту прилёта (Казань) прогнозируется сильный боковой ветер",
        },
        {
          severity: "low",
          text: "Вечерний пик в Шереметьево: очередь на вылет до 12 минут",
        },
      ],
    },
  },
  {
    id: "S72054",
    flightNumber: "S7 2054",
    airline: "S7 Airlines",
    from: { city: "Сочи", code: "AER" },
    to: { city: "Москва", code: "DME" },
    departure: "09:15",
    arrival: "11:45",
    history: {
      score: 8.6,
      onTimeRate: 84,
      avgDelay: 12,
      distribution: { onTime: 84, medium: 13, severe: 3 },
      worstDay: "Воскресенье",
    },
    risk: {
      level: "LOW",
      probability: 18,
      delayFrom: 0,
      delayTo: 15,
      factors: [
        { severity: "low", text: "Борт уже находится в аэропорту вылета, ночная стоянка" },
        { severity: "low", text: "Метеоусловия в Сочи и Москве в норме, видимость более 10 км" },
      ],
    },
  },
  {
    id: "DP405",
    flightNumber: "DP 405",
    airline: "Победа",
    from: { city: "Москва", code: "VKO" },
    to: { city: "Санкт-Петербург", code: "LED" },
    departure: "21:50",
    arrival: "23:10",
    history: {
      score: 4.1,
      onTimeRate: 47,
      avgDelay: 52,
      distribution: { onTime: 47, medium: 32, severe: 21 },
      worstDay: "Понедельник",
    },
    risk: {
      level: "CRITICAL",
      probability: 91,
      delayFrom: 70,
      delayTo: 120,
      factors: [
        {
          severity: "high",
          text: "Цепочка из 4 рейсов за день: накопленное отставание борта +65 мин",
        },
        { severity: "high", text: "Гроза в районе Пулково, возможны ограничения на приём" },
        { severity: "medium", text: "Поздний слот вылета — риск переноса на утро" },
      ],
    },
  },
];

export const SUGGESTIONS = [
  { label: "SU 1402", airline: "Аэрофлот", route: "Москва — Казань", id: "SU1402" },
  { label: "S7 2054", airline: "S7 Airlines", route: "Сочи — Москва", id: "S72054" },
  { label: "DP 405", airline: "Победа", route: "Москва — Санкт-Петербург", id: "DP405" },
];

export type Airport = { code: string; city: string; name: string };

export const AIRPORTS: Airport[] = [
  { code: "SVO", city: "Москва", name: "Шереметьево" },
  { code: "DME", city: "Москва", name: "Домодедово" },
  { code: "VKO", city: "Москва", name: "Внуково" },
  { code: "LED", city: "Санкт-Петербург", name: "Пулково" },
  { code: "KZN", city: "Казань", name: "Казань" },
  { code: "AER", city: "Сочи", name: "Сочи" },
  { code: "SVX", city: "Екатеринбург", name: "Кольцово" },
  { code: "OVB", city: "Новосибирск", name: "Толмачёво" },
];

export const CITIES: string[] = Array.from(
  new Map(AIRPORTS.map((a) => [a.city, a.city])).values(),
).sort((a, b) => a.localeCompare(b, "ru"));

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\s—–>-]+/g, " ")
    .trim();

export function findFlight(query: string): Flight {
  const q = normalize(query);
  if (!q) return FLIGHTS[0]!;
  const byNumber = FLIGHTS.find(
    (f) => normalize(f.flightNumber).startsWith(q) || f.id.toLowerCase() === q.replace(/\s/g, ""),
  );
  if (byNumber) return byNumber;
  const byRoute = FLIGHTS.find((f) => {
    const route = normalize(`${f.from.city} ${f.to.city}`);
    const codes = normalize(`${f.from.code} ${f.to.code}`);
    return route.includes(q) || q.includes(route) || codes.includes(q);
  });
  return byRoute ?? FLIGHTS[0]!;
}

export function findFlights(from: string, to: string): Flight[] {
  const matches = FLIGHTS.filter(
    (f) => (!from || f.from.city === from) && (!to || f.to.city === to),
  );
  return matches.length > 0 ? matches : FLIGHTS;
}

/**
 * The schedule API carries times and statuses but no punctuality history or
 * risk score, so every flight is shown with the same placeholder numbers.
 * Only the card's identity — airline, number, route, departure — is real.
 * Replace this once the API exposes analytics.
 */
export const PLACEHOLDER_ANALYTICS: Pick<Flight, "history" | "risk"> = {
  history: {
    score: 7.2,
    onTimeRate: 68,
    avgDelay: 27,
    distribution: { onTime: 68, medium: 24, severe: 8 },
    worstDay: "Пятница",
  },
  risk: {
    level: "HIGH",
    probability: 78,
    delayFrom: 40,
    delayTo: 60,
    factors: [
      { severity: "high", text: "Самолёт задерживается на предыдущем сегменте маршрута" },
      { severity: "medium", text: "В аэропорту прилёта прогнозируется сильный боковой ветер" },
      { severity: "low", text: "Вечерний пик вылетов: очередь на взлёт до 12 минут" },
    ],
  },
};

/** Builds the analytics card's input from a flight found through the API. */
export function toAnalyticsFlight(flight: FoundFlight): Flight {
  const destination = flight.destination ?? "—";
  return {
    id: String(flight.id),
    flightNumber: flight.number,
    airline: flight.carrier,
    from: { city: flight.city, code: flight.airport },
    // The API names the arrival city but carries no arrival airport code and
    // no arrival time, so the city stands in for the code and arrival is blank.
    to: { city: destination, code: destination },
    departure: formatTime(flight.scheduledLocalTime),
    arrival: "—",
    ...PLACEHOLDER_ANALYTICS,
  };
}

export const LOADING_STEPS = [
  "Анализируем маршрут борта...",
  "Проверяем метеоусловия...",
  "Считаем индекс риска задержки...",
];

export const RISK_LABEL: Record<RiskLevel, string> = {
  LOW: "Низкий риск",
  HIGH: "Повышенный риск",
  CRITICAL: "Критический риск",
};
