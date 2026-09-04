// Route-lite Phase 1 tests (Release R7): offline suggestion + OSRM helpers.
import { describe, expect, it } from 'vitest';

import {
  buildOsrmTripUrl, haversineKm, parseOsrmTripResponse,
  suggestStopOrder, windowRank,
} from '@/lib/routeLite';
import { createStopRecord, type StopRecord } from '@/lib/stops';

const NOW_ISO = '2026-08-25T06:00:00.000Z';
let tick = 0;
function stop(over: Partial<StopRecord> = {}): StopRecord {
  tick += 1;
  return createStopRecord({
    operationDate: '2026-08-26', customerName: 'C', stopLabel: `L${tick}`,
    reference: `R-${tick}`, ...over,
  }, new Date(Date.parse(NOW_ISO) + tick * 1000).toISOString());
}

describe('windowRank', () => {
  it('orders morning → afternoon → evening → unset', () => {
    expect(windowRank({ serviceWindow: 'morning' })).toBe(0);
    expect(windowRank({ serviceWindow: 'afternoon' })).toBe(1);
    expect(windowRank({ serviceWindow: 'evening' })).toBe(2);
    expect(windowRank({})).toBe(3);
  });
});

describe('haversineKm', () => {
  it('matches the known Riyadh→Jeddah distance within tolerance', () => {
    const km = haversineKm(24.7136, 46.6753, 21.4858, 39.1925);
    expect(km).toBeGreaterThan(790);
    expect(km).toBeLessThan(900);
  });
  it('is zero for identical points and symmetric', () => {
    expect(haversineKm(24.7, 46.6, 24.7, 46.6)).toBe(0);
    expect(haversineKm(24.7, 46.6, 25.0, 47.0)).toBeCloseTo(haversineKm(25.0, 47.0, 24.7, 46.6), 9);
  });
});

describe('suggestStopOrder', () => {
  it('returns empty/stable for empty and single-stop inputs', () => {
    expect(suggestStopOrder([])).toEqual({ order: [], usedCoords: false, rationale: ['stable-kept'] });
    const one = stop();
    expect(suggestStopOrder([one])).toEqual({ order: [one.id], usedCoords: false, rationale: ['stable-kept'] });
  });

  it('groups by service window even when the manual order disagrees', () => {
    const evening = stop({ serviceWindow: 'evening', sequence: 1 });
    const morning = stop({ serviceWindow: 'morning', sequence: 2 });
    const out = suggestStopOrder([evening, morning]);
    expect(out.order).toEqual([morning.id, evening.id]);
    expect(out.usedCoords).toBe(false);
    expect(out.rationale).toContain('window-groups');
  });

  it('keeps the manual relative order inside a window without coordinates', () => {
    const a = stop({ sequence: 1 });
    const b = stop({ sequence: 2 });
    const out = suggestStopOrder([a, b]);
    expect(out.order).toEqual([a.id, b.id]);
    expect(out.rationale).toEqual(['stable-kept']);
  });

  it('runs nearest-neighbor inside a window when coordinates exist', () => {
    const a = stop({ lat: 24.7, lng: 46.6, sequence: 1 });
    const far = stop({ lat: 24.0, lng: 46.0, sequence: 2 });
    const near = stop({ lat: 24.71, lng: 46.61, sequence: 3 });
    const out = suggestStopOrder([a, far, near]);
    expect(out.order).toEqual([a.id, near.id, far.id]);
    expect(out.usedCoords).toBe(true);
    expect(out.rationale).toContain('nearest-neighbor');
  });

  it('never lets a short drive outrank a morning promise', () => {
    const morningFar = stop({ serviceWindow: 'morning', lat: 24.0, lng: 46.0, sequence: 2 });
    const eveningNear = stop({ serviceWindow: 'evening', lat: 24.7, lng: 46.6, sequence: 1 });
    const out = suggestStopOrder([eveningNear, morningFar]);
    expect(out.order).toEqual([morningFar.id, eveningNear.id]);
    expect(out.rationale).toContain('window-groups');
  });

  it('is deterministic across runs', () => {
    const stops = [stop({ lat: 24.7, lng: 46.6 }), stop({ lat: 24.71, lng: 46.61 }), stop({ serviceWindow: 'morning' })];
    expect(suggestStopOrder(stops)).toEqual(suggestStopOrder(stops));
  });
});

describe('buildOsrmTripUrl', () => {
  const coords = [{ lat: 24.7136, lng: 46.6753 }, { lat: 24.62, lng: 46.72 }];
  it('builds an lng,lat chained route URL for a bare host', () => {
    const out = buildOsrmTripUrl('https://router.example', coords);
    expect(out).toEqual({
      ok: true,
      url: 'https://router.example/route/v1/driving/46.6753,24.7136;46.72,24.62?overview=false&steps=false',
    });
  });
  it('rejects bases with paths, garbage, and bad/immense coordinate input', () => {
    expect(buildOsrmTripUrl('https://router.example/osrm', coords)).toEqual({ ok: false, error: 'bad-base' });
    expect(buildOsrmTripUrl('not-a-url', coords)).toEqual({ ok: false, error: 'bad-base' });
    expect(buildOsrmTripUrl('https://router.example', [coords[0]])).toEqual({ ok: false, error: 'too-few-coords' });
    expect(buildOsrmTripUrl('https://router.example', [{ lat: 999, lng: 46 }, coords[1]]))
      .toEqual({ ok: false, error: 'bad-coord' });
  });
});

describe('parseOsrmTripResponse', () => {
  it('parses the Trip-plugin shape into a visit order', () => {
    const out = parseOsrmTripResponse({
      code: 'Ok',
      trips: [{ distance: 12345, duration: 678 }],
      waypoints: [{ waypoint_index: 0 }, { waypoint_index: 2 }, { waypoint_index: 1 }],
    });
    expect(out).toEqual({ ok: true, route: { order: [0, 2, 1], distanceM: 12345, durationS: 678 } });
  });
  it('parses the plain Route shape', () => {
    const out = parseOsrmTripResponse({
      code: 'Ok',
      routes: [{ distance: 100, duration: 50 }],
      waypoints: [{ waypoint_index: 1 }, { waypoint_index: 0 }],
    });
    expect(out).toEqual({ ok: true, route: { order: [1, 0], distanceM: 100, durationS: 50 } });
  });
  it('rejects non-Ok codes, missing routes, and malformed waypoints', () => {
    expect(parseOsrmTripResponse({ code: 'NoRoute', routes: [] })).toEqual({ ok: false, error: 'non-ok' });
    expect(parseOsrmTripResponse({ code: 'Ok', routes: [] })).toEqual({ ok: false, error: 'no-route' });
    expect(parseOsrmTripResponse({
      code: 'Ok', routes: [{ distance: 1, duration: 1 }], waypoints: [{ waypoint_index: 7 }],
    })).toEqual({ ok: false, error: 'bad-shape' });
    expect(parseOsrmTripResponse(null)).toEqual({ ok: false, error: 'bad-shape' });
  });
});
