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
import { validateStopRecord, normalizeStopRecord, type StopRecord, type StopFieldError } from '@/lib/stops';

function validateStopRecordForBackup(candidate: Record<string, unknown>): StopFieldError[] {
  return validateStopRecord(candidate).errors.filter(e => e.field !== 'id');
}
function normalizeStopRecordForBackup(candidate: Record<string, unknown>): StopRecord {
  return normalizeStopRecord(candidate);
}

export const BACKUP_FORMAT = 'vega-logistics-backup' as const;
export const BACKUP_VERSION = 3 as const;

/** Authoritative inventory of user-state localStorage keys (see header). */
export const STORAGE_KEYS = {
  financialInput: 'vega-financialInput-v2',
  dailyRecords: 'vega-daily-reports-v2',
  scenarios: 'vega-scenarios-v1',
  recoveryEntries: 'vega-recovery-board-v1',
  followUpActions: 'vega-followup-actions-v1',
  stops: 'vega-stops-v1',
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
  /** v3 only — absent (not empty) in v2 files. */
  stops?: StopRecord[];
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
  stops: StopRecord[];
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
      migratedFrom?: 1 | 2;
      warnings: string[];
      dropped: { days: number; scenarios: number; recoveryEntries: number; followUpActions: number; stops: number };
      /** false ⇒ destructive Replace must be disabled in the UI. */
      lossless: boolean;
      /**
       * Legacy v1 scope notice: the format never contained recovery entries,
       * follow-up actions or language. EXPECTED — not corruption.
       */
      legacyScopeMissing?: boolean;
      /**
       * True when actual content was dropped or materially sanitized inside
       * the file's own scope (corrupt days/scenarios/rows). Gates scoped
       * restore for v1 and Replace for every format.
       */
      contentLoss?: boolean;
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

/** True only for REAL calendar dates ('2026-02-30' fails). */
function isValidCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

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
function sanitizeDailyRecord(rawDate: string, value: unknown, warn: (msg: string) => void): DailyRecord | null {
  if (!isRecord(value)) return null;
  const candidate = str(value.date, 10);
  let date = DATE_RE.test(candidate) ? candidate : DATE_RE.test(rawDate) ? rawDate : '';
  if (!isValidCalendarDate(date)) {
    if (date !== '') warn(`day:${date}:impossible-date`);
    date = '';
  }
  if (date === '') return null;
  const stampWarn = (field: string) => warn(`day:${date}:${field}`);
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
    // (non-string supplied notes warned explicitly right below)
  };
  if (record.updatedAt === '' && value.updatedAt !== undefined && value.updatedAt !== null && str(value.updatedAt, 40) !== '') stampWarn('updatedAt-invalid');
  if (value.notes !== undefined && value.notes !== null && typeof value.notes !== 'string') stampWarn('notes-invalid');

  if (typeof value.tomorrowNote === 'string') record.tomorrowNote = value.tomorrowNote.slice(0, 2000);
  else if (value.tomorrowNote !== undefined && value.tomorrowNote !== null) stampWarn('tomorrowNote-invalid');
  if (isRecord(value.failureReasons)) {
    const reasons: Record<string, number> = {};
    for (const [key, count] of Object.entries(value.failureReasons)) {
      const n = finite(count);
      if (n !== null && n >= 0) reasons[key.slice(0, 60)] = n;
      else warn(`day:${date}:failureReasons:${key.slice(0, 20)}`);
    }
    record.failureReasons = reasons as DailyRecord['failureReasons'];
  } else if (value.failureReasons !== undefined && value.failureReasons !== null) {
    stampWarn('failureReasons-container');
  }
  const extraCosts = finite(value.extraCosts);
  if (extraCosts !== null) record.extraCosts = extraCosts;
  else if (value.extraCosts !== undefined && value.extraCosts !== null) stampWarn('extraCosts-invalid');
  const visits = finite(value.newCustomerVisits);
  if (visits !== null) record.newCustomerVisits = visits;
  else if (value.newCustomerVisits !== undefined && value.newCustomerVisits !== null) stampWarn('newCustomerVisits-invalid');
  const recovered = finite(value.recoveredShipments);
  if (recovered !== null) record.recoveredShipments = recovered;
  else if (value.recoveredShipments !== undefined && value.recoveredShipments !== null) stampWarn('recoveredShipments-invalid');
  const incidents = finite(value.safetyIncidents);
  if (incidents !== null) record.safetyIncidents = incidents;
  else if (value.safetyIncidents !== undefined && value.safetyIncidents !== null) stampWarn('safetyIncidents-invalid');

  if (isRecord(value.customerBreakdown)) {
    const breakdown: Record<string, { delivered: number; missed: number }> = {};
    for (const [name, entry] of Object.entries(value.customerBreakdown)) {
      if (!isRecord(entry)) {
        warn(`day:${date}:customerBreakdown:${name.slice(0, 20)}`);
        continue;
      }
      const delivered = finite(entry.delivered);
      const missed = finite(entry.missed);
      if (delivered !== null && missed !== null) breakdown[name.slice(0, 80)] = { delivered, missed };
      else warn(`day:${date}:customerBreakdown:${name.slice(0, 20)}`);
    }
    if (Object.keys(breakdown).length > 0) record.customerBreakdown = breakdown;
  } else if (value.customerBreakdown !== undefined && value.customerBreakdown !== null) {
    stampWarn('customerBreakdown-container');
  }

  const pod = value.podStatus;
  if (pod === 'complete' || pod === 'partial' || pod === 'none') record.podStatus = pod;
  else if (pod !== undefined && pod !== null) stampWarn('podStatus-invalid');
  if (typeof value.driverName === 'string') record.driverName = value.driverName.slice(0, 120);
  else if (value.driverName !== undefined && value.driverName !== null) stampWarn('driverName-invalid');
  if (typeof value.carNumber === 'string') record.carNumber = value.carNumber.slice(0, 40);
  else if (value.carNumber !== undefined && value.carNumber !== null) stampWarn('carNumber-invalid');
  if (typeof value.plateNumber === 'string') record.plateNumber = value.plateNumber.slice(0, 40);
  else if (value.plateNumber !== undefined && value.plateNumber !== null) stampWarn('plateNumber-invalid');
  const cod = finite(value.codShipments);
  if (cod !== null) record.codShipments = cod;
  else if (value.codShipments !== undefined && value.codShipments !== null) stampWarn('codShipments-invalid');
  const prepaid = finite(value.prepaidShipments);
  if (prepaid !== null) record.prepaidShipments = prepaid;
  else if (value.prepaidShipments !== undefined && value.prepaidShipments !== null) stampWarn('prepaidShipments-invalid');
  const collected = finite(value.cashCollectedSar);
  if (collected !== null) record.cashCollectedSar = collected;
  else if (value.cashCollectedSar !== undefined && value.cashCollectedSar !== null) stampWarn('cashCollectedSar-invalid');
  const remitted = finite(value.cashRemittedSar);
  if (remitted !== null) record.cashRemittedSar = remitted;
  else if (value.cashRemittedSar !== undefined && value.cashRemittedSar !== null) stampWarn('cashRemittedSar-invalid');
  const loadedS = finite(value.loadedShipments);
  if (loadedS !== null && Number.isInteger(loadedS) && loadedS >= 0) record.loadedShipments = loadedS;
  else if (value.loadedShipments !== undefined && value.loadedShipments !== null) stampWarn('loadedShipments-invalid');
  const returnedS = finite(value.returnedShipments);
  if (returnedS !== null && Number.isInteger(returnedS) && returnedS >= 0) record.returnedShipments = returnedS;
  else if (value.returnedShipments !== undefined && value.returnedShipments !== null) stampWarn('returnedShipments-invalid');
  const pendingS = finite(value.pendingShipments);
  if (pendingS !== null && Number.isInteger(pendingS) && pendingS >= 0) record.pendingShipments = pendingS;
  else if (value.pendingShipments !== undefined && value.pendingShipments !== null) stampWarn('pendingShipments-invalid');
  const codExpected = finite(value.codExpectedSar);
  if (codExpected !== null && codExpected >= 0) record.codExpectedSar = codExpected;
  else if (value.codExpectedSar !== undefined && value.codExpectedSar !== null) stampWarn('codExpectedSar-invalid');
  if (value.closeStatus === 'draft' || value.closeStatus === 'reconciled') record.closeStatus = value.closeStatus;
  else if (value.closeStatus !== undefined && value.closeStatus !== null) stampWarn('closeStatus-invalid');
  if (typeof value.codRemittedOn === 'string' && isValidCalendarDate(value.codRemittedOn)) record.codRemittedOn = value.codRemittedOn;
  else if (value.codRemittedOn !== undefined && value.codRemittedOn !== null) stampWarn('codRemittedOn-invalid');
  if (typeof value.codAdjustmentNote === 'string') record.codAdjustmentNote = value.codAdjustmentNote.slice(0, 500);
  else if (value.codAdjustmentNote !== undefined && value.codAdjustmentNote !== null) stampWarn('codAdjustmentNote-invalid');
    const closedAt = normalizeIso(value.closedAt);
  if (closedAt) record.closedAt = closedAt;
  else if (value.closedAt !== undefined && value.closedAt !== null && str(value.closedAt, 40) !== '') stampWarn('closedAt-invalid');

    const weather = value.weatherCondition;
  if (weather === 'clear' || weather === 'rain' || weather === 'fog' || weather === 'sand') record.weatherCondition = weather;
  else if (weather !== undefined && weather !== null) stampWarn('weatherCondition-invalid');

  return record;
}

function sanitizeDailyMap(value: Record<string, unknown>, warn: (msg: string) => void): Record<string, DailyRecord> {
  const map: Record<string, DailyRecord> = {};
  for (const [date, raw] of Object.entries(value)) {
    const record = sanitizeDailyRecord(date, raw, warn);
    if (record) {
      // Two distinct source keys resolving to the same record.date collide —
      // LAST occurrence wins deterministically, and the file is marked lossy.
      if (map[record.date] !== undefined && record.date !== date) warn(`duplicate-date:${record.date}`);
      map[record.date] = record;
    } else warn(`day:${date}`);
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
    if (!isRecord(raw)) {
      warn(`scenario:index-${index}`);
      continue;
    }
    // Structure BEFORE sanitize, same law as the top-level model input.
    if (!isFinancialInputShape(raw.input)) {
      warn(`scenario:index-${index}:input-shape`);
      continue;
    }
    const savedAt = normalizeIso(raw.savedAt);
    if (!savedAt && raw.savedAt !== undefined && raw.savedAt !== null && str(raw.savedAt, 40) !== '') {
      warn(`scenario:index-${index}:savedAt-invalid`);
    }
    out.push({
      id: str(raw.id, 60) || `scn-index-${index}`,
      name: str(raw.name, 60) || 'Scenario',
      // Immutable creation stamp — see conflict-policy note in the header.
      savedAt: savedAt ?? '',
      input: pruneUndefined(sanitizeFinancialInput(raw.input as unknown as FinancialInput)),
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
    if (shipments === null || shipments < 1 || !isValidCalendarDate(createdAt)) {
      warn(`recovery:index-${index}:shipments-or-date`);
      continue;
    }
    if (status !== 'pending' && status !== 'recovered' && status !== 'written_off') {
      warn(`recovery:index-${index}:status`);
      continue;
    }
    const entry: RecoveryEntry = {
      id: str(raw.id, 60) || `rec-index-${index}-${createdAt}`,
      createdAt,
      shipments,
      owner: str(raw.owner, 120),
      status,
    };
    if (typeof raw.stopId === 'string') entry.stopId = str(raw.stopId, 80);
    else if (raw.stopId !== undefined && raw.stopId !== null) warn(`recovery:${entry.id}:stopId-type`);
    if (typeof raw.reasonKey === 'string') entry.reasonKey = str(raw.reasonKey, 40) as RecoveryEntry['reasonKey'];
    else if (raw.reasonKey !== undefined && raw.reasonKey !== null) warn(`recovery:${entry.id}:reasonKey-type`);
    if (typeof raw.customer === 'string') entry.customer = raw.customer.slice(0, 120);
    else if (raw.customer !== undefined && raw.customer !== null) warn(`recovery:${entry.id}:customer-type`);
    if (typeof raw.note === 'string') entry.note = raw.note.slice(0, 1000);
    else if (raw.note !== undefined && raw.note !== null) warn(`recovery:${entry.id}:note-type`);
    if (typeof raw.owner !== 'string') warn(`recovery:${entry.id}:owner-type`); // '' stays valid; wrong TYPE is lossy
    const resolvedAt = normalizeIso(raw.resolvedAt);
    if (resolvedAt) entry.resolvedAt = resolvedAt;
    else if (raw.resolvedAt !== undefined && raw.resolvedAt !== null && str(raw.resolvedAt, 40) !== '') warn(`recovery:${entry.id}:resolvedAt-invalid`);
    const updatedAt = normalizeIso(raw.updatedAt);
    if (updatedAt) entry.updatedAt = updatedAt;
    else if (raw.updatedAt !== undefined && raw.updatedAt !== null && str(raw.updatedAt, 40) !== '') warn(`recovery:${entry.id}:updatedAt-invalid`);
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
    // ids are whole numbers >= 0 (fractional/negative ids are corrupt)
    if (id === null || !Number.isInteger(id) || id < 0 || text === '') {
      warn(`action:index-${index}:id-or-text`);
      continue;
    }
    if (typeof raw.done !== 'boolean' && raw.done !== undefined && raw.done !== null) warn(`action:${id}:done-type`);
    if (raw.owner !== undefined && raw.owner !== null && typeof raw.owner !== 'string') warn(`action:${id}:owner-type`);
    const action: FollowUpAction = { id, text, owner: str(raw.owner, 80), done: raw.done === true };
    const updatedAt = normalizeIso(raw.updatedAt);
    if (updatedAt) action.updatedAt = updatedAt;
    else if (raw.updatedAt !== undefined && raw.updatedAt !== null && str(raw.updatedAt, 40) !== '') warn(`action:${id}:updatedAt-invalid`);
    out.push(action);
  }
  return out;
}

/** Strict per-row stop sanitization — invalid rows warn and are dropped. */
function sanitizeStops(value: unknown[], warn: (msg: string) => void): StopRecord[] {
  const out: StopRecord[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index];
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      warn(`stop:index-${index}`);
      continue;
    }
    // Field-level validation reusing the domain module (single truth).
    const errors: StopFieldError[] = [];
    const candidate = raw as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || (candidate.id as string).trim() === '') {
      errors.push({ field: 'id', code: 'required-missing' });
    }
    // Delegate remaining rules to validateStopRecord via a dry-run:
    const probe = validateStopRecordForBackup(candidate);
    errors.push(...probe);
    if (errors.length > 0) {
      warn(`stop:index-${index}:${errors[0].field}:${errors[0].code}`);
      continue;
    }
    out.push(normalizeStopRecordForBackup(candidate));
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

/** Build a v3 backup file from live state (including language pref). */
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
    const dailyRecordsV1 = sanitizeDailyMap(parsed.dailyRecords, warn);
    const daysDroppedV1 = Object.keys(parsed.dailyRecords).length - Object.keys(dailyRecordsV1).length;
    const rawScenariosV1 = Array.isArray(parsed.scenarios) ? sanitizeScenarios(parsed.scenarios, warn) : [];
    // Deduplicate BEFORE computing contentLoss — duplicate v1 ids are real
    // scope corruption and must warn + flip contentLoss (contract G1).
    const dedupedScenariosV1 = dedupeById(rawScenariosV1, warn);
    // measured against the ORIGINAL input length so both corrupt rows and
    // duplicate-id collapses count as scope content loss
    const scenariosInputCountV1 = Array.isArray(parsed.scenarios) ? parsed.scenarios.length : 0;
    const scenariosDroppedV1 = scenariosInputCountV1 - dedupedScenariosV1.length;
    const duplicateWarnings = warnings.filter(w => w.startsWith('duplicate-id')).length;
    const contentLoss = daysDroppedV1 > 0 || scenariosDroppedV1 > 0 || duplicateWarnings > 0 || warnings.some(w => !w.startsWith('legacy-v1') && !w.startsWith('duplicate-id'));
    return {
      ok: true,
      migratedFrom: 1,
      warnings: [...warnings, 'legacy-v1:no-recovery-or-actions-stored'],
      dropped: { days: daysDroppedV1, scenarios: scenariosDroppedV1, recoveryEntries: 0, followUpActions: 0, stops: 0 },
      lossless: false, // full-fidelity Replace is impossible for v1 by definition
      legacyScopeMissing: true,
      contentLoss,
      file: {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: normalizeIso(parsed.exportedAt) ?? '',
        data: {
          financialInput: input,
          dailyRecords: dailyRecordsV1,
          scenarios: dedupedScenariosV1.map(scn => ({ ...scn })),
          recoveryEntries: [],
          followUpActions: [],
          stops: [],
        },
      },
    };
  }

  // ── v2 legacy migration (full collections EXCEPT stops) ──
  // A v2 file never contained stops; adopting it must NEVER erase current
  // stop records. Parsed with the same strictness; stops = [] and
  // legacyScopeMissing=true ⇒ UI keeps destructive Replace disabled and
  // merge/scoped paths preserve existing stops.
  if (parsed.version === 2 && parsed.format === BACKUP_FORMAT) {
    const v2Result = parseV3ShapedData(parsed, warn, warnings, { requireStops: false });
    if (!v2Result.ok) return { ok: false, error: v2Result.error };
    return {
      ok: true,
      migratedFrom: 2,
      warnings: [...warnings, 'legacy-v2:no-stops-stored'],
      dropped: { ...v2Result.dropped, stops: 0 },
      lossless: false, // missing-scope formats can never Replace losslessly
      legacyScopeMissing: true,
      contentLoss: v2Result.contentLoss,
      file: {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: normalizeIso(parsed.exportedAt) ?? '',
        data: { ...v2Result.data, stops: [] },
      },
    };
  }

  // ── v3 strict ──
  if (parsed.format !== BACKUP_FORMAT || parsed.version !== BACKUP_VERSION) {
    return { ok: false, error: 'unsupported-format' };
  }
  if (!isRecord(parsed.data)) return { ok: false, error: 'data-container-invalid' };

  const shaped = parseV3ShapedData(parsed, warn, warnings);
  if (!shaped.ok) return { ok: false, error: shaped.error };

  return {
    ok: true,
    warnings,
    dropped: shaped.dropped,
    // ANY warning means the file did not survive byte-perfect ⇒ lossy.
    lossless: warnings.length === 0,
    contentLoss: warnings.length > 0,
    file: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: normalizeIso(parsed.exportedAt) ?? '',
      data: { ...shaped.data, ...(shaped.language ? { language: shaped.language } : {}) },
    },
  };
}

/**
 * Shared strict parser for v3 and the v2-migration branch. Container-type
 * enforcement: a missing/malformed collection rejects the whole file —
 * malformed collections NEVER become silent empty arrays. For v3, a MISSING
 * stops key is malformed; `stops: []` is a valid explicit empty collection.
 */
function parseV3ShapedData(
  parsed: Record<string, unknown>,
  warn: (msg: string) => void,
  warnings: string[],
  /** v2 legacy files legitimately lack the stops collection. */
  options: { requireStops: boolean } = { requireStops: true },
): { ok: true; data: Omit<BackupData, 'language'> & { language?: string }; dropped: { days: number; scenarios: number; recoveryEntries: number; followUpActions: number; stops: number }; contentLoss: boolean; language?: string }
  | { ok: false; error: string } {
  if (!isRecord(parsed.data)) return { ok: false, error: 'data-container-invalid' };
  const data = parsed.data as Record<string, unknown>;
  if (!isRecord(data.financialInput)) return { ok: false, error: 'financial-input-container' };
  if (!isRecord(data.dailyRecords)) return { ok: false, error: 'daily-records-container' };
  if (!Array.isArray(data.scenarios)) return { ok: false, error: 'scenarios-container' };
  if (!Array.isArray(data.recoveryEntries)) return { ok: false, error: 'recovery-entries-container' };
  if (!Array.isArray(data.followUpActions)) return { ok: false, error: 'follow-up-actions-container' };
  const hasStops = Array.isArray(data.stops);
  if (!hasStops && options.requireStops) return { ok: false, error: 'stops-container' };
  const rawStopsInput = hasStops ? (data.stops as unknown[]) : [];

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
  const rawStops = sanitizeStops(rawStopsInput, warn);
  const stopsDropped = rawStopsInput.length - rawStops.length;

  const languageRaw = data.language;
  const language = languageRaw === 'en' || languageRaw === 'ar' ? languageRaw : undefined;

  const dropped = { days: daysDropped, scenarios: scenariosDropped, recoveryEntries: recoveryDropped, followUpActions: actionsDropped, stops: stopsDropped };

  const scenarios = dedupeById(rawScenarios, warn);
  const recoveryEntries = dedupeById(rawRecovery, warn);
  const followUpActions = dedupeById(rawActions.map(a => ({ ...a, id: String(a.id) })), warn)
    .map(({ id, ...rest }) => ({ ...rest, id: Number(id) }))
    .sort((a, b) => a.id - b.id);
  const stops = dedupeById(rawStops, warn);

  return {
    ok: true,
    dropped,
    contentLoss: warnings.length > 0,
    language,
    data: {
      financialInput: pruneUndefined(sanitizeFinancialInput(data.financialInput)),
      dailyRecords,
      scenarios,
      recoveryEntries,
      followUpActions,
      stops,
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

  const stops = mergeById(
    current.stops ?? [],
    file.data.stops ?? [],
    stop => normalizeIso(stop.updatedAt) || normalizeIso(stop.createdAt),
    (a, b) => JSON.stringify(a) !== JSON.stringify(b),
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
      stops: stops.merged as StopRecord[],
    },
    stats: sum(days.stats, scenarios.stats, recovery.stats, actions.stats, stops.stats, {
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
    // Legacy formats carry stops: [] — the UI's lossless gate prevents them
    // from ever reaching this path with current stops present.
    stops: file.data.stops ?? [],
  });
}

export interface PersistResult {
  persistedOk: boolean;
  failedKeys: string[];
  /** True unless the post-failure rollback also wrote back cleanly. */
  rollbackOk: boolean;
  /** Keys whose rollback itself failed (critical — data may be mixed). */
  rollbackFailedKeys: string[];
}

type WritableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): WritableStorage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

/**
 * Best-effort TRANSACTIONAL write (review contract E-4):
 *   1. snapshot the RAW current value of every destination key;
 *   2. attempt ALL writes (language stored RAW 'en'/'ar', matching
 *      ClientLayout/i18n.ts — never JSON-stringified for this key);
 *   3. any failure ⇒ roll EVERY destination key back to its snapshot
 *      (absent-before ⇒ removed again);
 *   4. report exactly what happened; callers must not update React state
 *      or announce success unless result.persistedOk.
 */
export function commitBundle(
  bundle: Partial<StateBundle>,
  language?: string,
  options: { storage?: WritableStorage; keys?: ReadonlyArray<keyof typeof STORAGE_KEYS> } = {},
): PersistResult {
  const storage = options.storage ?? defaultStorage();
  if (!storage) return { persistedOk: false, failedKeys: [], rollbackOk: true, rollbackFailedKeys: [] };

  const allWrites: Array<[string, string | null]> = []; // null ⇒ key not wanted
  const wants = options.keys ?? (Object.keys(STORAGE_KEYS) as Array<keyof typeof STORAGE_KEYS>);
  for (const slot of wants) {
    const key = STORAGE_KEYS[slot];
    if (slot === 'language') {
      allWrites.push([key, language === 'en' || language === 'ar' ? language : null]);
      continue;
    }
    const value = (bundle as Record<string, unknown>)[slot];
    if (value !== undefined) allWrites.push([key, JSON.stringify(value)]);
  }
  const present = allWrites.filter(([, v]) => v !== null) as Array<[string, string]>;

  // 1. snapshot raw values of every destination we will touch.
  // A failing read is treated like a failed write: abort BEFORE touching
  // storage so neither disk nor React state can observe a half-restore.
  const snapshot = new Map<string, string | null>();
  try {
    for (const [key] of present) snapshot.set(key, storage.getItem(key));
  } catch (readError) {
    return {
      persistedOk: false,
      failedKeys: [readError instanceof Error && 'key' in readError ? String((readError as { key: unknown }).key) : 'snapshot-read'],
      rollbackOk: true, // nothing was written, so nothing needs rolling back
      rollbackFailedKeys: [],
    };
  }

  // 2. attempt every write, collecting failures
  const failedKeys: string[] = [];
  for (const [key, value] of present) {
    try {
      storage.setItem(key, value);
    } catch {
      failedKeys.push(key);
    }
  }

  let rollbackOk = true;
  const rollbackFailedKeys: string[] = [];
  if (failedKeys.length > 0) {
    // 3. roll EVERY touched key back to its previous raw value
    for (const [key] of present) {
      try {
        const previous = snapshot.get(key);
        if (previous === null || previous === undefined) storage.removeItem(key);
        else storage.setItem(key, previous);
      } catch {
        rollbackOk = false;
        rollbackFailedKeys.push(key);
      }
    }
  }

  return {
    persistedOk: failedKeys.length === 0,
    failedKeys,
    rollbackOk,
    rollbackFailedKeys,
  };
}

/** Back-compat wrapper: fire-and-forget persistence with failure list. */
export function persistBundle(bundle: StateBundle, language?: string, storage?: WritableStorage): PersistResult {
  return commitBundle(bundle, language, { storage });
}

/**
 * Scoped adoption of a LEGACY v1 file (review contract E-2): take its
 * model input, days and scenarios; PRESERVE current recovery entries,
 * follow-up actions and language — collections absent from v1 are never
 * replaced by it. Persistence touches only the three adopted keys.
 */
export function applyLegacyScopedRestore(current: StateBundle, file: BackupFileV2): { next: StateBundle; stats: MergeStats } {
  const next: StateBundle = {
    financialInput: structuredClone(file.data.financialInput),
    dailyRecords: structuredClone(file.data.dailyRecords),
    scenarios: structuredClone(file.data.scenarios),
    recoveryEntries: current.recoveryEntries,
    followUpActions: current.followUpActions,
    stops: current.stops ?? [], // collections absent from legacy formats are never replaced by them
  };
  const incomingDays = Object.keys(next.dailyRecords).length;
  return {
    next,
    stats: { added: incomingDays, updated: 0, conflicts: 0, identical: 0 },
  };
}
