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
  /**
   * Средняя суточная температура по месяцам, январь..декабрь — климатическая
   * норма 1991–2020. От неё пляшет погода, чтобы в январе не было +10.
   */
  climate: readonly number[];
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
    baseOnTime: 74,
    climate: [-6.2, -5.9, -0.7, 6.6, 13, 16.9, 19.2, 17, 11.3, 5.6, -0.4, -4.5],
    restrictionRate: 0.55,
  },
  {
    city: "Санкт-Петербург",
    code: "LED",
    airports: [{ code: "LED", title: "Пулково" }],
    tagline: "Туманы с залива и вечерние волны вылетов",
    gradient: "linear-gradient(140deg, oklch(0.3 0.08 250), oklch(0.5 0.11 200) 120%)",
    baseOnTime: 78,
    climate: [-4.8, -5, -1, 5.3, 11.5, 15.8, 18.8, 16.8, 11.7, 5.9, 0.6, -2.6],
    restrictionRate: 0.3,
  },
  {
    city: "Екатеринбург",
    code: "SVX",
    airports: [{ code: "SVX", title: "Кольцово" }],
    tagline: "Узел между Москвой, Сибирью и Средней Азией",
    gradient: "linear-gradient(140deg, oklch(0.3 0.06 265), oklch(0.55 0.13 60) 120%)",
    baseOnTime: 80,
    climate: [-13.2, -11.1, -3.7, 4, 11.4, 16, 18.5, 15.6, 9.8, 2.6, -5, -10.2],
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

/**
 * Явления по температуре: снег при +10 или гроза в мороз выдали бы генерацию
 * сразу. Внутри списка — от безобидного к худшему для расписания, по этому
 * порядку их выбирает тяжесть погоды.
 */
const WEATHER = {
  frost: ["Ясно", "Облачно", "Морозная дымка", "Снег", "Метель"],
  thaw: ["Облачно", "Дождь со снегом", "Мокрый снег", "Туман", "Гололёд"],
  mild: ["Ясно", "Облачно", "Ветер до 12 м/с", "Дождь", "Туман"],
  warm: ["Ясно", "Переменная облачность", "Кратковременный дождь", "Гроза"],
} as const;

const weatherFor = (temp: number) =>
  temp <= -3 ? WEATHER.frost : temp <= 3 ? WEATHER.thaw : temp <= 15 ? WEATHER.mild : WEATHER.warm;

/**
 * Норма на конкретный день. Значения месяцев стоят на 15-м числе, между ними —
 * линейно, иначе 31 января и 1 февраля отличались бы скачком.
 */
function climateMean(climate: readonly number[], date: LocalDate) {
  const [, mm, dd] = date.split("-").map(Number);
  const month = clamp((mm || 1) - 1, 0, 11);
  const offset = ((dd || 15) - 15) / 30;
  const from = offset < 0 ? (month + 11) % 12 : month;
  const to = (from + 1) % 12;
  const t = offset < 0 ? 1 + offset : offset;
  return climate[from]! + (climate[to]! - climate[from]!) * t;
}

/** Дни от эпохи — непрерывная ось, чтобы соседние дни получали близкую погоду. */
const dayIndex = (date: LocalDate) => {
  const [yy, mm, dd] = date.split("-").map(Number);
  return Date.UTC(yy || 1970, (mm || 1) - 1, dd || 1) / 86_400_000;
};

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

  // Отклонение от нормы тянется днями, как реальные потепления и похолодания, а
  // не прыгает каждые сутки. Зимой разброс шире: оттепель и мороз в один месяц
  // для средней полосы — обычное дело.
  const norm = climateMean(info.climate, date);
  const spread = norm < 0 ? 7 : norm < 10 ? 5 : 4;
  const temp = Math.round(norm + (noise(`${info.city}|temp`, day / 4) - 0.5) * 2 * spread);
  // Тяжесть погоды 0..1: она же выбирает явление и она же портит пунктуальность.
  const severity = noise(`${info.city}|wx`, day / 3);
  const kinds = weatherFor(temp);
  const weather = kinds[Math.min(kinds.length - 1, Math.floor(severity * kinds.length))]!;

  // «Ковёр» — событие дня, а не тренд, поэтому разыгрывается на дату. Говорим
  // о нём только «недавно»: ни «сейчас», ни «утром», ни длительности — любое
  // время легко проверить и поймать нас на выдумке.
  const restricted = unit(seed("restriction")) < info.restrictionRate * 0.6;
  const restrictedAirport = pick(seed("restriction-airport"), info.airports);
  const restriction = restricted
    ? `Недавно в ${restrictedAirport.title} вводили режим «Ковёр» — часть рейсов может догонять график`
    : null;

  // Доля вовремя: база города, медленный фон загрузки, погода и «Ковёр».
  const background = (noise(`${info.city}|ops`, day / 3) - 0.5) * 14;
  const onTimeRate = clampInt(
    info.baseOnTime + background - (severity - 0.4) * 12 - (restricted ? 4 : 0),
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

  const airports = info.airports.map<AirportStatus>((airport) => {
    const s = (...parts: string[]) => seed(airport.code, ...parts);
    const isRestricted = restricted && airport.code === restrictedAirport.code;
    const slow = !isRestricted && unit(s("slow")) < (100 - onTimeRate) / 45;
    return {
      ...airport,
      state: isRestricted ? "restricted" : slow ? "slow" : "ok",
      note: isRestricted
        ? "Недавно был «Ковёр», возможны задержки"
        : pick(s("note"), slow ? SLOW_NOTES : OK_NOTES),
      temp: temp + Math.round(normal(s("temp"))),
      weather,
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
