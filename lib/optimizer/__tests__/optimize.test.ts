import { describe, expect, it } from "vitest";
import { optimizeItinerary } from "../optimize";
import {
  allPairsProvider,
  basePlan,
  everyDayHours,
  place,
  symmetricProvider,
  t,
} from "./fixtures";

describe("optimizeItinerary — simple feasible case", () => {
  it("sequences 3 required places with no reservations into the shortest-travel order", () => {
    const A = place({ id: "A", name: "A", isRequired: true, voteCount: 1 });
    const B = place({ id: "B", name: "B", isRequired: true, voteCount: 1 });
    const C = place({ id: "C", name: "C", isRequired: true, voteCount: 1 });

    // A straight line: start -> A -> B -> C is unambiguously the shortest
    // tour (15 min); every other ordering costs strictly more.
    const provider = symmetricProvider("driving", [
      ["start", "A", 5],
      ["A", "B", 5],
      ["B", "C", 5],
      ["start", "B", 10],
      ["start", "C", 15],
      ["A", "C", 10],
    ]);

    const plan = basePlan({ places: [C, A, B] }); // deliberately out of order
    const result = optimizeItinerary(plan, provider);

    expect(result.feasible).toBe(true);
    expect(result.conflicts.filter((c) => c.severity === "blocking")).toHaveLength(0);
    expect(result.itinerary.map((s) => s.placeId)).toEqual(["A", "B", "C"]);
    expect(result.includedPlaceIds.sort()).toEqual(["A", "B", "C"]);
    expect(result.metrics.totalTravelMinutes).toBe(15);
  });
});

describe("optimizeItinerary — reservation conflict", () => {
  it("flags two mutually-unhonorable reservations as blocking and drops the lower-voted one", () => {
    const D = place({
      id: "D",
      name: "D",
      isRequired: true,
      voteCount: 5,
      visitDurationMinutes: 30,
      reservation: { time: t("12:00") },
    });
    const E = place({
      id: "E",
      name: "E",
      isRequired: true,
      voteCount: 2,
      visitDurationMinutes: 30,
      reservation: { time: t("12:05") },
    });

    // Far apart — arriving at either place from the other, after visiting
    // the first, is always well outside the other's 10-minute tolerance.
    const provider = symmetricProvider("driving", [
      ["start", "D", 5],
      ["start", "E", 5],
      ["D", "E", 60],
    ]);

    const plan = basePlan({ places: [D, E] });
    const result = optimizeItinerary(plan, provider);

    expect(result.feasible).toBe(false);
    const reservationConflict = result.conflicts.find((c) => c.code === "reservation_conflict");
    expect(reservationConflict?.severity).toBe("blocking");
    expect(reservationConflict?.placeIds.sort()).toEqual(["D", "E"]);

    // Lower-voted E is the one dropped; D (higher-voted) stays on the itinerary.
    expect(result.excludedRequiredPlaceIds).toEqual(["E"]);
    expect(result.includedPlaceIds).toEqual(["D"]);
    expect(result.itinerary).toHaveLength(1);
    expect(result.itinerary[0].placeId).toBe("D");
  });
});

describe("optimizeItinerary — opening hours conflicts on required places (blocking, with a reason)", () => {
  it("blocks with 'closed all day' when a required place has no opening windows at all", () => {
    const F = place({ id: "F", name: "F", isRequired: true, voteCount: 1, openingHours: {} });
    const G = place({ id: "G", name: "G", isRequired: true, voteCount: 1 });

    const provider = symmetricProvider("driving", [
      ["start", "F", 5],
      ["start", "G", 5],
      ["F", "G", 5],
    ]);

    const plan = basePlan({ places: [F, G] });
    const result = optimizeItinerary(plan, provider);

    expect(result.feasible).toBe(false);
    const conflict = result.conflicts.find((c) => c.placeIds.includes("F"));
    expect(conflict?.severity).toBe("blocking");
    expect(conflict?.code).toBe("required_place_closed_all_day");
    expect(result.excludedRequiredPlaceIds).toEqual(["F"]);
    // G is unaffected — still gets a valid best-effort itinerary.
    expect(result.includedPlaceIds).toEqual(["G"]);
  });

  it("blocks with 'hours unreachable' when a required place's (real) hours can't be reached in time", () => {
    const H = place({
      id: "H",
      name: "H",
      isRequired: true,
      voteCount: 1,
      openingHours: everyDayHours("09:00", "09:30"),
    });

    // 60 min travel + 10 min buffer means arrival is 10:10 — the 09:00-09:30
    // window is long closed by then, on every day (everyDayHours).
    const provider = symmetricProvider("driving", [["start", "H", 60]]);

    const plan = basePlan({ places: [H] });
    const result = optimizeItinerary(plan, provider);

    expect(result.feasible).toBe(false);
    const conflict = result.conflicts.find((c) => c.placeIds.includes("H"));
    expect(conflict?.severity).toBe("blocking");
    expect(conflict?.code).toBe("required_place_hours_unreachable");
    expect(result.excludedRequiredPlaceIds).toEqual(["H"]);
    expect(result.itinerary).toHaveLength(0);
  });
});

describe("optimizeItinerary — optional place dropped to fit", () => {
  it("excludes an optional place that can't fit anywhere, as a suggestion, and still returns a valid itinerary", () => {
    const A = place({ id: "A", name: "A", isRequired: true, voteCount: 1 });
    const B = place({ id: "B", name: "B", isRequired: true, voteCount: 1 });
    // Never open at all — no position will ever let it fit.
    const O = place({ id: "O", name: "O", isRequired: false, voteCount: 3, openingHours: {} });

    const provider = symmetricProvider("driving", [
      ["start", "A", 5],
      ["start", "B", 5],
      ["start", "O", 5],
      ["A", "B", 5],
      ["A", "O", 5],
      ["B", "O", 5],
    ]);

    const plan = basePlan({ places: [A, B, O] });
    const result = optimizeItinerary(plan, provider);

    expect(result.feasible).toBe(true);
    expect(result.conflicts.filter((c) => c.severity === "blocking")).toHaveLength(0);
    expect(result.includedPlaceIds.sort()).toEqual(["A", "B"]);
    expect(result.excludedOptionalPlaceIds).toEqual(["O"]);

    const suggestion = result.conflicts.find((c) => c.placeIds.includes("O"));
    expect(suggestion?.severity).toBe("suggestion");
    expect(suggestion?.code).toBe("optional_place_dropped");
  });
});

describe("optimizeItinerary — full 8-finalist case", () => {
  it("produces a feasible itinerary with 3 required, 1 required+reservation, and 4 optional places", () => {
    const required = [
      place({ id: "R1", name: "R1", isRequired: true, voteCount: 4 }),
      place({ id: "R2", name: "R2", isRequired: true, voteCount: 6 }),
      place({ id: "R3", name: "R3", isRequired: true, voteCount: 2 }),
      place({
        id: "R4",
        name: "R4",
        isRequired: true,
        voteCount: 8,
        visitDurationMinutes: 30,
        reservation: { time: t("13:00") },
      }),
    ];
    const optional = [
      place({ id: "O1", name: "O1", voteCount: 9 }),
      place({ id: "O2", name: "O2", voteCount: 7 }),
      place({ id: "O3", name: "O3", voteCount: 3 }),
      place({ id: "O4", name: "O4", voteCount: 1 }),
    ];
    const allPlaces = [...required, ...optional];
    const ids = ["start", ...allPlaces.map((p) => p.id)];

    // Deterministic, modest travel times (8-19 min) between every pair.
    const provider = allPairsProvider("driving", ids, (i, j) => 8 + ((i * 5 + j * 3) % 12));

    const plan = basePlan({
      places: allPlaces,
      endTime: t("20:00"), // 11-hour window, generous for ~8 short visits
    });

    const result = optimizeItinerary(plan, provider);

    expect(result.feasible).toBe(true);
    expect(result.conflicts.filter((c) => c.severity === "blocking")).toHaveLength(0);
    expect(result.itinerary).toHaveLength(8);
    expect(result.includedPlaceIds.sort()).toEqual(allPlaces.map((p) => p.id).sort());

    const reservationStop = result.itinerary.find((s) => s.placeId === "R4");
    expect(reservationStop?.isReservation).toBe(true);
    const deviationMs = Math.abs(reservationStop!.visitStart.getTime() - t("13:00").getTime());
    expect(deviationMs).toBeLessThanOrEqual(10 * 60_000);

    const expectedVoteScore = allPlaces.reduce((sum, p) => sum + p.voteCount, 0);
    expect(result.metrics.voteScore).toBe(expectedVoteScore);
  });
});

describe("optimizeItinerary — vote-count tiebreaking for optional places", () => {
  it("prioritizes the higher-voted optional place when only one can fit, regardless of input order", () => {
    const R = place({ id: "R", name: "R", isRequired: true, voteCount: 1, visitDurationMinutes: 30 });
    const L = place({ id: "L", name: "L", isRequired: false, voteCount: 1, visitDurationMinutes: 30 });
    const H = place({ id: "H", name: "H", isRequired: false, voteCount: 10, visitDurationMinutes: 30 });

    const provider = symmetricProvider("driving", [
      ["start", "R", 5],
      ["start", "H", 5],
      ["start", "L", 5],
      ["R", "H", 5],
      ["R", "L", 5],
      ["H", "L", 5],
    ]);

    // Tight enough that only one optional place (30 min visit + ~15 min
    // transit) fits alongside R after 09:00; L is listed first in the
    // input to prove selection follows votes, not array order.
    const plan = basePlan({ places: [L, R, H], endTime: t("10:30") });
    const result = optimizeItinerary(plan, provider);

    expect(result.feasible).toBe(true);
    expect(result.includedPlaceIds).toContain("H");
    expect(result.includedPlaceIds).not.toContain("L");
    expect(result.excludedOptionalPlaceIds).toEqual(["L"]);

    const suggestion = result.conflicts.find((c) => c.placeIds.includes("L"));
    expect(suggestion?.severity).toBe("suggestion");
    expect(suggestion?.code).toBe("optional_place_dropped");
  });
});
