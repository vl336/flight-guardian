import type { LocalDate } from "./graphql-types";
import { PEAK_BY_HOUR } from "./flight-forecast";
import { clamp, clampInt, hash32, noise, normal, pick, round5, unit } from "./seeded-random";

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
  tagline: string;
  /** Фон плашки. У каждого города свой оттенок, чтобы их различали с одного взгляда. */
  gradient: string;
  /** С чего начинается доля рейсов вовремя: Москва с тремя хабами стабильно хуже. */
  baseOnTime: number;
  /** Средняя температура второй половины октября. */
  baseTemp: number;
  /** Насколько часто здесь вводят «Ковёр» — 0..1. */
  restrictionRate: number;
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
    tagline: "Три аэропорта и самый плотный трафик страны",
    gradient: "linear-gradient(140deg, oklch(0.32 0.11 285), oklch(0.45 0.17 15) 120%)",
    baseOnTime: 71,
    baseTemp: 5,
    restrictionRate: 0.55,
  },
  {
    city: "Санкт-Петербург",
    code: "LED",
    airports: [{ code: "LED", title: "Пулково" }],
    tagline: "Туманы с залива и вечерние волны вылетов",
    gradient: "linear-gradient(140deg, oklch(0.3 0.08 250), oklch(0.5 0.11 200) 120%)",
    baseOnTime: 76,
    baseTemp: 5,
    restrictionRate: 0.3,
  },
  {
    city: "Екатеринбург",
    code: "SVX",
    airports: [{ code: "SVX", title: "Кольцово" }],
    tagline: "Узел между Москвой, Сибирью и Средней Азией",
    gradient: "linear-gradient(140deg, oklch(0.3 0.06 265), oklch(0.55 0.13 60) 120%)",
    baseOnTime: 79,
    baseTemp: 1,
    restrictionRate: 0.2,
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

const WEATHER = {
  cold: ["Ясно", "Облачно", "Мокрый снег", "Позёмка", "Туман"],
  mild: ["Ясно", "Облачно", "Дождь", "Туман", "Ветер до 12 м/с"],
} as const;

export function overviewFor(info: CityInfo, date: LocalDate): CityOverview {
  const seed = (...parts: (string | number)[]) => hash32(info.city, date, ...parts);

  const onTimeRate = clampInt(info.baseOnTime + normal(seed("ontime")) * 6, 52, 93);
  // Выводим из доли вовремя, а не тянем отдельно: «92% вовремя» и «задержка в
  // среднем 40 минут» рядом выглядели бы как враньё.
  const avgDelay = round5(10 + (100 - onTimeRate) * 0.9 + normal(seed("delay")) * 4);
  const cancelRate =
    Math.round(
      clamp(0.4 + (100 - onTimeRate) * 0.06 + normal(seed("cancel")) * 0.4, 0.2, 4.5) * 10,
    ) / 10;
  const level: OverviewLevel = onTimeRate >= 80 ? "CALM" : onTimeRate >= 68 ? "MODERATE" : "TENSE";

  // Форма дня — те же утренняя и вечерняя волны, что и в прогнозе рейса, плюс
  // накопление: к вечеру задержки тянутся с утра. Масштаб подогнан так, чтобы
  // среднее по дню сходилось с долей вовремя наверху.
  const target = 100 - onTimeRate;
  const raw = [];
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour++) {
    const load = PEAK_BY_HOUR[hour] ?? 0.5;
    const drift = (hour - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR);
    raw.push({
      hour,
      value: load * (0.7 + 0.5 * drift) * (0.6 + 0.8 * noise(`${info.city}|${date}|h`, hour / 3)),
    });
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

  const restricted =
    unit(seed("restriction")) <
    info.restrictionRate * (level === "TENSE" ? 1.4 : level === "MODERATE" ? 0.9 : 0.4);
  const restrictedAirport = pick(seed("restriction-airport"), info.airports);
  const restriction = restricted
    ? `Утром в ${restrictedAirport.title} вводили режим «Ковёр» на ${round5(25 + unit(seed("restriction-len")) * 70)} минут — часть рейсов ещё догоняет график`
    : null;

  const temp = Math.round(info.baseTemp + normal(seed("temp")) * 3);
  const airports = info.airports.map<AirportStatus>((airport) => {
    const s = (...parts: string[]) => seed(airport.code, ...parts);
    const isRestricted = restricted && airport.code === restrictedAirport.code;
    const slow = !isRestricted && unit(s("slow")) < (100 - onTimeRate) / 45;
    return {
      ...airport,
      state: isRestricted ? "restricted" : slow ? "slow" : "ok",
      note: isRestricted
        ? "Последствия «Ковра», задержки до часа"
        : pick(s("note"), slow ? SLOW_NOTES : OK_NOTES),
      temp: temp + Math.round(normal(s("temp"))),
      weather: pick(s("weather"), temp <= 2 ? WEATHER.cold : WEATHER.mild),
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

/** Доля вовремя по направлению — вокруг городской, чтобы цифры не спорили между собой. */
export function directionOnTime(
  city: string,
  destination: string,
  date: LocalDate,
  cityRate: number,
) {
  return clampInt(cityRate + normal(hash32(city, destination, date, "dir")) * 8, 45, 97);
}
