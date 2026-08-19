// Google Routes API-backed TravelTimeProvider. Implements the same
// synchronous TravelTimeProvider interface as the fixture
// MatrixTravelTimeProvider (see travel-time.ts) — optimizer logic
// (search.ts/schedule.ts/optional-insertion.ts/conflicts.ts) is untouched
// and has no idea which implementation it's talking to.
//
// The interface itself is synchronous, but a real Google API call is
// necessarily async (network). The seam: GoogleRoutesTravelTimeProvider is
// constructed via the async static `create()`, which does ALL the Google
// calls up front — one batched computeRouteMatrix call for DRIVE/WALK, or
// (Google limitation, not a shortcut taken here — see below) one
// computeRoutes call per ordered pair for TRANSIT — and caches every
// pair's minutes. getTravelTimeMinutes() itself just reads that cache, so
// the optimizer's search (which queries the same pair many times across
// different branches) never triggers a second network call for a pair
// already fetched, and the whole class stays a drop-in for
// TravelTimeProvider.
//
// Note: Routes API's computeRouteMatrix does NOT support TRANSIT as a
// travel mode (only DRIVE / WALK / BICYCLE / TWO_WHEELER) — only the
// single-route computeRoutes endpoint supports TRANSIT. So for transit
// hangouts this provider falls back to N*(N-1) individual computeRoutes
// calls instead of one matrix call. That's a real API constraint, not an
// implementation shortcut — flagged here and in the PR description.

import type { GeoPoint, TransportationMode, TravelTimeProvider } from "./types";

const ROUTE_MATRIX_URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";
const COMPUTE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

export type GoogleTravelMode = "DRIVE" | "WALK" | "TRANSIT";

export function mapTransportationMode(mode: TransportationMode): GoogleTravelMode {
  switch (mode) {
    case "driving":
      return "DRIVE";
    case "walking":
      return "WALK";
    case "transit":
      return "TRANSIT";
  }
}

/** The Google API call itself failed (network, auth, quota, malformed request) — distinct from "no route between these two points". */
export class GoogleRoutesApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = "GoogleRoutesApiError";
  }
}

/** The API call succeeded, but Google reported no route exists between this specific pair. */
export class RouteNotFoundError extends Error {
  constructor(
    public readonly fromId: string,
    public readonly toId: string,
  ) {
    super(`No route found from ${fromId} to ${toId}`);
    this.name = "RouteNotFoundError";
  }
}

function pairKey(fromId: string, toId: string): string {
  return `${fromId}=>${toId}`;
}

// ---------------------------------------------------------------------
// Pure request/response shaping — exported and unit-testable without a
// network call.
// ---------------------------------------------------------------------

interface LatLngWaypoint {
  waypoint: { location: { latLng: { latitude: number; longitude: number } } };
}

function toWaypoint(point: GeoPoint): LatLngWaypoint {
  return { waypoint: { location: { latLng: { latitude: point.lat, longitude: point.lng } } } };
}

export interface RouteMatrixRequestBody {
  origins: LatLngWaypoint[];
  destinations: LatLngWaypoint[];
  travelMode: "DRIVE" | "WALK";
  routingPreference?: "TRAFFIC_AWARE";
  departureTime?: string;
}

/**
 * Google rejects a departureTime in the past for traffic-aware requests,
 * so a hangout whose start_time has already passed (organizer regenerating
 * a plan mid-hangout) falls back to "now" instead of sending a stale time.
 */
function resolveDepartureTime(departureTime: Date | undefined, now: Date): Date | undefined {
  if (!departureTime) return undefined;
  return departureTime > now ? departureTime : undefined;
}

export function buildRouteMatrixRequestBody(
  points: GeoPoint[],
  mode: "DRIVE" | "WALK",
  departureTime?: Date,
  now: Date = new Date(),
): RouteMatrixRequestBody {
  const waypoints = points.map(toWaypoint);
  const body: RouteMatrixRequestBody = {
    origins: waypoints,
    destinations: waypoints,
    travelMode: mode,
  };
  if (mode === "DRIVE") {
    body.routingPreference = "TRAFFIC_AWARE";
    const resolved = resolveDepartureTime(departureTime, now);
    if (resolved) body.departureTime = resolved.toISOString();
  }
  return body;
}

export interface ComputeRoutesRequestBody {
  origin: { location: { latLng: { latitude: number; longitude: number } } };
  destination: { location: { latLng: { latitude: number; longitude: number } } };
  travelMode: "TRANSIT";
  departureTime?: string;
}

export function buildComputeRoutesRequestBody(
  from: GeoPoint,
  to: GeoPoint,
  departureTime?: Date,
  now: Date = new Date(),
): ComputeRoutesRequestBody {
  const body: ComputeRoutesRequestBody = {
    origin: toWaypoint(from).waypoint,
    destination: toWaypoint(to).waypoint,
    travelMode: "TRANSIT",
  };
  const resolved = resolveDepartureTime(departureTime, now);
  if (resolved) body.departureTime = resolved.toISOString();
  return body;
}

/** Parses a Google duration string ("1234s", "12.5s") into whole minutes. */
export function parseDurationToMinutes(duration: string): number {
  const match = /^(\d+(?:\.\d+)?)s$/.exec(duration);
  if (!match) throw new GoogleRoutesApiError(`Unrecognized duration format from Google Routes API: "${duration}"`);
  return Math.round(Number(match[1]) / 60);
}

interface RouteMatrixElement {
  originIndex?: number;
  destinationIndex?: number;
  status?: { code?: number; message?: string };
  condition?: "ROUTE_EXISTS" | "ROUTE_NOT_FOUND" | string;
  duration?: string;
  distanceMeters?: number;
}

export interface ParsedRouteMatrix {
  minutesByPair: Map<string, number>;
  notFoundPairs: Array<{ fromId: string; toId: string }>;
}

export function parseRouteMatrixResponse(points: GeoPoint[], body: unknown): ParsedRouteMatrix {
  if (!Array.isArray(body)) {
    throw new GoogleRoutesApiError("Unexpected computeRouteMatrix response shape (expected a JSON array)");
  }

  const minutesByPair = new Map<string, number>();
  const notFoundPairs: Array<{ fromId: string; toId: string }> = [];

  for (const raw of body as RouteMatrixElement[]) {
    const originIndex = raw.originIndex ?? 0;
    const destinationIndex = raw.destinationIndex ?? 0;
    if (originIndex === destinationIndex) continue; // self-pair, matrix.ts already treats as 0

    const from = points[originIndex];
    const to = points[destinationIndex];
    if (!from || !to) continue; // defensive: malformed index from the API

    const ok = (raw.condition === "ROUTE_EXISTS" || raw.condition === undefined) && !raw.status?.code;
    if (!ok || !raw.duration) {
      notFoundPairs.push({ fromId: from.id, toId: to.id });
      continue;
    }

    minutesByPair.set(pairKey(from.id, to.id), parseDurationToMinutes(raw.duration));
  }

  return { minutesByPair, notFoundPairs };
}

/** Returns minutes, or null if Google reported no route for this pair. */
export function parseComputeRoutesResponse(body: unknown): number | null {
  const routes = (body as { routes?: Array<{ duration?: string }> } | null)?.routes;
  const duration = routes?.[0]?.duration;
  if (!duration) return null;
  return parseDurationToMinutes(duration);
}

// ---------------------------------------------------------------------
// The provider itself.
// ---------------------------------------------------------------------

export interface CreateGoogleRoutesTravelTimeProviderParams {
  points: GeoPoint[];
  mode: TransportationMode;
  /** Hangout start time, used for traffic-aware DRIVE and TRANSIT schedule lookups. */
  departureTime?: Date;
  /** Defaults to process.env.GOOGLE_SERVER_API_KEY. */
  apiKey?: string;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** How many concurrent computeRoutes calls to run for TRANSIT's per-pair fallback. */
  transitConcurrency?: number;
}

export class GoogleRoutesTravelTimeProvider implements TravelTimeProvider {
  private readonly mode: TransportationMode;
  private readonly cache = new Map<string, number>();
  private readonly notFound = new Set<string>();

  private constructor(mode: TransportationMode) {
    this.mode = mode;
  }

  static async create(
    params: CreateGoogleRoutesTravelTimeProviderParams,
  ): Promise<GoogleRoutesTravelTimeProvider> {
    const apiKey = params.apiKey ?? process.env.GOOGLE_SERVER_API_KEY;
    if (!apiKey) {
      throw new GoogleRoutesApiError(
        "GOOGLE_SERVER_API_KEY is not set — can't call the Google Routes API.",
      );
    }
    const fetchImpl = params.fetchImpl ?? fetch;
    const provider = new GoogleRoutesTravelTimeProvider(params.mode);

    const points = dedupePoints(params.points);
    const googleMode = mapTransportationMode(params.mode);

    if (googleMode === "TRANSIT") {
      await provider.warmTransitCache(points, params.departureTime, apiKey, fetchImpl, params.transitConcurrency ?? 5);
    } else {
      await provider.warmMatrixCache(points, googleMode, params.departureTime, apiKey, fetchImpl);
    }

    return provider;
  }

  private async warmMatrixCache(
    points: GeoPoint[],
    googleMode: "DRIVE" | "WALK",
    departureTime: Date | undefined,
    apiKey: string,
    fetchImpl: typeof fetch,
  ): Promise<void> {
    if (points.length < 2) return;

    const body = buildRouteMatrixRequestBody(points, googleMode, departureTime);
    const res = await fetchImpl(ROUTE_MATRIX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,status,condition",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await safeText(res);
      throw new GoogleRoutesApiError(
        `Google Routes computeRouteMatrix failed (HTTP ${res.status})`,
        res.status,
        text,
      );
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch (cause) {
      throw new GoogleRoutesApiError("Couldn't parse Google Routes computeRouteMatrix response as JSON", res.status, String(cause));
    }

    const { minutesByPair, notFoundPairs } = parseRouteMatrixResponse(points, json);
    for (const [key, minutes] of minutesByPair) this.cache.set(key, minutes);
    for (const { fromId, toId } of notFoundPairs) this.notFound.add(pairKey(fromId, toId));
  }

  private async warmTransitCache(
    points: GeoPoint[],
    departureTime: Date | undefined,
    apiKey: string,
    fetchImpl: typeof fetch,
    concurrency: number,
  ): Promise<void> {
    const pairs: Array<[GeoPoint, GeoPoint]> = [];
    for (const from of points) {
      for (const to of points) {
        if (from.id !== to.id) pairs.push([from, to]);
      }
    }

    await mapWithConcurrency(pairs, concurrency, async ([from, to]) => {
      const body = buildComputeRoutesRequestBody(from, to, departureTime);
      const res = await fetchImpl(COMPUTE_ROUTES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await safeText(res);
        throw new GoogleRoutesApiError(
          `Google Routes computeRoutes failed (HTTP ${res.status}) for ${from.id} -> ${to.id}`,
          res.status,
          text,
        );
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch (cause) {
        throw new GoogleRoutesApiError(`Couldn't parse Google Routes computeRoutes response as JSON for ${from.id} -> ${to.id}`, res.status, String(cause));
      }

      const minutes = parseComputeRoutesResponse(json);
      if (minutes === null) {
        this.notFound.add(pairKey(from.id, to.id));
      } else {
        this.cache.set(pairKey(from.id, to.id), minutes);
      }
    });
  }

  getTravelTimeMinutes(from: GeoPoint, to: GeoPoint, mode: TransportationMode): number {
    if (from.id === to.id) return 0;
    if (mode !== this.mode) {
      throw new GoogleRoutesApiError(
        `GoogleRoutesTravelTimeProvider was warmed for "${this.mode}" but was asked for "${mode}"`,
      );
    }
    const key = pairKey(from.id, to.id);
    const minutes = this.cache.get(key);
    if (minutes !== undefined) return minutes;
    if (this.notFound.has(key)) throw new RouteNotFoundError(from.id, to.id);
    throw new GoogleRoutesApiError(
      `No cached travel time for ${from.id} -> ${to.id} — was this pair included in the points passed to create()?`,
    );
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function dedupePoints(points: GeoPoint[]): GeoPoint[] {
  const byId = new Map<string, GeoPoint>();
  for (const p of points) byId.set(p.id, p);
  return [...byId.values()];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
