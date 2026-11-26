import { useEffect, useRef, useState } from "react";
import {
  CalendarCheck,
  Check,
  CreditCard,
  Info,
  QrCode,
  Radar,
  ShieldCheck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { reachGoal } from "@/lib/analytics";
import type { RiskLevel } from "@/lib/flight-data";
import { cn } from "@/lib/utils";

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
  const [leadOpen, setLeadOpen] = useState(false);

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
    setLeadOpen(true);
  };

  const handleHow = () => {
    reachGoal("insurance_how_click", {
      flight: flightNumber,
      risk_level: riskLevel,
      risk_probability: riskProbability,
    });
    setHowOpen(true);
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
            Если рейс задержат, компенсации придут сами — без заявлений и справок. Оформляется на
            рейс {flightNumber}.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-border p-4 sm:p-5">
        <p className="text-2xl font-black">
          599&nbsp;₽ <span className="text-xs font-semibold text-muted-foreground">/ рейс</span>
        </p>
        <ul className="mt-3 space-y-3 text-sm">
          <Benefit
            criterion="От 30 минут"
            perk={"Ваучер на еду, 500\u00A0₽"}
            tooltip={
              "Ваучер на 500\u00A0₽ появится в личном кабинете и будет доступен целый год. Потратить его можно в кафе или магазине любого аэропорта России — не обязательно в этой поездке."
            }
          />
          <Benefit
            criterion="От 1,5 часа"
            perk={"Возврат 599\u00A0₽ за страховку"}
            tooltip={
              "Если рейс задержат, мы вернём на карту все 599\u00A0₽, которые вы заплатили. Без заявлений и ожиданий."
            }
          />
          <Benefit
            criterion="От 2,5 часа"
            perk="QR-код в бизнес-зал"
            tooltip="QR-код появится в личном кабинете и будет действовать год. Покажите его на входе в бизнес-зал — в этой поездке или в любой следующей."
          />
        </ul>
        <Button
          variant="outline"
          onClick={handleHow}
          className="mt-4 h-11 w-full rounded-2xl font-bold"
        >
          Как это работает
        </Button>
        <Button onClick={handlePlan} className="mt-2 h-11 w-full rounded-2xl font-bold">
          Оформить страховку
        </Button>
      </div>

      <HowItWorks open={howOpen} onOpenChange={setHowOpen} flightNumber={flightNumber} />
      <InsuranceLeadModal
        open={leadOpen}
        onOpenChange={setLeadOpen}
        flightNumber={flightNumber}
        riskLevel={riskLevel}
        riskProbability={riskProbability}
      />
    </section>
  );
}

const HOW_PROCESS = [
  {
    icon: CalendarCheck,
    title: "Оформляете на рейс",
    text: "Страховка привязывается к номеру рейса и дате вылета.",
  },
  {
    icon: Radar,
    title: "Следим за задержкой сами",
    text: "Заявления и обращения в поддержку не понадобятся: если рейс задержат, мы всё оформим сами и уведомим вас.",
  },
];

const HOW_PAYOUTS = [
  {
    icon: UtensilsCrossed,
    threshold: "от 30 минут",
    title: "Ваучер на еду",
    text: "В личном кабинете появится ваучер на 500\u00A0₽. Он действует год — потратить его можно в кафе или магазине любого аэропорта России.",
  },
  {
    icon: CreditCard,
    threshold: "от 1,5 часа",
    title: "Возврат за страховку",
    text: "На карту моментально вернутся 599\u00A0₽ — полная стоимость страховки.",
  },
  {
    icon: QrCode,
    threshold: "от 2,5 часа",
    title: "Бизнес-зал",
    text: "В личном кабинете можно получить QR-код на бизнес-зал. Он действует год — покажите его на входе в бизнес-зал любого аэропорта России.",
  },
];

type HowItWorksProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flightNumber: string;
};

/**
 * Попап «Как это работает»: сверху компактный hero с фирменным градиентом,
 * внутри — таймлайн (два шага подготовки и три выплаты по порогам задержки),
 * снизу — итоговая цена и кнопка. Dialog от Radix даёт Esc, фокус-ловушку
 * и блокировку прокрутки страницы под окном.
 */
function HowItWorks({ open, onOpenChange, flightNumber }: HowItWorksProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* text-primary-foreground — цвет по умолчанию для hero; встроенный
          крестик DialogContent прячем и рисуем свой на градиенте. */}
      <DialogContent className="flex max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-3xl p-0 text-primary-foreground sm:rounded-3xl [&>button]:hidden">
        <div className="relative overflow-hidden bg-hero px-6 pt-7 pb-6">
          <span
            aria-hidden
            className="absolute -top-14 -right-10 h-40 w-40 rounded-full bg-primary-foreground/15 blur-2xl"
          />
          <span
            aria-hidden
            className="absolute -bottom-16 -left-12 h-32 w-32 rounded-full bg-sky/50 blur-2xl"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Закрыть"
            className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-2xl bg-primary-foreground/10 ring-1 ring-primary-foreground/15 transition-colors hover:bg-primary-foreground/20"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-foreground/15 ring-1 ring-primary-foreground/20">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <DialogTitle className="mt-4 pr-8 text-2xl leading-tight font-black">
            Как работает страховка
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-primary-foreground/75">
            Страховка оформляется на рейс {flightNumber}. Дальше всё происходит автоматически.
          </DialogDescription>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 text-foreground">
          <div className="relative">
            {/* Линия таймлайна проходит за иконками: к выплатам становится
                заметнее — чем дольше задержка, тем ценнее компенсация. */}
            <span
              aria-hidden
              className="absolute top-4 bottom-4 left-[21px] w-0.5 rounded-full bg-gradient-to-b from-border via-sky/30 to-sky/60"
            />
            <ol className="space-y-5">
              {HOW_PROCESS.map((step, i) => (
                <li
                  key={step.title}
                  className="flex animate-in items-start gap-3.5 fade-in slide-in-from-bottom-2 [animation-fill-mode:both]"
                  style={{ animationDelay: `${(i + 1) * 70}ms` }}
                >
                  <span className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-secondary">
                    <step.icon className="h-5 w-5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[15px] font-bold">{step.title}</p>
                    <p className="mt-1 text-sm leading-snug text-muted-foreground">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="pt-6 pb-1 pl-[58px] text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Что вы получите
            </p>
            <ol className="space-y-5">
              {HOW_PAYOUTS.map((step, i) => (
                <li
                  key={step.title}
                  className="flex animate-in items-start gap-3.5 fade-in slide-in-from-bottom-2 [animation-fill-mode:both]"
                  style={{ animationDelay: `${(i + 3) * 70}ms` }}
                >
                  <span className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-soft ring-1 ring-sky/20">
                    <step.icon className="h-5 w-5 text-accent-foreground" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[15px] font-bold">
                      {step.title}
                      <span className="ml-2 inline-flex rounded-full bg-sky-soft px-2 py-0.5 align-middle text-[11px] font-bold text-accent-foreground">
                        {step.threshold}
                      </span>
                    </p>
                    <p className="mt-1 text-sm leading-snug text-muted-foreground">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-border bg-secondary/40 px-6 py-4 text-foreground">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Всё это за
            </p>
            <p className="text-lg leading-tight font-black">
              599&nbsp;₽ <span className="text-xs font-semibold text-muted-foreground">/ рейс</span>
            </p>
          </div>
          <Button
            onClick={() => onOpenChange(false)}
            className="h-12 shrink-0 rounded-2xl px-8 font-bold"
          >
            Понятно
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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

type LeadModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flightNumber: string;
  riskLevel: RiskLevel;
  riskProbability: number;
};

/**
 * Окно предзаказа со спецценой 349 ₽: собирает реальный интерес (Telegram/Email)
 * и отправляет контакт сразу в Яндекс.Метрику и VK пиксель как параметр цели.
 */
function InsuranceLeadModal({
  open,
  onOpenChange,
  flightNumber,
  riskLevel,
  riskProbability,
}: LeadModalProps) {
  const [channel, setChannel] = useState<"telegram" | "email">("telegram");
  const [contact, setContact] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = contact.trim();
    if (channel === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(clean)) {
        setError("Введите корректный email (например name@example.com)");
        return;
      }
    } else {
      if (clean.length < 3) {
        setError("Укажите @username или телефон в Telegram");
        return;
      }
    }

    reachGoal("insurance_lead_submit", {
      flight: flightNumber,
      contact: clean,
      channel,
      risk_level: riskLevel,
      risk_probability: riskProbability,
    });
    setSubmitted(true);
    setError("");
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setSubmitted(false);
      setContact("");
      setError("");
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-3xl p-6 sm:p-7">
        {!submitted ? (
          <div>
            <DialogHeader className="text-left">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-soft text-accent-foreground">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  Рейс {flightNumber}
                </span>
              </div>
              <DialogTitle className="mt-3 text-xl font-extrabold sm:text-2xl">
                Предзаказ страховки
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                Оформление полисов на этот рейс запустится в ближайшие дни. Зафиксируйте спеццену до
                старта продаж.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 rounded-2xl border border-sky/30 bg-sky-soft p-4 text-accent-foreground">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold">Спеццена по предзаказу:</span>
                <span className="text-xl font-black">
                  349&nbsp;₽{" "}
                  <span className="text-xs font-semibold text-muted-foreground line-through">
                    599&nbsp;₽
                  </span>
                </span>
              </div>
              <p className="mt-1 text-xs text-accent-foreground/80">
                Скидка закрепится за вами. Оплата только при фактическом оформлении полиса.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <div className="flex gap-2 rounded-2xl bg-secondary/80 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setChannel("telegram");
                    setError("");
                  }}
                  className={cn(
                    "flex-1 rounded-xl py-2 text-xs font-bold transition-all",
                    channel === "telegram"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Telegram
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChannel("email");
                    setError("");
                  }}
                  className={cn(
                    "flex-1 rounded-xl py-2 text-xs font-bold transition-all",
                    channel === "email"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Email
                </button>
              </div>

              <div>
                <Input
                  value={contact}
                  onChange={(e) => {
                    setContact(e.target.value);
                    if (error) setError("");
                  }}
                  type={channel === "email" ? "email" : "text"}
                  placeholder={
                    channel === "telegram" ? "@username или телефон" : "name@example.com"
                  }
                  autoFocus
                  className="h-12 rounded-2xl border-border bg-secondary/40 px-3.5 text-base"
                />
                {error && <p className="mt-1.5 text-xs font-semibold text-danger">{error}</p>}
              </div>

              <Button type="submit" className="h-12 w-full rounded-2xl text-base font-bold">
                Зафиксировать цену 349&nbsp;₽
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Пришлём ссылку на оформление со скидкой, как только откроем доступ. Без спама.
              </p>
            </form>
          </div>
        ) : (
          <div className="py-2 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-success-soft text-success">
              <Check className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-xl font-black">Спеццена 349&nbsp;₽ зафиксирована!</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Мы привязали скидку к рейсу <strong>{flightNumber}</strong>. Как только откроется
              оформление, персональная ссылка со скидкой придёт{" "}
              {channel === "telegram" ? "вам в Telegram" : "на вашу почту"}.
            </p>
            <Button
              onClick={handleClose}
              className="mt-6 h-12 w-full rounded-2xl text-base font-bold"
            >
              Понятно
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
