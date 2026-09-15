import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Radar, Loader2, ArrowLeft, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchWidget } from "@/components/SearchWidget";
import { FlightResults } from "@/components/FlightResults";
import { FlightAnalytics } from "@/components/FlightAnalytics";
import { toAnalyticsFlight } from "@/lib/flight-data";
import { fetchFlights, type FoundFlight, type SearchParams } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Airrisk — индекс риска задержки авиарейсов" },
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

function Index() {
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

  const handleSearch = (next: SearchParams) => {
    setFlight(null);
    setParams(next);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto grid max-w-5xl grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-navy text-primary-foreground">
            <Radar className="h-5 w-5" />
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
          <h1 className="text-3xl leading-tight font-black sm:text-4xl">
            Узнайте реальный риск задержки или отмены вашего рейса
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-primary-foreground/75 sm:text-base">
            Анализ цепочек бортов, метеоусловий и исторической пунктуальности до официального табло
          </p>
        </div>
      </section>

      <main className="mx-auto -mt-16 max-w-3xl px-4 pb-16">
        <SearchWidget onSearch={handleSearch} loading={loading} />

        <div className="mt-6">
          {params === null ? (
            <Placeholder />
          ) : loading ? (
            <div className="grid place-items-center gap-3 rounded-3xl bg-card p-12 text-center shadow-card">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-semibold">Ищем рейсы...</p>
            </div>
          ) : flights.isError ? (
            <Failed message={flights.error.message} onRetry={() => flights.refetch()} />
          ) : flight ? (
            <div className="grid gap-4">
              <Button
                variant="ghost"
                onClick={() => setFlight(null)}
                className="w-fit rounded-2xl font-semibold"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Назад к списку рейсов
              </Button>
              <FlightAnalytics flight={toAnalyticsFlight(flight)} />
            </div>
          ) : flights.data ? (
            <FlightResults route={route} result={flights.data} onSelect={setFlight} />
          ) : null}
        </div>
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
