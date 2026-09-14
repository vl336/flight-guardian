import { ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { formatTime, STATUS_LABEL, STATUS_STYLES, terminalOf, type FoundFlight } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Everything here comes straight from the schedule API — nothing is inferred. */
export function FlightDetails({ flight }: { flight: FoundFlight }) {
  const terminal = terminalOf(flight.terminal);
  const shift = flight.shiftMinutes;
  const day = format(parseISO(flight.localDate), "d MMMM", { locale: ru });
  const lastSeen = format(parseISO(flight.lastSeenAtUtc), "d MMMM, HH:mm", { locale: ru });

  return (
    <div className="overflow-hidden rounded-3xl bg-card shadow-card">
      <div className="border-b border-border bg-navy p-5 text-primary-foreground">
        <p className="text-xs font-semibold tracking-widest text-primary-foreground/60 uppercase">
          {flight.carrier}
        </p>
        <h2 className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xl font-extrabold sm:text-2xl">
          <span className="truncate">{flight.number}</span>
          <span className="text-primary-foreground/40">·</span>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">{flight.airport}</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
            <span className="truncate">{flight.destination}</span>
          </span>
        </h2>
        <p className="mt-1 truncate text-sm text-primary-foreground/70">
          {flight.city} — {flight.destination} · {day}
        </p>
      </div>

      <div className="p-5">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Вылет по расписанию</p>
            <p className="text-3xl font-black tabular-nums">
              {formatTime(flight.scheduledLocalTime)}
            </p>
          </div>
          <span
            className={cn("rounded-full px-3 py-1 text-sm font-bold", STATUS_STYLES[flight.status])}
          >
            {STATUS_LABEL[flight.status]}
          </span>
        </div>

        {shift !== 0 ? (
          <p
            className={cn(
              "mt-4 rounded-2xl px-4 py-3 text-sm font-bold",
              shift > 0 ? "bg-danger-soft text-danger" : "bg-success-soft text-success",
            )}
          >
            {shift > 0 ? "Рейс сдвинули на " : "Рейс перенесли раньше на "}
            {Math.abs(shift)} мин — изначально в расписании стоял{" "}
            {formatTime(flight.firstLocalTime)}
          </p>
        ) : (
          <p className="mt-4 rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-muted-foreground">
            Время вылета не меняли с момента публикации расписания
          </p>
        )}

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <Fact label="Аэропорт вылета" value={flight.airport} />
          <Fact label="Терминал" value={terminal ?? "не указан"} />
          <Fact label="Тип воздушного судна" value={flight.aircraftType ?? "не указан"} />
          <Fact label="Последнее обновление" value={lastSeen} />
          <Fact
            label="Наблюдений в расписании"
            value={String(flight.observationCount)}
            hint="Сколько раз сервис видел этот рейс в опубликованном расписании"
          />
        </dl>
      </div>
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-bold">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
