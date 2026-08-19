// Shared builders for optimizer tests: fixture places, a fixture hangout
// plan, and fixture (fake, in-memory) travel-time providers. No network,
// no DB — everything here is plain data.

import { MatrixTravelTimeProvider } from "../travel-time";
import { instantAtLocalMinutes } from "../time";
import type {
  FinalistPlace,
  GeoPoint,
  HangoutPlan,
  OpeningHours,
  TransportationMode,
} from "../types";

export const TZ = "America/Los_Angeles";
/** 2026-08-20 is a Thursday (DayOfWeek 4) — the fixed "today" for all fixtures below. */
export const FIXTURE_DAY = 20;
export const FIXTURE_DOW = 4 as const;

/** Local wall-clock time on the fixture day (or fixture day + dayOffset). */
export function t(hhmm: string, dayOffset = 0): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return instantAtLocalMinutes(TZ, 2026, 7, FIXTURE_DAY + dayOffset, h * 60 + m);
}

export function everyDayHours(open: string, close: string): OpeningHours {
  const windows = [{ open, close }];
  return { 0: windows, 1: windows, 2: windows, 3: windows, 4: windows, 5: windows, 6: windows };
}

export function point(id: string): GeoPoint {
  return { id, lat: 0, lng: 0 };
}

export function place(
  overrides: Partial<FinalistPlace> & { id: string; name: string },
): FinalistPlace {
  return {
    lat: 0,
    lng: 0,
    openingHours: everyDayHours("09:00", "21:00"),
    visitDurationMinutes: 45,
    isRequired: false,
    voteCount: 0,
    ...overrides,
  };
}

export function basePlan(overrides: Partial<HangoutPlan> = {}): HangoutPlan {
  return {
    timezone: TZ,
    startLocation: point("start"),
    startTime: t("09:00"),
    transportationMode: "driving",
    bufferMinutes: 10,
    places: [],
    ...overrides,
  };
}

/** Builds a fixture provider from symmetric pairwise minutes: both directions get the same value. */
export function symmetricProvider(
  mode: TransportationMode,
  pairs: [string, string, number][],
): MatrixTravelTimeProvider {
  const table: Record<string, Record<string, number>> = {};
  for (const [a, b, minutes] of pairs) {
    (table[a] ??= {})[b] = minutes;
    (table[b] ??= {})[a] = minutes;
  }
  return new MatrixTravelTimeProvider({ [mode]: table });
}

/** All-pairs fixture provider for a full point-id list, minutes from a deterministic formula. */
export function allPairsProvider(
  mode: TransportationMode,
  ids: string[],
  minutesFn: (i: number, j: number) => number,
): MatrixTravelTimeProvider {
  const pairs: [string, string, number][] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push([ids[i], ids[j], minutesFn(i, j)]);
    }
  }
  return symmetricProvider(mode, pairs);
}
