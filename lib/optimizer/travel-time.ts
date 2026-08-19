// TravelTimeProvider: the seam between the optimizer and travel-time data.
// This phase only ships MatrixTravelTimeProvider, a fixture/in-memory
// implementation for tests. A future GoogleRoutesTravelTimeProvider can
// implement the same interface (e.g. backed by a matrix precomputed via
// the Routes API) without any change to optimize.ts.

import type { GeoPoint, TransportationMode, TravelTimeProvider } from "./types";

/**
 * Fixture travel-time provider backed by a plain nested-object matrix:
 * `{ [mode]: { [fromId]: { [toId]: minutes } } }`. Intended for tests —
 * throws on a missing pair so a fixture gap fails loudly instead of
 * silently producing a bogus (e.g. zero) travel time.
 */
export class MatrixTravelTimeProvider implements TravelTimeProvider {
  constructor(
    private readonly matrix: Partial<
      Record<TransportationMode, Record<string, Record<string, number>>>
    >,
  ) {}

  getTravelTimeMinutes(
    from: GeoPoint,
    to: GeoPoint,
    mode: TransportationMode,
  ): number {
    if (from.id === to.id) return 0;
    const minutes = this.matrix[mode]?.[from.id]?.[to.id];
    if (minutes === undefined) {
      throw new Error(
        `MatrixTravelTimeProvider: no fixture travel time for ${mode} ${from.id} -> ${to.id}`,
      );
    }
    return minutes;
  }
}

/** Precomputed lookup for a fixed set of points, so the search never re-queries the provider mid-search. */
export class TravelTimeMatrix {
  private readonly minutesByPair = new Map<string, number>();

  constructor(
    points: GeoPoint[],
    mode: TransportationMode,
    provider: TravelTimeProvider,
  ) {
    for (const from of points) {
      for (const to of points) {
        if (from.id === to.id) continue;
        const minutes = provider.getTravelTimeMinutes(from, to, mode);
        this.minutesByPair.set(pairKey(from.id, to.id), minutes);
      }
    }
  }

  get(fromId: string, toId: string): number {
    if (fromId === toId) return 0;
    const minutes = this.minutesByPair.get(pairKey(fromId, toId));
    if (minutes === undefined) {
      throw new Error(`TravelTimeMatrix: missing pair ${fromId} -> ${toId}`);
    }
    return minutes;
  }
}

function pairKey(fromId: string, toId: string): string {
  return `${fromId}=>${toId}`;
}

/** Convenience for building a matrix directly from a provider + point list. */
export function buildTravelTimeMatrix(
  points: GeoPoint[],
  mode: TransportationMode,
  provider: TravelTimeProvider,
): TravelTimeMatrix {
  return new TravelTimeMatrix(points, mode, provider);
}
