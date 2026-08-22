/**
 * Model repositories — one contract, two backends.
 *
 * - LocalModelRepository  : localStorage keys the app uses today (default).
 * - SupabaseModelRepository : Postgres-backed persistence with RLS-owned rows.
 *
 * resolveRepository() picks Supabase when configured AND a session exists,
 * otherwise falls back to local — so the app degrades gracefully and never
 * loses writes while auth is being set up.
 */

import type { FinancialInput } from '@/lib/types';
import type { DailyRecord } from '@/lib/operationsReporting';
import type { Scenario } from '@/lib/scenarios';
import { getSupabaseClient, type SupabaseQueryClient } from './db/client';

export interface ModelRepository {
  readonly kind: 'local' | 'supabase';
  loadFinancialInput(): Promise<FinancialInput | null>;
  saveFinancialInput(input: FinancialInput): Promise<void>;
  loadDailyRecords(): Promise<Record<string, DailyRecord>>;
  saveDailyRecord(record: DailyRecord): Promise<void>;
  deleteDailyRecord(date: string): Promise<void>;
  loadScenarios(): Promise<Scenario[]>;
  saveScenario(scenario: Scenario): Promise<void>;
  deleteScenario(id: string): Promise<void>;
}

const KEY_INPUT = 'vega-financialInput-v2';
const KEY_DAILY = 'vega-daily-reports-v2';
const KEY_SCENARIOS = 'vega-scenarios-v1';

// ── Local ───────────────────────────────────────────────────────────────────

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Quota/private-mode failures must not break the UI.
    console.warn(`localStorage write failed for "${key}":`, error);
  }
}

export class LocalModelRepository implements ModelRepository {
  readonly kind = 'local' as const;

  async loadFinancialInput(): Promise<FinancialInput | null> { return readJson<FinancialInput>(KEY_INPUT); }
  async saveFinancialInput(input: FinancialInput): Promise<void> { writeJson(KEY_INPUT, input); }

  async loadDailyRecords(): Promise<Record<string, DailyRecord>> { return readJson<Record<string, DailyRecord>>(KEY_DAILY) ?? {}; }
  async saveDailyRecord(record: DailyRecord): Promise<void> {
    const all = await this.loadDailyRecords();
    all[record.date] = record;
    writeJson(KEY_DAILY, all);
  }
  async deleteDailyRecord(date: string): Promise<void> {
    const all = await this.loadDailyRecords();
    delete all[date];
    writeJson(KEY_DAILY, all);
  }

  async loadScenarios(): Promise<Scenario[]> { return readJson<Scenario[]>(KEY_SCENARIOS) ?? []; }
  async saveScenario(scenario: Scenario): Promise<void> {
    const all = await this.loadScenarios();
    const next = all.filter(item => item.id !== scenario.id).concat(scenario);
    writeJson(KEY_SCENARIOS, next);
  }
  async deleteScenario(id: string): Promise<void> {
    writeJson(KEY_SCENARIOS, (await this.loadScenarios()).filter(item => item.id !== id));
  }
}

// ── Supabase ────────────────────────────────────────────────────────────────

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** Defensive row → model mapping; a corrupted remote row can never crash the UI. */
function mapDailyRow(row: Record<string, unknown>): DailyRecord {
  const date = typeof row.report_date === 'string' ? row.report_date.slice(0, 10) : '';
  return {
    date,
    completedShipments: Math.round(toNumber(row.completed_shipments)),
    failedShipments: Math.round(toNumber(row.failed_shipments)),
    fuelCost: toNumber(row.fuel_cost),
    driversPresent: Math.round(toNumber(row.drivers_present)),
    notes: typeof row.notes === 'string' ? row.notes : '',
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
  };
}

export class SupabaseModelRepository implements ModelRepository {
  readonly kind = 'supabase' as const;

  constructor(private readonly client: SupabaseQueryClient, private readonly userId: string) {}

  static async create(): Promise<SupabaseModelRepository | null> {
    const client = await getSupabaseClient();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    const user = data?.session?.user;
    return user ? new SupabaseModelRepository(client, user.id) : null;
  }

  private guard<T>(error: { message: string } | null, fallback: T, value?: T): T {
    if (error) throw new Error(`Supabase repository error: ${error.message}`);
    return value ?? fallback;
  }

  async loadFinancialInput(): Promise<FinancialInput | null> {
    const { data, error } = await this.client.from('financial_inputs').select('data').eq('user_id', this.userId);
    if (error) return this.guard(error, null);
    const rows = Array.isArray(data) ? (data as { data?: FinancialInput }[]) : [];
    return rows.length > 0 && rows[0].data ? rows[0].data : null;
  }

  async saveFinancialInput(input: FinancialInput): Promise<void> {
    const { error } = await this.client.from('financial_inputs').upsert({ user_id: this.userId, data: input, updated_at: new Date().toISOString() });
    this.guard(error, undefined);
  }

  async loadDailyRecords(): Promise<Record<string, DailyRecord>> {
    const { data, error } = await this.client.from('daily_records').select('*').eq('user_id', this.userId);
    if (error) return this.guard(error, {});
    if (!Array.isArray(data)) return {};
    const records: Record<string, DailyRecord> = {};
    for (const raw of data as Record<string, unknown>[]) {
      const mapped = mapDailyRow(raw);
      if (/^\d{4}-\d{2}-\d{2}$/.test(mapped.date)) records[mapped.date] = mapped;
    }
    return records;
  }

  async saveDailyRecord(record: DailyRecord): Promise<void> {
    const { error } = await this.client.from('daily_records').upsert({
      user_id: this.userId,
      report_date: record.date,
      completed_shipments: record.completedShipments,
      failed_shipments: record.failedShipments,
      fuel_cost: record.fuelCost,
      drivers_present: record.driversPresent,
      notes: record.notes,
      updated_at: new Date().toISOString(),
    });
    this.guard(error, undefined);
  }

  async deleteDailyRecord(date: string): Promise<void> {
    const { error } = await this.client.from('daily_records').delete().eq('report_date', date).eq('user_id', this.userId);
    this.guard(error, undefined);
  }

  async loadScenarios(): Promise<Scenario[]> {
    const { data, error } = await this.client.from('scenarios').select('id,name,input,saved_at').eq('user_id', this.userId);
    if (error) return this.guard(error, []);
    if (!Array.isArray(data)) return [];
    return (data as { id: string; name: string; input: Scenario['input']; saved_at: string }[])
      .filter(row => typeof row.name === 'string' && row.input)
      .map(row => ({ id: row.id, name: row.name, savedAt: row.saved_at, input: row.input }));
  }

  async saveScenario(scenario: Scenario): Promise<void> {
    const { error } = await this.client.from('scenarios').upsert({ id: scenario.id, user_id: this.userId, name: scenario.name, input: scenario.input, saved_at: scenario.savedAt });
    this.guard(error, undefined);
  }

  async deleteScenario(id: string): Promise<void> {
    const { error } = await this.client.from('scenarios').delete().eq('id', id).eq('user_id', this.userId);
    this.guard(error, undefined);
  }
}

/**
 * Backend selection: Supabase when configured + signed in; local otherwise.
 * Never throws — an unavailable backend must not take the planner down.
 */
export async function resolveRepository(): Promise<ModelRepository> {
  try {
    const supabase = await SupabaseModelRepository.create();
    if (supabase) return supabase;
  } catch (error) {
    console.warn('Supabase repository unavailable, falling back to local:', error);
  }
  return new LocalModelRepository();
}
