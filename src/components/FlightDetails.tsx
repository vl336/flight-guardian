import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { formatTime, STATUS_LABEL, STATUS_STYLES, terminalOf, type FoundFlight } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Everything here comes straight from the schedule API — nothing is inferred.
 * The flight's identity is already in the analytics card above, so this one
 * starts at the facts rather than repeating the header.
 */
export function FlightDetails({ flight }: { flight: FoundFlight }) {
  const terminal = terminalOf(flight.terminal);
  const shift = flight.shiftMinutes;
  const day = format(parseISO(flight.localDate), "d MMMM", { locale: ru });
  const lastSeen = format(parseISO(flight.lastSeenAtUtc), "d MMMM, HH:mm", { locale: ru });

  return (
    <div className="rounded-3xl bg-card p-5 shadow-card">
      <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
        Данные расписания · {day}
      </h3>

      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
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
          {Math.abs(shift)} мин — изначально в расписании стоял {formatTime(flight.firstLocalTime)}
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
