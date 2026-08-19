// Diagnostic classification: turns "a required place got dropped" or "an
// optional place got left out" into a structured, explainable Conflict —
// so the UI can say *why*, not just "no route found".

import type { Conflict, FinalistPlace, HangoutPlan } from "./types";
import { describeOpeningHours, fitsWithinOpeningHours, isClosedForEntireRange } from "./opening-hours";
import type { TravelTimeMatrix } from "./travel-time";
import { addMinutes } from "./time";

/**
 * Necessary (not sufficient) condition: true only when neither visiting
 * order ("a then b" or "b then a") could possibly satisfy both
 * reservations, based on the direct leg between them. A real route might
 * insert other stops between them, but that only adds time — it can never
 * bring an already-impossible pair back into range — so this is a sound
 * way to identify likely culprits for messaging.
 */
function pairwiseReservationConflict(
  a: FinalistPlace,
  b: FinalistPlace,
  plan: HangoutPlan,
  matrix: TravelTimeMatrix,
): boolean {
  if (!a.reservation || !b.reservation) return false;

  const aToB =
    addMinutes(a.reservation.time, a.visitDurationMinutes).getTime() +
    (matrix.get(a.id, b.id) + plan.bufferMinutes) * 60_000;
  const bTolerance = b.reservation.toleranceMinutes ?? 10;
  const bLatest = addMinutes(b.reservation.time, bTolerance).getTime();
  const aThenBWorks = aToB <= bLatest;

  const bToA =
    addMinutes(b.reservation.time, b.visitDurationMinutes).getTime() +
    (matrix.get(b.id, a.id) + plan.bufferMinutes) * 60_000;
  const aTolerance = a.reservation.toleranceMinutes ?? 10;
  const aLatest = addMinutes(a.reservation.time, aTolerance).getTime();
  const bThenAWorks = bToA <= aLatest;

  return !aThenBWorks && !bThenAWorks;
}

/** Builds blocking conflicts explaining why each dropped required place couldn't be included. */
export function classifyDroppedRequiredPlaces(
  dropped: FinalistPlace[],
  allRequired: FinalistPlace[],
  plan: HangoutPlan,
  matrix: TravelTimeMatrix,
): Conflict[] {
  const conflicts: Conflict[] = [];
  const horizonEnd = plan.endTime ?? plan.startTime;

  for (const place of dropped) {
    if (isClosedForEntireRange(place.openingHours, plan.startTime, horizonEnd, plan.timezone)) {
      conflicts.push({
        severity: "blocking",
        code: "required_place_closed_all_day",
        message: `${place.name} is closed all day during this hangout's window (hours: ${describeOpeningHours(place.openingHours)}).`,
        placeIds: [place.id],
        suggestion: `Drop ${place.name} from the required list, or reschedule the hangout to a day it's open.`,
      });
      continue;
    }

    if (place.reservation) {
      const resStart = place.reservation.time;
      const resEnd = addMinutes(resStart, place.visitDurationMinutes);
      if (!fitsWithinOpeningHours(place.openingHours, resStart, resEnd, plan.timezone)) {
        conflicts.push({
          severity: "blocking",
          code: "reservation_outside_hours",
          message: `${place.name}'s reservation is outside its opening hours (hours: ${describeOpeningHours(place.openingHours)}).`,
          placeIds: [place.id],
          suggestion: `Double-check the reservation time for ${place.name}, or drop it.`,
        });
        continue;
      }

      const conflictingPartner = allRequired.find(
        (other) =>
          other.id !== place.id &&
          other.reservation &&
          pairwiseReservationConflict(place, other, plan, matrix),
      );
      if (conflictingPartner) {
        conflicts.push({
          severity: "blocking",
          code: "reservation_conflict",
          message: `The reservation at ${place.name} conflicts with the reservation at ${conflictingPartner.name} — there isn't enough time to honor both.`,
          placeIds: [place.id, conflictingPartner.id],
          suggestion: `Pick one of ${place.name} or ${conflictingPartner.name} — the other's reservation can't be reached in time.`,
        });
        continue;
      }
    }

    conflicts.push({
      severity: "blocking",
      code: "required_place_hours_unreachable",
      message: `${place.name} couldn't be reached within its opening hours (hours: ${describeOpeningHours(place.openingHours)}) given the rest of the schedule.`,
      placeIds: [place.id],
      suggestion: `Drop an optional place to free up time, extend the hangout's end time, or drop ${place.name} from the required list.`,
    });
  }

  return conflicts;
}

export function classifyExcludedOptionalPlaces(
  excluded: { place: FinalistPlace; reason: string }[],
): Conflict[] {
  return excluded.map(({ place, reason }) => ({
    severity: "suggestion",
    code: "optional_place_dropped",
    message: `${place.name} was left off the itinerary — ${reason}.`,
    placeIds: [place.id],
    suggestion: `Consider dropping another stop if you'd like to make room for ${place.name}.`,
  }));
}
