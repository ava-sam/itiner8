// Shared shapes for the hangout planning room (Ideas / Finalists / Plan
// tabs). A "stop" is a hangout_stops row joined to its cached place and
// votes — candidates (status "candidate") and finalists (status
// "selected") are just filtered views of the same list.

import type { Conflict } from "@/lib/optimizer/types";

export type PlaceInfo = {
  id: string;
  name: string;
  formatted_address: string;
  lat: number;
  lng: number;
};

export type VoteRow = {
  id: string;
  voter_id: string;
};

export type StopStatus =
  | "candidate"
  | "selected"
  | "planned"
  | "completed"
  | "skipped";

export type HangoutStop = {
  id: string;
  hangout_id: string;
  place_id: string;
  suggested_by: string;
  status: StopStatus;
  visit_duration_minutes: number;
  created_at: string;
  place: PlaceInfo;
  votes: VoteRow[];
};

export type ActionResult = { error?: string };

// The Plan tab's generated itinerary. Dates here are always real Date
// objects — whether the source was a fresh generatePlan() call (Next.js
// server actions preserve Date across the client/server boundary) or an
// itineraries row loaded from the DB (jsonb round-trips Dates as ISO
// strings, parsed back to Date by parseStoredItinerary in page.tsx) — so
// PlanTab never has to branch on where the data came from.
export type DisplayItineraryStop = {
  placeId: string;
  name: string;
  arrival: Date;
  visitStart: Date;
  visitEnd: Date;
  waitMinutes: number;
  travelMinutesFromPrevious: number;
  isReservation: boolean;
  isRequired: boolean;
  fitsOpeningHours: boolean;
};

export type DisplayItinerary = {
  id: string;
  generatedAt: Date;
  stops: DisplayItineraryStop[];
  conflicts: Conflict[];
};
