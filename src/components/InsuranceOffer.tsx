import { useEffect, useRef, type ReactNode } from "react";
import { Umbrella, Check, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
          <Umbrella className="h-5 w-5 text-accent-foreground" />
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
        <TooltipProvider delayDuration={100}>
          <ul className="mt-3 space-y-2.5 text-sm">
            <Benefit tooltip="Ваучер на 500 ₽ придёт в приложение и будет ждать целый год: потратить его можно в кафе и магазинах любого аэропорта России — когда удобно, не обязательно прямо в этой поездке.">
              Задержка от 30 минут — ваучер на еду на 500 ₽
            </Benefit>
            <Benefit tooltip="Моментальный возврат на карту ровно той суммы, что вы заплатили за страховку: эти 599 ₽ вернутся сами, без заявлений и ожиданий.">
              Задержка от 1,5 часа — возврат 599 ₽ за страховку
            </Benefit>
            <Benefit tooltip="QR-код на проход в бизнес-зал не сгорит: примените его в любой момент — на этом рейсе или на любом следующем.">
              Задержка от 2,5 часа — QR-код в бизнес-зал
            </Benefit>
          </ul>
        </TooltipProvider>
        <Button onClick={handlePlan} className="mt-4 h-11 w-full rounded-2xl font-bold">
          Оформить страховку
        </Button>
      </div>
    </section>
  );
}

function Benefit({ children, tooltip }: { children: ReactNode; tooltip: string }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      <span className="min-w-0">{children}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Подробнее об условии"
            className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Info className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-72 text-sm leading-snug">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
