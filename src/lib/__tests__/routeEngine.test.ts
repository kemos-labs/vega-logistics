// R7 Phase 2 tests: self-hosted OSRM adapter — opt-in config gate, public
// demo ban (never fetched), timeout fallback, honest error taxonomy.
// Measurement NEVER reorders stops; it only reports km/min for display.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildOsrmOptimizeUrl, buildOsrmTripUrl } from '@/lib/routeLite';
import { measureOsrmRoute } from '@/lib/routeEngine';

const COORDS = [{ lat: 24.75, lng: 46.65 }, { lat: 24.8, lng: 46.6 }];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OSRM demo ban (builders)', () => {
  it.each([
    'https://router.project-osrm.org',
    'https://router.project-osrm.org/',
    'http://router.project-osrm.org',
    'https://foo.project-osrm.org',
  ])('rejects %s without building a URL', (base) => {
    expect(buildOsrmOptimizeUrl(base, COORDS)).toEqual({ ok: false, error: 'banned-demo' });
    expect(buildOsrmTripUrl(base, COORDS)).toEqual({ ok: false, error: 'banned-demo' });
  });

  it('still accepts an owner-approved self-hosted endpoint', () => {
    const built = buildOsrmOptimizeUrl('https://routing.example.test', COORDS);
    expect(built.ok).toBe(true);
  });
});

describe('measureOsrmRoute', () => {
  it('returns not-configured without touching the network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await measureOsrmRoute(undefined, COORDS)).toEqual({ ok: false, error: 'not-configured' });
    expect(await measureOsrmRoute('   ', COORDS)).toEqual({ ok: false, error: 'not-configured' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never fetches the banned demo server', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await measureOsrmRoute('https://router.project-osrm.org', COORDS))
      .toEqual({ ok: false, error: 'invalid-input' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid input without fetching', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await measureOsrmRoute('not-a-url', COORDS)).toEqual({ ok: false, error: 'invalid-input' });
    expect(await measureOsrmRoute('https://routing.example.test', [{ lat: 24.75, lng: 46.65 }]))
      .toEqual({ ok: false, error: 'invalid-input' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports a parsed self-hosted route with provider + timestamp', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 'Ok',
        trips: [{ distance: 12500, duration: 1500 }],
        waypoints: [{ waypoint_index: 0 }, { waypoint_index: 1 }],
      }),
    }));
    const result = await measureOsrmRoute('https://routing.example.test', COORDS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('self-hosted-osrm');
      expect(result.route.distanceM).toBe(12500);
      expect(result.route.durationS).toBe(1500);
      expect(result.measuredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('maps non-Ok payloads to invalid-response (offline fallback keeps manual order)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ code: 'NoRoute', trips: [], waypoints: [] }),
    }));
    expect(await measureOsrmRoute('https://routing.example.test', COORDS))
      .toEqual({ ok: false, error: 'invalid-response' });
  });

  it('maps HTTP failures to network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await measureOsrmRoute('https://routing.example.test', COORDS))
      .toEqual({ ok: false, error: 'network' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('down')));
    expect(await measureOsrmRoute('https://routing.example.test', COORDS))
      .toEqual({ ok: false, error: 'network' });
  });

  it('maps aborts to timeout', async () => {
    const abort = new DOMException('aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
    expect(await measureOsrmRoute('https://routing.example.test', COORDS))
      .toEqual({ ok: false, error: 'timeout' });
  });
});
