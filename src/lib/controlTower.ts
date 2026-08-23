// VEGA — Control Tower selectors (Release R1).
//
// Pure, React-free, storage-free. Everything is DERIVED from recorded data
// (DailyRecord / RecoveryEntry) plus the operator's own model — never from
// simulated or external figures. The wall clock is injected (`nowMs`) so the
// snapshot is deterministic and testable.
//
// Honest-data-states rule: planned values come from the model and are always
// labelled planned; missing days are "no data", never zero-filled.

import { isDefinitiveDailyRecord, toDateString, type DailyRecord } from '@/lib/operationsReporting';
import { RECOVERY_TARGETS, type RecoveryEntry } from '@/lib/recoveryBoard';
import type { BackupReminderState } from '@/lib/backupReminder';

export interface TowerYesterday {
  date: string;
  planned: number;
  delivered: number;
  failed: number;
  recovered: number;
  hasData: boolean;
}

export interface TowerAction {
  id: string;
  severity: 'high' | 'medium';
  /** Locale key under businessModel.tower.actions. */
  labelKey: string;
  params?: Record<string, string | number>;
}

export interface ControlTowerSnapshot {
  yesterday: TowerYesterday | null;
  codOutstandingSar: number;
  podGapDates: string[];
  recoveryOpen: number;
  recoveryOverdue: number;
  driversPresentYesterday: number | null;
  backup: BackupReminderState | null;
  actions: TowerAction[];
}

export interface ControlTowerInput {
  records: Record<string, DailyRecord>;
  recoveryEntries: RecoveryEntry[];
  plannedShipmentsPerDay: number;
  nowMs: number;
  backup: BackupReminderState | null;
}

/** Yesterday in LOCAL time (UTC+3 law) — never a UTC slice. */
export function yesterdayKey(nowMs: number): string {
  const d = new Date(nowMs);
  d.setDate(d.getDate() - 1);
  return toDateString(d);
}

export function buildControlTowerSnapshot(inputSpec: ControlTowerInput): ControlTowerSnapshot {
  const { recoveryEntries, plannedShipmentsPerDay, nowMs, backup } = inputSpec;
  // Draft closes are NEVER definitive: filter once, derive everything below.
  const records = Object.fromEntries(Object.entries(inputSpec.records).filter(([, r]) => isDefinitiveDailyRecord(r)));
  const draftCount = Object.values(inputSpec.records).filter(r => !isDefinitiveDailyRecord(r)).length;

  // ── EXACT yesterday only (local calendar). A day that was not recorded
  // is honest "no data", never substituted by an older recorded day.
  const yKey = yesterdayKey(nowMs);
  let yesterday: TowerYesterday | null = null;
  if (records[yKey]) {
    const r = records[yKey];
    yesterday = {
      date: yKey,
      planned: plannedShipmentsPerDay,
      delivered: r.completedShipments,
      failed: r.failedShipments,
      recovered: r.recoveredShipments ?? 0,
      hasData: true,
    };
  }

  // ── COD outstanding across ALL recorded days. Raw balance nets globally
  // (remittances pay down older cash); displayed outstanding clamps at zero —
  // over-remittance credit representation arrives in R4.
  let codBalanceRaw = 0;
  for (const record of Object.values(records)) {
    codBalanceRaw += Math.max(0, Number(record.cashCollectedSar) || 0) - Math.max(0, Number(record.cashRemittedSar) || 0);
  }
  const codOutstandingSar = Math.max(0, codBalanceRaw);

  // ── POD gaps (partial/none), most recent first, cap 7 shown upstream
  const podGapDates = Object.values(records)
    .filter(r => r.podStatus === 'partial' || r.podStatus === 'none')
    .map(r => r.date)
    .sort((a, b) => b.localeCompare(a));

  // ── recovery board aging
  const openEntries = recoveryEntries.filter(e => e.status === 'pending');
  const overdueMs = RECOVERY_TARGETS.overdueDays * 86_400_000;
  const recoveryOverdue = openEntries.filter(e => {
    const created = Date.parse(e.createdAt);
    return Number.isFinite(created) && nowMs - created > overdueMs;
  }).length;

  const actions: TowerAction[] = [];
  if (recoveryOverdue > 0) {
    actions.push({ id: 'recovery-overdue', severity: 'high', labelKey: 'recoveryOverdue', params: { count: recoveryOverdue } });
  }
  if (backup?.visible) {
    actions.push({ id: 'backup-stale', severity: 'high', labelKey: 'backupStale', params: {} });
  }
  if (codOutstandingSar > 0) {
    actions.push({ id: 'cod-outstanding', severity: 'high', labelKey: 'codOutstanding', params: { amount: codOutstandingSar } });
  }
  if (yesterday && yesterday.failed > 0) {
    actions.push({ id: 'failed-yesterday', severity: 'medium', labelKey: 'failedYesterday', params: { count: yesterday.failed } });
  }
  if (podGapDates.length > 0) {
    actions.push({ id: 'pod-gaps', severity: 'medium', labelKey: 'podGaps', params: { count: podGapDates.length } });
  }
  if (!yesterday) {
    actions.push({ id: 'record-yesterday', severity: 'medium', labelKey: 'recordYesterday', params: { date: yKey } });
  }
  if (draftCount > 0) {
    actions.push({ id: 'draft-close', severity: 'medium', labelKey: 'draftClose', params: { count: draftCount } });
  }

  // Explicit stable ranking: high before medium, then fixed domain priority.
  // Sorting happens BEFORE slicing so a high-severity item can never be
  // displaced by insertion-order luck.
  const PRIORITY = ['recovery-overdue', 'backup-stale', 'cod-outstanding', 'failed-yesterday', 'pod-gaps', 'record-yesterday'] as const;
  const rank = (a: TowerAction): number => (a.severity === 'high' ? 0 : 1) * 100 + PRIORITY.indexOf(a.id as typeof PRIORITY[number]);
  const sortedActions = [...actions].sort((a, b) => rank(a) - rank(b)).slice(0, 3);

  return {
    yesterday,
    codOutstandingSar,
    podGapDates,
    recoveryOpen: openEntries.length,
    recoveryOverdue,
    driversPresentYesterday: records[yKey]?.driversPresent ?? null,
    backup,
    actions: sortedActions,
  };
}
