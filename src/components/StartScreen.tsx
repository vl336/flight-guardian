import { useEffect, useRef } from "react";
import { ArrowRight, CloudSun, Link2, Plane, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reachGoal } from "@/lib/analytics";
import { checkHumanClick } from "@/lib/human-check";

/** Ключ в sessionStorage: заставку уже прошли в этой сессии. */
export const STARTED_KEY = "airrisk:started";

/** Класс на <html>, который прячет заставку до гидрации, см. styles.css. */
const STARTED_CLASS = "airrisk-started";

// Выполняется при разборе HTML, до первой отрисовки заставки. Без него
// посетитель, уже прошедший заставку, видел бы её мельком на каждой
// перезагрузке — React узнаёт про sessionStorage только после гидрации.
const earlyHideScript = `try{if(sessionStorage.getItem(${JSON.stringify(STARTED_KEY)}))document.documentElement.classList.add(${JSON.stringify(STARTED_CLASS)})}catch(e){}`;

// По строке на каждый источник риска: видно, зачем сюда пришли, но это не
// абзац, который надо читать. Без них экран с одной кнопкой похож на
// рекламную прокладку. Метки в ряд пробовали — на телефоне переносились
// лесенкой. Про «Ковёр» — без времени и без «прямо сейчас».
const REASONS = [
  { icon: Link2, text: "Задержки самолёта на прошлых рейсах" },
  { icon: ShieldAlert, text: "Режим «Ковёр» и закрытия аэропортов" },
  { icon: CloudSun, text: "Погода в городах вылета и прилёта" },
];

type Props = {
  onStart: () => void;
};

/**
 * Полноэкранная заставка поверх лендинга: заголовок, одна строка и кнопка.
 * Текста намеренно минимум — длинная заставка с карточками пугала, и люди
 * уходили, не дочитав. Рассказ о том, как считаем риск, переедет на сам сайт.
 * Клик по ней отделяет людей от ботов: цель start_click уходит только для
 * кликов, прошедших проверку, — на неё и стоит оптимизировать рекламу.
 * Остальные клики уходят в start_suspect, чтобы было видно, сколько отсеяно.
 */
export function StartScreen({ onStart }: Props) {
  // Время появления кнопки, а не загрузки страницы: на медленной сети
  // страница могла грузиться дольше, чем человек думает над кликом.
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = performance.now();
    // Под заставкой лежит лендинг — не даём ему прокручиваться.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const check = checkHumanClick(e.nativeEvent, shownAt.current);
    if (check.human) {
      reachGoal("start_click", { ms_to_click: check.ms });
    } else {
      reachGoal("start_suspect", { ms_to_click: check.ms, failed: check.failed });
    }
    try {
      sessionStorage.setItem(STARTED_KEY, "1");
    } catch {
      // Приватный режим или запрещённое хранилище — заставка покажется снова.
    }
    // Пропускаем дальше в любом случае: ложное срабатывание не должно
    // стоить нам живого посетителя.
    onStart();
  };

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: earlyHideScript }} />
      <div
        data-start-screen
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-screen-title"
        className="fixed inset-0 z-50 overflow-y-auto bg-hero text-primary-foreground"
      >
        <div className="mx-auto flex min-h-full max-w-xl flex-col px-4 py-6 sm:py-8">
          <div className="flex items-center justify-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-foreground/10">
              <Plane className="h-5 w-5" />
            </span>
            <p className="text-lg font-extrabold">Airrisk</p>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
            <h1
              id="start-screen-title"
              className="text-3xl leading-tight font-black text-balance sm:text-5xl sm:leading-tight"
            >
              Узнайте о задержке рейса раньше табло
            </h1>
            <p className="mt-4 text-base text-balance text-primary-foreground/75 sm:text-lg">
              Покажем риск задержки или отмены вашего рейса
            </p>
            <ul className="mx-auto mt-6 grid w-fit gap-2.5 text-left">
              {REASONS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-foreground/10">
                    <Icon className="h-4 w-4 text-sky" />
                  </span>
                  <span className="text-sm font-semibold text-primary-foreground/90 sm:text-base">
                    {text}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              onClick={handleClick}
              className="mt-8 h-14 w-full max-w-xs rounded-2xl text-base font-bold"
            >
              Начать проверку
              <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
