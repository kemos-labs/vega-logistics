// VEGA — Today workspace selectors (R5-UX). Pure, deterministic, React-free.
// Reuses dispatch, close and definitive predicates; no persistence, no wall-clock.

import { buildDispatchBoard, runKey, runWorkload, type DriverRun } from '@/lib/dispatch';
import {
  calculateCodClose,
  isDefinitiveDailyRecord,
  reconcileShipmentTotals,
  summarizeStopOutcomes,
} from '@/lib/eveningClose';
import { toDateString, type DailyRecord } from '@/lib/operationsReporting';
import type { RecoveryEntry } from '@/lib/recoveryBoard';
import type { StopRecord } from '@/lib/stops';

// ── State ─────────────────────────────────────────────────────────

export type CloseState = 'open' | 'draft' | 'reconciled' | 'legacy-recorded';

export interface CodProvenanceState {
  expectedSar: number;
  expectedSource: 'stop-derived' | 'manual-adjusted';
  collectedSar: number;
  remittedSar: number;
  outstandingSar: number;
  uncollectedSar: number;
  overRemittedSar: number;
}

export interface TodayException {
  id: string;
  kind:
    | 'missing-address'
    | 'missing-phone'
    | 'unassigned'
    | 'missing-reason'
    | 'shipment-gap'
    | 'cod-uncollected'
    | 'cod-overremitted'
    | 'draft-close'
    | 'pending-recovery';
  count?: number;
  detail?: string;
  /** Destination view for navigation from Today. */
  targetView: 'stops' | 'dispatch' | 'close' | 'recovery' | 'daily';
}

export interface RunPreview {
  key: string;
  run: DriverRun;
  workload: ReturnType<typeof runWorkload>;
}

export interface YesterdayWarning {
  yesterdayDate: string;
  hasWarning: boolean;
  status: 'missing' | 'draft' | 'reconciled' | 'legacy-recorded' | 'open';
  record?: DailyRecord;
}

export interface TodayWorkflowState {
  selectedDate: string;
  plannedCount: number;
  /** Dispatchable (planned/pending) subset — what the board can assign. */
  dispatchableCount: number;
  assignedCount: number;
  unassignedCount: number;
  delivered: number;
  returned: number;
  pending: number;
  failedAttempts: number;
  missingReasonCount: number;
  missingAddressCount: number;
  missingPhoneCount: number;
  loadedShipments?: number;
  /** Signed loaded - (delivered+returned+pending); null when no loaded value. */
  shipmentDifference: number | null;
  shipmentBalanced: boolean | null;
  cod: CodProvenanceState;
  closeState: CloseState;
  closeRecord?: DailyRecord;
  closeIsDefinitive: boolean;
  exceptions: TodayException[];
  runPreviews: RunPreview[];
  yesterdayWarning: YesterdayWarning;
  isEmptyDay: boolean;
  isReconciled: boolean;
}

export interface WorkflowStepStatus {
  id: 'plan' | 'dispatch' | 'close' | 'report';
  labelKey: string;
  status: 'complete' | 'in-progress' | 'not-started' | 'legacy' | 'blocked';
  detail?: string;
}

export interface PrimaryAction {
  id: 'add-stops' | 'review-address' | 'dispatch' | 'close-blockers' | 'close' | 'close-cod' | 'daily-report';
  labelKey: string;
  descriptionKey: string;
  targetView: 'stops' | 'dispatch' | 'close' | 'daily';
}

export interface TodayWorkspaceInput {
  selectedDate: string; // YYYY-MM-DD
  stops: StopRecord[];
  dailyRecords: Record<string, DailyRecord>;
  recoveryEntries: RecoveryEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────

function yesterdayOf(selectedDate: string): string {
  const base = new Date(`${selectedDate}T12:00:00`);
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() - 1);
  return toDateString(base);
}

function resolveCloseState(record: DailyRecord | undefined): CloseState {
  if (!record) return 'open';
  if (record.closeStatus === 'reconciled') return 'reconciled';
  if (record.closeStatus === 'draft') return 'draft';
  return 'legacy-recorded';
}

function buildCodState(
  dayStops: StopRecord[],
  record: DailyRecord | undefined,
): CodProvenanceState {
  const deliveredStops = dayStops.filter(stop => stop.status === 'delivered');
  const stopDerived = deliveredStops.reduce((sum, stop) => sum + (stop.codAmountSar ?? 0), 0);
  let expectedSar = stopDerived;
  let expectedSource: 'stop-derived' | 'manual-adjusted' = 'stop-derived';
  let useManual = false;
  let realNote: string | undefined;
  if (record && typeof record.codExpectedSar === 'number' && Number.isFinite(record.codExpectedSar) && record.codExpectedSar >= 0) {
    const note = typeof record.codAdjustmentNote === 'string' ? record.codAdjustmentNote.trim() : '';
    if (note !== '' && record.codExpectedSar !== stopDerived) {
      expectedSar = record.codExpectedSar;
      expectedSource = 'manual-adjusted';
      useManual = true;
      realNote = record.codAdjustmentNote;
    }
  }
  const collectedSar = record?.cashCollectedSar ?? 0;
  const remittedSar = record?.cashRemittedSar ?? 0;
  if (useManual) {
    const computed = calculateCodClose({
      deliveredStops,
      collectedSar,
      remittedSar,
      manualExpectedSar: expectedSar,
      adjustmentNote: realNote!,
    });
    return {
      expectedSar: computed.expectedSar,
      expectedSource: computed.expectedSource,
      collectedSar: computed.collectedSar,
      remittedSar: computed.remittedSar,
      outstandingSar: computed.outstandingSar,
      uncollectedSar: computed.uncollectedSar,
      overRemittedSar: computed.overRemittedSar,
    };
  }
  const computed = calculateCodClose({ deliveredStops, collectedSar, remittedSar });
  return {
    expectedSar: computed.expectedSar,
    expectedSource: computed.expectedSource,
    collectedSar: computed.collectedSar,
    remittedSar: computed.remittedSar,
    outstandingSar: computed.outstandingSar,
    uncollectedSar: computed.uncollectedSar,
    overRemittedSar: computed.overRemittedSar,
  };
}

function buildRunPreviews(dayStops: StopRecord[]): RunPreview[] {
  const map = new Map<string, DriverRun>();
  for (const stop of dayStops) {
    if (!stop.driverName) continue;
    const key = runKey({ driverName: stop.driverName, carNumber: stop.carNumber, plateNumber: stop.plateNumber });
    const existing = map.get(key);
    if (existing) existing.stops.push(stop);
    else map.set(key, { driverName: stop.driverName, carNumber: stop.carNumber, plateNumber: stop.plateNumber, stops: [stop] });
  }
  const runs = [...map.values()]
    .map(run => ({ ...run, stops: [...run.stops].sort((a, b) => (a.sequence ?? 1e9) - (b.sequence ?? 1e9) || Date.parse(a.createdAt) - Date.parse(b.createdAt)) }))
    .sort((a, b) => a.driverName.localeCompare(b.driverName))
    .slice(0, 3);
  return runs.map(run => ({ key: runKey(run), run, workload: runWorkload(run.stops) }));
}

// ── Core selector ─────────────────────────────────────────────────

export function buildTodayWorkflowState(input: TodayWorkspaceInput): TodayWorkflowState {
  const { selectedDate, stops, dailyRecords, recoveryEntries } = input;
  const dayStops = stops.filter(stop => stop.operationDate === selectedDate);
  const plannedCount = dayStops.length;
  const board = buildDispatchBoard(dayStops);
  const dispatchableStops = dayStops.filter(stop => stop.status === 'planned' || stop.status === 'pending');
  const dispatchableCount = dispatchableStops.length;
  const unassignedCount = board.unassigned.length;
  const assignedCount = dayStops.filter(stop => Boolean(stop.driverName?.trim())).length;

  const summary = summarizeStopOutcomes(dayStops);
  const missingAddressCount = dayStops.filter(stop => !stop.addressNotes?.trim()).length;
  const missingPhoneCount = dayStops.filter(stop => !stop.phone?.trim()).length;

  const closeRecord = dailyRecords[selectedDate];
  const closeState = resolveCloseState(closeRecord);
  const isReconciled = closeState === 'reconciled';
  const closeIsDefinitive = closeRecord ? isDefinitiveDailyRecord(closeRecord) : false;

  const loadedShipments = closeRecord?.loadedShipments;
  let shipmentDifference: number | null = null;
  let shipmentBalanced: boolean | null = null;
  if (loadedShipments !== undefined) {
    const recon = reconcileShipmentTotals(loadedShipments, summary.delivered, summary.returned, summary.pending);
    shipmentDifference = recon.difference;
    shipmentBalanced = recon.balanced;
  }

  const cod = buildCodState(dayStops, closeRecord);

  const yesterdayDate = yesterdayOf(selectedDate);
  const yesterdayRecord = yesterdayDate ? dailyRecords[yesterdayDate] : undefined;
  let yStatus: YesterdayWarning['status'] = 'missing';
  if (!yesterdayRecord) yStatus = 'missing';
  else if (yesterdayRecord.closeStatus === 'reconciled') yStatus = 'reconciled';
  else if (yesterdayRecord.closeStatus === 'draft') yStatus = 'draft';
  else if (yesterdayRecord.closeStatus === undefined) yStatus = 'legacy-recorded';
  else yStatus = 'open';
  const hasWarning = yStatus !== 'reconciled';
  const yesterdayWarning: YesterdayWarning = {
    yesterdayDate,
    hasWarning: Boolean(yesterdayDate) && hasWarning,
    status: yStatus,
    record: yesterdayRecord,
  };

  const exceptions: TodayException[] = [];
  if (missingAddressCount > 0) {
    exceptions.push({ id: 'missing-address', kind: 'missing-address', count: missingAddressCount, targetView: 'stops' });
  }
  if (missingPhoneCount > 0) {
    exceptions.push({ id: 'missing-phone', kind: 'missing-phone', count: missingPhoneCount, targetView: 'stops' });
  }
  if (unassignedCount > 0) {
    exceptions.push({ id: 'unassigned', kind: 'unassigned', count: unassignedCount, targetView: 'dispatch' });
  }
  if (summary.missingReason.length > 0) {
    exceptions.push({ id: 'missing-reason', kind: 'missing-reason', count: summary.missingReason.length, targetView: 'close' });
  }
  if (shipmentDifference !== null && shipmentDifference !== 0) {
    // Preserve sign in detail; UI will not duplicate it elsewhere
    const sign = shipmentDifference > 0 ? '+' : '−';
    exceptions.push({ id: 'shipment-gap', kind: 'shipment-gap', detail: `${sign}${Math.abs(shipmentDifference)}`, targetView: 'close' });
  }
  if (cod.uncollectedSar > 0) {
    exceptions.push({ id: 'cod-uncollected', kind: 'cod-uncollected', count: cod.uncollectedSar, targetView: 'close' });
  }
  if (cod.overRemittedSar > 0) {
    exceptions.push({ id: 'cod-overremitted', kind: 'cod-overremitted', count: cod.overRemittedSar, targetView: 'close' });
  }
  if (closeState === 'draft') {
    exceptions.push({ id: 'draft-close', kind: 'draft-close', targetView: 'close' });
  }
  const pendingRecoveries = recoveryEntries.filter(entry => entry.status === 'pending').length;
  if (pendingRecoveries > 0) {
    exceptions.push({ id: 'pending-recovery', kind: 'pending-recovery', count: pendingRecoveries, targetView: 'recovery' });
  }

  const runPreviews = buildRunPreviews(dayStops);

  return {
    selectedDate,
    plannedCount,
    dispatchableCount,
    assignedCount,
    unassignedCount,
    delivered: summary.delivered,
    returned: summary.returned,
    pending: summary.pending,
    failedAttempts: summary.failedAttempts,
    missingReasonCount: summary.missingReason.length,
    missingAddressCount,
    missingPhoneCount,
    loadedShipments,
    shipmentDifference,
    shipmentBalanced,
    cod,
    closeState,
    closeRecord,
    closeIsDefinitive,
    exceptions,
    runPreviews,
    yesterdayWarning,
    isEmptyDay: plannedCount === 0,
    isReconciled,
  };
}

// ── Primary action ────────────────────────────────────────────────

export function selectPrimaryNextAction(state: TodayWorkflowState): PrimaryAction {
  if (state.plannedCount === 0) {
    return { id: 'add-stops', labelKey: 'businessModel.today.primary.addStops', descriptionKey: 'businessModel.today.primary.addStopsDesc', targetView: 'stops' };
  }
  if (state.missingAddressCount > 0) {
    return { id: 'review-address', labelKey: 'businessModel.today.primary.reviewAddress', descriptionKey: 'businessModel.today.primary.reviewAddressDesc', targetView: 'stops' };
  }
  if (state.unassignedCount > 0) {
    return { id: 'dispatch', labelKey: 'businessModel.today.primary.dispatch', descriptionKey: 'businessModel.today.primary.dispatchDesc', targetView: 'dispatch' };
  }
  let hasCloseBlocker = false;
  if (state.shipmentDifference !== null && state.shipmentDifference !== 0) hasCloseBlocker = true;
  if (state.missingReasonCount > 0) hasCloseBlocker = true;
  if (hasCloseBlocker) {
    return { id: 'close-blockers', labelKey: 'businessModel.today.primary.closeBlockers', descriptionKey: 'businessModel.today.primary.closeBlockersDesc', targetView: 'close' };
  }
  if (state.closeState !== 'reconciled') {
    return { id: 'close', labelKey: 'businessModel.today.primary.close', descriptionKey: 'businessModel.today.primary.closeDesc', targetView: 'close' };
  }
  if (state.cod.uncollectedSar > 0 || state.cod.overRemittedSar > 0 || state.cod.outstandingSar > 0) {
    return { id: 'close-cod', labelKey: 'businessModel.today.primary.closeCod', descriptionKey: 'businessModel.today.primary.closeCodDesc', targetView: 'close' };
  }
  return { id: 'daily-report', labelKey: 'businessModel.today.primary.report', descriptionKey: 'businessModel.today.primary.reportDesc', targetView: 'daily' };
}

// ── Exception queue (sorted) ──────────────────────────────────────

export function buildTodayExceptionQueue(state: TodayWorkflowState): TodayException[] {
  const order: Record<TodayException['kind'], number> = {
    'missing-address': 1,
    'missing-reason': 2,
    'shipment-gap': 3,
    unassigned: 4,
    'draft-close': 5,
    'cod-uncollected': 6,
    'cod-overremitted': 7,
    'pending-recovery': 8,
    'missing-phone': 9,
  };
  return [...state.exceptions].sort((a, b) => (order[a.kind] ?? 99) - (order[b.kind] ?? 99));
}

// ── Workflow step statuses ───────────────────────────────────────

export function buildWorkflowStepStatuses(state: TodayWorkflowState): WorkflowStepStatus[] {
  const planStatus: WorkflowStepStatus['status'] = state.plannedCount > 0 ? 'complete' : 'not-started';
  let dispatchStatus: WorkflowStepStatus['status'] = 'not-started';
  if (state.plannedCount === 0) dispatchStatus = 'not-started';
  else if (state.unassignedCount === 0) dispatchStatus = 'complete';
  else dispatchStatus = 'in-progress';
  let closeStatus: WorkflowStepStatus['status'] = 'not-started';
  if (state.closeState === 'reconciled') closeStatus = 'complete';
  else if (state.closeState === 'draft') {
    const hasBlocker = (state.shipmentDifference !== null && state.shipmentDifference !== 0) || state.missingReasonCount > 0;
    closeStatus = hasBlocker ? 'blocked' : 'in-progress';
  } else if (state.closeState === 'legacy-recorded') closeStatus = 'legacy';
  else closeStatus = 'not-started';
  const reportComplete = state.closeRecord ? isDefinitiveDailyRecord(state.closeRecord) : false;
  const reportStatus: WorkflowStepStatus['status'] = reportComplete ? 'complete' : state.closeRecord ? 'in-progress' : 'not-started';

  return [
    { id: 'plan', labelKey: 'businessModel.today.steps.plan', status: planStatus, detail: planStatus === 'complete' ? String(state.plannedCount) : undefined },
    { id: 'dispatch', labelKey: 'businessModel.today.steps.dispatch', status: dispatchStatus, detail: dispatchStatus === 'complete' ? `${state.assignedCount}/${state.plannedCount}` : `${state.unassignedCount}` },
    { id: 'close', labelKey: 'businessModel.today.steps.close', status: closeStatus },
    { id: 'report', labelKey: 'businessModel.today.steps.report', status: reportStatus },
  ];
}
