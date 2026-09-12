import { useState } from "react";
import { Plane, Search, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SUGGESTIONS } from "@/lib/flight-data";

type Props = {
  onSearch: (query: string) => void;
  loading: boolean;
};

const today = new Date().toISOString().slice(0, 10);

export function SearchWidget({ onSearch, loading }: Props) {
  const [query, setQuery] = useState("");
  const [date, setDate] = useState(today);
  const [open, setOpen] = useState(false);

  const filtered = SUGGESTIONS.filter((s) =>
    s.label.toLowerCase().includes(query.toLowerCase().trim()),
  );

  const submit = (value?: string) => {
    setOpen(false);
    onSearch(value ?? query);
  };

  return (
    <div className="rounded-3xl bg-card p-4 shadow-float sm:p-5">
      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
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
            placeholder="Номер рейса или маршрут"
            aria-label="Номер рейса или маршрут"
            className="h-14 rounded-2xl border-border bg-secondary/60 pl-9 text-base"
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
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                  >
                    <span className="min-w-0 truncate text-sm font-semibold">{s.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{s.hint}</span>
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
            aria-label="Дата рейса"
            className="h-14 rounded-2xl border-border bg-secondary/60 pl-9 text-base"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-14 rounded-2xl text-base font-bold sm:col-span-2"
        >
          <Search className="mr-1 h-5 w-5" />
          {loading ? "Анализируем..." : "Посмотреть аналитику рейса"}
        </Button>
      </form>
    </div>
  );
}
