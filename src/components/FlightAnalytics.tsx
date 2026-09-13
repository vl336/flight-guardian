import { useState } from "react";
import {
  ArrowRight,
  ShieldCheck,
  TriangleAlert,
  Flame,
  ChevronDown,
  Clock,
  CalendarClock,
  Send,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RISK_LABEL, type Flight, type RiskLevel } from "@/lib/flight-data";

const riskStyles: Record<
  RiskLevel,
  { box: string; text: string; bar: string; icon: typeof ShieldCheck }
> = {
  LOW: {
    box: "bg-success-soft border-success/30",
    text: "text-success",
    bar: "bg-success",
    icon: ShieldCheck,
  },
  HIGH: {
    box: "bg-warning-soft border-warning/40",
    text: "text-warning",
    bar: "bg-warning",
    icon: TriangleAlert,
  },
  CRITICAL: {
    box: "bg-danger-soft border-danger/40",
    text: "text-danger",
    bar: "bg-danger",
    icon: Flame,
  },
};

const dotColor = { low: "bg-sky", medium: "bg-warning", high: "bg-danger" } as const;

function Bar({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-bold">{value}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full ${className}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function FlightAnalytics({ flight }: { flight: Flight }) {
  const [openFactors, setOpenFactors] = useState(true);
  const risk = riskStyles[flight.risk.level];
  const RiskIcon = risk.icon;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl bg-card shadow-card">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-navy p-5 text-primary-foreground sm:flex sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-widest text-primary-foreground/60 uppercase">
              {flight.airline}
            </p>
            <h2 className="mt-1 flex min-w-0 items-center gap-2 text-xl font-extrabold sm:text-2xl">
              <span className="truncate">{flight.flightNumber}</span>
              <span className="hidden text-primary-foreground/40 sm:inline">·</span>
              <span className="hidden items-center gap-1.5 sm:flex">
                {flight.from.code} <ArrowRight className="h-4 w-4" /> {flight.to.code}
              </span>
            </h2>
            <p className="mt-1 truncate text-sm text-primary-foreground/70">
              {flight.from.city} — {flight.to.city}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-primary-foreground/60">По расписанию</p>
            <p className="text-2xl font-extrabold">{flight.departure}</p>
            <p className="text-xs text-primary-foreground/60">прилёт {flight.arrival}</p>
          </div>
        </div>

        <div className="p-5">
          <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Историческая надёжность · 30 дней
          </h3>
          <div className="mt-4 grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <div className="flex items-center gap-4 rounded-2xl bg-sky-soft p-4 sm:w-56 sm:flex-col sm:text-center">
              <p className="text-4xl font-black text-accent-foreground">
                {flight.history.score.toFixed(1)}
                <span className="text-lg font-bold opacity-50"> / 10</span>
              </p>
              <div className="min-w-0">
                <p className="text-sm font-bold text-accent-foreground">
                  {flight.history.onTimeRate}% вовремя
                </p>
                <p className="text-xs text-accent-foreground/70">
                  средняя задержка {flight.history.avgDelay} мин
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <Bar label="Вовремя" value={flight.history.distribution.onTime} className="bg-success" />
              <Bar
                label="Задержка 15–60 мин"
                value={flight.history.distribution.medium}
                className="bg-warning"
              />
              <Bar
                label="Более 60 мин или отмена"
                value={flight.history.distribution.severe}
                className="bg-danger"
              />
            </div>
          </div>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-warning-soft px-3 py-1.5 text-sm font-semibold text-warning">
            <CalendarClock className="h-4 w-4 shrink-0" />
            {flight.history.worstDay} — самый частый день задержек
          </p>
        </div>
      </div>

      <div className={`rounded-3xl border ${risk.box} p-5 shadow-card`}>
        <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          Прогноз риска в реальном времени
        </h3>
        <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
          <RiskIcon className={`h-10 w-10 shrink-0 ${risk.text}`} />
          <div className="min-w-0">
            <p className="text-2xl font-black sm:text-3xl">
              Риск задержки сегодня: <span className={risk.text}>{flight.risk.probability}%</span>
            </p>
            <p className={`text-sm font-bold ${risk.text}`}>
              {RISK_LABEL[flight.risk.level]} ({flight.risk.level})
            </p>
          </div>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-card">
          <div
            className={`h-full rounded-full ${risk.bar}`}
            style={{ width: `${flight.risk.probability}%` }}
          />
        </div>
        <p className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-card px-3 py-2 text-sm font-bold">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />+{flight.risk.delayFrom}...
          {flight.risk.delayTo} минут от расписания
        </p>

        <button
          type="button"
          onClick={() => setOpenFactors((v: boolean) => !v)}
          className="mt-5 flex w-full items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 text-left font-bold"
          aria-expanded={openFactors}
        >
          Факторы риска ({flight.risk.factors.length})
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${openFactors ? "rotate-180" : ""}`}
          />
        </button>
        {openFactors && (
          <ul className="mt-2 space-y-2">
            {flight.risk.factors.map((f) => (
              <li
                key={f.text}
                className="flex items-start gap-3 rounded-2xl bg-card px-4 py-3 text-sm"
              >
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotColor[f.severity]}`} />
                <span className="min-w-0">{f.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-3xl bg-hero p-5 text-primary-foreground shadow-card sm:p-6">
        <h3 className="text-xl font-extrabold">
          Хотите следить за изменением риска по этому рейсу?
        </h3>
        <p className="mt-2 text-sm text-primary-foreground/75">
          Подписка на уведомления в Telegram или на email скоро появится.
        </p>
        <div className="mt-4 inline-flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-sm font-bold text-primary-foreground/80 sm:w-auto">
          <Clock className="h-4 w-4 shrink-0" />
          Функция в разработке
        </div>
      </div>
    </div>
  );
}
