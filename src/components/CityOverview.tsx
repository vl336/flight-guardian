import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BellRing,
  ChevronDown,
  Clock,
  CloudSun,
  Loader2,
  PlaneTakeoff,
  Search,
  ShieldAlert,
  Timer,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchDestinations } from "@/lib/api";
import {
  CITIES,
  LEVEL_LABEL,
  directionOnTime,
  overviewFor,
  type AirportStatus,
  type CityInfo,
  type OverviewLevel,
} from "@/lib/city-overview";
import type { LocalDate } from "@/lib/graphql-types";
import { reachGoal } from "@/lib/analytics";
import { cityBotLink } from "@/lib/telegram-bot";

const levelStyles: Record<OverviewLevel, { badge: string; dot: string; bar: string }> = {
  CALM: { badge: "bg-success-soft text-success", dot: "bg-success", bar: "bg-success" },
  MODERATE: { badge: "bg-warning-soft text-warning", dot: "bg-warning", bar: "bg-warning" },
  TENSE: { badge: "bg-danger-soft text-danger", dot: "bg-danger", bar: "bg-danger" },
};

const airportDot: Record<AirportStatus["state"], string> = {
  ok: "bg-success",
  slow: "bg-warning",
  restricted: "bg-danger",
};

/** Сколько направлений показываем чипами: дальше список превращается в простыню. */
const TOP_DIRECTIONS = 8;

type Props = {
  date: LocalDate;
  onFindFlight: (city: string) => void;
  onDirection: (city: string, destination: string) => void;
};

export function CityOverview({ date, onFindFlight, onDirection }: Props) {
  const [open, setOpen] = useState<string | null>(null);

  const toggle = (city: string) => {
    const next = open === city ? null : city;
    if (next) reachGoal("city_open", { city });
    setOpen(next);
  };

  return (
    <div className="grid gap-4">
      {CITIES.map((info) => (
        <CityCard
          key={info.city}
          info={info}
          date={date}
          open={open === info.city}
          onToggle={() => toggle(info.city)}
          onFindFlight={() => onFindFlight(info.city)}
          onDirection={(destination) => onDirection(info.city, destination)}
        />
      ))}
    </div>
  );
}

type CardProps = {
  info: CityInfo;
  date: LocalDate;
  open: boolean;
  onToggle: () => void;
  onFindFlight: () => void;
  onDirection: (destination: string) => void;
};

function CityCard({ info, date, open, onToggle, onFindFlight, onDirection }: CardProps) {
  const overview = useMemo(() => overviewFor(info, date), [info, date]);
  const level = levelStyles[overview.level];

  // Тот же ключ, что и у SearchWidget: открыли плашку, потом пошли искать рейс —
  // список городов прибытия уже в кэше.
  const destinations = useQuery({
    queryKey: ["destinations", info.city, date],
    queryFn: () => fetchDestinations(info.city, date),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const flightCount = destinations.data?.reduce((sum, d) => sum + d.flightCount, 0);
  const top = (destinations.data ?? [])
    .slice()
    .sort((a, b) => b.flightCount - a.flightCount)
    .slice(0, TOP_DIRECTIONS);
  const maxDelayed = Math.max(...overview.hourly.map((h) => h.delayed));
  const panelId = `city-panel-${info.code}`;

  return (
    <article className="overflow-hidden rounded-3xl shadow-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="group relative block w-full overflow-hidden p-5 text-left text-primary-foreground sm:p-6"
        style={{ backgroundImage: info.gradient }}
      >
        {/* Код города водяным знаком — плашки узнаются по нему, как на табло. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-2 -bottom-6 text-8xl font-black tracking-tighter text-primary-foreground/10 select-none sm:text-9xl"
        >
          {info.code}
        </span>

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5">
              {info.airports.map((a) => (
                <span
                  key={a.code}
                  className="rounded-full bg-primary-foreground/15 px-2.5 py-0.5 text-xs font-bold tracking-wide"
                >
                  {a.code}
                </span>
              ))}
            </div>
            <h2 className="mt-3 text-2xl leading-tight font-black sm:text-3xl">{info.city}</h2>
            <p className="mt-1 text-sm text-primary-foreground/75">{info.tagline}</p>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-foreground/15 transition-colors group-hover:bg-primary-foreground/25">
            <ChevronDown
              className={`h-5 w-5 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
            />
          </span>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold ${level.badge}`}
          >
            <span className={`h-2 w-2 rounded-full ${level.dot}`} />
            {LEVEL_LABEL[overview.level]}
          </span>
          <span className="rounded-full bg-primary-foreground/15 px-3 py-1 font-semibold">
            {overview.onTimeRate}% рейсов вовремя
          </span>
        </div>
      </button>

      {/* grid-rows 0fr → 1fr анимирует высоту без замеров в JS. */}
      <div
        id={panelId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="min-h-0 overflow-hidden bg-card" inert={!open}>
          <div className="grid gap-6 p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                icon={PlaneTakeoff}
                label="Вылетов сегодня"
                value={
                  flightCount === undefined ? (
                    destinations.isError ? (
                      "—"
                    ) : (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    )
                  ) : (
                    flightCount
                  )
                }
              />
              <Stat icon={Clock} label="Вовремя" value={`${overview.onTimeRate}%`} />
              <Stat icon={Timer} label="Средняя задержка" value={`${overview.avgDelay} мин`} />
              <Stat icon={XCircle} label="Отменено" value={`${overview.cancelRate}%`} />
            </div>

            <p className="rounded-2xl bg-secondary/60 p-4 text-sm leading-relaxed">
              {overview.insight}
            </p>

            <section>
              <h3 className="font-bold">Когда задерживают вылеты</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Доля задержанных рейсов по часам вылета, местное время
              </p>
              <div
                className="mt-4 flex h-28 items-end gap-1"
                role="img"
                aria-label={`Пик задержек с ${overview.worstWindow.from}:00 до ${overview.worstWindow.to}:00`}
              >
                {overview.hourly.map(({ hour, delayed }) => {
                  const peak = hour >= overview.worstWindow.from && hour < overview.worstWindow.to;
                  return (
                    <div
                      key={hour}
                      className="flex h-full min-w-0 flex-1 flex-col justify-end"
                      title={`${hour}:00 — ${delayed}%`}
                    >
                      <div
                        className={`rounded-t-md ${peak ? level.bar : "bg-sky/40"}`}
                        style={{ height: `${Math.max(6, (delayed / maxDelayed) * 100)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
            </section>

            <section>
              <h3 className="font-bold">Аэропорты</h3>
              <ul className="mt-3 grid gap-2">
                {overview.airports.map((a) => (
                  <li
                    key={a.code}
                    className="flex items-center gap-3 rounded-2xl border border-border p-3"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${airportDot[a.state]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {a.title} <span className="text-muted-foreground">· {a.code}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">{a.note}</p>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <p className="flex items-center justify-end gap-1 font-bold">
                        <CloudSun className="h-4 w-4 text-sky" />
                        {a.temp > 0 ? "+" : ""}
                        {a.temp}°
                      </p>
                      <p className="text-xs text-muted-foreground">{a.weather}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {overview.restriction && (
                <p className="mt-3 flex gap-2 rounded-2xl bg-danger-soft p-3 text-sm text-danger">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {overview.restriction}
                </p>
              )}
            </section>

            <section>
              <h3 className="font-bold">Популярные направления сегодня</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Нажмите на направление — покажем все рейсы и риск по каждому
              </p>
              {destinations.isPending ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загружаем расписание...
                </div>
              ) : destinations.isError ? (
                <p className="mt-3 text-sm text-danger">Не удалось загрузить направления</p>
              ) : top.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  На сегодня рейсов в расписании нет
                </p>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {top.map((d) => {
                    const rate = directionOnTime(info.city, d.title, date, overview.onTimeRate);
                    const tone =
                      rate >= 80 ? "text-success" : rate >= 68 ? "text-warning" : "text-danger";
                    return (
                      <li key={d.title}>
                        <button
                          type="button"
                          onClick={() => onDirection(d.title)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{d.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {d.flightCount} рейс{plural(d.flightCount)}
                            </p>
                          </div>
                          <span className={`shrink-0 text-sm font-bold ${tone}`}>{rate}%</span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <CitySubscribe info={info} level={overview.level} />

            <Button
              size="lg"
              onClick={onFindFlight}
              className="h-14 w-full rounded-2xl text-base font-bold"
            >
              <Search className="mr-1 h-5 w-5" />
              Проверить конкретный рейс
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Подписка на обстановку в городе — та же почта, Telegram и Макс, что у рейса.
 * Рассылки по городам пока нет: блок меряет спрос, поэтому каждый канал уходит
 * одной целью city_subscribe с параметром channel.
 */
function CitySubscribe({ info, level }: { info: CityInfo; level: OverviewLevel }) {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);

  const isValidEmail = emailRegex.test(email.trim());
  const showError = touched && email.length > 0 && !isValidEmail;

  // Сам адрес в цели не уходит — только город и канал.
  const report = (channel: "email" | "telegram" | "max") =>
    reachGoal("city_subscribe", { city: info.city, channel, level });

  const handleSubscribe = () => {
    const clean = email.trim();
    if (!emailRegex.test(clean)) return;
    report("email");
    toast.success("Успешно подписались", {
      description: `Напишем на ${clean}, если в аэропортах что-то изменится.`,
    });
    setEmail("");
    setTouched(false);
  };

  return (
    <section
      className="rounded-3xl p-5 text-primary-foreground sm:p-6"
      style={{ backgroundImage: info.gradient }}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-foreground/15">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg leading-tight font-extrabold">
            Следить за обстановкой по {info.dative}
          </h3>
          <p className="mt-1 text-sm text-primary-foreground/75">
            Не нужно помнить номер рейса — напишем, когда в аэропортах города что-то изменится.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubscribe();
          }}
          placeholder="Введите ваш email"
          aria-label={`Email для сводки по ${info.dative}`}
          aria-invalid={showError}
          className="h-12 rounded-2xl border-transparent bg-card text-base text-foreground placeholder:text-muted-foreground"
        />
        <Button
          disabled={!isValidEmail}
          onClick={handleSubscribe}
          className="h-12 rounded-2xl bg-card text-base font-bold text-foreground hover:bg-card/90 disabled:opacity-60"
        >
          Подписаться
        </Button>
      </div>
      {showError && (
        <p className="mt-2 text-sm font-semibold text-primary-foreground">
          Введите корректный email, например name@example.com
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
        <a
          href={cityBotLink(info.code)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => report("telegram")}
          className="rounded-2xl bg-primary-foreground/15 px-3 py-2.5 text-center transition-colors hover:bg-primary-foreground/25"
        >
          В Telegram →
        </a>
        <a
          href="https://max.ru/riskbotair"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => report("max")}
          className="rounded-2xl bg-primary-foreground/15 px-3 py-2.5 text-center transition-colors hover:bg-primary-foreground/25"
        >
          В Макс →
        </a>
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-secondary/60 p-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <p className="mt-2 flex h-7 items-center text-xl font-black">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
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
