/**
 * Яндекс.Метрика. Счётчик ставится инлайном в <head> (см. RootShell), поэтому
 * очередь window.ym существует ещё до загрузки tag.js — вызовы из неё
 * доигрываются после загрузки, и ранние цели не теряются.
 *
 * Каждая цель должна быть заведена в интерфейсе счётчика как
 * «JavaScript-событие» с тем же идентификатором, иначе достижение никуда
 * не попадёт.
 */

export const YM_COUNTER_ID = 112756968;

export const yandexMetrikaScript = `
(function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${YM_COUNTER_ID}', 'ym');

ym(${YM_COUNTER_ID}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
`;

export type Goal =
  /** Нажали «Найти рейсы» с заполненными полями. */
  | "search_submit"
  /** Выдача вернулась: рейсы есть, пусто или ошибка. */
  | "search_result"
  /** «Попробовать ещё раз» после неудачного запроса. */
  | "search_retry"
  /** Выбрали город отправления или прибытия. */
  | "city_select"
  /** Открыли карточку рейса из списка. */
  | "flight_open"
  /** Подписались на уведомления по рейсу (email валиден). */
  | "subscribe_email"
  /** Переход в Telegram-бота или в Макс. */
  | "messenger_click"
  /** Сработал error boundary. */
  | "app_error"
  /** Открыли несуществующий адрес. */
  | "page_not_found";

/** Параметры цели. Персональные данные (email) сюда не попадают. */
type GoalParams = Record<string, string | number | boolean>;

declare global {
  interface Window {
    ym?: (counterId: number, action: string, ...args: unknown[]) => void;
  }
}

export function reachGoal(goal: Goal, params?: GoalParams): void {
  if (typeof window === "undefined") return;
  try {
    window.ym?.(YM_COUNTER_ID, "reachGoal", goal, params);
  } catch {
    // Метрику мог вырезать блокировщик — аналитика не должна ронять страницу.
  }
}
