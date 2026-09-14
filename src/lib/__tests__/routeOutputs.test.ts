import { describe, expect, it } from 'vitest';

import { buildDriverRouteCsv, buildGoogleMapsDirectionsUrl, buildOsrmOptimizeUrl } from '@/lib/routeLite';
import { createStopRecord } from '@/lib/stops';

const now = '2026-09-15T06:00:00.000Z';
const stop = (reference: string, extra: Record<string, unknown> = {}) => createStopRecord({
  operationDate: '2026-09-15', customerName: `Customer ${reference}`, stopLabel: `حي ${reference}`,
  reference, ...extra,
}, now);

describe('route outputs', () => {
  it('builds a driving Maps link from coordinates in run order', () => {
    const url = buildGoogleMapsDirectionsUrl([
      stop('A', { lat: 24.75, lng: 46.65 }),
      stop('B', { lat: 24.8, lng: 46.6 }),
      stop('C', { lat: 24.85, lng: 46.55 }),
    ]);
    expect(url).toContain('travelmode=driving');
    expect(url).toContain('24.75%2C46.65');
    expect(url).toContain('waypoints=24.8%2C46.6');
    expect(url).toContain('24.85%2C46.55');
  });

  it('adds Riyadh context for address-only links and emits stable CSV', () => {
    const rows = [stop('A', { addressNotes: 'بوابة 3' }), stop('B')];
    expect(buildGoogleMapsDirectionsUrl(rows)).toContain('Riyadh%2C+Saudi+Arabia');
    expect(buildDriverRouteCsv(rows)).toContain('"sequence","reference"');
    expect(buildDriverRouteCsv(rows)).toContain('"1","A"');
  });

  it('builds a self-hosted OSRM trip request with fixed endpoints', () => {
    const built = buildOsrmOptimizeUrl('https://routing.example.test', [{ lat: 24.75, lng: 46.65 }, { lat: 24.8, lng: 46.6 }]);
    expect(built.ok).toBe(true);
    if (built.ok) expect(built.url).toContain('/trip/v1/driving/46.65,24.75;46.6,24.8');
  });
});
