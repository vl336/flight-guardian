import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, CalendarDays, PlaneTakeoff, PlaneLanding } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CityCombobox } from "@/components/CityCombobox";
import {
  fetchDepartureCities,
  fetchDestinationDays,
  formatDay,
  nearestFlightDay,
  toLocalDate,
  windowEnd,
  type SearchParams,
} from "@/lib/api";
import { reachGoal } from "@/lib/analytics";

type Props = {
  onSearch: (params: SearchParams) => void;
  loading: boolean;
};

const today = toLocalDate(new Date());

export function SearchWidget({ onSearch, loading }: Props) {
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const cities = useQuery({
    queryKey: ["departure-cities"],
    queryFn: fetchDepartureCities,
    staleTime: 60 * 60 * 1000,
  });

  // Список «куда» строится не на одну дату, а на окно в неделю: города, в которые
  // сегодня не летают, но летают завтра, остаются в списке и не пропадают при смене
  // даты. Окно двигается, только когда выбрали дату вне него, — сдвиг даты внутри
  // окна (см. selectCity) не вызывает нового запроса.
  const [windowStart, setWindowStart] = useState(today);
  const destinations = useQuery({
    queryKey: ["destination-days", from, windowStart],
    queryFn: () => fetchDestinationDays(from, windowStart, windowEnd(windowStart)),
    enabled: from !== "",
    staleTime: 5 * 60 * 1000,
  });

  // Дата до того, как её сдвинули за пользователя при выборе города, — чтобы дать вернуть.
  const [shiftedFrom, setShiftedFrom] = useState<string | null>(null);

  const daysByCity = useMemo(
    () => new Map((destinations.data ?? []).map((d) => [d.title, d.days])),
    [destinations.data],
  );
  const loaded = destinations.data !== undefined;
  const toDays = to ? daysByCity.get(to) : undefined;
  const flownOnDate = Boolean(toDays?.some((day) => day.date === date));

  const ready = Boolean(from && to && date && from !== to && flownOnDate);

  const changeDate = (next: string) => {
    setDate(next);
    setShiftedFrom(null);
    if (next && (next < windowStart || next > windowEnd(windowStart))) setWindowStart(next);
  };

  // Города, в которые летают в выбранный день, идут первыми с числом рейсов;
  // остальные — отдельной приглушённой группой, с ближайшим днём вместо числа.
  const options = (destinations.data ?? []).map((d) => {
    const count = d.days.find((day) => day.date === date)?.flightCount;
    if (count) return { value: d.title, hint: `${count} рейс${plural(count)}` };
    const nearest = nearestFlightDay(
      d.days.map((day) => day.date),
      date,
    );
    return { value: d.title, hint: nearest ? formatDay(nearest, true) : "", muted: true };
  });

  // Насколько заранее ищут — самый полезный разрез по поиску: за сегодня
  // и за неделю это разные сценарии.
  const daysAhead = Math.round(
    (new Date(`${date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000,
  );

  const selectCity = (field: "from" | "to", city: string) => {
    let dateShifted = false;
    if (field === "from") {
      setFrom(city);
      setShiftedFrom(null);
    } else {
      setTo(city);
      // Города, в который в этот день не летают, не отказываем, а сдвигаем дату
      // на ближайший день с рейсом: человек выбрал, куда лететь, дата вторична.
      const next = nearestFlightDay(
        (daysByCity.get(city) ?? []).map((day) => day.date),
        date,
      );
      dateShifted = Boolean(next && next !== date);
      setShiftedFrom(dateShifted ? date : null);
      if (next && dateShifted) setDate(next);
    }
    reachGoal("city_select", { field, city, date_shifted: dateShifted });
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
          options={options}
          mutedHeading="В другие дни"
          label="Город прибытия"
          placeholder={from ? "Город прибытия" : "Сначала выберите отправление"}
          emptyText="Таких направлений нет"
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
            onChange={(e) => changeDate(e.target.value)}
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

        {shiftedFrom && (
          <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            {from} → {to}: {formatDay(shiftedFrom)} рейсов нет, поставили {formatDay(date)}.{" "}
            <button
              type="button"
              onClick={() => {
                setDate(shiftedFrom);
                setShiftedFrom(null);
              }}
              className="font-semibold text-foreground underline underline-offset-2"
            >
              Вернуть дату
            </button>
          </p>
        )}

        {loaded && from && to && from !== to && !flownOnDate && !shiftedFrom && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            {toDays?.length ? (
              <>
                <span>
                  {from} → {to}: {formatDay(date)} рейсов нет. Летают:
                </span>
                {toDays.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => changeDate(day.date)}
                    className="rounded-full bg-secondary px-3 py-1 font-semibold text-foreground hover:bg-secondary/70"
                  >
                    {formatDay(day.date, true)}
                  </button>
                ))}
              </>
            ) : (
              <span>
                {from} → {to}: с {formatDay(windowStart)} по {formatDay(windowEnd(windowStart))}{" "}
                рейсов нет.
              </span>
            )}
          </div>
        )}

        {from && to && from === to && (
          <p className="text-sm text-destructive sm:col-span-2 lg:col-span-3">
            Города отправления и прибытия должны различаться.
          </p>
        )}
      </form>

      {destinations.isError && (
        <p className="mt-3 text-sm font-semibold text-danger">
          Не удалось загрузить направления. Выберите город отправления ещё раз.
        </p>
      )}

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
