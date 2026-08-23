// VEGA — Backup integrity engine (P1).
//
// Versioned backup envelope v2 covering EVERY user-created persisted state:
// FinancialInput, DailyRecord (all fields incl. optionals), Scenarios,
// Recovery entries, Follow-up actions. Backward compatible with the legacy
// v1 ModelBackup ({version:1,input,dailyRecords,scenarios?}) which is
// migrated on parse.
//
// Import contract (AGENTS.md R7 + master-plan P1):
//  - parse NEVER throws and NEVER touches app state;
//  - three explicit modes: merge | replace | cancel;
//  - deterministic conflicts: newer updatedAt wins, ties keep the local
//    record, every "incoming lost" case increments `conflicts` so nothing
//    is silently discarded;
//  - merge mode never overwrites singleton model inputs (no trustworthy
//    timestamps exist for them) — the UI says so and offers Replace.
//
// Excluded by design (documented decision): seed catalogs `vega-vehicles`,
// `vega-zones` (static reference data, not user-created), UI language pref.

import { sanitizeFinancialInput } from '@/lib/calculations';
import type { FinancialInput } from '@/lib/types';
import type { DailyRecord } from '@/lib/operationsReporting';
import type { RecoveryEntry } from '@/lib/recoveryBoard';
import type { Scenario } from '@/lib/scenarios';

export const BACKUP_FORMAT = 'vega-logistics-backup' as const;
export const BACKUP_VERSION = 2 as const;

/** Follow-up action row as persisted under `vega-followup-actions-v1`. */
export interface FollowUpAction {
  id: number;
  text: string;
  owner: string;
  done: boolean;
}

export interface BackupData {
  financialInput: FinancialInput;
  dailyRecords: Record<string, DailyRecord>;
  scenarios: Scenario[];
  recoveryEntries: RecoveryEntry[];
  followUpActions: FollowUpAction[];
}

export interface BackupFileV2 {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: BackupData;
}

/** The slice of live app state backups round-trip. */
export interface StateBundle {
  financialInput: FinancialInput;
  dailyRecords: Record<string, DailyRecord>;
  scenarios: Scenario[];
  recoveryEntries: RecoveryEntry[];
  followUpActions: FollowUpAction[];
}

export interface MergeStats {
  added: number;
  updated: number;
  /** Incoming records discarded because the local copy was equal-or-newer. */
  conflicts: number;
}

export type ParsedBackup =
  | { ok: true; file: BackupFileV2; migratedFrom?: 1 }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function str(value: unknown, max = 4000): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T/;

/**
 * Rebuild a DailyRecord preserving EVERY field, required and optional.
 * Returns null when required numerics are corrupt (mirrors the v1 parser's
 * phantom-zero protection). Optional fields survive only when well-typed;
 * corrupt optionals are dropped rather than rejecting the whole day.
 */
function sanitizeDailyRecord(rawDate: string, value: unknown): DailyRecord | null {
  if (!isRecord(value)) return null;
  const date = DATE_RE.test(str(value.date, 10)) && str(value.date, 10) !== '' ? str(value.date, 10) : rawDate;
  if (!DATE_RE.test(date)) return null;
  const completed = finite(value.completedShipments);
  const failed = finite(value.failedShipments);
  const fuel = finite(value.fuelCost);
  const drivers = finite(value.driversPresent);
  if (completed === null || failed === null || fuel === null || drivers === null) return null;

  const record: DailyRecord = {
    date,
    completedShipments: completed,
    failedShipments: failed,
    fuelCost: fuel,
    driversPresent: drivers,
    notes: str(value.notes, 2000),
    updatedAt: ISO_RE.test(str(value.updatedAt, 40)) ? str(value.updatedAt, 40) : '',
  };

  if (typeof value.tomorrowNote === 'string') record.tomorrowNote = value.tomorrowNote.slice(0, 2000);
  if (isRecord(value.failureReasons)) {
    const reasons: Record<string, number> = {};
    for (const [key, count] of Object.entries(value.failureReasons)) {
      const n = finite(count);
      if (n !== null && n >= 0) reasons[key.slice(0, 60)] = n;
    }
    record.failureReasons = reasons as DailyRecord['failureReasons'];
  }
  const extraCosts = finite(value.extraCosts);
  if (extraCosts !== null) record.extraCosts = extraCosts;
  const visits = finite(value.newCustomerVisits);
  if (visits !== null) record.newCustomerVisits = visits;
  const recovered = finite(value.recoveredShipments);
  if (recovered !== null) record.recoveredShipments = recovered;
  const incidents = finite(value.safetyIncidents);
  if (incidents !== null) record.safetyIncidents = incidents;

  if (isRecord(value.customerBreakdown)) {
    const breakdown: Record<string, { delivered: number; missed: number }> = {};
    for (const [name, entry] of Object.entries(value.customerBreakdown)) {
      if (!isRecord(entry)) continue;
      const delivered = finite(entry.delivered);
      const missed = finite(entry.missed);
      if (delivered !== null && missed !== null) breakdown[name.slice(0, 80)] = { delivered, missed };
    }
    if (Object.keys(breakdown).length > 0) record.customerBreakdown = breakdown;
  }

  const pod = value.podStatus;
  if (pod === 'complete' || pod === 'partial' || pod === 'none') record.podStatus = pod;
  if (typeof value.driverName === 'string') record.driverName = value.driverName.slice(0, 120);
  if (typeof value.carNumber === 'string') record.carNumber = value.carNumber.slice(0, 40);
  if (typeof value.plateNumber === 'string') record.plateNumber = value.plateNumber.slice(0, 40);
  const cod = finite(value.codShipments);
  if (cod !== null) record.codShipments = cod;
  const prepaid = finite(value.prepaidShipments);
  if (prepaid !== null) record.prepaidShipments = prepaid;
  const collected = finite(value.cashCollectedSar);
  if (collected !== null) record.cashCollectedSar = collected;
  const remitted = finite(value.cashRemittedSar);
  if (remitted !== null) record.cashRemittedSar = remitted;
  const weather = value.weatherCondition;
  if (weather === 'clear' || weather === 'rain' || weather === 'fog' || weather === 'sand') record.weatherCondition = weather;

  return record;
}

function sanitizeDailyMap(value: unknown): Record<string, DailyRecord> {
  const map: Record<string, DailyRecord> = {};
  if (!isRecord(value)) return map;
  for (const [date, raw] of Object.entries(value)) {
    const record = sanitizeDailyRecord(date, raw);
    if (record) map[record.date] = record;
  }
  return map;
}

function sanitizeScenarios(value: unknown): Scenario[] {
  if (!Array.isArray(value)) return [];
  const out: Scenario[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const input = isRecord(raw.input) ? sanitizeFinancialInput(raw.input as unknown as FinancialInput) : null;
    if (!input) continue;
    out.push({
      id: str(raw.id, 60) || `scn-${out.length}`,
      name: str(raw.name, 60) || 'Scenario',
      savedAt: ISO_RE.test(str(raw.savedAt, 40)) ? str(raw.savedAt, 40) : '',
      input,
    });
  }
  return out;
}

function sanitizeRecoveryEntries(value: unknown): RecoveryEntry[] {
  if (!Array.isArray(value)) return [];
  const out: RecoveryEntry[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const shipments = finite(raw.shipments);
    const createdAt = str(raw.createdAt, 10);
    const owner = str(raw.owner, 120);
    const status = raw.status;
    if (shipments === null || shipments < 0 || !DATE_RE.test(createdAt) || owner === '') continue;
    if (status !== 'pending' && status !== 'recovered' && status !== 'written_off') continue;
    const entry: RecoveryEntry = {
      id: str(raw.id, 60) || `rec-${out.length}-${createdAt}`,
      createdAt,
      shipments,
      owner,
      status,
    };
    if (typeof raw.reasonKey === 'string') entry.reasonKey = str(raw.reasonKey, 40) as RecoveryEntry['reasonKey'];
    if (typeof raw.customer === 'string') entry.customer = raw.customer.slice(0, 120);
    if (typeof raw.note === 'string') entry.note = raw.note.slice(0, 1000);
    const resolvedAt = str(raw.resolvedAt, 40);
    if (ISO_RE.test(resolvedAt)) entry.resolvedAt = resolvedAt;
    out.push(entry);
  }
  return out;
}

function sanitizeFollowUpActions(value: unknown): FollowUpAction[] {
  if (!Array.isArray(value)) return [];
  const out: FollowUpAction[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const id = finite(raw.id);
    const text = str(raw.text, 300);
    if (id === null || text === '') continue;
    out.push({ id, text, owner: str(raw.owner, 80), done: raw.done === true });
  }
  return out;
}

/** Build a v2 backup file from live state. */
export function buildBackup(bundle: StateBundle): BackupFileV2 {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: structuredClone({
      financialInput: bundle.financialInput,
      dailyRecords: bundle.dailyRecords,
      scenarios: bundle.scenarios,
      recoveryEntries: bundle.recoveryEntries,
      followUpActions: bundle.followUpActions,
    }),
  };
}

/**
 * Parse a backup file. Accepts v2 envelopes and migrates legacy v1 files.
 * Never throws; returns a typed error instead. App state is untouched here.
 */
export function parseBackup(raw: string): ParsedBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
  if (!isRecord(parsed)) return { ok: false, error: 'not-an-object' };

  // ── legacy v1 (ModelBackup from scenarios.ts) ──
  if (parsed.version === 1) {
    if (!isRecord(parsed.input) || !Array.isArray((parsed.input as { vehicleClasses?: unknown }).vehicleClasses ?? [])) {
      // vehicleClasses check happens again inside sanitize; presence guard below
    }
    const daily = sanitizeDailyMap(parsed.dailyRecords);
    const scenarios = sanitizeScenarios(parsed.scenarios);
    const input = isRecord(parsed.input) ? sanitizeFinancialInput(parsed.input as unknown as FinancialInput) : null;
    if (!input) return { ok: false, error: 'v1-input-invalid' };
    return {
      ok: true,
      migratedFrom: 1,
      file: {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: ISO_RE.test(str(parsed.exportedAt, 40)) ? str(parsed.exportedAt, 40) : '',
        data: { financialInput: pruneUndefined(input), dailyRecords: daily, scenarios, recoveryEntries: [], followUpActions: [] },
      },
    };
  }

  // ── v2 ──
  if (parsed.format !== BACKUP_FORMAT || parsed.version !== BACKUP_VERSION || !isRecord(parsed.data)) {
    return { ok: false, error: 'unsupported-format' };
  }
  const data = parsed.data as Record<string, unknown>;
  if (!isRecord(data.financialInput)) return { ok: false, error: 'financial-input-invalid' };
  const input = sanitizeFinancialInput(data.financialInput as unknown as FinancialInput);
  if (!input || !Array.isArray(input.vehicleClasses) || !Array.isArray(input.providers)) {
    return { ok: false, error: 'financial-input-invalid' };
  }
  return {
    ok: true,
    file: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: ISO_RE.test(str(parsed.exportedAt, 40)) ? str(parsed.exportedAt, 40) : '',
      data: {
        financialInput: pruneUndefined(input),
        dailyRecords: sanitizeDailyMap(data.dailyRecords),
        scenarios: sanitizeScenarios(data.scenarios),
        recoveryEntries: sanitizeRecoveryEntries(data.recoveryEntries),
        followUpActions: sanitizeFollowUpActions(data.followUpActions),
      },
    },
  };
}

/** Strip keys explicitly set to undefined (e.g. sanitizer-injected optionals)
 *  so exported state compares cleanly against live state. */
function pruneUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => pruneUndefined(item)) as T;
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (val !== undefined) out[key] = pruneUndefined(val);
    }
    return out as T;
  }
  return value;
}

function newer(incoming: string, existing: string): boolean {
  // Deterministic: strictly-newer incoming wins; ties keep the local record.
  return (incoming || '') > (existing || '');
}

/** Date-keyed merge for DailyRecords. */
export function mergeDailyRecords(
  current: Record<string, DailyRecord>,
  incoming: Record<string, DailyRecord>,
): { merged: Record<string, DailyRecord>; stats: MergeStats } {
  const merged: Record<string, DailyRecord> = { ...current };
  const stats: MergeStats = { added: 0, updated: 0, conflicts: 0 };
  for (const [date, record] of Object.entries(incoming)) {
    const existing = merged[date];
    if (!existing) {
      merged[date] = record;
      stats.added += 1;
    } else if (newer(record.updatedAt, existing.updatedAt)) {
      merged[date] = record;
      stats.updated += 1;
    } else {
      stats.conflicts += 1;
    }
  }
  return { merged, stats };
}

/** Id-keyed merge generic over timestamped rows. */
function mergeById<T extends { id: string }>(
  current: T[],
  incoming: T[],
  timeOf: (item: T) => string,
  differs: (a: T, b: T) => boolean,
): { merged: T[]; stats: MergeStats } {
  const byId = new Map(current.map(item => [item.id, item]));
  const stats: MergeStats = { added: 0, updated: 0, conflicts: 0 };
  for (const item of incoming) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      stats.added += 1;
    } else if (differs(existing, item)) {
      if (newer(timeOf(item), timeOf(existing))) {
        byId.set(item.id, item);
        stats.updated += 1;
      } else {
        stats.conflicts += 1;
      }
    }
    // identical rows are ignored silently — no information was lost
  }
  return { merged: [...byId.values()], stats };
}

const sum = (...stats: MergeStats[]): MergeStats =>
  stats.reduce((acc, s) => ({ added: acc.added + s.added, updated: acc.updated + s.updated, conflicts: acc.conflicts + s.conflicts }), { added: 0, updated: 0, conflicts: 0 });

/**
 * Merge-mode application. Singleton model inputs are intentionally kept —
 * surfaced to the user as part of the visible conflict accounting.
 */
export function applyBackupMerge(
  current: StateBundle,
  file: BackupFileV2,
): { next: StateBundle; stats: MergeStats } {
  const days = mergeDailyRecords(current.dailyRecords, file.data.dailyRecords);
  const scenarios = mergeById(
    current.scenarios,
    file.data.scenarios,
    scenario => scenario.savedAt,
    (a, b) => JSON.stringify(a) !== JSON.stringify(b),
  );
  const recovery = mergeById(
    current.recoveryEntries,
    file.data.recoveryEntries,
    entry => entry.resolvedAt ?? entry.createdAt,
    (a, b) => JSON.stringify(a) !== JSON.stringify(b),
  );
  const actions = mergeById(
    current.followUpActions.map(action => ({ ...action, id: String(action.id) })),
    file.data.followUpActions.map(action => ({ ...action, id: String(action.id) })),
    () => '', // actions carry no timestamps: first-seen wins, edits conflict
    (a, b) => a.text !== b.text || a.owner !== b.owner || a.done !== b.done,
  );

  const inputsDiffer = JSON.stringify(current.financialInput) !== JSON.stringify(file.data.financialInput);

  return {
    next: {
      financialInput: current.financialInput,
      dailyRecords: days.merged,
      scenarios: scenarios.merged as Scenario[],
      recoveryEntries: recovery.merged as RecoveryEntry[],
      followUpActions: actions.merged.map(({ id, ...rest }) => ({ ...rest, id: Number(id) })).sort((a, b) => a.id - b.id),
    },
    stats: sum(days.stats, scenarios.stats, recovery.stats, actions.stats, {
      added: 0,
      updated: 0,
      conflicts: inputsDiffer ? 1 : 0, // model inputs kept in merge mode
    }),
  };
}

/** Replace-mode application: wholesale adoption of the backup file. */
export function replaceWithBackup(_current: StateBundle, file: BackupFileV2): StateBundle {
  return structuredClone(file.data);
}
