import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Check, Info, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { reachGoal } from "@/lib/analytics";
import type { RiskLevel } from "@/lib/flight-data";

type Props = {
  /** Номер рейса попадает и в тексты, и в цель — без него тариф не оформить. */
  flightNumber: string;
  riskLevel: RiskLevel;
  riskProbability: number;
};

/**
 * Предложение страховки от задержки и отмены в карточке рейса. Чекаута пока
 * нет: клик по тарифу уходит в цель, а покупателю честно отвечаем, что
 * оформление скоро откроется — так меряем спрос до запуска продаж.
 */
export function InsuranceOffer({ flightNumber, riskLevel, riskProbability }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [howOpen, setHowOpen] = useState(false);

  // Показ = «viewable impression»: ≥50% блока в кадре ≥1 сек — случайный
  // проскок при прокрутке показом не станет. Один раз за открытую карточку,
  // чтобы воронка insurance_view → insurance_click не раздувалась.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          timer ??= window.setTimeout(() => {
            reachGoal("insurance_view", {
              flight: flightNumber,
              risk_level: riskLevel,
              risk_probability: riskProbability,
            });
            observer.disconnect();
          }, 1000);
        } else {
          window.clearTimeout(timer);
          timer = undefined;
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [flightNumber, riskLevel, riskProbability]);

  const handlePlan = () => {
    reachGoal("insurance_click", {
      flight: flightNumber,
      risk_level: riskLevel,
      risk_probability: riskProbability,
    });
    toast.success("Оформление скоро откроется", {
      description: `Страховку на рейс ${flightNumber} готовим к запуску — увидели ваш интерес.`,
    });
  };

  return (
    <section
      ref={sectionRef}
      className="rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sky-soft">
          <ShieldCheck className="h-5 w-5 text-accent-foreground" />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg leading-tight font-extrabold">
            Страховка от задержки и отмены рейса
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Компенсации приходят сами, без заявлений и справок. Оформляется на рейс {flightNumber}.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-border p-4 sm:p-5">
        <p className="text-2xl font-black">
          599 ₽ <span className="text-xs font-semibold text-muted-foreground">/ рейс</span>
        </p>
        <ul className="mt-3 space-y-3 text-sm">
          <Benefit
            criterion="От 30 минут"
            perk="Ваучер на еду, 500 ₽"
            tooltip="Ваучер на 500 ₽ придёт в приложение и будет ждать целый год: потратить его можно в кафе и магазинах любого аэропорта России — когда удобно, не обязательно прямо в этой поездке."
          />
          <Benefit
            criterion="От 1,5 часа"
            perk="Возврат 599 ₽ за страховку"
            tooltip="Моментальный возврат на карту ровно той суммы, что вы заплатили за страховку: эти 599 ₽ вернутся сами, без заявлений и ожиданий."
          />
          <Benefit
            criterion="От 2,5 часа"
            perk="QR-код в бизнес-зал"
            tooltip="По QR-коду можно пройти в бизнес-зал аэропорта. Не обязательно сразу: код не сгорит — используйте его в этой поездке или в любой следующей."
          />
        </ul>
        <Button
          variant="outline"
          onClick={() => setHowOpen(true)}
          className="mt-4 h-11 w-full rounded-2xl font-bold"
        >
          Как это работает
        </Button>
        <Button onClick={handlePlan} className="mt-2 h-11 w-full rounded-2xl font-bold">
          Оформить страховку
        </Button>
      </div>

      {howOpen && <HowItWorks onClose={() => setHowOpen(false)} />}
    </section>
  );
}

const HOW_STEPS = [
  {
    title: "Оформляете на рейс",
    text: "Страховка привязывается к номеру рейса и дате вылета.",
  },
  {
    title: "Следим за задержкой сами",
    text: "Заявления не нужны и в поддержку писать не нужно: если случится задержка, мы сами всё выдадим.",
  },
  {
    title: "От 30 минут — ваучер на еду",
    text: "В личном кабинете в течение года можно получить ваучер на 500 ₽ и потратить его в любом аэропорту России — в кафе или магазине.",
  },
  {
    title: "От 1,5 часа — возврат за страховку",
    text: "Моментально возвращаем на карту 599 ₽.",
  },
  {
    title: "От 2,5 часа — бизнес-зал",
    text: "В личном кабинете в течение года можно получить QR-код на бизнес-зал: нажали «Получить QR-код» — и проходите в бизнес-зал любого аэропорта России.",
  },
];

/**
 * Попап «Как это работает» в стиле полноэкранной заставки: тёмный hero-фон,
 * карточки-шаги с номерами и липкая кнопка снизу.
 */
function HowItWorks({ onClose }: { onClose: () => void }) {
  // Под попапом лежит карточка рейса — не даём ей прокручиваться.
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-it-works-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-hero text-primary-foreground"
    >
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 pt-6 sm:py-8">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-foreground/10">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <p className="text-lg font-extrabold">Airrisk</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-foreground/10 transition-colors hover:bg-primary-foreground/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col pt-8 sm:py-6">
          <h2 id="how-it-works-title" className="text-3xl leading-tight font-black sm:text-4xl">
            Как работает страховка
          </h2>
          <p className="mt-4 max-w-2xl text-base text-primary-foreground/75 sm:text-lg">
            Оформляется на конкретный рейс — дальше всё происходит само.
          </p>

          <ol className="mt-8 grid gap-3">
            {HOW_STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex items-start gap-3 rounded-3xl border border-primary-foreground/10 bg-primary-foreground/5 p-4"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-foreground/10 text-xs font-bold">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-bold">{step.title}</p>
                  <p className="mt-1 text-sm text-primary-foreground/70">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-6 inline-flex items-center gap-2 self-start rounded-full bg-primary-foreground/10 px-3 py-1.5 text-sm font-semibold">
            Платим первыми — вы только показываете QR и садитесь за столик.
          </p>
        </div>

        {/* Как и в заставке: на телефоне прибиваем кнопку к низу, чтобы не листать. */}
        <div className="sticky bottom-0 -mx-4 mt-8 grid border-t border-primary-foreground/10 bg-navy/70 px-4 pt-4 pb-5 backdrop-blur-md sm:static sm:mx-0 sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <Button
            onClick={onClose}
            className="h-14 w-full rounded-2xl text-base font-bold sm:w-fit sm:px-8"
          >
            Понятно
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Ступень компенсации: сверху плашка с порогом задержки (критерий), под ней
 * сама плюшка с иконкой ⓘ — поповер, а не hover-тултип, чтобы открывался
 * тапом на телефоне (второй тап или клик мимо закрывают).
 */
function Benefit({
  criterion,
  perk,
  tooltip,
}: {
  criterion: string;
  perk: string;
  tooltip: string;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-1.5 h-4 w-4 shrink-0 text-success" />
      <div className="min-w-0 flex-1">
        <span className="inline-flex rounded-full bg-sky-soft px-2.5 py-1 text-xs font-bold text-accent-foreground">
          {criterion}
        </span>
        <p className="mt-1.5 font-medium">
          {perk}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Подробнее об условии"
                className="ml-1 inline-flex h-4 w-4 items-center justify-center align-[-2px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Info className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              collisionPadding={12}
              className="w-72 border-none bg-primary text-sm leading-snug text-primary-foreground"
            >
              {tooltip}
            </PopoverContent>
          </Popover>
        </p>
      </div>
    </li>
  );
}
