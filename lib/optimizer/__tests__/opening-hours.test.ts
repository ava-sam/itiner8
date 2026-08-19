import { describe, expect, it } from "vitest";
import {
  fitsWithinOpeningHours,
  findNextOpenWindow,
  isClosedForEntireRange,
  isOpenAt,
} from "../opening-hours";
import { instantAtLocalMinutes } from "../time";
import type { OpeningHours } from "../types";

const TZ = "America/Los_Angeles";
// 2026-08-20 is a Thursday (day 4).
const THU = 4 as const;
const FRI = 5 as const;
const SAT = 6 as const;

function at(hhmm: string, dayOffset = 0): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return instantAtLocalMinutes(TZ, 2026, 7, 20 + dayOffset, h * 60 + m);
}

describe("isOpenAt / fitsWithinOpeningHours — plain daytime hours", () => {
  const hours: OpeningHours = { [THU]: [{ open: "09:00", close: "17:00" }] };

  it("is open inside the window and closed outside it", () => {
    expect(isOpenAt(hours, at("09:00"), TZ)).toBe(true);
    expect(isOpenAt(hours, at("12:00"), TZ)).toBe(true);
    expect(isOpenAt(hours, at("16:59"), TZ)).toBe(true);
    expect(isOpenAt(hours, at("17:00"), TZ)).toBe(false); // close is exclusive
    expect(isOpenAt(hours, at("08:59"), TZ)).toBe(false);
  });

  it("fits a visit fully inside the window, rejects one that runs past close", () => {
    expect(fitsWithinOpeningHours(hours, at("15:00"), at("16:30"), TZ)).toBe(true);
    expect(fitsWithinOpeningHours(hours, at("16:00"), at("17:30"), TZ)).toBe(false);
  });
});

describe("overnight windows (close <= open spans past midnight)", () => {
  const hours: OpeningHours = { [FRI]: [{ open: "22:00", close: "02:00" }] };

  it("is open late Friday night and into the small hours of Saturday", () => {
    expect(isOpenAt(hours, at("23:00", 1), TZ)).toBe(true); // Fri 23:00
    expect(isOpenAt(hours, at("01:00", 2), TZ)).toBe(true); // Sat 01:00, spillover
    expect(isOpenAt(hours, at("03:00", 2), TZ)).toBe(false); // Sat 03:00, past close
    expect(isOpenAt(hours, at("21:00", 1), TZ)).toBe(false); // Fri 21:00, before open
  });
});

describe("findNextOpenWindow", () => {
  it("finds the same day's window when arriving before it opens", () => {
    const hours: OpeningHours = { [THU]: [{ open: "09:00", close: "17:00" }] };
    const next = findNextOpenWindow(hours, at("07:00"), TZ);
    expect(next?.open.getTime()).toBe(at("09:00").getTime());
  });

  it("skips a closed day to find a later window within the horizon", () => {
    const hours: OpeningHours = { [SAT]: [{ open: "10:00", close: "14:00" }] };
    // Thursday has no window at all; next open is Saturday.
    const next = findNextOpenWindow(hours, at("07:00"), TZ, 5);
    expect(next?.open.getTime()).toBe(at("10:00", 2).getTime());
  });

  it("returns null when nothing opens within the horizon", () => {
    const hours: OpeningHours = {}; // closed every day
    expect(findNextOpenWindow(hours, at("07:00"), TZ, 3)).toBeNull();
  });
});

describe("isClosedForEntireRange", () => {
  it("is true when there are no windows on any day in range", () => {
    expect(isClosedForEntireRange({}, at("09:00"), at("09:00"), TZ)).toBe(true);
  });

  it("is false when at least one day in range has a window", () => {
    const hours: OpeningHours = { [THU]: [{ open: "09:00", close: "17:00" }] };
    expect(isClosedForEntireRange(hours, at("09:00"), at("09:00"), TZ)).toBe(false);
  });
});
