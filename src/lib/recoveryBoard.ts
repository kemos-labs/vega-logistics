import type { FailureReasonKey } from '@/lib/operationsReporting';

/**
 * Recovery board — the follow-up loop for failed deliveries. Industry research
 * (#1 daily pain): exceptions get counted everywhere but rarely *closed*. Each
 * entry tracks who owns the recovery and whether it succeeded.
 */
export type RecoveryStatus = 'pending' | 'recovered' | 'written_off';

export interface RecoveryEntry {
  id: string;
  /** Day the miss happened (YYYY-MM-DD). */
  createdAt: string;
  shipments: number;
  reasonKey?: FailureReasonKey;
  customer?: string;
  owner: string;
  note?: string;
  status: RecoveryStatus;
  /** Set when status leaves `pending`. */
  resolvedAt?: string;
  /** Normalized ISO stamp set on every edit (backup conflict resolution). */
  updatedAt?: string;
}

export interface RecoverySummary {
  pendingEntries: number;
  pendingShipments: number;
  recoveredShipments: number;
  writtenOffShipments: number;
  /** recovered / (recovered + written off) across closed entries. */
  closeRatePercent: number;
  /** Age in days of the oldest still-pending entry. */
  oldestPendingDays: number;
  /** Share of pending entries older than 7 days — escalation trigger. */
  overdueSharePercent: number;
}

/** Research-informed operating targets: contact-and-reschedule reattempts
 *  recover ~50-65%; exceptions should close within days, not weeks. */
export const RECOVERY_TARGETS = { closeRatePercent: 50, overdueDays: 7 } as const;

/** Entries past the escalation threshold are 'hot'. */
export function entryAgeDays(entry: RecoveryEntry, now = new Date()): number {
  return daysSince(entry.createdAt, now);
}

export const RECOVERY_STATUSES: RecoveryStatus[] = ['pending', 'recovered', 'written_off'];

let idCounter = 0;
export function createRecoveryEntry(input: Pick<RecoveryEntry, 'createdAt' | 'shipments'> & Partial<RecoveryEntry>): RecoveryEntry {
  idCounter += 1;
  return {
    id: `${Date.now().toString(36)}-${idCounter}`,
    status: 'pending',
    owner: '',
    ...input,
    shipments: Math.max(1, Math.round(input.shipments)),
  };
}

/** Defensive parse — localStorage may hold anything. */
/** Normalize any timestamp to canonical UTC ISO; null when invalid. */
function normalizeIso(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function validateRecoveryEntries(raw: unknown): RecoveryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): RecoveryEntry[] => {
    if (typeof item !== 'object' || item === null) return [];
    const row = item as Record<string, unknown>;
    const date = typeof row.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.createdAt) ? row.createdAt : null;
    const shipments = Number(row.shipments);
    const status = RECOVERY_STATUSES.includes(row.status as RecoveryStatus) ? row.status as RecoveryStatus : null;
    if (!date || !Number.isFinite(shipments) || shipments <= 0 || !status) return [];
    // updatedAt MUST survive the read path — it drives backup conflict
    // resolution (review contract F1). resolvedAt normalized too.
    const updatedAt = normalizeIso(row.updatedAt);
    const resolvedAt = normalizeIso(row.resolvedAt);
    return [{
      id: typeof row.id === 'string' ? row.id : `${date}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: date,
      shipments: Math.round(shipments),
      status,
      reasonKey: typeof row.reasonKey === 'string' ? row.reasonKey as FailureReasonKey : undefined,
      customer: typeof row.customer === 'string' ? row.customer.slice(0, 80) : undefined,
      owner: typeof row.owner === 'string' ? row.owner.slice(0, 60) : '',
      note: typeof row.note === 'string' ? row.note.slice(0, 300) : undefined,
      resolvedAt: resolvedAt ?? undefined,
      ...(updatedAt ? { updatedAt } : {}),
    }];
  });
}

function daysSince(dateIso: string, now: Date): number {
  const parsed = new Date(`${dateIso}T12:00:00`).getTime();
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.floor((now.getTime() - parsed) / 86_400_000));
}

export function summarizeRecoveryBoard(entries: RecoveryEntry[], now = new Date()): RecoverySummary {
  let pendingEntries = 0, pendingShipments = 0, recoveredShipments = 0, writtenOffShipments = 0, oldestPendingDays = 0, overdue = 0;
  for (const entry of entries) {
    if (entry.status === 'pending') {
      pendingEntries += 1;
      pendingShipments += entry.shipments;
      const age = daysSince(entry.createdAt, now);
      oldestPendingDays = Math.max(oldestPendingDays, age);
      if (age > RECOVERY_TARGETS.overdueDays) overdue += 1;
    } else if (entry.status === 'recovered') {
      recoveredShipments += entry.shipments;
    } else {
      writtenOffShipments += entry.shipments;
    }
  }
  const closed = recoveredShipments + writtenOffShipments;
  return {
    pendingEntries,
    pendingShipments,
    recoveredShipments,
    writtenOffShipments,
    closeRatePercent: closed > 0 ? Math.round(recoveredShipments / closed * 100) : 0,
    oldestPendingDays,
    overdueSharePercent: pendingEntries > 0 ? Math.round(overdue / pendingEntries * 100) : 0,
  };
}

/** Entries sorted for action: pending first, oldest misses on top. */
export function sortForAction(entries: RecoveryEntry[]): RecoveryEntry[] {
  const rank = (entry: RecoveryEntry) => (entry.status === 'pending' ? 0 : 1);
  return [...entries].sort((a, b) => rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt));
}

export interface RecoveryWeekBucket {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  label: string;
  recovered: number;
  writtenOff: number;
}

/** Recovered vs written-off shipments per ISO week (resolvedAt), oldest first.
 *  Gives the close-the-loop narrative its trend line. */
export function buildWeeklyRecoveryTrend(entries: RecoveryEntry[], weeks = 4, now = new Date()): RecoveryWeekBucket[] {
  const buckets: RecoveryWeekBucket[] = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const start = new Date(now);
    start.setDate(now.getDate() - index * 7 - now.getDay() + 1); // Monday of that week
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    buckets.push({ weekStart: key, label: key.slice(5), recovered: 0, writtenOff: 0 });
  }
  const weekIndexOf = (iso: string): number => {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return -1;
    const days = Math.floor((now.getTime() - parsed.getTime()) / 86_400_000);
    return weeks - 1 - Math.min(weeks - 1, Math.max(0, Math.floor(days / 7)));
  };
  for (const entry of entries) {
    if (entry.status === 'pending' || !entry.resolvedAt) continue;
    const index = weekIndexOf(entry.resolvedAt);
    if (index < 0) continue;
    if (entry.status === 'recovered') buckets[index].recovered += entry.shipments;
    else buckets[index].writtenOff += entry.shipments;
  }
  return buckets;
}
