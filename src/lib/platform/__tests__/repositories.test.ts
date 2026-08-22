import { describe, it, expect, beforeEach } from 'vitest';
import { LocalModelRepository, SupabaseModelRepository, resolveRepository, type ModelRepository } from '../repositories';
import type { DailyRecord } from '@/lib/operationsReporting';
import type { Scenario } from '@/lib/scenarios';
import { defaultFinancialInput } from '@/lib/mockData';

function makeRecord(date: string): DailyRecord {
  return { date, completedShipments: 10, failedShipments: 1, fuelCost: 55.5, driversPresent: 8, notes: 'ok', updatedAt: '2026-08-21T00:00:00.000Z' };
}

function makeScenario(id: string): Scenario {
  return { id, name: `Scenario ${id}`, savedAt: '2026-08-21T00:00:00.000Z', input: structuredClone(defaultFinancialInput) };
}

/** Minimal fake matching the structural SupabaseQueryClient surface. */
function fakeClient(userId = 'user-1') {
  const tables: Record<string, Record<string, unknown>[]> = { financial_inputs: [], daily_records: [], scenarios: [] };
  const session = { user: { id: userId } };
  const client = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from(table: string) {
      const rows = tables[table];
      return {
        select() {
          return {
            eq(_col: string, value: unknown) {
              return Promise.resolve({ data: rows.filter(r => r.user_id === value), error: null });
            },
          };
        },
        upsert(payload: Record<string, unknown>) {
          const keyCols = table === 'financial_inputs' ? ['user_id'] : table === 'daily_records' ? ['user_id', 'report_date'] : ['id'];
          const idx = rows.findIndex(r => keyCols.every(k => r[k] === payload[k]));
          if (idx >= 0) rows[idx] = { ...rows[idx], ...payload }; else rows.push({ ...payload });
          return Promise.resolve({ error: null });
        },
        delete() {
          return {
            eq(col: string, value: unknown) {
              const next = rows.filter(r => r[col] !== value || (col !== 'user_id' && r.user_id !== userId));
              // chainable second eq handled by re-filtering on both calls below
              tables[table] = next;
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return { client, tables };
}

describe('LocalModelRepository', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips financial input, daily records and scenarios', async () => {
    const repo: ModelRepository = new LocalModelRepository();
    expect(await repo.loadFinancialInput()).toBeNull();
    await repo.saveFinancialInput(defaultFinancialInput);
    expect(await repo.loadFinancialInput()).toEqual(defaultFinancialInput);

    await repo.saveDailyRecord(makeRecord('2026-08-20'));
    await repo.saveDailyRecord(makeRecord('2026-08-21'));
    const records = await repo.loadDailyRecords();
    expect(Object.keys(records)).toHaveLength(2);
    await repo.deleteDailyRecord('2026-08-20');
    expect(Object.keys(await repo.loadDailyRecords())).toEqual(['2026-08-21']);

    await repo.saveScenario(makeScenario('s1'));
    await repo.saveScenario(makeScenario('s2'));
    expect((await repo.loadScenarios()).map(s => s.id)).toEqual(['s1', 's2']);
    await repo.deleteScenario('s1');
    expect((await repo.loadScenarios()).map(s => s.id)).toEqual(['s2']);
  });

  it('overwrites a daily record for the same date', async () => {
    const repo = new LocalModelRepository();
    await repo.saveDailyRecord(makeRecord('2026-08-20'));
    const updated = { ...makeRecord('2026-08-20'), completedShipments: 99 };
    await repo.saveDailyRecord(updated);
    expect((await repo.loadDailyRecords())['2026-08-20'].completedShipments).toBe(99);
  });

  it('survives corrupted localStorage JSON', async () => {
    localStorage.setItem('vega-daily-reports-v2', '{not json');
    const repo = new LocalModelRepository();
    expect(await repo.loadDailyRecords()).toEqual({});
  });
});

describe('SupabaseModelRepository', () => {
  it('maps daily rows defensively (bad dates and values dropped/coerced)', async () => {
    const { client, tables } = fakeClient();
    tables.daily_records = [
      { user_id: 'user-1', report_date: '2026-08-20', completed_shipments: 12, failed_shipments: -5, fuel_cost: '40.5', drivers_present: null, notes: 7, updated_at: '2026-08-20T10:00:00Z' },
      { user_id: 'user-1', report_date: 'garbage', completed_shipments: 1, failed_shipments: 0, fuel_cost: 0, drivers_present: 0, notes: '', updated_at: '' },
    ];
    const repo = new SupabaseModelRepository(client as never, 'user-1');
    const records = await repo.loadDailyRecords();
    expect(Object.keys(records)).toEqual(['2026-08-20']);
    expect(records['2026-08-20']).toMatchObject({
      date: '2026-08-20',
      completedShipments: 12,
      failedShipments: 0,
      fuelCost: 40.5,
      driversPresent: 0,
      notes: '',
    });
  });

  it('create() returns null without a session', async () => {
    const { client } = fakeClient();
    (client.auth as { getSession: () => Promise<unknown> }).getSession = async () => ({ data: { session: null }, error: null });
    expect(await SupabaseModelRepository.create.call({ client } as never)).toBeNull();
  });

  it('upsert then load round-trips scenarios', async () => {
    const { client } = fakeClient();
    const repo = new SupabaseModelRepository(client as never, 'user-1');
    await repo.saveScenario(makeScenario('sc-9'));
    const loaded = await repo.loadScenarios();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({ id: 'sc-9', name: 'Scenario sc-9' });
  });
});

describe('resolveRepository', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to local when Supabase is not configured', async () => {
    const repo = await resolveRepository();
    expect(repo.kind).toBe('local');
  });
});
