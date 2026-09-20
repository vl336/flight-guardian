import { ChevronRight } from "lucide-react";
import {
  byCarrierThenTime,
  formatTime,
  STATUS_LABEL,
  STATUS_STYLES,
  terminalOf,
  type FoundFlight,
} from "@/lib/api";
import { AirlineLogo } from "@/components/AirlineLogo";
import { cn } from "@/lib/utils";

type Props = {
  route: string;
  result: { totalCount: number; items: FoundFlight[] };
  onSelect: (flight: FoundFlight) => void;
};

export function FlightResults({ route, result, onSelect }: Props) {
  if (result.items.length === 0) {
    return (
      <div className="rounded-3xl bg-card p-12 text-center shadow-card">
        <p className="font-semibold">По маршруту {route} на эту дату рейсов не нашлось</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Попробуйте другую дату или направление.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-card p-4 shadow-card sm:p-5">
      <p className="text-sm text-muted-foreground">
        Рейсы по маршруту {route} — найдено {result.totalCount}. Выберите рейс, чтобы увидеть
        детали.
      </p>
      {/* minmax(0,1fr) instead of the default auto track: grid items refuse to shrink
          below their content, so without it a long route pushes the row past the card
          and the truncate inside FlightRow never kicks in. */}
      <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3">
        {[...result.items].sort(byCarrierThenTime).map((flight) => (
          <li key={flight.id}>
            <FlightRow flight={flight} onSelect={onSelect} />
          </li>
        ))}
      </ul>
      {result.totalCount > result.items.length && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Показаны первые {result.items.length} рейсов из {result.totalCount}
        </p>
      )}
    </div>
  );
}

function FlightRow({
  flight,
  onSelect,
}: {
  flight: FoundFlight;
  onSelect: (flight: FoundFlight) => void;
}) {
  const terminal = terminalOf(flight.terminal);
  // shiftMinutes is how far the airline has moved the flight since it first
  // published it — the only delay signal the schedule actually carries.
  const shift = flight.shiftMinutes;

  return (
    <button
      type="button"
      onClick={() => onSelect(flight)}
      className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left transition-colors hover:bg-accent"
    >
      <AirlineLogo code={flight.carrierCode} name={flight.carrier} />
      <span className="min-w-0 flex-1">
        {/* The flight number is what identifies the row, so it never truncates —
            a long carrier name gives way instead. */}
        <span className="flex items-baseline gap-1 text-sm font-bold">
          <span className="truncate">{flight.carrier}</span>
          <span className="shrink-0">· {flight.number}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {formatTime(flight.scheduledLocalTime)} · {flight.airport}
          {terminal && `, терминал ${terminal}`} · {flight.city} → {flight.destination}
        </span>
      </span>
      {shift !== 0 && (
        <span
          className={cn("shrink-0 text-xs font-bold", shift > 0 ? "text-danger" : "text-success")}
        >
          {shift > 0 ? `+${shift}` : shift} мин
        </span>
      )}
      <span
        className={cn(
          "hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold sm:inline",
          STATUS_STYLES[flight.status],
        )}
      >
        {STATUS_LABEL[flight.status]}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}
