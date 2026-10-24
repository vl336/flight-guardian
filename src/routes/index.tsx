import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plane, Loader2, ArrowLeft, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchWidget } from "@/components/SearchWidget";
import { StartScreen, STARTED_KEY } from "@/components/StartScreen";
import { FlightResults } from "@/components/FlightResults";
import { FlightAnalytics } from "@/components/FlightAnalytics";
import { CityOverview } from "@/components/CityOverview";
import { toAnalyticsFlight } from "@/lib/flight-data";
import {
  fetchFlights,
  STATUS_LABEL,
  toLocalDate,
  type FoundFlight,
  type SearchParams,
} from "@/lib/api";
import { reachGoal, type SearchSource } from "@/lib/analytics";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Airrisk" },
      {
        name: "description",
        content:
          "Проверьте риск задержки или отмены рейса: историческая пунктуальность, цепочки бортов и метеоусловия до официального табло.",
      },
      { property: "og:title", content: "Airrisk — риск задержки вашего рейса" },
      {
        property: "og:description",
        content: "Аналитика пунктуальности авиарейсов и прогноз риска задержки в реальном времени.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const today = toLocalDate(new Date());
const todayLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(
  new Date(),
);

/** С чего открыть форму поиска: город из плашки и, если нажали направление, город прибытия. */
type SearchSeed = { from: string; to?: string | undefined; key: number };

function Index() {
  // Заставку показываем один раз за сессию. На сервере sessionStorage нет,
  // поэтому до гидрации она всегда в разметке, а уже начатую сессию узнаём
  // в эффекте.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(STARTED_KEY)) setStarted(true);
    } catch {
      // Приватный режим или запрещённое хранилище — просто покажем заставку.
    }
  }, []);

  // Set only when the user submits the form, so nothing is fetched before that.
  const [params, setParams] = useState<SearchParams | null>(null);
  const [flight, setFlight] = useState<FoundFlight | null>(null);

  const flights = useQuery({
    queryKey: ["flights", params],
    queryFn: () => fetchFlights(params!),
    enabled: params !== null,
    staleTime: 60 * 1000,
  });

  const loading = params !== null && flights.isFetching;
  const route = params ? `${params.from} → ${params.to}` : "";

  // Откуда начат текущий поиск — уходит в цели выдачи и рейса вслед за search_submit.
  const [searchSource, setSearchSource] = useState<SearchSource>("form");
  // Пришли ли к форме из плашки города: тогда её отправка — city_form, а не form.
  const [fromCity, setFromCity] = useState(false);

  const handleSearch = (next: SearchParams, source: SearchSource) => {
    setFlight(null);
    setSearchSource(source);
    setParams(next);
  };

  // Форма поиска под плашками видна всегда. Плашка города только подставляет в
  // неё значения и прокручивает к ней — key 0 значит, что этого ещё не было.
  const [seed, setSeed] = useState<SearchSeed>({ from: "", key: 0 });
  const searchRef = useRef<HTMLElement>(null);

  const openSearch = (from: string, to?: string) => {
    setSeed((prev) => ({ from, to, key: prev.key + 1 }));
    setFromCity(true);
    if (to) {
      // Форму тут не отправляют, поэтому search_submit шлём сами — иначе
      // воронка от поиска к рейсу теряла бы всех, кто пришёл через направление.
      reachGoal("search_submit", { from, to, date: today, days_ahead: 0, source: "direction" });
      handleSearch({ from, to, date: today }, "direction");
    } else {
      setFlight(null);
      setParams(null);
    }
  };

  const handleFindFlight = (city: string) => {
    reachGoal("city_find_flight", { city });
    openSearch(city);
  };

  const handleDirection = (city: string, destination: string) => {
    reachGoal("direction_click", { city, destination, route: `${city} → ${destination}` });
    openSearch(city, destination);
  };

  useEffect(() => {
    const node = searchRef.current;
    if (!node || seed.key === 0) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [seed]);

  const handleSelect = (next: FoundFlight) => {
    reachGoal("flight_open", {
      carrier: next.carrier,
      number: next.number,
      status: STATUS_LABEL[next.status],
      shift_minutes: next.shiftMinutes,
      source: searchSource,
    });
    setFlight(next);
  };

  const handleRetry = () => {
    reachGoal("search_retry", { route });
    flights.refetch();
  };

  // Исход поиска — отдельная цель от search_submit: до неё доходят не все.
  // Ключ включает отметки времени ответа, иначе цель ушла бы повторно на
  // каждый ререндер, но не ушла бы на повторный поиск того же маршрута.
  const reportedResult = useRef("");
  useEffect(() => {
    if (params === null || flights.isFetching) return;
    const key = `${params.from}|${params.to}|${params.date}|${flights.dataUpdatedAt}|${flights.errorUpdatedAt}`;
    if (reportedResult.current === key) return;
    reportedResult.current = key;

    if (flights.isError) {
      reachGoal("search_result", {
        result: "error",
        route,
        message: flights.error.message,
        source: searchSource,
      });
    } else if (flights.data) {
      reachGoal("search_result", {
        result: flights.data.items.length > 0 ? "ok" : "empty",
        route,
        count: flights.data.totalCount,
        source: searchSource,
      });
    }
  }, [
    params,
    route,
    searchSource,
    flights.isFetching,
    flights.isError,
    flights.error,
    flights.data,
    flights.dataUpdatedAt,
    flights.errorUpdatedAt,
  ]);

  const detailsRef = useRef<HTMLDivElement>(null);

  // Opening a flight swaps the list for the card but leaves the page at the
  // same offset, so a click near the bottom of a 50-row list lands the reader
  // below the card. The page also gets shorter in that swap, which makes the
  // browser clamp the scroll position — so wait a frame for that to settle and
  // let scrollIntoView do the arithmetic rather than computing an offset that
  // is stale by the time it is applied.
  useEffect(() => {
    const node = detailsRef.current;
    if (!node) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [flight]);

  return (
    <div className="min-h-screen bg-background">
      {!started && <StartScreen onStart={() => setStarted(true)} />}
      <header className="border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto grid max-w-5xl grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-navy text-primary-foreground">
            <Plane className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-lg leading-tight font-extrabold">Airrisk</p>
            <p className="truncate text-xs text-muted-foreground">
              Аналитика и индекс риска задержки авиарейсов
            </p>
          </div>
        </div>
      </header>

      <section className="bg-hero px-4 pt-10 pb-24 text-primary-foreground">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mx-auto w-fit rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-bold tracking-wide uppercase">
            Сегодня, {todayLabel}
          </p>
          <h1 className="mt-4 text-3xl leading-tight font-black sm:text-4xl">
            Как сейчас летают из вашего города
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-primary-foreground/75 sm:text-base">
            Выберите город — покажем пунктуальность, пики задержек и обстановку в аэропортах. Свой
            рейс можно найти потом, номер помнить не обязательно.
          </p>
        </div>
      </section>

      <main className="mx-auto -mt-16 max-w-3xl px-4 pb-16">
        <CityOverview date={today} onFindFlight={handleFindFlight} onDirection={handleDirection} />

        <section ref={searchRef} className="mt-10 scroll-mt-4">
          <h2 className="text-2xl font-black">Проверить конкретный рейс</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Выберите направление и дату — покажем все рейсы и риск задержки по каждому.
          </p>
          <SearchWidget
            key={seed.key}
            initialFrom={seed.from}
            initialTo={seed.to}
            onSearch={(next) => handleSearch(next, fromCity ? "city_form" : "form")}
            source={fromCity ? "city_form" : "form"}
            loading={loading}
          />

          <div className="mt-6">
            {params === null ? (
              <Placeholder />
            ) : loading ? (
              <div className="grid place-items-center gap-3 rounded-3xl bg-card p-12 text-center shadow-card">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="font-semibold">Ищем рейсы...</p>
              </div>
            ) : flights.isError ? (
              <Failed message={flights.error.message} onRetry={handleRetry} />
            ) : flight ? (
              <div ref={detailsRef} className="grid scroll-mt-4 gap-4">
                <Button
                  variant="ghost"
                  onClick={() => setFlight(null)}
                  className="w-fit rounded-2xl font-semibold"
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Назад к списку рейсов
                </Button>
                <FlightAnalytics
                  flight={toAnalyticsFlight(flight, params.date)}
                  date={params.date}
                  source={searchSource}
                />
              </div>
            ) : flights.data ? (
              <FlightResults route={route} result={flights.data} onSelect={handleSelect} />
            ) : null}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted-foreground">
        Данные носят аналитический характер и не являются официальной информацией перевозчика.
      </footer>
    </div>
  );
}

function Placeholder() {
  return (
    <div className="grid place-items-center gap-3 rounded-3xl bg-card p-12 text-center shadow-card">
      <Search className="h-8 w-8 text-muted-foreground" />
      <p className="font-semibold">Выберите города и дату</p>
      <p className="text-sm text-muted-foreground">
        Покажем все рейсы по направлению и то, насколько их уже сдвинули от первоначального
        расписания.
      </p>
    </div>
  );
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid place-items-center gap-3 rounded-3xl bg-card p-12 text-center shadow-card">
      <TriangleAlert className="h-8 w-8 text-danger" />
      <p className="font-semibold">Не удалось загрузить рейсы</p>
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 font-bold text-primary hover:underline"
      >
        Попробовать ещё раз
      </button>
    </div>
  );
}
