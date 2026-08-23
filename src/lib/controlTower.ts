// VEGA — Control Tower selectors (Release R1).
//
// Pure, React-free, storage-free. Everything is DERIVED from recorded data
// (DailyRecord / RecoveryEntry) plus the operator's own model — never from
// simulated or external figures. The wall clock is injected (`nowMs`) so the
// snapshot is deterministic and testable.
//
// Honest-data-states rule: planned values come from the model and are always
// labelled planned; missing days are "no data", never zero-filled.

import type { DailyRecord } from '@/lib/operationsReporting';
import { toDateString } from '@/lib/operationsReporting';
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
  const { records, recoveryEntries, plannedShipmentsPerDay, nowMs, backup } = inputSpec;

  // ── yesterday (most recent RECORDED day ≤ yesterday; missing ⇒ null)
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

  // ── COD outstanding across ALL recorded days (collected − remitted)
  let codOutstandingSar = 0;
  for (const record of Object.values(records)) {
    codOutstandingSar += Math.max(0, Number(record.cashCollectedSar) || 0) - Math.max(0, Number(record.cashRemittedSar) || 0);
  }

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
  if (codOutstandingSar > 0) {
    actions.push({ id: 'cod-outstanding', severity: 'high', labelKey: 'codOutstanding', params: { amount: codOutstandingSar } });
  }
  if (yesterday && yesterday.failed > 0) {
    actions.push({ id: 'failed-yesterday', severity: 'medium', labelKey: 'failedYesterday', params: { count: yesterday.failed } });
  }
  if (podGapDates.length > 0) {
    actions.push({ id: 'pod-gaps', severity: 'medium', labelKey: 'podGaps', params: { count: podGapDates.length } });
  }
  if (backup?.visible) {
    actions.push({ id: 'backup-stale', severity: 'high', labelKey: 'backupStale', params: {} });
  }
  if (!yesterday) {
    actions.push({ id: 'record-yesterday', severity: 'medium', labelKey: 'recordYesterday', params: { date: yKey } });
  }

  return {
    yesterday,
    codOutstandingSar,
    podGapDates,
    recoveryOpen: openEntries.length,
    recoveryOverdue,
    driversPresentYesterday: records[yKey]?.driversPresent ?? null,
    backup,
    actions: actions.slice(0, 3),
  };
}
