// VEGA — Route-lite Phase 1 (Release R7). Pure, React-free, OFFLINE.
//
// Manual order always wins: this module only SUGGESTS a visit order for a
// dispatch run. Nothing here touches the network — OSRM wiring is deferred
// (see buildOsrmTripUrl / parseOsrmTripResponse: pure helpers kept so the
// evaluation stays concrete without any fetch, CSP change, or demo-server
// reliance). Suggestion inputs are the operator's OWN data only:
// service windows first (hard customer expectation), then — when the
// operator entered coordinates — a greedy nearest-neighbor pass inside each
// window group. Without coordinates the current manual order is preserved
// inside each group (stable), so the suggestion can never scramble intent.
//
// Honest labels: every suggestion carries machine-readable rationale codes;
// the UI renders them next to the preview. This is a heuristic aid, never
// "optimized routing".

import { isValidCoordinatePair, sortStopsForDate, type StopRecord } from '@/lib/stops';

/** Service-window visit priority: morning → afternoon → evening → unset. */
export const WINDOW_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 };

export function windowRank(stop: Pick<StopRecord, 'serviceWindow'>): number {
  return stop.serviceWindow === undefined ? 3 : (WINDOW_ORDER[stop.serviceWindow] ?? 3);
}

export type RouteRationale = 'window-groups' | 'nearest-neighbor' | 'stable-kept';

export interface RouteSuggestion {
  /** Stop ids in suggested visit order. */
  order: string[];
  /** True when entered coordinates drove the within-group ordering. */
  usedCoords: boolean;
  rationale: RouteRationale[];
}

/** Great-circle distance in km between two WGS84 points. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function hasCoords(stop: StopRecord): boolean {
  return stop.lat !== undefined && stop.lng !== undefined
    && isValidCoordinatePair(stop.lat, stop.lng);
}

/**
 * Suggest a visit order for the given stops (typically one driver run).
 * Deterministic: identical inputs ⇒ identical outputs. Tie-breaks fall back
 * to stop id so two equidistant stops cannot flip between renders.
 */
export function suggestStopOrder(stops: StopRecord[]): RouteSuggestion {
  const base = sortStopsForDate(stops);
  if (base.length < 2) return { order: base.map(s => s.id), usedCoords: false, rationale: ['stable-kept'] };

  const withCoords = base.filter(hasCoords);
  const usedCoords = withCoords.length >= 2;

  // Window groups first — a morning promise outranks a short drive.
  const groups = new Map<number, StopRecord[]>();
  for (const stop of base) {
    const rank = windowRank(stop);
    const list = groups.get(rank) ?? [];
    list.push(stop);
    groups.set(rank, list);
  }

  const ordered: StopRecord[] = [];
  const rationale: RouteRationale[] = [];
  const multiGroup = groups.size > 1;
  if (multiGroup) rationale.push('window-groups');

  for (const rank of [...groups.keys()].sort((a, b) => a - b)) {
    const group = groups.get(rank) as StopRecord[];
    if (usedCoords && group.filter(hasCoords).length >= 2) {
      // Greedy nearest-neighbor inside the window, starting from the
      // operator's current first stop of that group (intent preserved).
      const remaining = [...group];
      const startIdx = remaining.indexOf(group[0]);
      const [start] = remaining.splice(startIdx, 1);
      const chain = [start];
      let cursor = start;
      while (remaining.length > 0) {
        let best = 0;
        let bestDist = Number.POSITIVE_INFINITY;
        for (let i = 0; i < remaining.length; i += 1) {
          const cand = remaining[i];
          const dist = hasCoords(cursor) && hasCoords(cand)
            ? haversineKm(cursor.lat as number, cursor.lng as number, cand.lat as number, cand.lng as number)
            : Number.POSITIVE_INFINITY;
          if (dist < bestDist || (dist === bestDist && cand.id < remaining[best].id)) {
            best = i;
            bestDist = dist;
          }
        }
        const [next] = remaining.splice(best, 1);
        chain.push(next);
        cursor = next;
      }
      ordered.push(...chain);
      if (!rationale.includes('nearest-neighbor')) rationale.push('nearest-neighbor');
    } else {
      // Stable: keep the operator's relative order inside the group.
      ordered.push(...group);
      if (!rationale.includes('stable-kept')) rationale.push('stable-kept');
    }
  }

  return { order: ordered.map(s => s.id), usedCoords, rationale };
}

// ── OSRM evaluation helpers (pure — no fetch, intentionally unwired) ──────
// When (and only when) the owner approves a self-hosted OSRM endpoint, the
// network layer will call buildOsrmTripUrl → fetch with timeout →
// parseOsrmTripResponse, behind NEXT_PUBLIC_OSRM_URL + CSP + attribution.
// The public demo server is BANNED for production use (no SLA, fair-use).

/** OSM attribution duty (shown with any OSRM-derived output, per licence). */
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

export type OsrmUrlError = 'bad-base' | 'too-few-coords' | 'bad-coord';

/** Build an OSRM Route-service URL for the given coordinate chain. */
export function buildOsrmTripUrl(
  baseUrl: string,
  coords: Array<{ lat: number; lng: number }>,
): { ok: true; url: string } | { ok: false; error: OsrmUrlError } {
  if (!/^https?:\/\/[^/\s]+$/.test(baseUrl.trim())) return { ok: false, error: 'bad-base' };
  if (coords.length < 2) return { ok: false, error: 'too-few-coords' };
  if (!coords.every(c => isValidCoordinatePair(c.lat, c.lng))) return { ok: false, error: 'bad-coord' };
  const chain = coords.map(c => `${c.lng},${c.lat}`).join(';');
  return { ok: true, url: `${baseUrl.trim()}/route/v1/driving/${chain}?overview=false&steps=false` };
}

export type OsrmParseError = 'bad-shape' | 'non-ok' | 'no-route';

export interface OsrmParsedRoute {
  /** Input-order indexes in visit order (from waypoint_index). */
  order: number[];
  distanceM: number;
  durationS: number;
}

/**
 * Parse an OSRM Route (or Trip) response body into a visit order.
 * Accepts the Trip-plugin shape ({trips, waypoints[].waypoint_index}) and
 * the plain Route shape ({routes, waypoints[].waypoint_index}).
 */
export function parseOsrmTripResponse(body: unknown): { ok: true; route: OsrmParsedRoute } | { ok: false; error: OsrmParseError } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'bad-shape' };
  const raw = body as Record<string, unknown>;
  if (raw.code !== 'Ok') return { ok: false, error: 'non-ok' };
  const routes = (Array.isArray(raw.trips) ? raw.trips : raw.routes) as unknown;
  if (!Array.isArray(routes) || routes.length === 0) return { ok: false, error: 'no-route' };
  const first = routes[0] as Record<string, unknown>;
  if (typeof first.distance !== 'number' || typeof first.duration !== 'number') return { ok: false, error: 'bad-shape' };
  const waypoints = raw.waypoints as unknown;
  if (!Array.isArray(waypoints) || waypoints.length === 0) return { ok: false, error: 'bad-shape' };
  const order: number[] = [];
  for (const wp of waypoints) {
    const idx = (wp as Record<string, unknown>).waypoint_index;
    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= waypoints.length) {
      return { ok: false, error: 'bad-shape' };
    }
    order.push(idx);
  }
  return { ok: true, route: { order, distanceM: first.distance, durationS: first.duration } };
}
