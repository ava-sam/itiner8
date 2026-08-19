import { describe, expect, it } from "vitest";
import { getLocalParts, instantAtLocalMinutes, timeOfDayToMinutes } from "../time";

// These assertions are chosen to hold regardless of the host machine's own
// default timezone — that's the whole point of time.ts (see its comments).
// Aug 20 2026 is outside any DST transition window for these zones, so the
// UTC offsets below are stable.

describe("timeOfDayToMinutes", () => {
  it("parses HH:MM", () => {
    expect(timeOfDayToMinutes("00:00")).toBe(0);
    expect(timeOfDayToMinutes("09:30")).toBe(570);
    expect(timeOfDayToMinutes("23:59")).toBe(1439);
  });

  it("rejects malformed or out-of-range input", () => {
    expect(() => timeOfDayToMinutes("9:5")).toThrow();
    expect(() => timeOfDayToMinutes("25:00")).toThrow();
    expect(() => timeOfDayToMinutes("not-a-time")).toThrow();
  });
});

describe("getLocalParts", () => {
  it("decomposes an instant into Tokyo (UTC+9) wall-clock parts", () => {
    // 2026-08-20T16:00:00Z -> 2026-08-21 01:00 in Tokyo
    const instant = new Date("2026-08-20T16:00:00.000Z");
    const parts = getLocalParts(instant, "Asia/Tokyo");
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(7); // August, 0-indexed
    expect(parts.date).toBe(21);
    expect(parts.minutesOfDay).toBe(60); // 01:00
    expect(parts.dayOfWeek).toBe(5); // Friday
  });

  it("decomposes the same instant into New York (UTC-4 in August) wall-clock parts", () => {
    // 2026-08-20T16:00:00Z -> 2026-08-20 12:00 in New York (EDT, UTC-4)
    const instant = new Date("2026-08-20T16:00:00.000Z");
    const parts = getLocalParts(instant, "America/New_York");
    expect(parts.date).toBe(20);
    expect(parts.minutesOfDay).toBe(720); // 12:00
  });
});

describe("instantAtLocalMinutes", () => {
  it("round-trips with getLocalParts", () => {
    const timezone = "Asia/Tokyo";
    const instant = instantAtLocalMinutes(timezone, 2026, 7, 20, 9 * 60); // 09:00 Tokyo
    expect(instant.toISOString()).toBe("2026-08-20T00:00:00.000Z");

    const parts = getLocalParts(instant, timezone);
    expect(parts.minutesOfDay).toBe(9 * 60);
    expect(parts.date).toBe(20);
  });

  it("rolls minutesOfDay >= 1440 into the next calendar day", () => {
    const timezone = "America/New_York";
    // 25:00 on Aug 20 = 01:00 on Aug 21
    const instant = instantAtLocalMinutes(timezone, 2026, 7, 20, 25 * 60);
    const parts = getLocalParts(instant, timezone);
    expect(parts.date).toBe(21);
    expect(parts.minutesOfDay).toBe(60);
  });
});
