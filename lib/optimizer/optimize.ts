// Top-level orchestration: the one function callers actually use. Pure
// and synchronous — no DB, no network. Travel-time data comes in through
// the injected TravelTimeProvider (a fixture matrix in this phase; a real
// Google Routes-backed provider can replace it later without any change
// here — see travel-time.ts).
//
// Priority order this module implements, highest first (see README.md
// for the full design writeup):
//   1. Honor reservations (hard gate in search.ts)
//   2. Include required places        \ both hard gates in search.ts —
//   3. Fit within opening hours       / if they can't both hold, that
//      place is dropped and reported as a "blocking" conflict (not
//      silently demoted to a warning — see README's "opening hours vs.
//      required inclusion" note).
//   4. Prefer highly-voted places     — drives optional-place selection
//      order in optional-insertion.ts.
//   5. Minimize total travel time     \
//   6. Minimize opening-hours wait     | cost vector search.ts/optional-
//   7. Respect preferred windows      / insertion.ts minimize, in order.
//   8. Include optional places if the schedule has room — phase B,
//      optional-insertion.ts, only ever adds, never at the expense of 1-3.

import type { Conflict, FinalistPlace, GeoPoint, HangoutPlan, ItineraryStop, OptimizerResult, TravelTimeProvider } from "./types";
import type { StopSchedule } from "./schedule";
import { buildTravelTimeMatrix } from "./travel-time";
import { solveRequiredCore } from "./search";
import { insertOptionalPlaces } from "./optional-insertion";
import { classifyDroppedRequiredPlaces, classifyExcludedOptionalPlaces } from "./conflicts";

const MAX_FINALISTS = 8;

export function optimizeItinerary(
  plan: HangoutPlan,
  provider: TravelTimeProvider,
): OptimizerResult {
  if (plan.places.length > MAX_FINALISTS) {
    throw new Error(
      `optimizeItinerary: expected at most ${MAX_FINALISTS} finalist places, got ${plan.places.length}`,
    );
  }

  const requiredPlaces = plan.places.filter((p) => p.isRequired);
  const optionalPlaces = plan.places.filter((p) => !p.isRequired);

  const points = dedupePoints([
    plan.startLocation,
    ...plan.places,
    ...(plan.endLocation ? [plan.endLocation] : []),
  ]);
  const matrix = buildTravelTimeMatrix(points, plan.transportationMode, provider);

  const { dropped, solution } = solveRequiredCore(
    requiredPlaces,
    plan,
    matrix,
  );

  const insertion = insertOptionalPlaces(optionalPlaces, solution.order, plan, matrix);

  const itinerary = buildItineraryStops(insertion.order, insertion.simulation.schedules);

  const conflicts = [
    ...classifyDroppedRequiredPlaces(dropped, requiredPlaces, plan, matrix),
    ...preferredWindowWarnings(insertion.order, insertion.simulation.schedules),
    ...classifyExcludedOptionalPlaces(insertion.excluded),
  ];

  const totalWaitMinutes = insertion.simulation.schedules.reduce(
    (sum, s) => sum + s.waitMinutes,
    0,
  );
  const voteScore = insertion.order.reduce((sum, p) => sum + p.voteCount, 0);

  return {
    feasible: !conflicts.some((c) => c.severity === "blocking"),
    itinerary,
    includedPlaceIds: insertion.order.map((p) => p.id),
    excludedRequiredPlaceIds: dropped.map((p) => p.id),
    excludedOptionalPlaceIds: insertion.excluded.map((e) => e.place.id),
    conflicts,
    metrics: {
      totalTravelMinutes: insertion.simulation.totalTravelMinutes,
      totalWaitMinutes,
      voteScore,
    },
  };
}

function buildItineraryStops(order: FinalistPlace[], schedules: StopSchedule[]): ItineraryStop[] {
  return order.map((place, i) => {
    const schedule = schedules[i];
    return {
      placeId: place.id,
      name: place.name,
      arrival: schedule.arrival,
      visitStart: schedule.visitStart,
      visitEnd: schedule.visitEnd,
      waitMinutes: schedule.waitMinutes,
      travelMinutesFromPrevious: schedule.travelMinutes,
      isReservation: Boolean(place.reservation),
      isRequired: place.isRequired,
      fitsOpeningHours: schedule.fitsOpeningHours,
    };
  });
}

function preferredWindowWarnings(
  order: FinalistPlace[],
  schedules: StopSchedule[],
): Conflict[] {
  const warnings: Conflict[] = [];
  for (let i = 0; i < order.length; i++) {
    const place = order[i];
    const schedule = schedules[i];
    if (place.preferredWindow && schedule.preferredWindowDeviationMinutes > 0) {
      warnings.push({
        severity: "warning" as const,
        code: "preferred_window_missed" as const,
        message: `${place.name} is scheduled about ${Math.round(schedule.preferredWindowDeviationMinutes)} minute(s) outside its preferred visit window.`,
        placeIds: [place.id],
      });
    }
  }
  return warnings;
}

function dedupePoints(points: GeoPoint[]): GeoPoint[] {
  const byId = new Map<string, GeoPoint>();
  for (const p of points) byId.set(p.id, p);
  return [...byId.values()];
}
