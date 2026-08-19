// Opening-hours window resolution. All checks are timezone-aware via
// time.ts and handle windows that span past local midnight (close <= open
// means "closes the next calendar day").

import type { DayOfWeek, OpeningHours } from "./types";
import { getLocalParts, instantAtLocalMinutes, timeOfDayToMinutes } from "./time";

export interface ResolvedWindow {
  open: Date;
  close: Date;
}

/**
 * Resolves the concrete open/close instants "around" a given instant: the
 * instant's own local calendar day, plus the previous calendar day (so an
 * overnight window from yesterday that spills past midnight is still
 * considered active). This is sufficient for typical same-day hangout
 * scheduling; it is not a general-purpose recurring-hours expander.
 */
export function getActiveWindowsNearInstant(
  openingHours: OpeningHours,
  instant: Date,
  timezone: string,
): ResolvedWindow[] {
  const { dayOfWeek, year, month, date } = getLocalParts(instant, timezone);
  const results: ResolvedWindow[] = [];

  for (const dayOffset of [-1, 0] as const) {
    const dow = (((dayOfWeek + dayOffset) % 7) + 7) % 7 as DayOfWeek;
    const windows = openingHours[dow] ?? [];
    for (const w of windows) {
      const openMin = timeOfDayToMinutes(w.open);
      let closeMin = timeOfDayToMinutes(w.close);
      if (closeMin <= openMin) closeMin += 1440; // overnight spillover
      results.push({
        open: instantAtLocalMinutes(timezone, year, month, date + dayOffset, openMin),
        close: instantAtLocalMinutes(timezone, year, month, date + dayOffset, closeMin),
      });
    }
  }

  return results.sort((a, b) => a.open.getTime() - b.open.getTime());
}

export function isOpenAt(
  openingHours: OpeningHours,
  instant: Date,
  timezone: string,
): boolean {
  return getActiveWindowsNearInstant(openingHours, instant, timezone).some(
    (w) => w.open <= instant && instant < w.close,
  );
}

/** True when the entire [visitStart, visitEnd) interval fits inside a single window. */
export function fitsWithinOpeningHours(
  openingHours: OpeningHours,
  visitStart: Date,
  visitEnd: Date,
  timezone: string,
): boolean {
  return getActiveWindowsNearInstant(openingHours, visitStart, timezone).some(
    (w) => w.open <= visitStart && visitEnd <= w.close,
  );
}

/**
 * Earliest window with open >= fromInstant (or covering it), searched
 * across a short forward horizon. Returns null if nothing opens within
 * that horizon (a strong signal the place is effectively unreachable
 * within any plausible hangout window, not just "closed today").
 */
export function findNextOpenWindow(
  openingHours: OpeningHours,
  fromInstant: Date,
  timezone: string,
  horizonDays = 3,
): ResolvedWindow | null {
  for (let dayOffset = 0; dayOffset <= horizonDays; dayOffset++) {
    const probeInstant = new Date(fromInstant.getTime() + dayOffset * 86_400_000);
    const windows = getActiveWindowsNearInstant(openingHours, probeInstant, timezone);
    const candidates = windows
      .filter((w) => w.close > fromInstant && w.open >= fromInstant)
      .sort((a, b) => a.open.getTime() - b.open.getTime());
    if (candidates.length > 0) return candidates[0];

    // Also consider a window that already covers fromInstant itself.
    const covering = windows.find((w) => w.open <= fromInstant && fromInstant < w.close);
    if (covering) return covering;
  }
  return null;
}

/** True if the place has zero opening windows on every day within [start, end]. */
export function isClosedForEntireRange(
  openingHours: OpeningHours,
  start: Date,
  end: Date,
  timezone: string,
): boolean {
  const spanMs = Math.max(0, end.getTime() - start.getTime());
  const spanDays = Math.ceil(spanMs / 86_400_000) + 1;
  for (let dayOffset = 0; dayOffset <= spanDays; dayOffset++) {
    const probe = new Date(start.getTime() + dayOffset * 86_400_000);
    const { dayOfWeek } = getLocalParts(probe, timezone);
    if ((openingHours[dayOfWeek] ?? []).length > 0) return false;
  }
  return true;
}

export function describeOpeningHours(openingHours: OpeningHours): string {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const entries = (Object.keys(openingHours) as unknown as string[])
    .map(Number)
    .sort((a, b) => a - b)
    .map((day) => {
      const windows = openingHours[day as DayOfWeek] ?? [];
      if (windows.length === 0) return `${dayNames[day]}: closed`;
      return `${dayNames[day]}: ${windows.map((w) => `${w.open}-${w.close}`).join(", ")}`;
    });
  return entries.length > 0 ? entries.join("; ") : "closed every day";
}
