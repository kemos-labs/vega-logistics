import { describe, it, expect } from 'vitest';
import { createStopRecord, type StopRecord } from '@/lib/stops';
import { buildTodayWorkflowState, selectPrimaryNextAction, buildTodayExceptionQueue, buildWorkflowStepStatuses } from '@/lib/todayWorkspace';
import type { DailyRecord } from '@/lib/operationsReporting';
import type { RecoveryEntry } from '@/lib/recoveryBoard';

const DATE = '2026-08-27';
const YESTERDAY = '2026-08-26';
const NOW = '2026-08-27T12:00:00.000Z';
let tick = 0;
function stop(over: Partial<StopRecord> = {}): StopRecord {
  tick += 1;
  return createStopRecord({
    operationDate: DATE,
    customerName: `Customer ${tick}`,
    stopLabel: `Stop ${tick}`,
    ...over,
  }, new Date(Date.parse(NOW) + tick * 1000).toISOString());
}
function yStop(over: Partial<StopRecord> = {}): StopRecord {
  tick += 1;
  return createStopRecord({
    operationDate: YESTERDAY,
    customerName: `Y Customer`,
    stopLabel: `Y Stop`,
    ...over,
  }, new Date(Date.parse(NOW) - 86400000 + tick * 1000).toISOString());
}
function record(over: Partial<DailyRecord> = {}): DailyRecord {
  return { date: DATE, completedShipments: 0, failedShipments: 0, fuelCost: 0, driversPresent: 2, notes: '', updatedAt: NOW, ...over };
}

describe('buildTodayWorkflowState', () => {
  it('empty day: planned 0, unassigned 0, shipmentDifference null, empty exceptions', () => {
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [], dailyRecords: {}, recoveryEntries: [] });
    expect(state.plannedCount).toBe(0);
    expect(state.dispatchableCount).toBe(0);
    expect(state.unassignedCount).toBe(0);
    expect(state.shipmentDifference).toBeNull();
    expect(state.isEmptyDay).toBe(true);
    expect(state.exceptions.find(e => e.kind === 'pending-recovery')).toBeUndefined();
  });

  it('planned != loaded: honest separation, no fallback', () => {
    const stopsList = [stop({ reference: 'A' }), stop({ reference: 'B' }), stop({ reference: 'C' })];
    const rec = record({ loadedShipments: 5, completedShipments: 1, returnedShipments: 1, pendingShipments: 1, closeStatus: 'draft' });
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: stopsList, dailyRecords: { [DATE]: rec }, recoveryEntries: [] });
    expect(state.plannedCount).toBe(3);
    expect(state.loadedShipments).toBe(5);
    expect(state.shipmentDifference).toBe(2); // 5 - (1+1+1)=2
  });

  it('unassigned and assigned counts derived from dispatch board', () => {
    const s1 = stop({ driverName: 'Ahmed', carNumber: 'Van' });
    const s2 = stop({});
    const s3 = stop({});
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [s1, s2, s3], dailyRecords: {}, recoveryEntries: [] });
    expect(state.dispatchableCount).toBe(3);
    expect(state.unassignedCount).toBe(2);
    expect(state.assignedCount).toBe(1);
  });

  it('missing address notes priority counted', () => {
    const withAddr = stop({ addressNotes: 'حي الملقا' });
    const without = stop({ addressNotes: undefined });
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [withAddr, without], dailyRecords: {}, recoveryEntries: [] });
    expect(state.missingAddressCount).toBe(1);
    expect(state.exceptions.some(e => e.kind === 'missing-address')).toBe(true);
  });

  it('nullable shipment difference when no loaded', () => {
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [stop()], dailyRecords: {}, recoveryEntries: [] });
    expect(state.shipmentDifference).toBeNull();
    expect(state.shipmentBalanced).toBeNull();
  });

  it('signed mismatch preserved', () => {
    const stopsList = [
      stop({ status: 'delivered', codAmountSar: 10 }),
      stop({ status: 'returned', failureReasonKey: 'noDriver' }),
    ];
    const recPos = record({ loadedShipments: 10, completedShipments: 1, returnedShipments: 1, pendingShipments: 0 });
    const pos = buildTodayWorkflowState({ selectedDate: DATE, stops: stopsList, dailyRecords: { [DATE]: recPos }, recoveryEntries: [] });
    expect(pos.shipmentDifference).toBe(8);
    const recNeg = record({ loadedShipments: 1, completedShipments: 1, returnedShipments: 1, pendingShipments: 0 });
    const neg = buildTodayWorkflowState({ selectedDate: DATE, stops: stopsList, dailyRecords: { [DATE]: recNeg }, recoveryEntries: [] });
    expect(neg.shipmentDifference).toBe(-1);
  });

  it('strict COD formulas', () => {
    const delivered = stop({ status: 'delivered', codAmountSar: 20 });
    const delivered2 = stop({ status: 'delivered', codAmountSar: 22 });
    const rec = record({ cashCollectedSar: 30, cashRemittedSar: 50, codExpectedSar: 42 });
    // delivered stops drive expected = 42
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [delivered, delivered2], dailyRecords: { [DATE]: rec }, recoveryEntries: [] });
    // outstanding = max(0,30-50)=0, uncollected = max(0,42-30)=12, overRemitted = max(0,50-30)=20
    expect(state.cod.outstandingSar).toBe(0);
    expect(state.cod.uncollectedSar).toBe(12);
    expect(state.cod.overRemittedSar).toBe(20);
  });

  it('explicit draft vs reconciled vs legacy', () => {
    const draftRec = record({ closeStatus: 'draft' });
    const reconciledRec = record({ closeStatus: 'reconciled', closedAt: NOW });
    const legacyRec = record({}); // no closeStatus
    const d = buildTodayWorkflowState({ selectedDate: DATE, stops: [], dailyRecords: { [DATE]: draftRec }, recoveryEntries: [] });
    const r = buildTodayWorkflowState({ selectedDate: DATE, stops: [], dailyRecords: { [DATE]: reconciledRec }, recoveryEntries: [] });
    const l = buildTodayWorkflowState({ selectedDate: DATE, stops: [], dailyRecords: { [DATE]: legacyRec }, recoveryEntries: [] });
    expect(d.closeState).toBe('draft');
    expect(d.closeIsDefinitive).toBe(false);
    expect(r.closeState).toBe('reconciled');
    expect(r.closeIsDefinitive).toBe(true);
    expect(l.closeState).toBe('legacy-recorded');
    expect(l.closeIsDefinitive).toBe(true);
  });

  it('yesterday warning does not steal primary action', () => {
    // Today has unassigned; yesterday is draft (warning) — primary should still be dispatch, not yesterday
    const todayStops = [stop({}), stop({ addressNotes: 'ok' })];
    // make first missing address? Ensure second has address so missing-address not triggered? We'll have one missing address to test priority? Actually want unassigned priority
    const s1 = stop({ addressNotes: 'حي', reference: 'A' }); // has address
    const s2 = stop({ addressNotes: 'حي 2' });
    // Make one unassigned by not assigning driver
    const draftYesterday = record({ date: YESTERDAY, closeStatus: 'draft' });
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [s1, s2], dailyRecords: { [YESTERDAY]: draftYesterday }, recoveryEntries: [] });
    expect(state.yesterdayWarning.hasWarning).toBe(true);
    const primary = selectPrimaryNextAction(state);
    // Should be dispatch (unassigned) not yesterday
    expect(primary.targetView).toBe('dispatch');
  });

  it('recovery and run derivation max three', () => {
    const stopsList = [
      stop({ driverName: 'A', carNumber: 'V1' }),
      stop({ driverName: 'A', carNumber: 'V1' }),
      stop({ driverName: 'B', carNumber: 'V2' }),
      stop({ driverName: 'C', carNumber: 'V3' }),
      stop({ driverName: 'D', carNumber: 'V4' }),
    ];
    const recoveries: RecoveryEntry[] = [
      { id: 'r1', createdAt: DATE, shipments: 1, owner: '', status: 'pending' },
      { id: 'r2', createdAt: DATE, shipments: 1, owner: '', status: 'recovered' },
    ];
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: stopsList, dailyRecords: {}, recoveryEntries: recoveries });
    expect(state.exceptions.some(e => e.kind === 'pending-recovery')).toBe(true);
    expect(state.runPreviews.length).toBeLessThanOrEqual(3);
  });
});

describe('selectPrimaryNextAction precedence', () => {
  it('no planned -> add stops', () => {
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [], dailyRecords: {}, recoveryEntries: [] });
    expect(selectPrimaryNextAction(state).id).toBe('add-stops');
  });
  it('missing address -> review', () => {
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [stop({ addressNotes: undefined })], dailyRecords: {}, recoveryEntries: [] });
    expect(selectPrimaryNextAction(state).id).toBe('review-address');
  });
  it('unassigned -> dispatch', () => {
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [stop({ addressNotes: 'ok' }), stop({ addressNotes: 'ok2' })], dailyRecords: {}, recoveryEntries: [] });
    // Both have address, so missing-address not trigger; unassigned should win
    expect(selectPrimaryNextAction(state).targetView).toBe('dispatch');
  });
  it('shipment gap -> close blockers', () => {
    const s = stop({ addressNotes: 'ok', status: 'delivered' });
    const rec = record({ loadedShipments: 5, completedShipments: 1, returnedShipments: 0, pendingShipments: 0 });
    // Need assigned to avoid unassigned priority: make dispatchable assigned
    const assigned = stop({ addressNotes: 'ok2', driverName: 'X', carNumber: 'V' });
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [assigned], dailyRecords: { [DATE]: rec }, recoveryEntries: [] });
    // We need to craft state where gap exists and no missing address/unassigned
    // Use a pending stop assigned to trigger? For simplicity directly test gap priority over generic close
    expect(state.shipmentDifference).not.toBe(0);
    expect(selectPrimaryNextAction(state).id).toBe('close-blockers');
  });
  it('modern close not reconciled -> close', () => {
    const s = stop({ addressNotes: 'ok', driverName: 'D', carNumber: 'V' });
    const rec = record({ closeStatus: 'draft', loadedShipments: 1, completedShipments: 0, returnedShipments: 0, pendingShipments: 1 });
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [s], dailyRecords: { [DATE]: rec }, recoveryEntries: [] });
    // No gap, no missing reason, but draft => close
    // Need to ensure gap is balanced: loaded 1, pending 1 => balanced so blockers not triggered
    // delivered 0, returned 0, pending 1 => 1-0-0-1=0 balanced
    const balanced = buildTodayWorkflowState({ selectedDate: DATE, stops: [stop({ addressNotes: 'x', status: 'pending', driverName: 'D', carNumber: 'V' })], dailyRecords: { [DATE]: record({ closeStatus: 'draft', loadedShipments: 1, completedShipments: 0, returnedShipments: 0, pendingShipments: 1 }) }, recoveryEntries: [] });
    expect(selectPrimaryNextAction(balanced).id).toBe('close');
  });
  it('unresolved COD -> close-cod when reconciled', () => {
    const s = stop({ addressNotes: 'ok', status: 'delivered', codAmountSar: 100, driverName: 'D', carNumber: 'V' });
    const rec = record({ closeStatus: 'reconciled', closedAt: NOW, cashCollectedSar: 20, cashRemittedSar: 0, codExpectedSar: 100 });
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [s], dailyRecords: { [DATE]: rec }, recoveryEntries: [] });
    expect(selectPrimaryNextAction(state).id).toBe('close-cod');
  });
  it('otherwise -> daily report', () => {
    const s = stop({ addressNotes: 'ok', status: 'delivered', codAmountSar: 10, driverName: 'D', carNumber: 'V' });
    const rec = record({ closeStatus: 'reconciled', closedAt: NOW, loadedShipments: 1, completedShipments: 1, returnedShipments: 0, pendingShipments: 0, cashCollectedSar: 10, cashRemittedSar: 10, codExpectedSar: 10 });
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [s], dailyRecords: { [DATE]: rec }, recoveryEntries: [] });
    expect(selectPrimaryNextAction(state).id).toBe('daily-report');
  });
});

describe('buildWorkflowStepStatuses', () => {
  it('plan complete only when at least one stop', () => {
    const empty = buildTodayWorkflowState({ selectedDate: DATE, stops: [], dailyRecords: {}, recoveryEntries: [] });
    expect(buildWorkflowStepStatuses(empty).find(s => s.id === 'plan')?.status).toBe('not-started');
    const withStops = buildTodayWorkflowState({ selectedDate: DATE, stops: [stop()], dailyRecords: {}, recoveryEntries: [] });
    expect(buildWorkflowStepStatuses(withStops).find(s => s.id === 'plan')?.status).toBe('complete');
  });
  it('dispatch complete only when unassigned 0 and at least one dispatchable', () => {
    const empty = buildTodayWorkflowState({ selectedDate: DATE, stops: [], dailyRecords: {}, recoveryEntries: [] });
    expect(buildWorkflowStepStatuses(empty).find(s => s.id === 'dispatch')?.status).toBe('not-started');
    const unassigned = buildTodayWorkflowState({ selectedDate: DATE, stops: [stop({ addressNotes: 'ok' })], dailyRecords: {}, recoveryEntries: [] });
    expect(buildWorkflowStepStatuses(unassigned).find(s => s.id === 'dispatch')?.status).toBe('in-progress');
    const assigned = buildTodayWorkflowState({ selectedDate: DATE, stops: [stop({ addressNotes: 'ok', driverName: 'D', carNumber: 'V' })], dailyRecords: {}, recoveryEntries: [] });
    expect(buildWorkflowStepStatuses(assigned).find(s => s.id === 'dispatch')?.status).toBe('complete');
  });
  it('close complete only for reconciled', () => {
    const draft = buildTodayWorkflowState({ selectedDate: DATE, stops: [stop()], dailyRecords: { [DATE]: record({ closeStatus: 'draft' }) }, recoveryEntries: [] });
    expect(buildWorkflowStepStatuses(draft).find(s => s.id === 'close')?.status).not.toBe('complete');
    const reconciled = buildTodayWorkflowState({ selectedDate: DATE, stops: [stop()], dailyRecords: { [DATE]: record({ closeStatus: 'reconciled', closedAt: NOW }) }, recoveryEntries: [] });
    expect(buildWorkflowStepStatuses(reconciled).find(s => s.id === 'close')?.status).toBe('complete');
    const legacy = buildTodayWorkflowState({ selectedDate: DATE, stops: [stop()], dailyRecords: { [DATE]: record({}) }, recoveryEntries: [] });
    expect(buildWorkflowStepStatuses(legacy).find(s => s.id === 'close')?.status).toBe('legacy');
  });
  it('report complete for definitive only', () => {
    const draft = buildTodayWorkflowState({ selectedDate: DATE, stops: [], dailyRecords: { [DATE]: record({ closeStatus: 'draft' }) }, recoveryEntries: [] });
    expect(buildWorkflowStepStatuses(draft).find(s => s.id === 'report')?.status).not.toBe('complete');
    const legacy = buildTodayWorkflowState({ selectedDate: DATE, stops: [], dailyRecords: { [DATE]: record({}) }, recoveryEntries: [] });
    expect(buildWorkflowStepStatuses(legacy).find(s => s.id === 'report')?.status).toBe('complete');
  });
});

describe('buildTodayExceptionQueue ordering', () => {
  it('sorts missing-address before missing-phone', () => {
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [stop({ addressNotes: undefined, phone: undefined })], dailyRecords: {}, recoveryEntries: [{ id: 'r', createdAt: DATE, shipments: 1, owner: '', status: 'pending' }] });
    const q = buildTodayExceptionQueue(state);
    const addrIdx = q.findIndex(e => e.kind === 'missing-address');
    const phoneIdx = q.findIndex(e => e.kind === 'missing-phone');
    expect(addrIdx).toBeLessThan(phoneIdx);
  });
});

describe('COD manual note truth', () => {
  it('ignores stored expected 999 without note => stop-derived 42', () => {
    const s1 = stop({ status: 'delivered', codAmountSar: 20 });
    const s2 = stop({ status: 'delivered', codAmountSar: 22 });
    const rec = record({ codExpectedSar: 999, cashCollectedSar: 0, cashRemittedSar: 0 });
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [s1, s2], dailyRecords: { [DATE]: rec }, recoveryEntries: [] });
    expect(state.cod.expectedSar).toBe(42);
    expect(state.cod.expectedSource).toBe('stop-derived');
  });
  it('uses stored expected 999 with real note => manual-adjusted', () => {
    const s1 = stop({ status: 'delivered', codAmountSar: 20 });
    const s2 = stop({ status: 'delivered', codAmountSar: 22 });
    const rec = record({ codExpectedSar: 999, codAdjustmentNote: 'verified with provider', cashCollectedSar: 0, cashRemittedSar: 0 });
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [s1, s2], dailyRecords: { [DATE]: rec }, recoveryEntries: [] });
    expect(state.cod.expectedSar).toBe(999);
    expect(state.cod.expectedSource).toBe('manual-adjusted');
  });
});

describe('terminal-outcome dispatch truth', () => {
  it('assignedCount includes terminal outcomes with driver identity', () => {
    const delivered = stop({ status: 'delivered', driverName: 'Ahmed', carNumber: 'V1' });
    const returned = { ...stop({ driverName: 'Ahmed', carNumber: 'V1' }), status: 'returned' as const, failureReasonKey: 'noDriver' as const } as unknown as ReturnType<typeof stop>;
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [delivered, returned], dailyRecords: {}, recoveryEntries: [] });
    expect(state.plannedCount).toBe(2);
    expect(state.assignedCount).toBe(2);
    expect(state.dispatchableCount).toBe(0);
  });
  it('Dispatch complete when all planned are terminal and no unassigned dispatchable remain', () => {
    const s1 = stop({ status: 'delivered', driverName: 'D', carNumber: 'V', addressNotes: 'ok' });
    const s2 = { ...stop({ addressNotes: 'ok', driverName: 'D', carNumber: 'V' }), status: 'returned' as const, failureReasonKey: 'noDriver' as const } as unknown as ReturnType<typeof stop>;
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [s1, s2], dailyRecords: {}, recoveryEntries: [] });
    const dispatch = buildWorkflowStepStatuses(state).find(s => s.id === 'dispatch');
    expect(dispatch?.status).toBe('complete');
  });
  it('run previews remain available from terminal stops with driver identity', () => {
    const s1 = stop({ status: 'delivered', driverName: 'Ali', carNumber: 'V1' });
    const s2 = stop({ status: 'returned', driverName: 'Ali', carNumber: 'V1', failureReasonKey: 'noDriver' } as unknown as never);
    const s3 = stop({ status: 'delivered', driverName: 'Sara', carNumber: 'V2' });
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [s1, s2, s3], dailyRecords: {}, recoveryEntries: [] });
    expect(state.runPreviews.length).toBeGreaterThan(0);
    expect(state.runPreviews[0].workload.stopCount).toBeGreaterThan(0);
  });
  it('pulse Assigned denominator is planned, not dispatchable subset', () => {
    const s1 = stop({ status: 'delivered', driverName: 'D', carNumber: 'V', addressNotes: 'ok' });
    const state = buildTodayWorkflowState({ selectedDate: DATE, stops: [s1], dailyRecords: {}, recoveryEntries: [] });
    const dispatch = buildWorkflowStepStatuses(state).find(s => s.id === 'dispatch');
    expect(dispatch?.detail).toBe(`1/${state.plannedCount}`);
  });
});
