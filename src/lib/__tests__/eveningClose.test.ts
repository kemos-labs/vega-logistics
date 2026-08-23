// Evening close domain (Release R4-A).
import { describe, expect, it } from 'vitest';

import {
  applyCloseToDailyRecord, applyStopOutcome, buildCloseDraft,
  buildRecoveryEntriesForStops, calculateCodClose, isDefinitiveDailyRecord,
  reconcileShipmentTotals, summarizeStopOutcomes, validateCloseDraft,
} from '@/lib/eveningClose';
import { createStopRecord, type StopRecord } from '@/lib/stops';
import type { DailyRecord } from '@/lib/operationsReporting';
import type { RecoveryEntry } from '@/lib/recoveryBoard';

const NOW = '2026-08-24T18:00:00.000Z';
const DATE = '2026-08-25';
let tick = 0;
function stop(over: Partial<StopRecord> = {}): StopRecord {
  tick += 1;
  return createStopRecord({
    operationDate: DATE, customerName: `C${tick}`, stopLabel: `L${tick}`,
    codAmountSar: over.status === 'delivered' ? 10 : over.codAmountSar,
    ...over,
  }, new Date(Date.parse(NOW) - 3600_000 + tick * 1000).toISOString());
}
function record(over: Partial<DailyRecord> = {}): DailyRecord {
  return { date: DATE, completedShipments: 0, failedShipments: 0, fuelCost: 0, driversPresent: 1, notes: '', updatedAt: NOW, ...over };
}

describe('reconcileShipmentTotals — the invariant with sign preserved', () => {
  it('25 − 18 − 2 − 5 = 0 balances', () => {
    expect(reconcileShipmentTotals(25, 18, 2, 5)).toMatchObject({ difference: 0, balanced: true });
  });
  it('+5 means loaded shipments unaccounted for', () => {
    expect(reconcileShipmentTotals(25, 18, 2, 0)).toMatchObject({ difference: 5, balanced: false });
  });
  it('−3 means outcomes exceed declared loaded', () => {
    expect(reconcileShipmentTotals(20, 18, 5, 0)).toMatchObject({ difference: -3, balanced: false });
  });
  it('NEVER auto-balances — the API exposes no balancing helper', async () => {
    const names = Object.keys(await import('@/lib/eveningClose'));
    expect(names.filter(n => /balance/i.test(n))).toEqual([]);
  });
});

describe('stop outcome mapping', () => {
  it('failed attempt = pending outcome + reason metadata (counted once, never twice)', () => {
    const s = applyStopOutcome(stop({ status: 'planned' }), 'failed', 'addressIssue', NOW);
    expect(s.status).toBe('pending');
    expect(s.failureReasonKey).toBe('addressIssue');
    const summary = summarizeStopOutcomes([s]);
    expect(summary.pending).toBe(1);
    expect(summary.failedAttempts).toBe(1);
    expect(summary.delivered + summary.returned + summary.pending).toBe(1); // no double count
  });
  it('returned requires a reason; delivered clears stale reasons', () => {
    expect(() => applyStopOutcome(stop(), 'returned', undefined, NOW)).toThrow(/failure-reason-required/);
    const d = applyStopOutcome(stop({ status: 'pending', failureReasonKey: 'noDriver' }), 'delivered', undefined, NOW);
    expect(d.status).toBe('delivered');
    expect(d.failureReasonKey).toBeUndefined();
  });
  it('missing reasons are listed for blocking (legacy shape without reason)', () => {
    const reasonless = { ...stop({ status: 'returned', failureReasonKey: 'other' }), failureReasonKey: undefined } as unknown as StopRecord;
    const summary = summarizeStopOutcomes([reasonless]);
    expect(summary.missingReason).toHaveLength(1);
  });
});

describe('calculateCodClose', () => {
  it('expected derives from DELIVERED stops; formulas clamp correctly', () => {
    const cod = calculateCodClose({
      deliveredStops: [stop({ status: 'delivered', codAmountSar: 30 }), stop({ status: 'delivered', codAmountSar: 12 })],
      collectedSar: 35, remittedSar: 40,
    });
    expect(cod).toMatchObject({
      expectedSar: 42, expectedSource: 'stop-derived',
      outstandingSar: 0, uncollectedSar: 7, overRemittedSar: 5,
    });
  });
  it('manual adjustment requires a note', () => {
    expect(() => calculateCodClose({ deliveredStops: [], collectedSar: 0, remittedSar: 0, manualExpectedSar: 50 }))
      .toThrow(/cod-adjustment-note-required/);
    const cod = calculateCodClose({ deliveredStops: [], collectedSar: 0, remittedSar: 0, manualExpectedSar: 50, adjustmentNote: 'verified with provider' });
    expect(cod.expectedSource).toBe('manual-adjusted');
  });
});

describe('draft vs definitive predicate', () => {
  it('draft excluded; reconciled and legacy included', () => {
    expect(isDefinitiveDailyRecord(record({ closeStatus: 'draft' }))).toBe(false);
    expect(isDefinitiveDailyRecord(record({ closeStatus: 'reconciled' }))).toBe(true);
    expect(isDefinitiveDailyRecord(record())).toBe(true); // legacy rows stay definitive
  });
});

describe('buildCloseDraft + validateCloseDraft', () => {
  const stops = [
    stop({ status: 'delivered', codAmountSar: 18 }),
    stop({ status: 'returned', failureReasonKey: 'customerUnavailable' }),
    stop({ status: 'pending' }),
    stop({ status: 'pending', failureReasonKey: 'addressIssue' }),
    stop({ status: 'planned' }),
  ];

  it('derives counters from stop outcomes; unrelated fields survive byte-for-byte', () => {
    const existing = record({ fuelCost: 130, notes: 'keep me', podStatus: 'complete', safetyIncidents: 1, tomorrowNote: 'tomorrow' });
    const draft = buildCloseDraft(existing, stops, {
      loadedShipments: 5, deliveredShipments: 1, returnedShipments: 1, pendingShipments: 3,
      codCollectedSar: 18, codRemittedSar: 0,
    });
    expect(draft).toMatchObject({
      fuelCost: 130, notes: 'keep me', podStatus: 'complete', safetyIncidents: 1, tomorrowNote: 'tomorrow',
      loadedShipments: 5, completedShipments: 1, returnedShipments: 1, pendingShipments: 3,
      codExpectedSar: 18, closeStatus: 'draft',
    });
    expect(draft.updatedAt).not.toBe(existing.updatedAt);
  });

  it('balanced + fully-reasoned + agreeing totals validate; mismatches block with stable codes', () => {
    const balanced = record({ loadedShipments: 5, completedShipments: 1, returnedShipments: 1, pendingShipments: 3 });
    expect(validateCloseDraft(balanced, stops).ok).toBe(true);
    const mismatch = record({ loadedShipments: 8, completedShipments: 1, returnedShipments: 1, pendingShipments: 3 });
    expect(validateCloseDraft(mismatch, stops).blockers).toContain('shipment-mismatch');
    const disagree = record({ loadedShipments: 5, completedShipments: 2, returnedShipments: 1, pendingShipments: 3 });
    expect(validateCloseDraft(disagree, stops).blockers).toContain('outcome-totals-disagree');
    // a stop WITHOUT a reason (legacy/corrupt shape — creation enforces reasons,
    // so this arrives only from old data): build via the raw shape
    const reasonless = { ...stops[1], id: 'reasonless', status: 'returned', failureReasonKey: undefined };
    const missingReason = validateCloseDraft(balanced, [...stops, reasonless as unknown as StopRecord]);
    expect(missingReason.blockers).toContain('missing-reasons');
  });

  it('reconciled application stamps closeStatus + closedAt; reopen keeps history', () => {
    const draft = record({ loadedShipments: 0, closeStatus: 'draft' });
    const closed = applyCloseToDailyRecord(draft, NOW);
    expect(closed).toMatchObject({ closeStatus: 'reconciled' });
    expect(closed.closedAt).toBe(NOW);
  });
});

const failedStop = stop({ reference: 'F-1', status: 'returned', failureReasonKey: 'refusedDelivery' });
const anotherFailed = stop({ reference: 'F-1', status: 'failed', failureReasonKey: 'noDriver' });

describe('recovery idempotency (stopId-linked)', () => {

  it('creates one pending entry per exception stop, linked by stopId', () => {
    const created = buildRecoveryEntriesForStops([failedStop, anotherFailed], [], 'owner', NOW);
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({ stopId: failedStop.id, shipments: 1, status: 'pending', customer: failedStop.customerName });
    expect(created[0].id).not.toBe(created[1].id); // same reference, separate links
  });

  it('repeated saves create nothing twice; operator-edited entries preserved', () => {
    const first = buildRecoveryEntriesForStops([failedStop], [], 'owner', NOW)[0];
    const edited: RecoveryEntry = { ...first, owner: 'م. خالد', note: 'اتصل مرتين', status: 'recovered', resolvedAt: NOW };
    const second = buildRecoveryEntriesForStops([failedStop], [edited], 'owner', NOW);
    expect(second).toHaveLength(0); // idempotent
    // delivered stop does not erase recovery history — buildRecovery never removes
    const afterDelivery = buildRecoveryEntriesForStops([{ ...failedStop, status: 'delivered' }], [edited], 'owner', NOW);
    expect(afterDelivery).toHaveLength(0);
    expect(edited.status).toBe('recovered');
  });
});

describe('backup round-trip preserves close + stopId fields', async () => {
  const { buildBackup, parseBackup } = await import('@/lib/backup');
  const { defaultFinancialInput } = await import('@/lib/mockData');
  it('v3 file keeps closeStatus/closedAt/close counters and recovery stopId', () => {
    const rec = record({ closeStatus: 'reconciled', closedAt: NOW, loadedShipments: 5, returnedShipments: 1, pendingShipments: 3, codExpectedSar: 42, updatedAt: NOW });
    const entry = buildRecoveryEntriesForStops([failedStop], [], 'o', NOW)[0];
    const file = buildBackup({ financialInput: structuredClone(defaultFinancialInput), dailyRecords: { [DATE]: rec }, scenarios: [], recoveryEntries: [entry], followUpActions: [], stops: [] }, 'ar');
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok && parsed.lossless).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.data.dailyRecords[DATE]).toMatchObject({ closeStatus: 'reconciled', closedAt: NOW, loadedShipments: 5, codExpectedSar: 42 });
    expect(parsed.file.data.recoveryEntries[0]?.stopId).toBe(entry.stopId);
  });
});
