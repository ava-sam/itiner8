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
  primary_type?: string | null;
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
  is_required: boolean;
  reservation_time: string | null;
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

export type RoomMember = {
  profileId: string;
  name: string;
  role: "organizer" | "member";
};

export type HangoutStatus = "planning" | "generated" | "finalized" | "completed";

// Everything the room / final-plan chrome needs about the hangout itself.
export type HangoutMeta = {
  id: string;
  name: string;
  status: HangoutStatus;
  inviteCode: string;
  organizerName: string;
  timezone: string;
  /** ISO instant the hangout starts (hangouts.start_time). */
  startTime: string;
  transportationMode: "driving" | "walking" | "transit";
  bufferMinutes: number;
  startLabel: string;
  endLabel: string | null;
  /** hangouts.updated_at — the closest thing to a "finalized at" stamp. */
  updatedAt: string;
};

// Per-place extras for itinerary rendering, keyed by place id.
export type ItineraryPlaceDetails = {
  address: string;
  category: string | null;
  /** ISO instant the place closes on the visit day (only when the visit doesn't fit). */
  closesAt: string | null;
};
