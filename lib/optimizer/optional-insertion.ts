// Phase B: opportunistically insert optional (non-required) places into
// the required-core route, highest-voted first (priority 4), at whichever
// position adds the least travel/wait/preferred-window cost (priorities
// 5-7) without disturbing any reservation or required place's fit within
// its opening hours. A candidate that has no valid position anywhere is
// simply left out — it's priority 8, the lowest, so it never displaces
// anything already locked in by a higher priority.

import type { FinalistPlace, HangoutPlan } from "./types";
import type { RouteSimulation } from "./schedule";
import { simulateRoute } from "./schedule";
import type { TravelTimeMatrix } from "./travel-time";
import { lexCompare } from "./search";

export interface OptionalInsertionResult {
  order: FinalistPlace[];
  simulation: RouteSimulation;
  includedOptionalIds: string[];
  /** Optional places that were considered but couldn't be worked in, with why. */
  excluded: { place: FinalistPlace; reason: string }[];
}

export function insertOptionalPlaces(
  optionalPlaces: FinalistPlace[],
  baseOrder: FinalistPlace[],
  plan: HangoutPlan,
  matrix: TravelTimeMatrix,
): OptionalInsertionResult {
  // Stable sort preserves original relative order on vote ties, so results
  // are deterministic given a fixed input array.
  const candidates = [...optionalPlaces].sort((a, b) => b.voteCount - a.voteCount);

  let order = [...baseOrder];
  const includedOptionalIds: string[] = [];
  const excluded: { place: FinalistPlace; reason: string }[] = [];

  for (const candidate of candidates) {
    let bestPosition: { order: FinalistPlace[]; simulation: RouteSimulation } | null = null;
    let sawOpeningHoursFailureOnly = true;

    for (let position = 0; position <= order.length; position++) {
      const tentativeOrder = [
        ...order.slice(0, position),
        candidate,
        ...order.slice(position),
      ];
      const simulation = simulateRoute(tentativeOrder, plan, matrix);

      const candidateSchedule = simulation.schedules[position];
      const candidateFitsHours = candidateSchedule.fitsOpeningHours;

      if (!simulation.allReservationsHonored || !simulation.allRequiredFitOpeningHours || !simulation.withinEndTime) {
        sawOpeningHoursFailureOnly = false;
        continue;
      }
      if (!candidateFitsHours) continue; // this position doesn't work for the candidate itself

      const cost: [number, number, number] = [
        simulation.totalTravelMinutes,
        simulation.totalOpeningHoursWaitMinutes,
        simulation.totalPreferredWindowDeviationMinutes,
      ];
      const bestCost: [number, number, number] | null = bestPosition
        ? [
            bestPosition.simulation.totalTravelMinutes,
            bestPosition.simulation.totalOpeningHoursWaitMinutes,
            bestPosition.simulation.totalPreferredWindowDeviationMinutes,
          ]
        : null;

      if (!bestPosition || (bestCost && lexCompare(cost, bestCost) < 0)) {
        bestPosition = { order: tentativeOrder, simulation };
      }
    }

    if (bestPosition) {
      order = bestPosition.order;
      includedOptionalIds.push(candidate.id);
    } else {
      excluded.push({
        place: candidate,
        reason: sawOpeningHoursFailureOnly
          ? "doesn't fit its opening hours anywhere in the schedule"
          : "couldn't be fit in without disrupting a reservation, a required place's hours, or the end time",
      });
    }
  }

  return {
    order,
    simulation: simulateRoute(order, plan, matrix),
    includedOptionalIds,
    excluded,
  };
}
