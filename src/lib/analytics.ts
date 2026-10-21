/**
 * Единая точка отправки целей. Одно достижение уходит сразу в оба счётчика —
 * Яндекс.Метрику и пиксель VK Рекламы (Top.Mail.Ru), с одинаковыми именами,
 * чтобы отчёты можно было сверять между собой.
 *
 * Имена целей надо завести в обоих кабинетах: в Метрике как
 * «JavaScript-событие», в VK Рекламе — как событие пикселя.
 */

import { metrikaReachGoal } from "./metrika";
import { topMailRuReachGoal } from "./top-mail-ru";

export type Goal =
  /** Нажали «Начать проверку», и клик прошёл проверку на бота. */
  | "start_click"
  /** Нажали «Начать проверку», но клик похож на бота (см. human-check). */
  | "start_suspect"
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
export type GoalParams = Record<string, string | number | boolean>;

export function reachGoal(goal: Goal, params?: GoalParams): void {
  if (typeof window === "undefined") return;
  // Счётчики независимы: сбой или блокировка одного не должны лишать данных
  // второй, поэтому каждый вызов гасит свои ошибки сам.
  metrikaReachGoal(goal, params);
  topMailRuReachGoal(goal, params);
}
