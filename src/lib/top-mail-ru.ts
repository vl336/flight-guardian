/**
 * Пиксель VK Рекламы (счётчик Top.Mail.Ru). Ставится инлайном в <head>
 * (см. RootShell): очередь window._tmr — обычный массив, он существует
 * до загрузки code.js, и всё, что в него положили раньше, обработается
 * после загрузки. Ранние цели не теряются.
 *
 * Как и в Метрике, цель должна быть заведена в кабинете VK Рекламы с тем же
 * именем, иначе достижение никуда не попадёт.
 */

export const TMR_COUNTER_ID = "3805351";

export const topMailRuScript = `
var _tmr = window._tmr || (window._tmr = []);
_tmr.push({id: "${TMR_COUNTER_ID}", type: "pageView", start: (new Date()).getTime()});
(function (d, w, id) {
  if (d.getElementById(id)) return;
  var ts = d.createElement("script"); ts.type = "text/javascript"; ts.async = true; ts.id = id;
  ts.src = "https://top-fwz1.mail.ru/js/code.js";
  var f = function () {var s = d.getElementsByTagName("script")[0]; s.parentNode.insertBefore(ts, s);};
  if (w.opera == "[object Opera]") { d.addEventListener("DOMContentLoaded", f, false); } else { f(); }
})(document, window, "tmr-code");
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
