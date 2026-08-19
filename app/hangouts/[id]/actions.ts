"use server";

import { createClient } from "@/lib/supabase/server";
import { optimizeItinerary } from "@/lib/optimizer/optimize";
import {
  GoogleRoutesApiError,
  GoogleRoutesTravelTimeProvider,
  RouteNotFoundError,
} from "@/lib/optimizer/google-travel-time";
import { getLocalParts, minutesOfDayToTimeOfDay } from "@/lib/optimizer/time";
import type {
  FinalistPlace,
  GeoPoint,
  HangoutPlan,
  OpeningHours,
  OpeningHoursWindow,
  OptimizerResult,
  TransportationMode,
} from "@/lib/optimizer/types";

const MAX_GENERATIONS_PER_DAY = 10;
const GENERATION_WINDOW_HOURS = 24;

export type GeneratePlanErrorCode =
  | "not_authenticated"
  | "not_organizer"
  | "cap_exceeded"
  | "no_finalists"
  | "google_api_error"
  | "route_not_found"
  | "unexpected";

export type GeneratePlanResult =
  | { ok: true; itineraryId: string; result: OptimizerResult }
  | { ok: false; error: { code: GeneratePlanErrorCode; message: string } };

interface HangoutRow {
  id: string;
  organizer_id: string;
  start_time: string;
  end_time: string | null;
  start_location: { lat: number; lng: number };
  end_location: { lat: number; lng: number } | null;
  transportation_mode: TransportationMode;
  buffer_minutes: number;
  timezone: string;
}

interface FinalistStopRow {
  id: string;
  place_id: string;
  is_required: boolean;
  visit_duration_minutes: number;
  reservation_time: string | null;
  preferred_start: string | null;
  preferred_end: string | null;
  place: { id: string; name: string; lat: number; lng: number; opening_hours: unknown } | null;
  votes: { id: string }[] | null;
}

const FINALIST_SELECT =
  "id, place_id, is_required, visit_duration_minutes, reservation_time, preferred_start, preferred_end, place:places(id, name, lat, lng, opening_hours), votes(id)";

/**
 * Generates a new itinerary for a hangout's current finalists via the
 * optimizer, backed by live Google Routes travel times. This is the ONLY
 * place in the app that calls Google Routes — everything else (Ideas,
 * Finalists tabs) is DB-only. Only the organizer may call this, and it's
 * capped at MAX_GENERATIONS_PER_DAY generations per hangout per rolling
 * 24h window (generation_log).
 */
export async function generatePlan(hangoutId: string): Promise<GeneratePlanResult> {
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims) {
    return { ok: false, error: { code: "not_authenticated", message: "You must be signed in." } };
  }
  const userId = claimsData.claims.sub;

  const { data: hangout, error: hangoutError } = await supabase
    .from("hangouts")
    .select(
      "id, organizer_id, start_time, end_time, start_location, end_location, transportation_mode, buffer_minutes, timezone",
    )
    .eq("id", hangoutId)
    .maybeSingle<HangoutRow>();

  if (hangoutError) {
    // Distinct from "no row" below — this means the query itself failed
    // (bad column, network, etc.), which a generic "not found" message
    // would silently mask.
    return {
      ok: false,
      error: { code: "unexpected", message: `Couldn't load this hangout: ${hangoutError.message}` },
    };
  }
  if (!hangout) {
    return { ok: false, error: { code: "unexpected", message: "Hangout not found." } };
  }
  if (hangout.organizer_id !== userId) {
    return {
      ok: false,
      error: { code: "not_organizer", message: "Only the organizer can generate a plan." },
    };
  }

  const capCheck = await checkGenerationCap(supabase, hangoutId);
  if (!capCheck.ok) return capCheck;

  const { error: logError } = await supabase
    .from("generation_log")
    .insert({ hangout_id: hangoutId, generated_by: userId });
  if (logError) {
    return { ok: false, error: { code: "unexpected", message: "Couldn't log the generation attempt." } };
  }

  const { data: stopRows, error: stopsError } = await supabase
    .from("hangout_stops")
    .select(FINALIST_SELECT)
    .eq("hangout_id", hangoutId)
    .eq("status", "selected")
    .returns<FinalistStopRow[]>();

  if (stopsError) {
    return { ok: false, error: { code: "unexpected", message: "Couldn't load finalists." } };
  }
  if (!stopRows || stopRows.length === 0) {
    return {
      ok: false,
      error: { code: "no_finalists", message: "Move some places to Finalists before generating a plan." },
    };
  }

  const plan = buildHangoutPlan(hangout, stopRows);

  let provider: GoogleRoutesTravelTimeProvider;
  try {
    const points: GeoPoint[] = [
      plan.startLocation,
      ...plan.places,
      ...(plan.endLocation ? [plan.endLocation] : []),
    ];
    provider = await GoogleRoutesTravelTimeProvider.create({
      points,
      mode: plan.transportationMode,
      departureTime: plan.startTime,
    });
  } catch (err) {
    return travelTimeErrorResult(err);
  }

  let result: OptimizerResult;
  try {
    result = optimizeItinerary(plan, provider);
  } catch (err) {
    return travelTimeErrorResult(err);
  }

  const { data: itinerary, error: insertError } = await supabase
    .from("itineraries")
    .insert({
      hangout_id: hangoutId,
      generated_by: userId,
      transportation_mode: plan.transportationMode,
      stops: result.itinerary,
      conflicts: result.conflicts,
    })
    .select("id")
    .single();

  if (insertError || !itinerary) {
    return { ok: false, error: { code: "unexpected", message: "Couldn't save the generated itinerary." } };
  }

  // Best-effort: the itinerary is already saved at this point, so a
  // failure here (unexpected — RLS lets the organizer update their own
  // hangout) shouldn't turn a successful generation into a reported
  // failure. Whatever the current status was, "a plan now exists" holds.
  await supabase.from("hangouts").update({ status: "generated" }).eq("id", hangoutId);

  return { ok: true, itineraryId: itinerary.id, result };
}

async function checkGenerationCap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  hangoutId: string,
): Promise<{ ok: true } | { ok: false; error: { code: GeneratePlanErrorCode; message: string } }> {
  const since = new Date(Date.now() - GENERATION_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("generation_log")
    .select("id", { count: "exact", head: true })
    .eq("hangout_id", hangoutId)
    .gte("created_at", since);

  if (error) {
    return { ok: false, error: { code: "unexpected", message: "Couldn't check the generation limit." } };
  }
  if ((count ?? 0) >= MAX_GENERATIONS_PER_DAY) {
    return {
      ok: false,
      error: {
        code: "cap_exceeded",
        message: `This hangout has already generated ${MAX_GENERATIONS_PER_DAY} plans in the last 24 hours — try again later.`,
      },
    };
  }
  return { ok: true };
}

function travelTimeErrorResult(err: unknown): { ok: false; error: { code: GeneratePlanErrorCode; message: string } } {
  if (err instanceof RouteNotFoundError) {
    // err.message names internal point ids (place uuids, "__start__") —
    // not something to show a user; the code alone is enough for the UI
    // to render a specific, still-honest message.
    return {
      ok: false,
      error: {
        code: "route_not_found",
        message: "Google couldn't find a route between two of your stops for the selected transportation mode.",
      },
    };
  }
  if (err instanceof GoogleRoutesApiError) {
    return {
      ok: false,
      error: { code: "google_api_error", message: `Couldn't reach Google Routes: ${err.message}` },
    };
  }
  return { ok: false, error: { code: "unexpected", message: "Unexpected error while building the itinerary." } };
}

// ---------------------------------------------------------------------
// DB row -> optimizer input mapping. Deliberately kept out of
// lib/optimizer (which takes no DB shapes at all) — this is glue code
// specific to the current schema, not optimizer logic.
// ---------------------------------------------------------------------

function buildHangoutPlan(hangout: HangoutRow, stopRows: FinalistStopRow[]): HangoutPlan {
  const timezone = hangout.timezone;

  const places: FinalistPlace[] = stopRows
    .filter((row): row is FinalistStopRow & { place: NonNullable<FinalistStopRow["place"]> } => row.place !== null)
    .map((row) => ({
      id: row.place.id,
      name: row.place.name,
      lat: row.place.lat,
      lng: row.place.lng,
      openingHours: mapOpeningHours(row.place.opening_hours),
      visitDurationMinutes: row.visit_duration_minutes,
      isRequired: row.is_required,
      voteCount: row.votes?.length ?? 0,
      reservation: row.reservation_time ? { time: new Date(row.reservation_time) } : undefined,
      preferredWindow: buildPreferredWindow(row.preferred_start, row.preferred_end, timezone),
    }));

  return {
    timezone,
    startLocation: { id: "__start__", lat: hangout.start_location.lat, lng: hangout.start_location.lng },
    startTime: new Date(hangout.start_time),
    endLocation: hangout.end_location
      ? { id: "__end__", lat: hangout.end_location.lat, lng: hangout.end_location.lng }
      : undefined,
    endTime: hangout.end_time ? new Date(hangout.end_time) : undefined,
    transportationMode: hangout.transportation_mode,
    bufferMinutes: hangout.buffer_minutes,
    places,
  };
}

/**
 * places.opening_hours is jsonb with no enforced shape, and nothing in the
 * app currently writes to it (it's meant to eventually hold Google Place
 * Details data, normalized to the optimizer's OpeningHours shape — that
 * normalizer doesn't exist yet). Interim, explicit fallback: treat
 * missing/unrecognized data as open 24/7 rather than silently
 * misinterpreting it as "closed all day" (which the optimizer would then
 * treat as a blocking conflict for every required place) or guessing at
 * Google's raw format.
 */
function mapOpeningHours(raw: unknown): OpeningHours {
  if (raw && typeof raw === "object" && isOpeningHoursShape(raw)) {
    return raw as OpeningHours;
  }
  return ALWAYS_OPEN_HOURS;
}

const ALWAYS_OPEN_HOURS: OpeningHours = (() => {
  const window: OpeningHoursWindow[] = [{ open: "00:00", close: "00:00" }]; // spans a full 24h, see opening-hours.ts
  return { 0: window, 1: window, 2: window, 3: window, 4: window, 5: window, 6: window };
})();

function isOpeningHoursShape(raw: object): boolean {
  return Object.entries(raw).every(([day, windows]) => {
    const dayNum = Number(day);
    if (!Number.isInteger(dayNum) || dayNum < 0 || dayNum > 6) return false;
    return (
      Array.isArray(windows) &&
      windows.every(
        (w) =>
          w &&
          typeof w === "object" &&
          typeof (w as { open?: unknown }).open === "string" &&
          typeof (w as { close?: unknown }).close === "string",
      )
    );
  });
}

/**
 * hangout_stops.preferred_start/preferred_end are absolute timestamps;
 * the optimizer wants a same-day local time-of-day window. This collapses
 * the absolute range down to its local HH:MM, dropping date information —
 * fine for the "prefer visiting sometime in this part of the day" use
 * case the field is for.
 */
function buildPreferredWindow(
  start: string | null,
  end: string | null,
  timezone: string,
): OpeningHoursWindow | undefined {
  if (!start || !end) return undefined;
  const openMinutes = getLocalParts(new Date(start), timezone).minutesOfDay;
  const closeMinutes = getLocalParts(new Date(end), timezone).minutesOfDay;
  return {
    open: minutesOfDayToTimeOfDay(openMinutes),
    close: minutesOfDayToTimeOfDay(closeMinutes),
  };
}
