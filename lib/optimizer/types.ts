// Shared types for the itinerary optimizer. This module is intentionally
// decoupled from the DB schema (hangouts / hangout_stops / places / votes):
// callers (server actions, route handlers, tests) are responsible for
// mapping DB rows into these shapes before calling optimizeItinerary, and
// mapping the result back out. Nothing in here talks to Supabase or Google.

export type TransportationMode = "driving" | "walking" | "transit";

/** Date#getDay(): 0 = Sunday ... 6 = Saturday. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 24h local wall-clock time, "HH:MM". */
export type TimeOfDay = string;

export interface OpeningHoursWindow {
  open: TimeOfDay;
  close: TimeOfDay;
}

/**
 * Per-day opening windows, keyed by DayOfWeek. A missing day, or a day
 * mapped to an empty array, means "closed all day". A window whose close
 * time is <= its open time is treated as spanning past midnight into the
 * next calendar day (e.g. a bar open 22:00-02:00).
 */
export type OpeningHours = Partial<Record<DayOfWeek, OpeningHoursWindow[]>>;

export interface GeoPoint {
  id: string;
  lat: number;
  lng: number;
}

export interface Reservation {
  /** Exact required arrival time (an absolute instant, not local wall time). */
  time: Date;
  /** Allowed +/- tolerance in minutes around `time`. Defaults to 10. */
  toleranceMinutes?: number;
}

export interface FinalistPlace extends GeoPoint {
  name: string;
  openingHours: OpeningHours;
  visitDurationMinutes: number;
  /**
   * Mandatory-to-include, independent of `reservation`. A place with a
   * reservation but isRequired: false is still only opportunistically
   * included (see README's "reservation vs required" note) — its
   * reservation only pins the time slot *if* it ends up on the itinerary.
   */
  isRequired: boolean;
  voteCount: number;
  /** Optional soft-preferred visit window, same calendar day as the visit. */
  preferredWindow?: OpeningHoursWindow;
  reservation?: Reservation;
}

export interface HangoutPlan {
  /** IANA timezone name (e.g. "America/Los_Angeles"); all places assumed local to it. */
  timezone: string;
  startLocation: GeoPoint;
  startTime: Date;
  endLocation?: GeoPoint;
  endTime?: Date;
  transportationMode: TransportationMode;
  /** Minutes added to every leg (start->first, between stops, last->end). Default 10. */
  bufferMinutes: number;
  /** Up to 8 finalist places. */
  places: FinalistPlace[];
}

/** Injected so real Google Routes calls can replace fixture data later without touching optimizer logic. */
export interface TravelTimeProvider {
  getTravelTimeMinutes(
    from: GeoPoint,
    to: GeoPoint,
    mode: TransportationMode,
  ): number;
}

export type ConflictSeverity = "blocking" | "warning" | "suggestion";

export type ConflictCode =
  | "reservation_conflict"
  | "reservation_outside_hours"
  | "required_place_closed_all_day"
  | "required_place_hours_unreachable"
  | "required_place_excluded"
  | "preferred_window_missed"
  | "optional_place_dropped"
  | "schedule_overflow";

export interface Conflict {
  severity: ConflictSeverity;
  code: ConflictCode;
  message: string;
  placeIds: string[];
  suggestion?: string;
}

export interface ItineraryStop {
  placeId: string;
  name: string;
  arrival: Date;
  visitStart: Date;
  visitEnd: Date;
  /** Minutes between arrival and visitStart (waiting for opening, or for a reservation time). */
  waitMinutes: number;
  travelMinutesFromPrevious: number;
  isReservation: boolean;
  isRequired: boolean;
  /** False when this stop's scheduled visit doesn't fully fit its opening hours. */
  fitsOpeningHours: boolean;
}

export interface OptimizerResult {
  /** False whenever at least one "blocking" conflict is present. */
  feasible: boolean;
  itinerary: ItineraryStop[];
  includedPlaceIds: string[];
  excludedRequiredPlaceIds: string[];
  excludedOptionalPlaceIds: string[];
  conflicts: Conflict[];
  metrics: {
    totalTravelMinutes: number;
    totalWaitMinutes: number;
    voteScore: number;
  };
}
