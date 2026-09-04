// VEGA — Stop/Shipment domain (Release R2).
// Pure, React-free. Single source of truth for stop validation, lifecycle,
// duplicate identity and stored-collection reading. Persistence key lives
// in backup.ts STORAGE_KEYS ('vega-stops-v1'); backup envelope is v3.
//
// Documented domain rules:
//   * operationDate must be a REAL calendar date (2026-02-30 rejected);
//   * failureReasonKey is REQUIRED when status ∈ {failed, returned} —
//     returned counts as an exception needing a reason, matching how the
//     provider reconciliation treats راجع;
//   * customerName is a snapshot: stops stay understandable even if the
//     provider catalog renames/deletes rows later;
//   * createdAt never changes after creation; updatedAt changes on every
//     material edit (numeric ISO comparison drives merge conflicts);
//   * privacy minimization: phone/addressNotes optional, length-capped,
//     never required; no identity numbers anywhere in the model.
//   * shortAddress is OPTIONAL format-only input (SPL AAAA9999 pattern via
//     compliance.ts); lat/lng are OPTIONAL manual coordinates feeding the
//     offline R7 suggestion only — never auto-geocoded, never required.

import type { FailureReasonKey } from '@/lib/operationsReporting';
import { FAILURE_REASON_KEYS } from '@/lib/operationsReporting';
import { checkShortAddressFormat } from '@/lib/compliance';

export const STOP_STATUSES = ['planned', 'delivered', 'failed', 'returned', 'pending'] as const;
export type StopStatus = (typeof STOP_STATUSES)[number];

const SERVICE_WINDOWS = ['morning', 'afternoon', 'evening'] as const;
export type ServiceWindow = (typeof SERVICE_WINDOWS)[number];

export interface StopRecord {
  id: string;
  operationDate: string;
  customerId?: string;
  customerName: string;
  reference?: string;
  stopLabel: string;
  addressNotes?: string;
  /** SPL Short Address (AAAA9999) — FORMAT-ONLY, never a verified address. */
  shortAddress?: string;
  phone?: string;
  codAmountSar?: number;
  serviceWindow?: ServiceWindow;
  /** Optional manual coordinates — offline suggestion input only (R7). */
  lat?: number;
  lng?: number;
  driverName?: string;
  carNumber?: string;
  plateNumber?: string;
  sequence?: number;
  status: StopStatus;
  failureReasonKey?: FailureReasonKey;
  podStatus?: 'complete' | 'partial' | 'none';
  exceptionOwner?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StopFieldError {
  field: string;
  code:
    | 'required-missing' | 'invalid-date' | 'impossible-date' | 'too-long'
    | 'invalid-number' | 'negative' | 'invalid-enum' | 'failure-reason-required'
    | 'not-a-string' | 'invalid-timestamp'
    | 'invalid-short-address' | 'invalid-coordinate';
}

export interface StopValidation {
  ok: boolean;
  errors: StopFieldError[];
}

const LIMITS = {
  id: 80, customerName: 120, reference: 60, stopLabel: 120, addressNotes: 300,
  shortAddress: 12, phone: 30, driverName: 120, carNumber: 40, plateNumber: 40, exceptionOwner: 120,
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Real calendar date check ('2026-02-30' fails). */
export function isValidStopDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Collapse whitespace runs without harming Arabic text or diacritics. */
function cleanText(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim().slice(0, limit) : '';
}

/**
 * Canonical Short Address form: whitespace stripped, letters uppercased.
 * Accepts "ABCD1234" and "ABCD 1234" alike; the FORMAT check itself lives
 * in compliance.ts (single source of truth for the SPL pattern).
 */
export function normalizeShortAddress(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/gu, '').toUpperCase().slice(0, LIMITS.shortAddress) : '';
}

/** Both coordinates present, finite, and inside world ranges. */
export function isValidCoordinatePair(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/** Stable id: crypto UUID when available, deterministic-safe fallback. */
let fallbackCounter = 0;
export function makeStopId(nowMs: number = Date.now()): string {
  const cryptoRef = typeof crypto === 'undefined' ? undefined : crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    try { return cryptoRef.randomUUID(); } catch { /* fall through */ }
  }
  fallbackCounter += 1;
  return `stop-${Math.floor(nowMs / 1000).toString(36)}-${fallbackCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Validate ANY unknown value as a StopRecord with field-level errors. */
export function validateStopRecord(value: unknown): StopValidation {
  const errors: StopFieldError[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, errors: [{ field: 'record', code: 'required-missing' }] };
  }
  const raw = value as Record<string, unknown>;

  const requireText = (field: keyof typeof LIMITS) => {
    if (typeof raw[field] !== 'string' || cleanText(raw[field], LIMITS[field]) === '') {
      errors.push({ field, code: typeof raw[field] === 'string' ? 'required-missing' : 'not-a-string' });
      return false;
    }
    if (typeof raw[field] === 'string' && (raw[field] as string).length > LIMITS[field]) {
      errors.push({ field, code: 'too-long' });
      return false;
    }
    return true;
  };

  requireText('customerName');
  requireText('stopLabel');

  const opDate = cleanText(raw.operationDate, 10);
  if (opDate === '') errors.push({ field: 'operationDate', code: 'invalid-date' });
  else if (!DATE_RE.test(opDate)) errors.push({ field: 'operationDate', code: 'invalid-date' });
  else if (!isValidStopDate(opDate)) errors.push({ field: 'operationDate', code: 'impossible-date' });

  // optional text fields: type + length only when present
  const optionalText: Array<keyof typeof LIMITS> = ['reference', 'addressNotes', 'phone', 'driverName', 'carNumber', 'plateNumber', 'exceptionOwner'];
  for (const field of optionalText) {
    const v = raw[field];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string') { errors.push({ field, code: 'not-a-string' }); continue; }
    if (cleanText(v, Number.MAX_SAFE_INTEGER).length > LIMITS[field]) errors.push({ field, code: 'too-long' });
  }

  if (raw.id !== undefined) {
    if (typeof raw.id !== 'string' || raw.id.length > LIMITS.id || raw.id.trim() === '') {
      errors.push({ field: 'id', code: 'too-long' });
    }
  }

  const cod = raw.codAmountSar;
  if (cod !== undefined && cod !== null) {
    if (typeof cod !== 'number' || !Number.isFinite(cod)) errors.push({ field: 'codAmountSar', code: 'invalid-number' });
    else if (cod < 0) errors.push({ field: 'codAmountSar', code: 'negative' });
  }

  if (raw.sequence !== undefined && raw.sequence !== null) {
    if (typeof raw.sequence !== 'number' || !Number.isInteger(raw.sequence) || raw.sequence < 0) {
      errors.push({ field: 'sequence', code: 'invalid-number' });
    }
  }

  // Short Address: optional; when present it must match the SPL format
  // (format-only — never a verified address). Blank ⇒ absent.
  const saRaw = raw.shortAddress;
  if (saRaw !== undefined && saRaw !== null && !(typeof saRaw === 'string' && saRaw.trim() === '')) {
    if (typeof saRaw !== 'string') errors.push({ field: 'shortAddress', code: 'not-a-string' });
    else if (saRaw.length > LIMITS.shortAddress) errors.push({ field: 'shortAddress', code: 'too-long' });
    else if (!checkShortAddressFormat(normalizeShortAddress(saRaw)).ok) {
      errors.push({ field: 'shortAddress', code: 'invalid-short-address' });
    }
  }

  // Coordinates: optional individually, each range-checked when present.
  for (const field of ['lat', 'lng'] as const) {
    const v = raw[field];
    if (v === undefined || v === null) continue;
    const inRange = field === 'lat'
      ? (typeof v === 'number' && v >= -90 && v <= 90)
      : (typeof v === 'number' && v >= -180 && v <= 180);
    if (typeof v !== 'number' || !Number.isFinite(v) || !inRange) {
      errors.push({ field, code: 'invalid-coordinate' });
    }
  }

  const status = raw.status;
  if (typeof status !== 'string' || !(STOP_STATUSES as readonly string[]).includes(status)) {
    errors.push({ field: 'status', code: 'invalid-enum' });
  } else if ((status === 'failed' || status === 'returned') && typeof raw.failureReasonKey !== 'string') {
    errors.push({ field: 'failureReasonKey', code: 'failure-reason-required' });
  }

  if (raw.failureReasonKey !== undefined && raw.failureReasonKey !== null) {
    if (typeof raw.failureReasonKey !== 'string' || !(FAILURE_REASON_KEYS as readonly string[]).includes(raw.failureReasonKey)) {
      errors.push({ field: 'failureReasonKey', code: 'invalid-enum' });
    }
  }

  if (raw.serviceWindow !== undefined && raw.serviceWindow !== null) {
    if (typeof raw.serviceWindow !== 'string' || !(SERVICE_WINDOWS as readonly string[]).includes(raw.serviceWindow)) {
      errors.push({ field: 'serviceWindow', code: 'invalid-enum' });
    }
  }

  if (raw.podStatus !== undefined && raw.podStatus !== null) {
    if (raw.podStatus !== 'complete' && raw.podStatus !== 'partial' && raw.podStatus !== 'none') {
      errors.push({ field: 'podStatus', code: 'invalid-enum' });
    }
  }

  for (const stamp of ['createdAt', 'updatedAt'] as const) {
    const v = raw[stamp];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) {
      errors.push({ field: stamp, code: 'invalid-timestamp' });
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Normalize a validated shape into the canonical persisted form. */
export function normalizeStopRecord(value: Record<string, unknown>): StopRecord {
  const record: StopRecord = {
    id: cleanText(value.id, LIMITS.id) || makeStopId(),
    operationDate: cleanText(value.operationDate, 10),
    customerName: cleanText(value.customerName, LIMITS.customerName),
    stopLabel: cleanText(value.stopLabel, LIMITS.stopLabel),
    status: value.status as StopStatus,
    createdAt: cleanText(value.createdAt, 40) || new Date().toISOString(),
    updatedAt: cleanText(value.updatedAt, 40) || new Date().toISOString(),
  };
  const optionalFields = ['customerId', 'reference', 'addressNotes', 'phone', 'driverName', 'carNumber', 'plateNumber', 'exceptionOwner'] as const;
  for (const field of optionalFields) {
    const limit = (LIMITS as Record<string, number>)[field] ?? 120;
    const cleaned = cleanText(value[field], limit);
    if (cleaned !== '') (record as unknown as Record<string, unknown>)[field] = cleaned;
  }
  if (typeof value.codAmountSar === 'number' && Number.isFinite(value.codAmountSar) && value.codAmountSar >= 0) {
    record.codAmountSar = value.codAmountSar;
  }
  const shortNorm = normalizeShortAddress(value.shortAddress);
  if (shortNorm !== '' && checkShortAddressFormat(shortNorm).ok) record.shortAddress = shortNorm;
  if (typeof value.lat === 'number' && Number.isFinite(value.lat) && value.lat >= -90 && value.lat <= 90) {
    record.lat = Math.round(value.lat * 1e6) / 1e6;
  }
  if (typeof value.lng === 'number' && Number.isFinite(value.lng) && value.lng >= -180 && value.lng <= 180) {
    record.lng = Math.round(value.lng * 1e6) / 1e6;
  }
  if (typeof value.sequence === 'number' && Number.isInteger(value.sequence) && value.sequence >= 0) {
    record.sequence = value.sequence;
  }
  if (typeof value.serviceWindow === 'string' && (SERVICE_WINDOWS as readonly string[]).includes(value.serviceWindow)) {
    record.serviceWindow = value.serviceWindow as ServiceWindow;
  }
  if (value.podStatus === 'complete' || value.podStatus === 'partial' || value.podStatus === 'none') {
    record.podStatus = value.podStatus;
  }
  // Failure-reason metadata: REQUIRED for failed/returned; on pending it is
  // the documented failed-ATTEMPT metadata (R4 mapping) and is preserved;
  // delivered stops must not retain stale reasons (applyStopOutcome clears).
  if (
    typeof value.failureReasonKey === 'string'
    && (FAILURE_REASON_KEYS as readonly string[]).includes(value.failureReasonKey)
    && record.status !== 'delivered'
  ) {
    record.failureReasonKey = value.failureReasonKey as FailureReasonKey;
  }
  return record;
}

/** Create a NEW stop (id + both stamps generated here). */
export function createStopRecord(
  input: Omit<Partial<StopRecord>, 'id' | 'createdAt' | 'updatedAt'> & { operationDate: string; customerName: string; stopLabel: string; status?: StopStatus },
  nowIso: string,
): StopRecord {
  const draft: Record<string, unknown> = {
    ...input,
    status: input.status ?? 'planned',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const validation = validateStopRecord(draft);
  if (!validation.ok) throw new Error(`invalid-stop:${validation.errors.map(e => `${e.field}:${e.code}`).join(',')}`);
  return normalizeStopRecord(draft);
}

/** Material edit: createdAt immutable, updatedAt refreshed by caller clock. */
export function updateStopRecord(existing: StopRecord, patch: Partial<StopRecord>, nowIso: string): StopRecord {
  const merged: Record<string, unknown> = { ...existing, ...patch, createdAt: existing.createdAt, updatedAt: nowIso };
  const validation = validateStopRecord(merged);
  if (!validation.ok) throw new Error(`invalid-stop:${validation.errors.map(e => `${e.field}:${e.code}`).join(',')}`);
  return normalizeStopRecord(merged);
}

/** Deterministic day ordering: explicit sequence first, then stable stamps. */
export function sortStopsForDate(stops: StopRecord[]): StopRecord[] {
  return [...stops].sort((a, b) =>
    (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER)
    || Date.parse(a.createdAt || '') - Date.parse(b.createdAt || '')
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// ── Duplicate identity hierarchy ──────────────────────────────
// 1. same normalized NON-EMPTY reference on the same operation date;
// 2. otherwise composite fingerprint: date + customer snapshot + label +
//    normalized phone/addressNotes.
// Never name-or-phone alone.

export type DuplicateKind = 'exact' | 'conflict' | 'probable';

export interface DuplicateFinding {
  incomingIndex: number;
  /** id of the conflicting EXISTING stop, when applicable. */
  existingId?: string;
  /** index of the other INCOMING row, when applicable. */
  incomingAgainst?: number;
  kind: DuplicateKind;
  basis: 'reference' | 'fingerprint';
}

function refKey(reference?: string): string | null {
  const r = cleanText(reference, LIMITS.reference);
  return r === '' ? null : r.toLowerCase();
}

function fingerprint(stop: Pick<StopRecord, 'operationDate' | 'customerName' | 'stopLabel' | 'phone' | 'addressNotes'>): string {
  return [
    stop.operationDate,
    cleanText(stop.customerName, 200).toLowerCase(),
    cleanText(stop.stopLabel, 200).toLowerCase(),
    cleanText(stop.phone ?? '', 40).replace(/[\s\-()]/g, ''),
    cleanText(stop.addressNotes ?? '', 200).toLowerCase(),
  ].join('|');
}

function materiallyEqual(a: StopRecord, b: StopRecord): boolean {
  return fingerprint(a) === fingerprint(b)
    && (a.codAmountSar ?? null) === (b.codAmountSar ?? null)
    && (a.reference ? a.reference.toLowerCase() : '') === (b.reference ? b.reference.toLowerCase() : '');
}

/**
 * Shared-field equality for REFERENCE-basis comparisons: an optional field
 * ABSENT from one side (e.g. an import row with no COD column) does not
 * contradict the other side — only genuinely differing PRESENT values do.
 */
function referenceCompatible(a: StopRecord, b: StopRecord): boolean {
  const fields = ['customerName', 'stopLabel', 'phone', 'addressNotes', 'shortAddress'] as const;
  for (const field of fields) {
    const av = cleanText(a[field] ?? '', 300);
    const bv = cleanText(b[field] ?? '', 300);
    if (av !== '' && bv !== '' && av.toLowerCase() !== bv.toLowerCase()) return false;
  }
  if (a.codAmountSar !== undefined && b.codAmountSar !== undefined && a.codAmountSar !== b.codAmountSar) return false;
  if ((a.serviceWindow ?? null) !== (b.serviceWindow ?? null)) {
    if (a.serviceWindow !== undefined && b.serviceWindow !== undefined) return false;
  }
  return true;
}

/**
 * Deterministic duplicate classification across an incoming batch against
 * existing stops AND within the batch itself. Order-independent: pair
 * comparisons run i<j so swapping row order cannot change decisions.
 */
export function identifyStopDuplicates(
  incoming: StopRecord[],
  existing: StopRecord[],
): DuplicateFinding[] {
  const findings: DuplicateFinding[] = [];
  const existingByRef = new Map<string, StopRecord>();
  for (const stop of existing) {
    const key = refKey(stop.reference);
    if (key && stop.status === 'planned') existingByRef.set(`${stop.operationDate}|${key}`, stop);
  }
  const existingByFp = new Map<string, StopRecord>();
  for (const stop of existing) {
    if (stop.status === 'planned') existingByFp.set(fingerprint(stop), stop);
  }

  for (let i = 0; i < incoming.length; i += 1) {
    const candidate = incoming[i];
    const ref = refKey(candidate.reference);
    let found = false;

    if (ref) {
      const match = existingByRef.get(`${candidate.operationDate}|${ref}`);
      if (match) {
        findings.push({
          incomingIndex: i,
          existingId: match.id,
          kind: referenceCompatible(match, candidate)
            ? 'exact'
            : 'conflict',
          basis: 'reference',
        });
        found = true;
      }
      // intra-batch same-reference check (pair-wise, j<i already reported)
      for (let j = 0; j < i; j += 1) {
        if (refKey(incoming[j].reference) === ref && incoming[j].operationDate === candidate.operationDate) {
          findings.push({
            incomingIndex: i, incomingAgainst: j,
            kind: referenceCompatible(incoming[j], candidate) ? 'exact' : 'conflict',
            basis: 'reference',
          });
          found = true;
          break;
        }
      }
    }

    if (!found) {
      const fpMatch = existingByFp.get(fingerprint(candidate));
      if (fpMatch) {
        findings.push({ incomingIndex: i, existingId: fpMatch.id, kind: materiallyEqual(fpMatch, candidate) ? 'exact' : 'probable', basis: 'fingerprint' });
        found = true;
      } else {
        for (let j = 0; j < i; j += 1) {
          if (incoming[j].operationDate === candidate.operationDate && fingerprint(incoming[j]) === fingerprint(candidate)) {
            findings.push({
              incomingIndex: i, incomingAgainst: j,
              kind: materiallyEqual(incoming[j], candidate) ? 'exact' : 'probable',
              basis: 'fingerprint',
            });
            break;
          }
        }
      }
    }
  }
  return findings;
}

/** Read + validate a stored collection; invalid rows are dropped with reasons. */
export function readStoredStops(raw: string | null | undefined): { stops: StopRecord[]; dropped: number } {
  if (!raw || raw.trim() === '') return { stops: [], dropped: 0 };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { stops: [], dropped: 0 }; }
  if (!Array.isArray(parsed)) return { stops: [], dropped: 0 };
  const stops: StopRecord[] = [];
  let dropped = 0;
  for (const item of parsed) {
    const validation = validateStopRecord(item);
    if (validation.ok) {
      try { stops.push(normalizeStopRecord(item as Record<string, unknown>)); continue; } catch { /* fall through */ }
    }
    dropped += 1;
  }
  return { stops, dropped };
}
