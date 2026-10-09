import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseMaintenanceRepository } from '../maintenanceRepository';
import type { SupabaseQueryClient } from '../db/client';
import * as db from '../db/client';

afterEach(() => vi.restoreAllMocks());
import { emptyMaintenanceState, type MaintenanceState } from '@/lib/vehicleMaintenance';

const state: MaintenanceState = {
  version: 2,
  vehicles: [{ id: 'v1', carNumber: '1', plate: 'ABC', availability: 'available', updatedAt: '2026-10-09T00:00:00Z', model: 'van', city: 'Riyadh', insuranceExpiryDate: '2027-01-01' }],
  records: [{ id: 'r1', vehicleId: 'v1', kind: 'oil', date: '2026-10-09', costSar: null, description: 'oil', updatedAt: '2026-10-09T00:00:00Z' }],
  incidents: [{ id: 'i1', vehicleId: 'v1', type: 'breakdown', date: '2026-10-09', description: 'tyre', estimatedCostSar: null, status: 'open', updatedAt: '2026-10-09T00:00:00Z' }],
};

function fake() {
  const rows: { user_id: string; data: unknown }[] = [{ user_id: 'other', data: emptyMaintenanceState() }];
  const eq = vi.fn(async (_column: string, userId: unknown) => ({ data: rows.filter(row => row.user_id === userId), error: null }));
  const upsert = vi.fn(async (payload: { user_id: string; data: unknown }) => {
    const index = rows.findIndex(row => row.user_id === payload.user_id);
    if (index >= 0) rows[index] = payload; else rows.push(payload);
    return { error: null };
  });
  const from = vi.fn(() => ({ select: () => ({ eq }), upsert }));
  return { rows, eq, upsert, from, client: { from } as unknown as SupabaseQueryClient };
}

describe('optional owner-only maintenance repository', () => {
  it('returns missing independently and round-trips complete v2 history', async () => {
    const f = fake();
    const repo = new SupabaseMaintenanceRepository(f.client, 'owner');
    expect(await repo.load()).toBeNull();
    await repo.save(state);
    expect(await repo.load()).toEqual(state);
    expect(f.eq).toHaveBeenCalledWith('user_id', 'owner');
    expect(f.from).toHaveBeenCalledWith('maintenance_state');
    expect(f.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'owner', data: state }));
    expect(f.rows[0].user_id).toBe('other');
  });

  it('migrates historical v1 reads without rewriting remote data', async () => {
    const f = fake();
    const legacy = { version: 1, vehicles: state.vehicles, records: state.records };
    f.rows.push({ user_id: 'owner', data: legacy });
    expect(await new SupabaseMaintenanceRepository(f.client, 'owner').load()).toEqual({ ...state, incidents: [] });
    expect(f.upsert).not.toHaveBeenCalled();
    expect(f.rows[1].data).toEqual(legacy);
  });

  it('rejects malformed history on load and save before a remote write', async () => {
    const f = fake();
    f.rows.push({ user_id: 'owner', data: { ...state, incidents: [{ ...state.incidents[0], vehicleId: 'missing' }] } });
    const repo = new SupabaseMaintenanceRepository(f.client, 'owner');
    await expect(repo.load()).rejects.toThrow('Invalid maintenance state');
    await expect(repo.save({ ...state, incidents: undefined } as unknown as MaintenanceState)).rejects.toThrow('Invalid maintenance state');
    expect(f.upsert).not.toHaveBeenCalled();
  });

  it('propagates remote database access and write failures', async () => {
    const f = fake();
    f.eq.mockResolvedValueOnce({ data: [], error: { message: 'denied' } } as never);
    f.upsert.mockResolvedValueOnce({ error: { message: 'offline' } } as never);
    const repo = new SupabaseMaintenanceRepository(f.client, 'owner');
    await expect(repo.load()).rejects.toThrow('denied');
    await expect(repo.save(state)).rejects.toThrow('offline');
  });
  it('derives factory ownership from authenticated session', async () => {
    const f = fake();
    const authClient = { ...f.client, auth: { getSession: async () => ({ data: { session: { user: { id: 'owner' } } }, error: null }) } } as SupabaseQueryClient;
    vi.spyOn(db, 'getSupabaseClient').mockResolvedValueOnce(authClient);
    const repo = await SupabaseMaintenanceRepository.create();
    await repo?.save(state);
    expect(f.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'owner' }));
  });

});
