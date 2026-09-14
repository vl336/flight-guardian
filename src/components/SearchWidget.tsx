import { useState } from "react";
import { Plane, Search, CalendarDays, PlaneTakeoff, PlaneLanding } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUGGESTIONS, CITIES } from "@/lib/flight-data";

type Props = {
  onSearch: (query: string) => void;
  loading: boolean;
};

const today = new Date().toISOString().slice(0, 10);

export function SearchWidget({ onSearch, loading }: Props) {
  const [query, setQuery] = useState("");
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = SUGGESTIONS.filter(
    (s) =>
      s.label.toLowerCase().includes(query.toLowerCase().trim()) ||
      s.airline.toLowerCase().includes(query.toLowerCase().trim()) ||
      s.route.toLowerCase().includes(query.toLowerCase().trim()),
  );

  const submit = (value?: string) => {
    setOpen(false);
    const flight = (value ?? query).trim();
    if (flight) {
      onSearch(flight);
      return;
    }
    if (from && to) {
      onSearch(`${from} ${to}`);
      return;
    }
    onSearch("");
  };

  return (
    <div className="rounded-3xl bg-card p-4 shadow-float sm:p-5">
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="relative">
          <PlaneTakeoff className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger
              aria-label="Аэропорт вылета"
              className="h-14 rounded-2xl border-border bg-secondary/60 pl-9 text-base"
            >
              <SelectValue placeholder="Аэропорт вылета" />
            </SelectTrigger>
            <SelectContent>
              {AIRPORTS.map((a) => (
                <SelectItem key={`from-${a.code}`} value={a.code}>
                  {a.city} · {a.name} ({a.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative">
          <PlaneLanding className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger
              aria-label="Аэропорт прилёта"
              className="h-14 rounded-2xl border-border bg-secondary/60 pl-9 text-base"
            >
              <SelectValue placeholder="Аэропорт прилёта" />
            </SelectTrigger>
            <SelectContent>
              {AIRPORTS.map((a) => (
                <SelectItem key={`to-${a.code}`} value={a.code}>
                  {a.city} · {a.name} ({a.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative">
          <Plane className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            placeholder="Номер рейса"
            aria-label="Номер рейса"
            className="h-14 rounded-2xl border-border bg-secondary/60 pl-9 text-base text-foreground"
          />
          {open && filtered.length > 0 && (
            <ul className="absolute top-16 z-20 w-full overflow-hidden rounded-2xl border border-border bg-popover shadow-float">
              {filtered.map((s) => (
                <li key={`${s.label}-${s.id}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setQuery(s.label);
                      submit(s.label);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <Plane className="h-4 w-4 text-sky" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {s.airline} · {s.label}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{s.route}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative">
          <CalendarDays className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Дата вылета"
            title="Дата вылета"
            className="h-14 rounded-2xl border-border bg-secondary/60 pl-9 text-base text-foreground"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-14 rounded-2xl text-base font-bold sm:col-span-2 lg:col-span-4"
        >
          <Search className="mr-1 h-5 w-5" />
          {loading ? "Анализируем..." : "Посмотреть аналитику рейса"}
        </Button>
      </form>
    </div>
  );
}
