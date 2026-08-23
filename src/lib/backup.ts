// VEGA — Backup integrity engine (P1, revision 2 under review contract C).
//
// Scope (single source of truth — mirrored in docs/MASTER_PLAN.md §P1,
// AGENTS.md session block and SESSION_MEMORY.md):
//   persisted keys backed up / restored
//     vega-financialInput-v2 · vega-daily-reports-v2 · vega-scenarios-v1
//     vega-recovery-board-v1  · vega-followup-actions-v1 · language (pref)
//   NOT persisted anymore: vega-vehicles / vega-zones — proven immutable
//     seed catalogs (read-only useLocalStorage consumers); persistence
//     removed from useSimulatedData in this commit (truthful-design b).
//
// Parsing contract:
//   - v2 files MUST contain all five collections with correct container
//     types (object/object/array/array/array) — a missing or wrong-typed
//     collection rejects the ENTIRE file;
//   - FinancialInput structure is validated BEFORE sanitizing — `{}` and
//     shape-less objects are rejected outright;
//   - individual records that fail validation inside a well-typed
//     container are DROPPED WITH WARNING: merge stays available, but
//     Replace is DISABLED because replace would silently shrink history
//     ("malformed input must never become an empty valid backup");
//   - parse never throws and never mutates app state or localStorage.
//
// Conflict semantics (deterministic, timestamp-driven):
//   - every mutable row carries a normalized ISO `updatedAt`
//     (recovery entries + follow-up actions migrated in this commit);
//   - comparison is numeric (Date.parse), never lexical regex matching;
//   - strictly-newer incoming wins ("updated"); differing rows where the
//     incoming version loses are CONFLICTS (visible count); IDENTICAL
//     rows are ignored silently — they are not conflicts;
//   - duplicate ids inside one incoming file resolve deterministically to
//     the LAST occurrence (later entries win), each duplicate warned;
//   - scenarios are treated as IMMUTABLE snapshots keyed by their
//     `savedAt` creation stamp (documented policy — scenario loading
//     replaces model inputs wholesale, so editing-in-place is not a
//     supported workflow);
//   - singleton model inputs are never overwritten in merge mode (no
//     trustworthy timestamps exist); a differing input counts as exactly
//     one visible conflict and Replace is the explicit adoption path.

import { sanitizeFinancialInput } from '@/lib/calculations';
import type { FinancialInput } from '@/lib/types';
import type { DailyRecord } from '@/lib/operationsReporting';
import type { RecoveryEntry } from '@/lib/recoveryBoard';
import type { Scenario } from '@/lib/scenarios';

export const BACKUP_FORMAT = 'vega-logistics-backup' as const;
export const BACKUP_VERSION = 2 as const;

/** Authoritative inventory of user-state localStorage keys (see header). */
export const STORAGE_KEYS = {
  financialInput: 'vega-financialInput-v2',
  dailyRecords: 'vega-daily-reports-v2',
  scenarios: 'vega-scenarios-v1',
  recoveryEntries: 'vega-recovery-board-v1',
  followUpActions: 'vega-followup-actions-v1',
  language: 'language',
} as const;

/** Follow-up action row as persisted under `vega-followup-actions-v1`. */
export interface FollowUpAction {
  id: number;
  text: string;
  owner: string;
  done: boolean;
  /** Normalized ISO stamp set on every edit (conflict resolution). */
  updatedAt?: string;
}

export interface BackupData {
  financialInput: FinancialInput;
  dailyRecords: Record<string, DailyRecord>;
  scenarios: Scenario[];
  recoveryEntries: RecoveryEntry[];
  followUpActions: FollowUpAction[];
  /** UI preference restored on import ('en' | 'ar'). */
  language?: string;
}

export interface BackupFileV2 {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: BackupData;
}

/** The slice of live application state backups round-trip. */
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
  /** Differing rows where the INCOMING version lost to the local one. */
  conflicts: number;
  /** Identical rows ignored silently (reported for transparency). */
  identical: number;
}

export type ParsedBackup =
  | {
      ok: true;
      file: BackupFileV2;
      migratedFrom?: 1;
      warnings: string[];
      dropped: { days: number; scenarios: number; recoveryEntries: number; followUpActions: number };
      /** false ⇒ destructive Replace must be disabled in the UI. */
      lossless: boolean;
    }
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

/**
 * Normalize a timestamp to a real ISO-8601 instant.
 * Returns the canonical `Date.toISOString()` form so downstream
 * comparisons can be numeric (Date.parse) instead of lexical.
 * Invalid/absent input → null (treated as "oldest" by merge rules).
 */
export function normalizeIso(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = new Date(value);
  const time = parsed.getTime();
  if (!Number.isFinite(time)) return null;
  return parsed.toISOString();
}

/**
 * Structural validation BEFORE sanitizing. Requires meaningful fields and
 * valid arrays — `{}`, `{a:1}` or arrays-of-garbage are rejected here so
 * sanitizeFinancialInput's coercive defaults can never launder them.
 */
export function isFinancialInputShape(value: unknown): value is FinancialInput {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.vehicleClasses) || !Array.isArray(value.providers)) return false;
  if ((value.vehicleClasses as unknown[]).some(item => !isRecord(item))) return false;
  if ((value.providers as unknown[]).some(item => !isRecord(item))) return false;
  const numericAnchors = ['driverSalary', 'companyDriverCount', 'fuelPricePerLiter'] as const;
  return numericAnchors.every(key => finite(value[key]) !== null);
}

/**
 * Rebuild a DailyRecord preserving EVERY field, required and optional.
 * Returns null only when REQUIRED numerics are corrupt (phantom-zero
 * protection inherited from the v1 parser). Corrupt OPTIONAL fields are
 * dropped individually rather than rejecting the whole day.
 */
function sanitizeDailyRecord(rawDate: string, value: unknown): DailyRecord | null {
  if (!isRecord(value)) return null;
  const candidate = str(value.date, 10);
  const date = DATE_RE.test(candidate) ? candidate : DATE_RE.test(rawDate) ? rawDate : '';
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
    updatedAt: normalizeIso(value.updatedAt) ?? '',
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

function sanitizeDailyMap(value: Record<string, unknown>, warn: (msg: string) => void): Record<string, DailyRecord> {
  const map: Record<string, DailyRecord> = {};
  for (const [date, raw] of Object.entries(value)) {
    const record = sanitizeDailyRecord(date, raw);
    if (record) map[record.date] = record;
    else warn(`day:${date}`);
  }
  return map;
}

/** Dedupe by id keeping the LAST occurrence (documented deterministic rule). */
function dedupeById<T extends { id: string }>(items: T[], warn: (msg: string) => void): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (seen.has(item.id)) {
      warn(`duplicate-id:${item.id}`);
      continue;
    }
    seen.add(item.id);
    out.push(item);
  }
  return out.reverse();
}

function sanitizeScenarios(value: unknown[], warn: (msg: string) => void): Scenario[] {
  const out: Scenario[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index];
    if (!isRecord(raw) || !isRecord(raw.input)) {
      warn(`scenario:index-${index}`);
      continue;
    }
    const input = sanitizeFinancialInput(raw.input as unknown as FinancialInput);
    out.push({
      id: str(raw.id, 60) || `scn-index-${index}`,
      name: str(raw.name, 60) || 'Scenario',
      // Immutable creation stamp — see conflict-policy note in the header.
      savedAt: normalizeIso(raw.savedAt) ?? '',
      input: pruneUndefined(input),
    });
  }
  return out;
}

function sanitizeRecoveryEntries(value: unknown[], warn: (msg: string) => void): RecoveryEntry[] {
  const out: RecoveryEntry[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index];
    if (!isRecord(raw)) {
      warn(`recovery:index-${index}`);
      continue;
    }
    const shipments = finite(raw.shipments);
    const createdAt = str(raw.createdAt, 10);
    const status = raw.status;
    // NOTE: an EMPTY owner is valid in the current model (unassigned row).
    if (shipments === null || shipments < 0 || !DATE_RE.test(createdAt)) {
      warn(`recovery:index-${index}`);
      continue;
    }
    if (status !== 'pending' && status !== 'recovered' && status !== 'written_off') {
      warn(`recovery:index-${index}`);
      continue;
    }
    const entry: RecoveryEntry = {
      id: str(raw.id, 60) || `rec-index-${index}-${createdAt}`,
      createdAt,
      shipments,
      owner: str(raw.owner, 120),
      status,
    };
    if (typeof raw.reasonKey === 'string') entry.reasonKey = str(raw.reasonKey, 40) as RecoveryEntry['reasonKey'];
    if (typeof raw.customer === 'string') entry.customer = raw.customer.slice(0, 120);
    if (typeof raw.note === 'string') entry.note = raw.note.slice(0, 1000);
    const resolvedAt = normalizeIso(raw.resolvedAt);
    if (resolvedAt) entry.resolvedAt = resolvedAt;
    const updatedAt = normalizeIso(raw.updatedAt);
    if (updatedAt) entry.updatedAt = updatedAt;
    out.push(entry);
  }
  return out;
}

function sanitizeFollowUpActions(value: unknown[], warn: (msg: string) => void): FollowUpAction[] {
  const out: FollowUpAction[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index];
    if (!isRecord(raw)) {
      warn(`action:index-${index}`);
      continue;
    }
    const id = finite(raw.id);
    const text = str(raw.text, 300);
    if (id === null || text === '') {
      warn(`action:index-${index}`);
      continue;
    }
    const action: FollowUpAction = { id, text, owner: str(raw.owner, 80), done: raw.done === true };
    const updatedAt = normalizeIso(raw.updatedAt);
    if (updatedAt) action.updatedAt = updatedAt;
    out.push(action);
  }
  return out;
}

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

/** Build a v2 backup file from live state (including language pref). */
export function buildBackup(
  bundle: StateBundle,
  language?: string,
): BackupFileV2 {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: structuredClone({ ...bundle, language }),
  };
}

/**
 * Parse a backup file (v2 strict / v1 migration). Never throws; returns a
 * typed error instead. App state and localStorage remain untouched here.
 */
export function parseBackup(raw: string): ParsedBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
  if (!isRecord(parsed)) return { ok: false, error: 'not-an-object' };

  const warnings: string[] = [];
  const warn = (msg: string) => warnings.push(msg);

  // ── legacy v1 (ModelBackup from scenarios.ts) ──
  if (parsed.version === 1) {
    if (!isRecord(parsed.input)) return { ok: false, error: 'v1-input-invalid' };
    if (!isFinancialInputShape(parsed.input)) return { ok: false, error: 'v1-input-invalid' };
    if (!isRecord(parsed.dailyRecords)) return { ok: false, error: 'v1-daily-records-invalid' };
    if (parsed.scenarios !== undefined && !Array.isArray(parsed.scenarios)) {
      return { ok: false, error: 'v1-scenarios-invalid' };
    }
    const input = pruneUndefined(sanitizeFinancialInput(parsed.input));
    return {
      ok: true,
      migratedFrom: 1,
      warnings: [...warnings, 'legacy-v1:no-recovery-or-actions-stored'],
      dropped: { days: 0, scenarios: 0, recoveryEntries: 0, followUpActions: 0 },
      lossless: false, // v1 never contained recovery/actions/language
      file: {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: normalizeIso(parsed.exportedAt) ?? '',
        data: {
          financialInput: input,
          dailyRecords: sanitizeDailyMap(parsed.dailyRecords, warn),
          scenarios: Array.isArray(parsed.scenarios) ? sanitizeScenarios(parsed.scenarios, warn) : [],
          recoveryEntries: [],
          followUpActions: [],
        },
      },
    };
  }

  // ── v2 strict ──
  if (parsed.format !== BACKUP_FORMAT || parsed.version !== BACKUP_VERSION) {
    return { ok: false, error: 'unsupported-format' };
  }
  if (!isRecord(parsed.data)) return { ok: false, error: 'data-container-invalid' };

  const data = parsed.data as Record<string, unknown>;
  // Container-type enforcement: a missing/malformed collection rejects the
  // whole file. Malformed collections NEVER become silent empty arrays.
  if (!isRecord(data.financialInput)) return { ok: false, error: 'financial-input-container' };
  if (!isRecord(data.dailyRecords)) return { ok: false, error: 'daily-records-container' };
  if (!Array.isArray(data.scenarios)) return { ok: false, error: 'scenarios-container' };
  if (!Array.isArray(data.recoveryEntries)) return { ok: false, error: 'recovery-entries-container' };
  if (!Array.isArray(data.followUpActions)) return { ok: false, error: 'follow-up-actions-container' };

  // Structure BEFORE sanitize: coercive defaults must not rescue junk.
  if (!isFinancialInputShape(data.financialInput)) return { ok: false, error: 'financial-input-shape' };

  const dailyRecords = sanitizeDailyMap(data.dailyRecords, warn);
  const daysDropped = Object.keys(data.dailyRecords).length - Object.keys(dailyRecords).length;
  const rawScenarios = sanitizeScenarios(data.scenarios, warn);
  const scenariosDropped = data.scenarios.length - rawScenarios.length;
  const rawRecovery = sanitizeRecoveryEntries(data.recoveryEntries, warn);
  const recoveryDropped = data.recoveryEntries.length - rawRecovery.length;
  const rawActions = sanitizeFollowUpActions(data.followUpActions, warn);
  const actionsDropped = data.followUpActions.length - rawActions.length;

  const languageRaw = data.language;
  const language = languageRaw === 'en' || languageRaw === 'ar' ? languageRaw : undefined;

  const dropped = { days: daysDropped, scenarios: scenariosDropped, recoveryEntries: recoveryDropped, followUpActions: actionsDropped };
  const totalDropped = daysDropped + scenariosDropped + recoveryDropped + actionsDropped;

  const scenarios = dedupeById(rawScenarios, warn);
  const recoveryEntries = dedupeById(rawRecovery, warn);
  const followUpActions = dedupeById(rawActions.map(a => ({ ...a, id: String(a.id) })), warn)
    .map(({ id, ...rest }) => ({ ...rest, id: Number(id) }))
    .sort((a, b) => a.id - b.id);

  return {
    ok: true,
    warnings,
    dropped,
    lossless: totalDropped === 0 && warnings.filter(w => w.startsWith('duplicate-id')).length === 0,
    file: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: normalizeIso(parsed.exportedAt) ?? '',
      data: {
        financialInput: pruneUndefined(sanitizeFinancialInput(data.financialInput)),
        dailyRecords,
        scenarios,
        recoveryEntries,
        followUpActions,
        ...(language ? { language } : {}),
      },
    },
  };
}

/** Numeric timestamp comparison on normalized instants. */
function isNewer(incomingIso: string | null, existingIso: string | null): boolean {
  const incoming = incomingIso ? Date.parse(incomingIso) : Number.NaN;
  const existing = existingIso ? Date.parse(existingIso) : Number.NaN;
  const inTime = Number.isFinite(incoming) ? incoming : Number.NEGATIVE_INFINITY;
  const exTime = Number.isFinite(existing) ? existing : Number.NEGATIVE_INFINITY;
  return inTime > exTime;
}

/** Date-keyed merge for DailyRecords. Identical days are ignored silently. */
export function mergeDailyRecords(
  current: Record<string, DailyRecord>,
  incoming: Record<string, DailyRecord>,
): { merged: Record<string, DailyRecord>; stats: MergeStats } {
  const merged: Record<string, DailyRecord> = { ...current };
  const stats: MergeStats = { added: 0, updated: 0, conflicts: 0, identical: 0 };
  for (const [date, record] of Object.entries(incoming)) {
    const existing = merged[date];
    if (!existing) {
      merged[date] = record;
      stats.added += 1;
    } else if (JSON.stringify(existing) === JSON.stringify(record)) {
      stats.identical += 1;
    } else if (isNewer(normalizeIso(record.updatedAt), normalizeIso(existing.updatedAt))) {
      merged[date] = record;
      stats.updated += 1;
    } else {
      // differing records where the incoming version loses = conflict
      stats.conflicts += 1;
    }
  }
  return { merged, stats };
}

/** Id-keyed merge generic over timestamped mutable rows. */
function mergeById<T extends { id: string }>(
  current: T[],
  incoming: T[],
  timeOf: (item: T) => string | null,
  differs: (a: T, b: T) => boolean,
): { merged: T[]; stats: MergeStats } {
  const byId = new Map(current.map(item => [item.id, item]));
  const stats: MergeStats = { added: 0, updated: 0, conflicts: 0, identical: 0 };
  for (const item of incoming) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      stats.added += 1;
    } else if (!differs(existing, item)) {
      stats.identical += 1; // identical rows are ignored, not conflicts
    } else if (isNewer(timeOf(item), timeOf(existing))) {
      byId.set(item.id, item);
      stats.updated += 1;
    } else {
      stats.conflicts += 1; // incoming differed but lost
    }
  }
  return { merged: [...byId.values()], stats };
}

const sum = (...stats: MergeStats[]): MergeStats =>
  stats.reduce(
    (acc, s) => ({
      added: acc.added + s.added,
      updated: acc.updated + s.updated,
      conflicts: acc.conflicts + s.conflicts,
      identical: acc.identical + s.identical,
    }),
    { added: 0, updated: 0, conflicts: 0, identical: 0 },
  );

/**
 * Merge-mode application. Singleton model inputs are intentionally kept —
 * surfaced as exactly one visible conflict when they differ (Replace is
 * the explicit adoption path).
 */
export function applyBackupMerge(current: StateBundle, file: BackupFileV2): { next: StateBundle; stats: MergeStats } {
  const days = mergeDailyRecords(current.dailyRecords, file.data.dailyRecords);
  const scenarios = mergeById(
    current.scenarios,
    file.data.scenarios,
    scenario => normalizeIso(scenario.savedAt),
    (a, b) => JSON.stringify(a) !== JSON.stringify(b),
  );
  const recovery = mergeById(
    current.recoveryEntries,
    file.data.recoveryEntries,
    entry => normalizeIso(entry.updatedAt) ?? normalizeIso(entry.resolvedAt) ?? normalizeIso(entry.createdAt),
    (a, b) => JSON.stringify(a) !== JSON.stringify(b),
  );
  const actions = mergeById(
    current.followUpActions.map(action => ({ ...action, id: String(action.id) })),
    file.data.followUpActions.map(action => ({ ...action, id: String(action.id) })),
    action => normalizeIso(action.updatedAt),
    (a, b) => !(a.text === b.text && a.owner === b.owner && a.done === b.done),
  );

  const inputsIdentical = JSON.stringify(current.financialInput) === JSON.stringify(file.data.financialInput);

  return {
    next: {
      financialInput: current.financialInput,
      dailyRecords: days.merged,
      scenarios: scenarios.merged as Scenario[],
      recoveryEntries: recovery.merged as RecoveryEntry[],
      followUpActions: actions.merged
        .map(({ id, ...rest }) => ({ ...rest, id: Number(id) }))
        .sort((a, b) => a.id - b.id),
    },
    stats: sum(days.stats, scenarios.stats, recovery.stats, actions.stats, {
      added: 0,
      updated: 0,
      conflicts: inputsIdentical ? 0 : 1,
      identical: inputsIdentical ? 1 : 0,
    }),
  };
}

/** Replace-mode application: wholesale adoption of the backup file. */
export function replaceWithBackup(_current: StateBundle, file: BackupFileV2): StateBundle {
  return structuredClone({
    financialInput: file.data.financialInput,
    dailyRecords: file.data.dailyRecords,
    scenarios: file.data.scenarios,
    recoveryEntries: file.data.recoveryEntries,
    followUpActions: file.data.followUpActions,
  });
}

export interface PersistResult {
  persistedOk: boolean;
  failedKeys: string[];
}

/**
 * Write every restored collection straight to its localStorage key so the
 * restore survives reload even if React state hydration hiccups. Storage
 * failures are COLLECTED, never thrown — callers must not announce a
 * successful restore when any key failed (review contract C2).
 */
export function persistBundle(
  bundle: StateBundle,
  language: string | undefined,
  storage: Pick<Storage, 'setItem'> = typeof window === 'undefined' ? undefined as unknown as Storage : window.localStorage,
): PersistResult {
  const payload: Array<[string, unknown]> = [
    [STORAGE_KEYS.financialInput, bundle.financialInput],
    [STORAGE_KEYS.dailyRecords, bundle.dailyRecords],
    [STORAGE_KEYS.scenarios, bundle.scenarios],
    [STORAGE_KEYS.recoveryEntries, bundle.recoveryEntries],
    [STORAGE_KEYS.followUpActions, bundle.followUpActions],
  ];
  if (language === 'en' || language === 'ar') payload.push([STORAGE_KEYS.language, language]);

  const failedKeys: string[] = [];
  for (const [key, value] of payload) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      failedKeys.push(key);
    }
  }
  return { persistedOk: failedKeys.length === 0, failedKeys };
}
