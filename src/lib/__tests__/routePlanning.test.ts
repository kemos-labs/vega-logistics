import { describe, expect, it } from 'vitest';

import { suggestGeographicDriverPlan } from '@/lib/routePlanning';
import { createStopRecord } from '@/lib/stops';

const driver = (id: string) => ({ id, fullName: id, vehicle: 'Van' });
const stop = (id: string, lng?: number) => createStopRecord({ operationDate: '2026-09-15', customerName: id, stopLabel: id, reference: id, ...(lng === undefined ? {} : { lat: 24.75, lng }) }, '2026-09-15T06:00:00.000Z');

describe('geographic route planning proposal', () => {
  it('clusters coordinate-bearing stops deterministically and flags missing coordinates', () => {
    const result = suggestGeographicDriverPlan([stop('west', 46.5), stop('east', 46.8), stop('unknown')], [driver('north-west'), driver('east-central')]);
    expect(result.rationale).toBe('two-coordinate-clusters');
    expect(result.clusters.flatMap(cluster => cluster.stopIds)).toEqual(expect.arrayContaining([expect.any(String), expect.any(String)]));
    expect(result.missingCoordinateStopIds).toHaveLength(1);
  });
});
