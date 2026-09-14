import { ArrowRight, SearchX } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import {
  formatTime,
  STATUS_LABEL,
  terminalOf,
  type FoundFlight,
  type SearchParams,
} from "@/lib/api";
import type { FlightDayStatus } from "@/lib/graphql-types";
import { cn } from "@/lib/utils";

const statusStyles: Record<FlightDayStatus, string> = {
  SCHEDULED: "bg-sky-soft text-accent-foreground",
  COMPLETED: "bg-success-soft text-success",
  REMOVED_FROM_SCHEDULE: "bg-danger-soft text-danger",
  REMOVED_LONG_BEFORE: "bg-danger-soft text-danger",
  UNKNOWN: "bg-secondary text-muted-foreground",
};

type Props = {
  params: SearchParams;
  result: { totalCount: number; items: FoundFlight[] };
};

export function FlightResults({ params, result }: Props) {
  const when = format(parseISO(params.date), "d MMMM", { locale: ru });

  if (result.items.length === 0) {
    return (
      <div className="grid place-items-center gap-3 rounded-3xl bg-card p-12 text-center shadow-card">
        <SearchX className="h-8 w-8 text-muted-foreground" />
        <p className="font-semibold">
          {params.from} — {params.to}: на {when} рейсов не нашлось
        </p>
        <p className="text-sm text-muted-foreground">Попробуйте другую дату или направление.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-card shadow-card">
      <div className="border-b border-border bg-navy p-5 text-primary-foreground">
        <h2 className="flex min-w-0 flex-wrap items-center gap-2 text-xl font-extrabold sm:text-2xl">
          <span className="truncate">{params.from}</span>
          <ArrowRight className="h-5 w-5 shrink-0" />
          <span className="truncate">{params.to}</span>
        </h2>
        <p className="mt-1 text-sm text-primary-foreground/70">
          {when} · найдено {result.totalCount} {result.totalCount === 1 ? "рейс" : "рейсов"}
        </p>
      </div>

      <ul className="divide-y divide-border">
        {result.items.map((flight) => (
          <FlightRow key={flight.id} flight={flight} />
        ))}
      </ul>

      {result.totalCount > result.items.length && (
        <p className="border-t border-border px-5 py-3 text-center text-xs text-muted-foreground">
          Показаны первые {result.items.length} рейсов из {result.totalCount}
        </p>
      )}
    </div>
  );
}

function FlightRow({ flight }: { flight: FoundFlight }) {
  const terminal = terminalOf(flight.terminal);
  // shiftMinutes is how far the airline has moved the flight since it first
  // published it — the only delay signal the schedule actually carries.
  const shift = flight.shiftMinutes;

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 p-4 sm:gap-5 sm:p-5">
      <div className="w-16 shrink-0 text-right sm:w-20">
        <p className="text-xl font-extrabold tabular-nums sm:text-2xl">
          {formatTime(flight.scheduledLocalTime)}
        </p>
        {shift !== 0 && (
          <p className={cn("text-xs font-bold", shift > 0 ? "text-danger" : "text-success")}>
            {shift > 0 ? `+${shift}` : shift} мин
          </p>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-bold">{flight.number}</span>
          <span className="min-w-0 truncate text-sm text-muted-foreground">{flight.carrier}</span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold",
              statusStyles[flight.status],
            )}
          >
            {STATUS_LABEL[flight.status]}
          </span>
        </div>

        <p className="mt-1 truncate text-sm text-muted-foreground">
          {flight.airport}
          {terminal && ` · терминал ${terminal}`} → {flight.destination}
        </p>

        {shift !== 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            В расписании изначально {formatTime(flight.firstLocalTime)}
          </p>
        )}
      </div>
    </li>
  );
}
