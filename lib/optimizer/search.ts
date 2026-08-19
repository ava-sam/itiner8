// Phase A: branch-and-bound search for the best ordering of the mandatory
// (required) places, plus a fallback that drops the least-important
// required places when no ordering can satisfy all of them.
//
// "Mandatory" here means isRequired: true only — a reservation on a
// non-required place does not force inclusion (see types.ts doc comment
// on FinalistPlace.isRequired); those are handled later, opportunistically,
// in optional-insertion.ts.

import type { FinalistPlace, GeoPoint, HangoutPlan } from "./types";
import type { StopSchedule } from "./schedule";
import { scheduleStop } from "./schedule";
import type { TravelTimeMatrix } from "./travel-time";
import { addMinutes } from "./time";

/** [totalTravelMinutes, totalOpeningHoursWaitMinutes, totalPreferredWindowDeviationMinutes] */
export type CostVector = [number, number, number];

export function lexCompare(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export interface OrderingSolution {
  order: FinalistPlace[];
  schedules: StopSchedule[];
  cost: CostVector;
}

/**
 * Finds the ordering of `places` (all of them — every place passed in is
 * treated as mandatory) that honors every reservation's tolerance window,
 * keeps every place within its opening hours, fits within plan.endTime
 * (if set), and — among orderings that do all that — minimizes
 * [travel time, opening-hours wait, preferred-window deviation] in that
 * order (priorities 5, 6, 7). Returns null if no such ordering exists.
 */
export function findBestOrdering(
  places: FinalistPlace[],
  plan: HangoutPlan,
  matrix: TravelTimeMatrix,
): OrderingSolution | null {
  if (places.length === 0) {
    return { order: [], schedules: [], cost: [0, 0, 0] };
  }

  let best: OrderingSolution | null = null;
  const visited = new Set<string>();
  const order: FinalistPlace[] = [];
  const schedules: StopSchedule[] = [];

  function dfs(previousLocation: GeoPoint, previousDeparture: Date, cost: CostVector) {
    if (best && lexCompare(cost, best.cost) > 0) return; // partial cost already worse than best (monotonic bound)

    if (visited.size === places.length) {
      // Account for the final leg to endLocation, if any, both for the
      // endTime check and so travel-time comparisons are apples-to-apples
      // with routes of the same stop count.
      let finalCost: CostVector = cost;
      let finalDeparture = previousDeparture;
      if (plan.endLocation) {
        const finalLegMinutes = matrix.get(previousLocation.id, plan.endLocation.id) + plan.bufferMinutes;
        finalDeparture = addMinutes(previousDeparture, finalLegMinutes);
        finalCost = [cost[0] + finalLegMinutes, cost[1], cost[2]];
      }
      if (plan.endTime && finalDeparture > plan.endTime) return;
      if (best && lexCompare(finalCost, best.cost) >= 0) return;

      best = { order: [...order], schedules: [...schedules], cost: finalCost };
      return;
    }

    for (const candidate of places) {
      if (visited.has(candidate.id)) continue;

      const schedule = scheduleStop(
        candidate,
        previousDeparture,
        previousLocation,
        plan.bufferMinutes,
        plan.transportationMode,
        matrix,
        plan.timezone,
      );

      if (candidate.reservation && !schedule.reservationHonored) continue;
      if (!schedule.fitsOpeningHours) continue; // required places must fit hours (hard gate)
      if (plan.endTime && schedule.visitEnd > plan.endTime) continue;

      const nextCost: CostVector = [
        cost[0] + schedule.travelMinutes,
        cost[1] + schedule.openingHoursWaitMinutes,
        cost[2] + schedule.preferredWindowDeviationMinutes,
      ];

      visited.add(candidate.id);
      order.push(candidate);
      schedules.push(schedule);

      dfs(candidate, schedule.visitEnd, nextCost);

      visited.delete(candidate.id);
      order.pop();
      schedules.pop();
    }
  }

  dfs(plan.startLocation, plan.startTime, [0, 0, 0]);
  return best;
}

export interface RequiredCoreResult {
  included: FinalistPlace[];
  dropped: FinalistPlace[];
  solution: OrderingSolution;
}

/**
 * Finds the best feasible ordering of `requiredPlaces`, dropping as few
 * as possible when the full set has no feasible ordering. Drop
 * preference (when a choice exists at the same drop count): keep
 * reservations over plain-required places, and among plain-required
 * places keep higher-voted ones — i.e. drop the lowest-voted,
 * non-reservation required place(s) first.
 */
export function solveRequiredCore(
  requiredPlaces: FinalistPlace[],
  plan: HangoutPlan,
  matrix: TravelTimeMatrix,
): RequiredCoreResult {
  const full = findBestOrdering(requiredPlaces, plan, matrix);
  if (full) return { included: requiredPlaces, dropped: [], solution: full };

  // Try dropping increasingly many places, cheapest-to-drop combinations first.
  for (let dropCount = 1; dropCount <= requiredPlaces.length; dropCount++) {
    const combos = combinationsOfIndices(requiredPlaces.length, dropCount).sort(
      (a, b) => dropCost(a, requiredPlaces) - dropCost(b, requiredPlaces),
    );
    for (const combo of combos) {
      const droppedSet = new Set(combo);
      const remaining = requiredPlaces.filter((_, i) => !droppedSet.has(i));
      const solution = findBestOrdering(remaining, plan, matrix);
      if (solution) {
        return {
          included: remaining,
          dropped: combo.map((i) => requiredPlaces[i]),
          solution,
        };
      }
    }
  }

  // Dropping every required place is always feasible (empty route).
  return {
    included: [],
    dropped: requiredPlaces,
    solution: { order: [], schedules: [], cost: [0, 0, 0] },
  };
}

function dropCost(combo: number[], places: FinalistPlace[]): number {
  return combo.reduce((sum, i) => {
    const place = places[i];
    // Lower score = tried earlier = preferred to drop. Reservations get a
    // large fixed penalty so every non-reservation combination at this
    // dropCount is tried first; within either group, lower-voted places
    // sort first (priority 4: prefer keeping highly-voted places).
    return sum + (place.reservation ? 1_000_000 + place.voteCount : place.voteCount);
  }, 0);
}

function combinationsOfIndices(n: number, k: number): number[][] {
  const results: number[][] = [];
  const current: number[] = [];
  function build(start: number) {
    if (current.length === k) {
      results.push([...current]);
      return;
    }
    for (let i = start; i < n; i++) {
      current.push(i);
      build(i + 1);
      current.pop();
    }
  }
  build(0);
  return results;
}
