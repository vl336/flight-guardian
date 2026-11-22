import { useEffect, useRef, type ReactNode } from "react";
import { Umbrella, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

  const handlePlan = (plan: "basic" | "premium") => {
    reachGoal("insurance_click", {
      plan,
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
            Выплата приходит на карту сама, без заявлений и справок. Оформляется на рейс{" "}
            {flightNumber}.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col rounded-3xl border border-border p-4">
          <p className="text-sm font-bold">Базовый</p>
          <p className="mt-1 text-2xl font-black">
            399 ₽ <span className="text-xs font-semibold text-muted-foreground">/ рейс</span>
          </p>
          <ul className="mt-3 grow space-y-2 text-sm">
            <Benefit>Задержка от 3 часов — 3 000 ₽</Benefit>
            <Benefit>Отмена рейса — до 15 000 ₽ на новый билет</Benefit>
            <Benefit>Следим за рейсом и платим сами</Benefit>
          </ul>
          <Button
            variant="outline"
            onClick={() => handlePlan("basic")}
            className="mt-4 h-11 w-full rounded-2xl font-bold"
          >
            Оформить базовый
          </Button>
        </div>

        <div className="relative flex flex-col rounded-3xl border-2 border-navy px-4 pt-5 pb-4">
          <p className="absolute -top-3 left-4 rounded-full bg-navy px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
            Рекомендуем
          </p>
          <p className="text-sm font-bold">Премиум</p>
          <p className="mt-1 text-2xl font-black">
            899 ₽ <span className="text-xs font-semibold text-muted-foreground">/ рейс</span>
          </p>
          <ul className="mt-3 grow space-y-2 text-sm">
            <Benefit>Задержка от 1 часа — 5 000 ₽</Benefit>
            <Benefit>Отмена — 30 000 ₽ + гостиница и питание</Benefit>
            <Benefit>Потеря багажа — 10 000 ₽</Benefit>
          </ul>
          <Button
            onClick={() => handlePlan("premium")}
            className="mt-4 h-11 w-full rounded-2xl font-bold"
          >
            Оформить премиум
          </Button>
        </div>
      </div>
    </section>
  );
}

function Benefit({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}
