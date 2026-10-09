/**
 * Model repositories — one contract, two backends.
 *
 * - LocalModelRepository  : localStorage keys the app uses today (default).
 * - SupabaseModelRepository : Postgres-backed persistence with RLS-owned rows.
 *
 * resolveRepository() defaults to local storage. Supabase requires an explicit
 * caller choice, configuration and a signed-in user; failures reject.
 */

import type { FinancialInput } from '@/lib/types';
import { FAILURE_REASON_KEYS, isValidCalendarDate, isValidIsoTimestamp, type DailyRecord } from '@/lib/operationsReporting';
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
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null) throw new Error(`Invalid stored null for ${key}`);
  return parsed as T;
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate without coercing missing cash evidence or stripping optional fields. */
function validateDailyPayload(value: unknown, date: string, legacyTimestamp = false): DailyRecord {
  if (!object(value) || value.date !== date || !isValidCalendarDate(date)) throw new Error('Invalid daily record payload');
  const number = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  const counts = ['completedShipments', 'failedShipments', 'driversPresent', 'newCustomerVisits', 'recoveredShipments', 'safetyIncidents', 'codShipments', 'prepaidShipments', 'loadedShipments', 'returnedShipments', 'pendingShipments'];
  const required = ['completedShipments', 'failedShipments', 'fuelCost', 'driversPresent'];
  for (const key of required) if (!number(value[key])) throw new Error(`Invalid daily field: ${key}`);
  for (const key of counts) if (value[key] !== undefined && (!number(value[key]) || !Number.isInteger(value[key]))) throw new Error(`Invalid daily field: ${key}`);
  for (const key of ['extraCosts', 'cashCollectedSar', 'cashRemittedSar', 'codExpectedSar']) if (value[key] !== undefined && !number(value[key])) throw new Error(`Invalid daily field: ${key}`);
  for (const key of ['notes', 'updatedAt']) if (typeof value[key] !== 'string') throw new Error(`Invalid daily field: ${key}`);
  for (const key of ['tomorrowNote', 'driverName', 'carNumber', 'plateNumber', 'codAdjustmentNote']) if (value[key] !== undefined && typeof value[key] !== 'string') throw new Error(`Invalid daily field: ${key}`);
  for (const key of ['updatedAt', 'closedAt']) if (value[key] !== undefined && (typeof value[key] !== 'string' || !(legacyTimestamp && key === 'updatedAt' && value[key] === '') && !isValidIsoTimestamp(value[key]))) throw new Error(`Invalid daily field: ${key}`);
  const enums: Record<string, string[]> = { closeStatus: ['draft', 'reconciled'], podStatus: ['complete', 'partial', 'none'], weatherCondition: ['clear', 'rain', 'fog', 'sand'] };
  for (const [key, values] of Object.entries(enums)) if (value[key] !== undefined && (typeof value[key] !== 'string' || !values.includes(value[key]))) throw new Error(`Invalid daily field: ${key}`);
  if (value.codRemittedOn !== undefined && (typeof value.codRemittedOn !== 'string' || !isValidCalendarDate(value.codRemittedOn))) throw new Error('Invalid remittance date');
  if (value.failureReasons !== undefined) {
    if (!object(value.failureReasons) || Object.entries(value.failureReasons).some(([key, n]) => !FAILURE_REASON_KEYS.includes(key as typeof FAILURE_REASON_KEYS[number]) || !number(n) || !Number.isInteger(n))) throw new Error('Invalid failure reasons');
  }
  if (value.customerBreakdown !== undefined) {
    if (!object(value.customerBreakdown) || Object.values(value.customerBreakdown).some(entry => !object(entry) || !number(entry.delivered) || !Number.isInteger(entry.delivered) || !number(entry.missed) || !Number.isInteger(entry.missed))) throw new Error('Invalid customer breakdown');
  }
  return value as unknown as DailyRecord;
}

export class LocalModelRepository implements ModelRepository {
  readonly kind = 'local' as const;

  async loadFinancialInput(): Promise<FinancialInput | null> { return readJson<FinancialInput>(KEY_INPUT); }
  async saveFinancialInput(input: FinancialInput): Promise<void> { writeJson(KEY_INPUT, input); }

  async loadDailyRecords(): Promise<Record<string, DailyRecord>> {
    const records = readJson<Record<string, DailyRecord>>(KEY_DAILY) ?? {};
    if (!object(records)) throw new Error('Invalid local daily records');
    for (const [date, record] of Object.entries(records)) validateDailyPayload(record, date, true);
    return records;
  }
  async saveDailyRecord(record: DailyRecord): Promise<void> {
    validateDailyPayload(record, record.date);
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
  if (row.record_payload !== undefined && row.record_payload !== null) {
    if (!object(row.record_payload) || row.record_payload.version !== 1) throw new Error('Unsupported daily payload version');
    return validateDailyPayload(row.record_payload.record, date);
  }
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
    const { data, error } = await client.auth.getSession();
    if (error) throw new Error(`Supabase session error: ${error.message}`);
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
      if (isValidCalendarDate(mapped.date)) records[mapped.date] = mapped;
    }
    return records;
  }

  async saveDailyRecord(record: DailyRecord): Promise<void> {
    validateDailyPayload(record, record.date);
    const { error } = await this.client.from('daily_records').upsert({
      user_id: this.userId,
      report_date: record.date,
      record_payload: { version: 1, record },
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

/** Local remains the default; explicit cloud selection never silently forks writes. */
export async function resolveRepository(backend: 'local' | 'supabase' = 'local'): Promise<ModelRepository> {
  if (backend === 'local') return new LocalModelRepository();
  const repository = await SupabaseModelRepository.create();
  if (!repository) throw new Error('Supabase requires configuration and a signed-in user');
  return repository;
}
