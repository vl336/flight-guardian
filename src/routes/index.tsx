import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Radar, Loader2, Plane, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchWidget } from "@/components/SearchWidget";
import { FlightAnalytics } from "@/components/FlightAnalytics";
import { FLIGHTS, LOADING_STEPS, findFlights, type Flight } from "@/lib/flight-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FlightRisk — индекс риска задержки авиарейсов" },
      {
        name: "description",
        content:
          "Проверьте риск задержки или отмены рейса: историческая пунктуальность, цепочки бортов и метеоусловия до официального табло.",
      },
      { property: "og:title", content: "FlightRisk — риск задержки вашего рейса" },
      {
        property: "og:description",
        content:
          "Аналитика пунктуальности авиарейсов и прогноз риска задержки в реальном времени.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [flight, setFlight] = useState<Flight>(FLIGHTS[0]!);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const handleSearch = (query: string) => {
    timers.current.forEach(window.clearTimeout);
    setLoading(true);
    setStep(0);
    timers.current = [
      window.setTimeout(() => setStep(1), 500),
      window.setTimeout(() => setStep(2), 1000),
      window.setTimeout(() => {
        setFlight(findFlight(query));
        setLoading(false);
      }, 1500),
    ];
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto grid max-w-5xl grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-navy text-primary-foreground">
            <Radar className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-lg leading-tight font-extrabold">FlightRisk</p>
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
          {loading ? (
            <div className="grid place-items-center gap-3 rounded-3xl bg-card p-12 text-center shadow-card">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-semibold">{LOADING_STEPS[step]}</p>
            </div>
          ) : (
            <FlightAnalytics flight={flight} />
          )}
        </div>
      </main>

      <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted-foreground">
        Данные носят аналитический характер и не являются официальной информацией перевозчика.
      </footer>
    </div>
  );
}
