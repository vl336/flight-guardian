import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, PlaneLanding, PlaneTakeoff, Search } from "lucide-react";
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

type Props = {
  onSearch: (params: SearchParams) => void;
  searching: boolean;
};

const today = toLocalDate(new Date());
const lastDate = toLocalDate(addDays(new Date(), SCHEDULE_WINDOW_DAYS));

export function SearchWidget({ onSearch, searching }: Props) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(today);

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

  const canSearch = from !== "" && to !== "" && date !== "" && !searching;

  return (
    <div className="rounded-3xl bg-card p-4 shadow-float sm:p-5">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSearch) onSearch({ from, to, date });
        }}
      >
        <CityCombobox
          value={from}
          onChange={setFrom}
          options={(cities.data ?? []).map((c) => ({
            value: c.city,
            hint: c.airports.join(" · "),
          }))}
          label="Город вылета"
          placeholder="Город вылета"
          emptyText="Город не найден"
          icon={PlaneTakeoff}
          loading={cities.isPending}
        />

        <CityCombobox
          value={to}
          onChange={setTo}
          options={(destinations.data ?? []).map((d) => ({
            value: d.title,
            hint: `${d.flightCount} рейс${plural(d.flightCount)}`,
          }))}
          label="Город прилёта"
          placeholder={from ? "Город прилёта" : "Сначала выберите вылет"}
          emptyText="На эту дату рейсов нет"
          icon={PlaneLanding}
          disabled={!from}
          loading={destinations.isFetching}
        />

        <div className="relative sm:col-span-2">
          <CalendarDays className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="date"
            value={date}
            min={today}
            max={lastDate}
            onChange={(event) => setDate(event.target.value)}
            aria-label="Дата вылета"
            className="h-14 rounded-2xl border-border bg-secondary/60 pl-9 text-base"
          />
        </div>

        <Button
          type="submit"
          disabled={!canSearch}
          className="h-14 rounded-2xl text-base font-bold sm:col-span-2"
        >
          <Search className="mr-1 h-5 w-5" />
          {searching ? "Ищем рейсы..." : "Найти рейсы"}
        </Button>
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
