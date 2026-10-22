import { useEffect, useRef } from "react";
import { ArrowRight, CloudSun, History, Link2, Plane, ShieldAlert } from "lucide-react";
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

const FEATURES = [
  {
    icon: Link2,
    title: "Цепочка бортов",
    text: "Самолёт до вашего рейса летит другие рейсы. Если он уже опаздывает где-то по пути, это видно раньше, чем на табло.",
  },
  {
    icon: ShieldAlert,
    title: "Ограничения в небе",
    text: "Следим за режимом «Ковёр» и временными закрытиями аэропортов по соображениям безопасности — из-за них рейсы задерживают и отменяют целыми волнами.",
  },
  {
    icon: CloudSun,
    title: "Погода в аэропортах",
    text: "Учитываем метеоусловия в городах вылета и прилёта: туман, грозы, снег и сильный ветер.",
  },
  {
    icon: History,
    title: "История рейса",
    text: "Смотрим, как этот рейс и перевозчик выполнялись раньше и насколько часто их сдвигали.",
  },
];

const STEPS = [
  "Выберите свой город",
  "Посмотрите, как сегодня летают",
  "Проверьте конкретный рейс",
];

type Props = {
  onStart: () => void;
};

/**
 * Полноэкранная заставка поверх лендинга: что делаем, как, и одна кнопка.
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
        <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 pt-6 sm:py-8">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-foreground/10">
              <Plane className="h-5 w-5" />
            </span>
            <p className="text-lg font-extrabold">Airrisk</p>
          </div>

          <div className="flex flex-1 flex-col justify-center pt-10 sm:py-6">
            <h1
              id="start-screen-title"
              className="text-3xl leading-tight font-black sm:text-4xl sm:leading-tight"
            >
              Узнайте о задержке рейса раньше табло
            </h1>
            <p className="mt-4 max-w-2xl text-base text-primary-foreground/75 sm:text-lg">
              Авиакомпании объявляют задержку в последний момент, хотя признаки видны заранее. Мы
              собираем их в одном месте и оцениваем риск, что ваш рейс задержат или отменят.
            </p>

            <ul className="mt-8 grid gap-3 sm:mt-6 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li
                  key={title}
                  className="flex gap-3 rounded-3xl border border-primary-foreground/10 bg-primary-foreground/5 p-4 sm:block"
                >
                  <Icon className="h-6 w-6 shrink-0 text-sky" />
                  <div>
                    <p className="font-bold sm:mt-3">{title}</p>
                    <p className="mt-1 text-sm text-primary-foreground/70">{text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <ol className="mt-8 grid gap-2 sm:mt-6 text-sm text-primary-foreground/80 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-foreground/10 text-xs font-bold">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            {/* На телефоне текст не влезает в экран, и кнопка ушла бы под сгиб —
                прибиваем её к низу, чтобы до неё не надо было листать. */}
            <div className="sticky bottom-0 -mx-4 mt-8 grid border-t border-primary-foreground/10 bg-navy/70 px-4 pt-4 pb-5 backdrop-blur-md sm:static sm:mx-0 sm:mt-8 sm:w-fit sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <Button
                size="lg"
                onClick={handleClick}
                className="h-14 rounded-2xl px-8 text-base font-bold"
              >
                Посмотреть обстановку
                <ArrowRight className="ml-1 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
