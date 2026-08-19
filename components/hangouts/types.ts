// Shared shapes for the hangout planning room (Ideas / Finalists / Plan
// tabs). A "stop" is a hangout_stops row joined to its cached place and
// votes — candidates (status "candidate") and finalists (status
// "selected") are just filtered views of the same list.

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
