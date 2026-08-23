// VEGA — Evening close & exception loop (Release R4). Pure, clock-injected.
//
// VOCABULARY (authoritative — mirrored in DATA_MODEL.md):
//   Loaded     — shipments declared loaded for the operation date.
//   Delivered  — successfully completed shipments.
//   Returned   — shipped back to origin/provider; requires a reason.
//   Pending    — loaded shipments still unresolved at close time.
//   Failed attempt — metadata over an OUTCOME (pending or returned), never
//   an extra arithmetic bucket: a failed attempt that will be reattempted
//   stays pending; a failed attempt whose goods go back becomes returned.
//   Unexplained difference — loaded − (delivered + returned + pending);
//   positive = loaded unaccounted for; negative = outcomes exceed declared.
//
// INVARIANT (reconciled close): loaded = delivered + returned + pending.
// Nothing in this module auto-balances — differences surface with sign.
//
// COD: expected derives from DELIVERED stops' codAmountSar unless the
// operator records a reviewed adjustment (note required). outstanding =
// max(0, collected − remitted); uncollected = max(0, expected − collected);
// overRemitted = max(0, remitted − collected) — credit is visible, not hidden.

import type { DailyRecord, FailureReasonKey } from '@/lib/operationsReporting';
import { updateStopRecord, type StopRecord, type StopStatus } from '@/lib/stops';
import type { RecoveryEntry } from '@/lib/recoveryBoard';

// ── Draft KPI predicate (§K) ──────────────────────────────────

/** Draft rows are excluded from definitive KPIs; legacy rows are definitive. */
export function isDefinitiveDailyRecord(record: DailyRecord): boolean {
  return record.closeStatus !== 'draft';
}

// ── Stop outcomes ─────────────────────────────────────────────

const OUTCOME_STATUSES: StopStatus[] = ['delivered', 'returned', 'pending', 'failed'];

/** Apply an evening outcome to one stop. Delivered clears stale reasons;
 *  returned REQUIRES one; failed keeps pending arithmetic + reason metadata. */
export function applyStopOutcome(stop: StopRecord, outcome: 'delivered' | 'returned' | 'pending' | 'failed', reason: FailureReasonKey | undefined, nowIso: string): StopRecord {
  if (outcome === 'failed') {
    if (!reason) throw new Error('invalid-stop:failureReasonKey:failure-reason-required');
    // failed attempt = pending outcome + reason metadata (documented mapping)
    return updateStopRecord(stop, { status: 'pending', failureReasonKey: reason }, nowIso);
  }
  if (outcome === 'returned' && !reason) {
    throw new Error('invalid-stop:failureReasonKey:failure-reason-required');
  }
  return updateStopRecord(stop, {
    status: outcome,
    ...(outcome === 'delivered' ? { failureReasonKey: undefined } : { failureReasonKey: reason }),
  }, nowIso);
}

export interface StopOutcomeSummary {
  delivered: number;
  returned: number;
  pending: number;
  failedAttempts: number; // metadata count (pending or returned with reason)
  missingReason: Array<{ id: string; reference?: string }>;
}

/** Summarize reviewed stop outcomes for a date (§F/G source of truth). */
export function summarizeStopOutcomes(stops: StopRecord[]): StopOutcomeSummary {
  const summary: StopOutcomeSummary = { delivered: 0, returned: 0, pending: 0, failedAttempts: 0, missingReason: [] };
  for (const stop of stops) {
    if (stop.status === 'delivered') { summary.delivered += 1; continue; }
    if (stop.status === 'returned') {
      // Returned counts ONCE — as the returned outcome. Its reason is
      // required metadata, never a second arithmetic bucket.
      summary.returned += 1;
      if (!stop.failureReasonKey) summary.missingReason.push({ id: stop.id, reference: stop.reference });
      continue;
    }
    // pending / planned / persisted legacy 'failed' ⇒ pending arithmetic;
    // 'failed' carries reason metadata by the documented mapping.
    if (stop.status === 'pending' || stop.status === 'planned' || stop.status === 'failed') {
      summary.pending += 1;
      if (stop.status === 'failed' && !stop.failureReasonKey) summary.missingReason.push({ id: stop.id, reference: stop.reference });
      else if (stop.failureReasonKey) summary.failedAttempts += 1;
    }
  }
  return summary;
}

// ── Shipment reconciliation ───────────────────────────────────

export interface ShipmentReconciliation {
  loaded: number;
  delivered: number;
  returned: number;
  pending: number;
  /** loaded − (delivered + returned + pending); sign preserved. */
  difference: number;
  balanced: boolean;
}

export function reconcileShipmentTotals(loaded: number, delivered: number, returned: number, pending: number): ShipmentReconciliation {
  const difference = loaded - (delivered + returned + pending);
  return { loaded, delivered, returned, pending, difference, balanced: difference === 0 };
}

// ── COD close ─────────────────────────────────────────────────

export interface CodClose {
  expectedSar: number;
  expectedSource: 'stop-derived' | 'manual-adjusted';
  collectedSar: number;
  remittedSar: number;
  outstandingSar: number;
  uncollectedSar: number;
  overRemittedSar: number;
}

export function calculateCodClose(input: {
  deliveredStops: StopRecord[];
  collectedSar: number;
  remittedSar: number;
  manualExpectedSar?: number;
  adjustmentNote?: string;
}): CodClose {
  const stopDerived = input.deliveredStops.reduce((sum, stop) => sum + (stop.codAmountSar ?? 0), 0);
  const manual = input.manualExpectedSar !== undefined;
  if (manual && !input.adjustmentNote?.trim()) {
    throw new Error('cod-adjustment-note-required');
  }
  const expectedSar = manual ? (input.manualExpectedSar as number) : stopDerived;
  return {
    expectedSar,
    expectedSource: manual ? 'manual-adjusted' : 'stop-derived',
    collectedSar: input.collectedSar,
    remittedSar: input.remittedSar,
    outstandingSar: Math.max(0, input.collectedSar - input.remittedSar),
    uncollectedSar: Math.max(0, expectedSar - input.collectedSar),
    overRemittedSar: Math.max(0, input.remittedSar - input.collectedSar),
  };
}

// ── Recovery integration (idempotent, stopId-linked) ─────────

/** One pending recovery entry per failed/returned stop that has none yet.
 *  Existing entries (any status) are never duplicated or auto-closed. */
export function buildRecoveryEntriesForStops(
  stops: StopRecord[],
  existing: RecoveryEntry[],
  owner: string,
  nowIso: string,
): RecoveryEntry[] {
  const linked = new Set(existing.map(entry => entry.stopId).filter(Boolean));
  const created: RecoveryEntry[] = [];
  for (const stop of stops) {
    // Exception = any non-delivered stop carrying a failure reason — that
    // covers returned AND the failed-attempt mapping (pending + reason).
    const isException = stop.status !== 'delivered' && Boolean(stop.failureReasonKey);
    if (!isException || linked.has(stop.id) || existing.some(entry => entry.stopId === stop.id)) continue;
    created.push({
      id: `rec-stop-${stop.id}`,
      createdAt: stop.operationDate,
      shipments: 1,
      reasonKey: stop.failureReasonKey,
      customer: stop.customerName,
      owner,
      status: 'pending',
      stopId: stop.id,
      note: undefined,
      updatedAt: nowIso,
    });
  }
  return created;
}

// ── DailyRecord application ───────────────────────────────────

export interface CloseDraftInput {
  loadedShipments: number;
  deliveredShipments: number;
  returnedShipments: number;
  pendingShipments: number;
  codCollectedSar: number;
  codRemittedSar: number;
  codExpectedManualSar?: number;
  codAdjustmentNote?: string;
  /** Day the day's collection was remitted (day-granularity lag data). */
  remittedOn?: string;
}

/** Build the close-shaped DailyRecord patch. Existing unrelated fields are
 *  preserved by the caller spreading; here we only compute close fields. */
export function buildCloseDraft(existing: DailyRecord, stops: StopRecord[], input: CloseDraftInput, nowIso: string): DailyRecord {
  const deliveredStops = stops.filter(stop => stop.status === 'delivered');
  const cod = calculateCodClose({
    deliveredStops,
    collectedSar: input.codCollectedSar,
    remittedSar: input.codRemittedSar,
    manualExpectedSar: input.codExpectedManualSar,
    adjustmentNote: input.codAdjustmentNote,
  });
  const outcomeSummary = summarizeStopOutcomes(stops);
  // failureReasons derived from reviewed stop outcomes; the sum equals
  // failedShipments because both count the same exception set exactly once.
  const failureReasons: Record<string, number> = {};
  for (const stop of stops) {
    if (stop.status !== 'delivered' && stop.failureReasonKey) {
      failureReasons[stop.failureReasonKey] = (failureReasons[stop.failureReasonKey] ?? 0) + 1;
    }
  }
  const exceptionTotal = outcomeSummary.returned + outcomeSummary.failedAttempts;
  return {
    ...existing,
    loadedShipments: input.loadedShipments,
    completedShipments: outcomeSummary.delivered,
    failedShipments: exceptionTotal,
    returnedShipments: outcomeSummary.returned,
    pendingShipments: outcomeSummary.pending,
    codShipments: deliveredStops.filter(stop => stop.codAmountSar !== undefined).length,
    codExpectedSar: cod.expectedSar,
    cashCollectedSar: input.codCollectedSar,
    cashRemittedSar: input.codRemittedSar,
    failureReasons,
    closeStatus: 'draft',
    updatedAt: nowIso,
    ...(input.remittedOn ? { codRemittedOn: input.remittedOn } : {}),
    ...(input.codAdjustmentNote ? { codAdjustmentNote: input.codAdjustmentNote } : {}),
  };
}

export interface CloseValidation {
  ok: boolean;
  blockers: string[]; // stable codes; UI maps to localized copy
}

/** Reconciled confirmation requires: balanced shipments, no missing reasons,
 *  agreement between stop outcomes and entered totals, COD sanity. */
export function validateCloseDraft(record: DailyRecord, stops: StopRecord[]): CloseValidation {
  const blockers: string[] = [];
  const recon = reconcileShipmentTotals(
    record.loadedShipments ?? 0,
    record.completedShipments,
    record.returnedShipments ?? 0,
    record.pendingShipments ?? 0,
  );
  if (!recon.balanced) blockers.push('shipment-mismatch');
  const summary = summarizeStopOutcomes(stops);
  if (summary.missingReason.length > 0) blockers.push('missing-reasons');
  if (summary.delivered !== record.completedShipments
    || summary.returned !== (record.returnedShipments ?? 0)) blockers.push('outcome-totals-disagree');
  // Shipments: finite non-negative INTEGERS. Money: finite non-negative
  // decimals. Stamps: real ISO. Fractions/negatives/exponent junk rejected.
  for (const value of [record.loadedShipments, record.returnedShipments, record.pendingShipments]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || !Number.isInteger(value))) blockers.push('invalid-number');
  }
  for (const value of [record.codExpectedSar, record.cashCollectedSar, record.cashRemittedSar]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) blockers.push('invalid-money');
  }
  if (record.closedAt !== undefined && Number.isNaN(Date.parse(record.closedAt))) blockers.push('invalid-number');
  if (record.date && !/^(\d{4}-\d{2}-\d{2})$/.test(record.date)) blockers.push('invalid-number');
  return { ok: blockers.length === 0, blockers };
}

/** Reconciled application: sets closeStatus + closedAt; recovery entries are
 *  created by the caller via buildRecoveryEntriesForStops BEFORE this. */
export function applyCloseToDailyRecord(draft: DailyRecord, nowIso: string): DailyRecord {
  return { ...draft, closeStatus: 'reconciled', closedAt: nowIso, updatedAt: nowIso };
}
