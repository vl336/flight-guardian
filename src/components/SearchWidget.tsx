import { useState } from "react";
import { Search, CalendarDays, PlaneTakeoff, PlaneLanding } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CITIES } from "@/lib/flight-data";

type Props = {
  onSearch: (params: { from: string; to: string; date: string }) => void;
  loading: boolean;
};

const today = new Date().toISOString().slice(0, 10);

export function SearchWidget({ onSearch, loading }: Props) {
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const ready = Boolean(from && to && date && from !== to);

  return (
    <div className="rounded-3xl bg-card p-4 shadow-float sm:p-5">
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onSearch({ from, to, date });
        }}
      >
        <div className="relative">
          <PlaneTakeoff className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger
              aria-label="Город отправления"
              className="h-14 rounded-2xl border-border bg-secondary/60 pl-9 text-base"
            >
              <SelectValue placeholder="Город отправления" />
            </SelectTrigger>
            <SelectContent>
              {CITIES.map((city) => (
                <SelectItem key={`from-${city}`} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative">
          <PlaneLanding className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger
              aria-label="Город прибытия"
              className="h-14 rounded-2xl border-border bg-secondary/60 pl-9 text-base"
            >
              <SelectValue placeholder="Город прибытия" />
            </SelectTrigger>
            <SelectContent>
              {CITIES.map((city) => (
                <SelectItem key={`to-${city}`} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          disabled={loading || !ready}
          className="h-14 rounded-2xl text-base font-bold sm:col-span-2 lg:col-span-3"
        >
          <Search className="mr-1 h-5 w-5" />
          {loading ? "Ищем рейсы..." : "Найти рейсы"}
        </Button>

        {from && to && from === to && (
          <p className="text-sm text-destructive sm:col-span-2 lg:col-span-3">
            Города отправления и прибытия должны различаться.
          </p>
        )}
      </form>
    </div>
  );
}
