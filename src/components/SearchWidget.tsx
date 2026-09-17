import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, CalendarDays, PlaneTakeoff, PlaneLanding } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CityCombobox } from "@/components/CityCombobox";
import {
  addDays,
  fetchDepartureCities,
  fetchDestinations,
  SCHEDULE_WINDOW_DAYS,
  toLocalDate,
  type SearchParams,
} from "@/lib/api";
import { reachGoal } from "@/lib/metrika";

type Props = {
  onSearch: (params: SearchParams) => void;
  loading: boolean;
};

const today = toLocalDate(new Date());
const lastDate = toLocalDate(addDays(new Date(), SCHEDULE_WINDOW_DAYS));

export function SearchWidget({ onSearch, loading }: Props) {
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const cities = useQuery({
    queryKey: ["departure-cities"],
    queryFn: fetchDepartureCities,
    staleTime: 60 * 60 * 1000,
  });

  const destinations = useQuery({
    queryKey: ["destinations", from, date],
    queryFn: () => fetchDestinations(from, date),
    enabled: from !== "" && date !== "",
    staleTime: 5 * 60 * 1000,
  });

  // Destinations are specific to the departure city and date, so a previously
  // picked arrival city can silently stop being reachable. Drop it when it is
  // no longer on the list instead of searching for a route that has no flights.
  const available = destinations.data;
  useEffect(() => {
    if (to && available && !available.some((d) => d.title === to)) setTo("");
  }, [available, to]);

  const ready = Boolean(from && to && date && from !== to);

  // Насколько заранее ищут — самый полезный разрез по поиску: за сегодня
  // и за неделю это разные сценарии.
  const daysAhead = Math.round(
    (new Date(`${date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000,
  );

  const selectCity = (field: "from" | "to", city: string) => {
    (field === "from" ? setFrom : setTo)(city);
    reachGoal("city_select", { field, city });
  };

  return (
    <div className="rounded-3xl bg-card p-4 shadow-float sm:p-5">
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready || loading) return;
          reachGoal("search_submit", { from, to, date, days_ahead: daysAhead });
          onSearch({ from, to, date });
        }}
      >
        <CityCombobox
          value={from}
          onChange={(city) => selectCity("from", city)}
          options={(cities.data ?? []).map((c) => ({
            value: c.city,
            hint: c.airports.join(" · "),
          }))}
          label="Город отправления"
          placeholder="Город отправления"
          emptyText="Город не найден"
          icon={PlaneTakeoff}
          loading={cities.isPending}
        />

        <CityCombobox
          value={to}
          onChange={(city) => selectCity("to", city)}
          options={(destinations.data ?? []).map((d) => ({
            value: d.title,
            hint: `${d.flightCount} рейс${plural(d.flightCount)}`,
          }))}
          label="Город прибытия"
          placeholder={from ? "Город прибытия" : "Сначала выберите отправление"}
          emptyText="На эту дату рейсов нет"
          icon={PlaneLanding}
          disabled={!from}
          loading={destinations.isFetching}
        />

        <div className="relative">
          <CalendarDays className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="date"
            value={date}
            min={today}
            max={lastDate}
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

      {cities.isError && (
        <p className="mt-3 text-sm font-semibold text-danger">
          Не удалось загрузить список городов. Обновите страницу.
        </p>
      )}
    </div>
  );
}

function plural(count: number) {
  const tens = count % 100;
  const ones = count % 10;
  if (tens > 10 && tens < 20) return "ов";
  if (ones === 1) return "";
  if (ones > 1 && ones < 5) return "а";
  return "ов";
}
