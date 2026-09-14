import type {
  AirportOption,
  DestinationOption,
  FlightDayStatus,
  FlightSummary,
  LocalDate,
} from "./graphql-types";

/** Flight schedule API. It allows any origin, so the browser calls it directly. */
export const GRAPHQL_ENDPOINT = "http://80.78.242.113/graphql/";

type GraphQLResponse<T> = { data?: T; errors?: Array<{ message: string }> };

async function request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error("Не удалось связаться с сервисом расписаний");
  }
  if (!response.ok) throw new Error(`Сервис расписаний ответил ${response.status}`);

  const payload = (await response.json()) as GraphQLResponse<T>;
  if (payload.errors?.length) throw new Error(payload.errors[0]!.message);
  if (!payload.data) throw new Error("Сервис расписаний вернул пустой ответ");
  return payload.data;
}

// The three queries are kept apart rather than in one round trip: the airport
// list never changes, destinations only depend on the departure city and date,
// and flights must not be fetched until the user actually hits "Найти рейсы".

const AIRPORTS_QUERY = `query Airports {
  airports { iataCode title city }
}`;

const DESTINATIONS_QUERY = `query Destinations($from: String, $date: LocalDate) {
  destinations(filter: { from: $from, date: $date }) {
    title
    flightCount
  }
}`;

const FLIGHTS_QUERY = `query Flights($from: String, $to: String, $date: LocalDate) {
  flights(filter: { from: $from, to: $to, date: $date, take: 50 }) {
    totalCount
    items {
      id
      number
      carrier
      city
      destination
      airport
      scheduledLocalTime
      firstLocalTime
      shiftMinutes
      terminal
      status
      localDate
      aircraftType
      observationCount
      lastSeenAtUtc
    }
  }
}`;

/** Moscow has three airports, so departure options are grouped down to cities. */
export type DepartureCity = { city: string; airports: string[] };

export async function fetchDepartureCities(): Promise<DepartureCity[]> {
  const { airports } = await request<{ airports: AirportOption[] }>(AIRPORTS_QUERY);

  const byCity = new Map<string, string[]>();
  for (const airport of airports) {
    byCity.set(airport.city, [...(byCity.get(airport.city) ?? []), airport.iataCode]);
  }

  return [...byCity]
    .map(([city, codes]) => ({ city, airports: codes.sort() }))
    .sort((a, b) => a.city.localeCompare(b.city, "ru"));
}

export async function fetchDestinations(
  from: string,
  date: LocalDate,
): Promise<DestinationOption[]> {
  const data = await request<{ destinations: DestinationOption[] }>(DESTINATIONS_QUERY, {
    from,
    date,
  });
  return data.destinations;
}

export type FoundFlight = Pick<
  FlightSummary,
  | "id"
  | "number"
  | "carrier"
  | "city"
  | "destination"
  | "airport"
  | "scheduledLocalTime"
  | "firstLocalTime"
  | "shiftMinutes"
  | "terminal"
  | "status"
  | "localDate"
  | "aircraftType"
  | "observationCount"
  | "lastSeenAtUtc"
>;

export type SearchParams = { from: string; to: string; date: LocalDate };

export async function fetchFlights(
  params: SearchParams,
): Promise<{ totalCount: number; items: FoundFlight[] }> {
  const data = await request<{ flights: { totalCount: number; items: FoundFlight[] } }>(
    FLIGHTS_QUERY,
    params,
  );
  return data.flights;
}

/** "18:40:00" -> "18:40" */
export const formatTime = (time: string) => time.slice(0, 5);

/** The API sends the literal string "NULL" when a flight has no terminal. */
export const terminalOf = (terminal: string | null) =>
  !terminal || terminal === "NULL" ? null : terminal;

export const STATUS_LABEL: Record<FlightDayStatus, string> = {
  SCHEDULED: "По расписанию",
  COMPLETED: "Выполнен",
  REMOVED_FROM_SCHEDULE: "Снят с расписания",
  REMOVED_LONG_BEFORE: "Снят заранее",
  UNKNOWN: "Нет данных",
};

/** Badge colours per status, kept beside the labels so they stay in step. */
export const STATUS_STYLES: Record<FlightDayStatus, string> = {
  SCHEDULED: "bg-sky-soft text-accent-foreground",
  COMPLETED: "bg-success-soft text-success",
  REMOVED_FROM_SCHEDULE: "bg-danger-soft text-danger",
  REMOVED_LONG_BEFORE: "bg-danger-soft text-danger",
  UNKNOWN: "bg-secondary text-muted-foreground",
};

const pad = (value: number) => String(value).padStart(2, "0");

/** Local calendar date — `toISOString` would roll over a day in evening MSK. */
export const toLocalDate = (date: Date): LocalDate =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const addDays = (date: Date, days: number) => {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
};

/** The schedule only reaches about a week out, so the picker is clamped to it. */
export const SCHEDULE_WINDOW_DAYS = 7;
