// Types for the flight API at http://80.78.242.113/graphql/.
// Written by hand from the server's schema — keep in sync when the API changes.

/** Date without time, "2026-09-14". */
export type LocalDate = string;
/** Time of day without date, "18:40:00". */
export type LocalTime = string;
/** Date and time with offset, "2026-09-14T15:40:00Z". */
export type DateTime = string;

export type FlightDayStatus =
  "SCHEDULED" | "COMPLETED" | "REMOVED_FROM_SCHEDULE" | "REMOVED_LONG_BEFORE" | "UNKNOWN";

export type AirportOption = {
  iataCode: string;
  title: string;
  city: string;
  timeZoneId: string;
};

export type DestinationOption = {
  title: string;
  flightCount: number;
};

export type FlightSummary = {
  id: number;
  number: string;
  carrier: string;
  carrierCode: string | null;
  airport: string;
  airportTitle: string;
  city: string;
  route: string | null;
  destination: string | null;
  localDate: LocalDate;
  firstLocalTime: LocalTime;
  scheduledLocalTime: LocalTime;
  scheduledDepartureUtc: DateTime;
  utcOffsetMinutes: number;
  shiftMinutes: number;
  shiftSinceDayStartMinutes: number | null;
  terminal: string | null;
  aircraftType: string | null;
  isFuzzy: boolean;
  status: FlightDayStatus;
  lastSeenAtUtc: DateTime;
  observationCount: number;
};

export type FlightSearchResult = {
  items: FlightSummary[];
  totalCount: number;
};

/** `delayedOnly`, `skip` and `take` default to false / 0 / 50 on the server. */
export type FlightSearchRequestInput = {
  query?: string | null;
  from?: string | null;
  to?: string | null;
  airport?: string | null;
  date?: LocalDate | null;
  until?: LocalDate | null;
  status?: FlightDayStatus | null;
  delayedOnly?: boolean;
  skip?: number;
  take?: number;
};

/** The four root queries the API exposes. */
export type Query = {
  airports: AirportOption[];
  flights: FlightSearchResult;
  destinations: DestinationOption[];
  flight: FlightSummary | null;
};
