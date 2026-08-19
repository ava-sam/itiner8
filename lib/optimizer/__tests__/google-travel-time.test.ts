import { describe, expect, it, vi } from "vitest";
import {
  GoogleRoutesApiError,
  GoogleRoutesTravelTimeProvider,
  RouteNotFoundError,
  buildComputeRoutesRequestBody,
  buildRouteMatrixRequestBody,
  parseComputeRoutesResponse,
  parseDurationToMinutes,
  parseRouteMatrixResponse,
} from "../google-travel-time";
import type { GeoPoint } from "../types";

const NOW = new Date("2026-08-20T16:00:00.000Z");
const FUTURE = new Date("2026-08-20T18:00:00.000Z");
const PAST = new Date("2026-08-20T10:00:00.000Z");

const START: GeoPoint = { id: "start", lat: 37.7749, lng: -122.4194 };
const A: GeoPoint = { id: "A", lat: 37.78, lng: -122.41 };
const B: GeoPoint = { id: "B", lat: 37.79, lng: -122.42 };

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("parseDurationToMinutes", () => {
  it("parses whole and fractional second durations, rounding to the nearest minute", () => {
    expect(parseDurationToMinutes("300s")).toBe(5);
    expect(parseDurationToMinutes("330s")).toBe(6); // 5.5 -> rounds to 6
    expect(parseDurationToMinutes("29s")).toBe(0);
    expect(parseDurationToMinutes("12.5s")).toBe(0);
  });

  it("throws GoogleRoutesApiError on an unrecognized format", () => {
    expect(() => parseDurationToMinutes("5 minutes")).toThrow(GoogleRoutesApiError);
  });
});

describe("buildRouteMatrixRequestBody — request shaping", () => {
  it("includes TRAFFIC_AWARE routingPreference and departureTime for DRIVE", () => {
    const body = buildRouteMatrixRequestBody([START, A], "DRIVE", FUTURE, NOW);
    expect(body.travelMode).toBe("DRIVE");
    expect(body.routingPreference).toBe("TRAFFIC_AWARE");
    expect(body.departureTime).toBe(FUTURE.toISOString());
    expect(body.origins).toHaveLength(2);
    expect(body.origins[0]).toEqual({
      waypoint: { location: { latLng: { latitude: START.lat, longitude: START.lng } } },
    });
    expect(body.destinations).toEqual(body.origins);
  });

  it("omits routingPreference and departureTime for WALK", () => {
    const body = buildRouteMatrixRequestBody([START, A], "WALK", FUTURE, NOW);
    expect(body.travelMode).toBe("WALK");
    expect(body.routingPreference).toBeUndefined();
    expect(body.departureTime).toBeUndefined();
  });

  it("omits departureTime (falls back to Google's default of 'now') when it's in the past", () => {
    const body = buildRouteMatrixRequestBody([START, A], "DRIVE", PAST, NOW);
    expect(body.departureTime).toBeUndefined();
  });
});

describe("buildComputeRoutesRequestBody — TRANSIT single-pair shaping", () => {
  it("shapes an origin/destination pair with travelMode TRANSIT and a future departureTime", () => {
    const body = buildComputeRoutesRequestBody(START, A, FUTURE, NOW);
    expect(body.travelMode).toBe("TRANSIT");
    expect(body.origin).toEqual({ location: { latLng: { latitude: START.lat, longitude: START.lng } } });
    expect(body.destination).toEqual({ location: { latLng: { latitude: A.lat, longitude: A.lng } } });
    expect(body.departureTime).toBe(FUTURE.toISOString());
  });
});

describe("parseRouteMatrixResponse", () => {
  const points = [START, A, B];

  it("parses a realistic matrix response into minutes keyed by pair, skipping self-pairs", () => {
    const body = [
      { originIndex: 0, destinationIndex: 0, condition: "ROUTE_EXISTS", duration: "0s", distanceMeters: 0 },
      { originIndex: 0, destinationIndex: 1, condition: "ROUTE_EXISTS", duration: "300s", distanceMeters: 1200 },
      { originIndex: 0, destinationIndex: 2, condition: "ROUTE_EXISTS", duration: "600s", distanceMeters: 2400 },
      { originIndex: 1, destinationIndex: 0, condition: "ROUTE_EXISTS", duration: "310s", distanceMeters: 1200 },
      { originIndex: 1, destinationIndex: 2, condition: "ROUTE_NOT_FOUND" },
      { originIndex: 2, destinationIndex: 0, condition: "ROUTE_EXISTS", duration: "590s", distanceMeters: 2400 },
      { originIndex: 2, destinationIndex: 1, status: { code: 5, message: "not found" } },
    ];

    const { minutesByPair, notFoundPairs } = parseRouteMatrixResponse(points, body);

    expect(minutesByPair.get("start=>A")).toBe(5);
    expect(minutesByPair.get("start=>B")).toBe(10);
    expect(minutesByPair.get("A=>start")).toBe(5);
    expect(minutesByPair.get("B=>start")).toBe(10);
    expect(minutesByPair.has("A=>B")).toBe(false);
    expect(minutesByPair.has("B=>A")).toBe(false);

    expect(notFoundPairs).toContainEqual({ fromId: "A", toId: "B" });
    expect(notFoundPairs).toContainEqual({ fromId: "B", toId: "A" });
  });

  it("throws GoogleRoutesApiError if the response isn't a JSON array", () => {
    expect(() => parseRouteMatrixResponse(points, { unexpected: true })).toThrow(GoogleRoutesApiError);
  });
});

describe("parseComputeRoutesResponse", () => {
  it("extracts minutes from the first route", () => {
    expect(parseComputeRoutesResponse({ routes: [{ duration: "900s" }] })).toBe(15);
  });

  it("returns null when there are no routes", () => {
    expect(parseComputeRoutesResponse({ routes: [] })).toBeNull();
    expect(parseComputeRoutesResponse({})).toBeNull();
  });
});

describe("GoogleRoutesTravelTimeProvider — DRIVE/WALK (matrix endpoint)", () => {
  it("makes exactly one batched computeRouteMatrix call and serves every pair from cache after that", async () => {
    const matrixResponse = [
      { originIndex: 0, destinationIndex: 1, condition: "ROUTE_EXISTS", duration: "300s" },
      { originIndex: 1, destinationIndex: 0, condition: "ROUTE_EXISTS", duration: "300s" },
      { originIndex: 0, destinationIndex: 2, condition: "ROUTE_EXISTS", duration: "600s" },
      { originIndex: 2, destinationIndex: 0, condition: "ROUTE_EXISTS", duration: "600s" },
      { originIndex: 1, destinationIndex: 2, condition: "ROUTE_EXISTS", duration: "420s" },
      { originIndex: 2, destinationIndex: 1, condition: "ROUTE_EXISTS", duration: "420s" },
    ];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix");
      const headers = init.headers as Record<string, string>;
      expect(headers["X-Goog-Api-Key"]).toBe("test-key");
      expect(headers["X-Goog-FieldMask"]).toContain("duration");
      const body = JSON.parse(init.body as string);
      expect(body.travelMode).toBe("DRIVE");
      expect(body.routingPreference).toBe("TRAFFIC_AWARE");
      return mockJsonResponse(matrixResponse);
    });

    const provider = await GoogleRoutesTravelTimeProvider.create({
      points: [START, A, B],
      mode: "driving",
      departureTime: FUTURE,
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(provider.getTravelTimeMinutes(START, A, "driving")).toBe(5);
    expect(provider.getTravelTimeMinutes(A, START, "driving")).toBe(5);
    expect(provider.getTravelTimeMinutes(START, B, "driving")).toBe(10);
    expect(provider.getTravelTimeMinutes(A, B, "driving")).toBe(7);
    expect(provider.getTravelTimeMinutes(START, START, "driving")).toBe(0);

    // Query the same pairs again — still just the one warm-up call.
    provider.getTravelTimeMinutes(START, A, "driving");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("surfaces an HTTP failure as GoogleRoutesApiError, distinguishable from a missing route", async () => {
    const fetchImpl = vi.fn(async () => mockJsonResponse({ error: "invalid key" }, false, 403));

    await expect(
      GoogleRoutesTravelTimeProvider.create({
        points: [START, A],
        mode: "driving",
        apiKey: "bad-key",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(GoogleRoutesApiError);
  });

  it("throws RouteNotFoundError (not a generic API error) when Google reports no route for a specific pair", async () => {
    const fetchImpl = vi.fn(async () =>
      mockJsonResponse([{ originIndex: 0, destinationIndex: 1, condition: "ROUTE_NOT_FOUND" }]),
    );

    const provider = await GoogleRoutesTravelTimeProvider.create({
      points: [START, A],
      mode: "walking",
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(() => provider.getTravelTimeMinutes(START, A, "walking")).toThrow(RouteNotFoundError);
  });
});

describe("GoogleRoutesTravelTimeProvider — TRANSIT (per-pair fallback)", () => {
  it("calls computeRoutes once per ordered pair (matrix endpoint doesn't support TRANSIT)", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      calls.push({ url, body });
      expect(body.travelMode).toBe("TRANSIT");
      return mockJsonResponse({ routes: [{ duration: "600s" }] });
    });

    const provider = await GoogleRoutesTravelTimeProvider.create({
      points: [START, A, B],
      mode: "transit",
      departureTime: FUTURE,
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // 3 points -> 6 ordered pairs, one computeRoutes call each.
    expect(fetchImpl).toHaveBeenCalledTimes(6);
    expect(calls.every((c) => c.url === "https://routes.googleapis.com/directions/v2:computeRoutes")).toBe(true);
    expect(provider.getTravelTimeMinutes(START, A, "transit")).toBe(10);

    // No further network calls once cached.
    provider.getTravelTimeMinutes(START, A, "transit");
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });
});
