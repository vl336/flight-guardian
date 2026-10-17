/**
 * Пиксель VK Рекламы (счётчик Top.Mail.Ru). Очередь window._tmr заводится
 * инлайном в <head> (см. RootShell) — это обычный массив, он существует до
 * загрузки code.js, и всё, что в него положили раньше, обработается после.
 * Ранние цели не теряются.
 *
 * code.js подключается отдельным <script async>, а не вставкой через
 * createElement, как в исходном сниппете VK. Вставку из JS предсканер
 * браузера не видит, поэтому загрузка стартовала только после выполнения
 * инлайн-скрипта — а он ждёт блокирующие стили, которые стоят выше в <head>.
 * На бою это давало задержку около 700 мс и диагностику VK «Пиксель долго
 * загружается». Статический тег предсканер находит сразу при разборе HTML.
 *
 * Как и в Метрике, цель должна быть заведена в кабинете VK Рекламы с тем же
 * именем, иначе достижение никуда не попадёт.
 */

export const TMR_COUNTER_ID = "3805351";

export const TMR_SCRIPT_SRC = "https://top-fwz1.mail.ru/js/code.js";

/** Тот же id, что и в оригинальном сниппете VK. */
export const TMR_SCRIPT_ID = "tmr-code";

export const topMailRuScript = `
var _tmr = window._tmr || (window._tmr = []);
_tmr.push({id: "${TMR_COUNTER_ID}", type: "pageView", start: (new Date()).getTime()});
`;
type TmrEvent = {
  id: string;
  type: string;
  goal?: string;
  params?: Record<string, unknown>;
  [key: string]: unknown;
};

declare global {
  interface Window {
    _tmr?: TmrEvent[];
  }
}

export function topMailRuReachGoal(goal: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    // Очередь создаётся инлайн-скриптом, но подстраховываемся: если счётчик
    // вырезал блокировщик, вызовы просто копятся в массиве и никому не мешают.
    const queue = (window._tmr ??= []);
    // exactOptionalPropertyTypes: params кладём только когда он есть.
    queue.push(
      params
        ? { id: TMR_COUNTER_ID, type: "reachGoal", goal, params }
        : { id: TMR_COUNTER_ID, type: "reachGoal", goal },
    );
  } catch {
    // Аналитика не должна ронять страницу.
  }
}
