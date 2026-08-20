import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOperationsApiDataSource } from '../data-source';

describe('operations API data source', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fetches and validates an operations read model', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        snapshot: { vehicles: [] },
        kpis: { fleetSize: 0 },
        freshness: { mode: 'simulation', source: 'test', asOf: '2026-01-01T00:00:00.000Z' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const source = createOperationsApiDataSource<{ vehicles: never[] }, { fleetSize: number }>('/api/v1/operations/snapshot', 'simulation');
    const result = await source.getSnapshot();

    expect(source.mode).toBe('simulation');
    expect(result.snapshot.vehicles).toEqual([]);
    expect(result.kpis.fleetSize).toBe(0);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/operations/snapshot', expect.objectContaining({ cache: 'no-store' }));
  });

  it('rejects malformed responses before they reach the UI', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ snapshot: {}, freshness: {} }),
    }));

    const source = createOperationsApiDataSource('/api/v1/operations/snapshot');
    await expect(source.getSnapshot()).rejects.toThrow('contract validation');
  });

  it('surfaces HTTP failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));

    const source = createOperationsApiDataSource('/api/v1/operations/snapshot');
    await expect(source.refresh()).rejects.toThrow('503');
  });
});
