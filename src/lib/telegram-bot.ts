import type { LocalDate } from "./graphql-types";

/**
 * Ссылки на бота @riskbotair. Бот сохраняет payload из ?start= и по нему
 * связывает переход с рейсом или городом. Ошибку при неверном payload он не
 * показывает, а просто здоровается — переход тогда ни с чем не связать,
 * поэтому всё, что не проходит формат, отправляем голой ссылкой.
 *
 * Формат согласован с ботом:
 * - flight_<НОМЕР>_<ГГГГММДД> — номер латиницей без пробелов: два символа
 *   кода перевозчика, 1–4 цифры и, если есть, буква (SU1074, U6123, 5N451A);
 * - city_<КОД> — MOW, LED, SVX.
 */

export const TELEGRAM_BOT_URL = "https://t.me/riskbotair";

const FLIGHT_NUMBER = /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/;
const CITY_CODE = /^[A-Z]{3}$/;

const withPayload = (payload: string) => `${TELEGRAM_BOT_URL}?start=${payload}`;

/** "2026-10-22" -> "20261022", или null, если это не настоящая дата. */
function compactDate(date: LocalDate): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [, year, month, day] = match;
  // Date.UTC сам переносит 31.02 на март — сверяем обратно, чтобы такое отсечь.
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}${month}${day}`;
}

export function flightBotLink(flightNumber: string, date: LocalDate): string {
  const number = flightNumber.replace(/\s+/g, "").toUpperCase();
  const day = compactDate(date);
  if (!FLIGHT_NUMBER.test(number) || !day) return TELEGRAM_BOT_URL;
  return withPayload(`flight_${number}_${day}`);
}

export function cityBotLink(code: string): string {
  return CITY_CODE.test(code) ? withPayload(`city_${code}`) : TELEGRAM_BOT_URL;
}
