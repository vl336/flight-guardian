/**
 * Проверка стартового клика на «человечность». Боты из рекламного трафика
 * обычно либо не кликают вовсе, либо кликают программно (el.click(),
 * dispatchEvent), либо под автоматизацией с navigator.webdriver, либо
 * мгновенно после загрузки. Каждый из этих признаков ловится дёшево и без
 * сторонних сервисов.
 *
 * Это не защита от целевой атаки — headless-браузер с эмуляцией мыши пройдёт.
 * Задача скромнее: дать рекламному кабинету чистую цель для оптимизации,
 * до которой фрод-трафик почти не доходит.
 */

/** Быстрее этого человек не успевает прочитать экран и нажать кнопку. */
const MIN_REACTION_MS = 700;

export type HumanCheck = {
  human: boolean;
  /** Через сколько миллисекунд после появления кнопки нажали. */
  ms: number;
  /** Какие проверки не прошли, через запятую; пусто, если все прошли. */
  failed: string;
};

export function checkHumanClick(event: { isTrusted: boolean }, shownAt: number): HumanCheck {
  const ms = Math.round(performance.now() - shownAt);
  const failed: string[] = [];
  // Программный клик (el.click(), dispatchEvent) приходит с isTrusted = false.
  if (!event.isTrusted) failed.push("untrusted");
  // Selenium, Puppeteer и Playwright без маскировки выставляют этот флаг.
  if (navigator.webdriver) failed.push("webdriver");
  if (ms < MIN_REACTION_MS) failed.push("too_fast");
  return { human: failed.length === 0, ms, failed: failed.join(",") };
}
