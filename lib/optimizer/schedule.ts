// Per-stop scheduling: given where/when the traveler leaves the previous
// stop, computes arrival/visitStart/visitEnd for the next place, handling
// both reservation-pinned stops and plain opening-hours-driven stops.

import type { FinalistPlace, GeoPoint, HangoutPlan, TransportationMode } from "./types";
import { addMinutes, diffMinutes, getLocalParts, instantAtLocalMinutes, timeOfDayToMinutes } from "./time";
import { fitsWithinOpeningHours, isOpenAt, findNextOpenWindow } from "./opening-hours";
import type { TravelTimeMatrix } from "./travel-time";

export interface StopSchedule {
  arrival: Date;
  visitStart: Date;
  visitEnd: Date;
  /** Total time between arrival and visitStart (opening-hours wait, or reservation wait). */
  waitMinutes: number;
  /**
   * The subset of waitMinutes attributable to waiting for opening hours.
   * Reservation-driven waiting (arriving before the booked time) is
   * excluded — priority 6 ("minimize waiting before a place opens") is
   * about opening hours specifically, not reservation punctuality.
   */
  openingHoursWaitMinutes: number;
  travelMinutes: number;
  fitsOpeningHours: boolean;
  /** True when there's no reservation, or the reservation's tolerance window was honored. */
  reservationHonored: boolean;
  preferredWindowDeviationMinutes: number;
}

export function scheduleStop(
  place: FinalistPlace,
  previousDeparture: Date,
  previousLocation: GeoPoint,
  bufferMinutes: number,
  mode: TransportationMode,
  matrix: TravelTimeMatrix,
  timezone: string,
): StopSchedule {
  const travelMinutes = matrix.get(previousLocation.id, place.id);
  const arrival = addMinutes(previousDeparture, travelMinutes + bufferMinutes);

  let visitStart: Date;
  let waitMinutes: number;
  let openingHoursWaitMinutes: number;
  let reservationHonored: boolean;

  if (place.reservation) {
    const { time: reservationTime, toleranceMinutes = 10 } = place.reservation;
    // Tolerance only guards against arriving *late* — a reservation held
    // for 12:00 is honored whether you show up at 9am and wait or walk in
    // at 12:00 sharp; arriving more than toleranceMinutes after 12:00 is
    // the actual violation (you may have lost the table).
    reservationHonored = arrival <= addMinutes(reservationTime, toleranceMinutes);
    visitStart = arrival > reservationTime ? arrival : reservationTime;
    waitMinutes = Math.max(0, diffMinutes(visitStart, arrival));
    openingHoursWaitMinutes = 0;
  } else {
    reservationHonored = true;
    if (isOpenAt(place.openingHours, arrival, timezone)) {
      visitStart = arrival;
      waitMinutes = 0;
    } else {
      const next = findNextOpenWindow(place.openingHours, arrival, timezone);
      if (next) {
        visitStart = next.open;
        waitMinutes = diffMinutes(next.open, arrival);
      } else {
        // Never opens within the search horizon — schedule at arrival
        // anyway; fitsOpeningHours below will come back false.
        visitStart = arrival;
        waitMinutes = 0;
      }
    }
    openingHoursWaitMinutes = waitMinutes;
  }

  const visitEnd = addMinutes(visitStart, place.visitDurationMinutes);
  const fitsOpeningHours = fitsWithinOpeningHours(
    place.openingHours,
    visitStart,
    visitEnd,
    timezone,
  );
  const preferredWindowDeviationMinutes = place.preferredWindow
    ? computePreferredWindowDeviation(place.preferredWindow, visitStart, timezone)
    : 0;

  return {
    arrival,
    visitStart,
    visitEnd,
    waitMinutes,
    openingHoursWaitMinutes,
    travelMinutes,
    fitsOpeningHours,
    reservationHonored,
    preferredWindowDeviationMinutes,
  };
}

export interface RouteSimulation {
  schedules: StopSchedule[];
  totalTravelMinutes: number;
  totalOpeningHoursWaitMinutes: number;
  totalPreferredWindowDeviationMinutes: number;
  allReservationsHonored: boolean;
  allRequiredFitOpeningHours: boolean;
  finalDeparture: Date;
  /** Travel minutes for the final leg to plan.endLocation, if one was given. */
  finalLegMinutes: number | null;
  /** True when endTime is unset, or the route (including the final leg) completes by endTime. */
  withinEndTime: boolean;
}

/**
 * Walks `order` from plan.startLocation/startTime, scheduling each stop in
 * sequence, then (if plan.endLocation is set) accounts for the final leg
 * back to it. Pure re-simulation from scratch — used where the search
 * space is small enough that recomputing the whole route per candidate is
 * simpler and safer than threading incremental state (optional-place
 * insertion, and final assembly of the chosen route).
 */
export function simulateRoute(
  order: FinalistPlace[],
  plan: HangoutPlan,
  matrix: TravelTimeMatrix,
): RouteSimulation {
  const schedules: StopSchedule[] = [];
  let previousLocation = plan.startLocation;
  let previousDeparture = plan.startTime;

  let totalTravelMinutes = 0;
  let totalOpeningHoursWaitMinutes = 0;
  let totalPreferredWindowDeviationMinutes = 0;
  let allReservationsHonored = true;
  let allRequiredFitOpeningHours = true;

  for (const place of order) {
    const schedule = scheduleStop(
      place,
      previousDeparture,
      previousLocation,
      plan.bufferMinutes,
      plan.transportationMode,
      matrix,
      plan.timezone,
    );
    schedules.push(schedule);
    totalTravelMinutes += schedule.travelMinutes;
    totalOpeningHoursWaitMinutes += schedule.openingHoursWaitMinutes;
    totalPreferredWindowDeviationMinutes += schedule.preferredWindowDeviationMinutes;
    if (place.reservation && !schedule.reservationHonored) allReservationsHonored = false;
    if (place.isRequired && !schedule.fitsOpeningHours) allRequiredFitOpeningHours = false;

    previousLocation = place;
    previousDeparture = schedule.visitEnd;
  }

  let finalLegMinutes: number | null = null;
  let finalDeparture = previousDeparture;
  if (plan.endLocation) {
    finalLegMinutes = matrix.get(previousLocation.id, plan.endLocation.id) + plan.bufferMinutes;
    finalDeparture = addMinutes(previousDeparture, finalLegMinutes);
    totalTravelMinutes += finalLegMinutes;
  }

  const withinEndTime = !plan.endTime || finalDeparture <= plan.endTime;

  return {
    schedules,
    totalTravelMinutes,
    totalOpeningHoursWaitMinutes,
    totalPreferredWindowDeviationMinutes,
    allReservationsHonored,
    allRequiredFitOpeningHours,
    finalDeparture,
    finalLegMinutes,
    withinEndTime,
  };
}

function computePreferredWindowDeviation(
  preferredWindow: { open: string; close: string },
  visitStart: Date,
  timezone: string,
): number {
  const { year, month, date } = getLocalParts(visitStart, timezone);
  const openMin = timeOfDayToMinutes(preferredWindow.open);
  let closeMin = timeOfDayToMinutes(preferredWindow.close);
  if (closeMin <= openMin) closeMin += 1440;

  const open = instantAtLocalMinutes(timezone, year, month, date, openMin);
  const close = instantAtLocalMinutes(timezone, year, month, date, closeMin);

  if (visitStart < open) return diffMinutes(open, visitStart);
  if (visitStart > close) return diffMinutes(visitStart, close);
  return 0;
}
