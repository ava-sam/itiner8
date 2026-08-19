// Local wall-clock <-> instant conversions, timezone-aware via date-fns-tz.
// Kept separate from opening-hours.ts because these are generic time
// utilities, while opening-hours.ts encodes the domain rules for windows.

import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { DayOfWeek, TimeOfDay } from "./types";

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function diffMinutes(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 60_000;
}

/** Formats minutes-since-midnight back into "HH:MM" (inverse of timeOfDayToMinutes). */
export function minutesOfDayToTimeOfDay(minutes: number): TimeOfDay {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const hours = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const mins = String(wrapped % 60).padStart(2, "0");
  return `${hours}:${mins}`;
}

/** Parses "HH:MM" into minutes since local midnight. */
export function timeOfDayToMinutes(t: TimeOfDay): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!match) {
    throw new Error(`Invalid TimeOfDay "${t}" — expected "HH:MM"`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid TimeOfDay "${t}" — hours/minutes out of range`);
  }
  return hours * 60 + minutes;
}

export interface LocalParts {
  dayOfWeek: DayOfWeek;
  minutesOfDay: number;
  year: number;
  month: number; // 0-indexed, matches Date
  date: number;
}

/**
 * Decomposes an instant into its local wall-clock parts in `timezone`.
 *
 * Note on date-fns-tz usage: toZonedTime returns a Date built via the
 * *local* (system-timezone) Date setters, meant to be read back via the
 * *local* getters (getDate/getHours/...), not the UTC ones — reading it
 * with getUTC* would silently reintroduce the host's own timezone. Local
 * getters/setters round-trip correctly no matter what the host TZ is, so
 * this function's result doesn't depend on the server's local timezone.
 */
export function getLocalParts(instant: Date, timezone: string): LocalParts {
  const zoned = toZonedTime(instant, timezone);
  return {
    dayOfWeek: zoned.getDay() as DayOfWeek,
    minutesOfDay: zoned.getHours() * 60 + zoned.getMinutes(),
    year: zoned.getFullYear(),
    month: zoned.getMonth(),
    date: zoned.getDate(),
  };
}

/**
 * Builds the instant corresponding to local calendar date (year, month,
 * date) + `minutesOfDay` in `timezone`. minutesOfDay may be negative or
 * >= 1440 — it rolls into the adjacent calendar date(s).
 *
 * Mirrors getLocalParts' host-timezone independence: fromZonedTime reads
 * a Date argument via *local* getters, so the "wall clock" value handed
 * to it here is built with the local Date constructor, not Date.UTC.
 */
export function instantAtLocalMinutes(
  timezone: string,
  year: number,
  month: number,
  date: number,
  minutesOfDay: number,
): Date {
  const dayOffset = Math.floor(minutesOfDay / 1440);
  const wrapped = ((minutesOfDay % 1440) + 1440) % 1440;
  const wallClock = new Date(
    year,
    month,
    date + dayOffset,
    Math.floor(wrapped / 60),
    wrapped % 60,
  );
  return fromZonedTime(wallClock, timezone);
}
