// VEGA — Backup-age reminder (P1, contract G2).
//
// Pure, deterministic age/visibility logic. The wall clock is ALWAYS
// injected as `nowMs` so tests are reproducible.
//
// Device metadata key — intentionally NOT part of backup files:
//   * restoring an old backup must never suppress reminders;
//   * the stamp updates only when the user actually INITIATES a backup
//     download (ScenarioView.downloadBackup), never on dismiss.
// Dismissal hides the banner for the remainder of the calendar day only.

import { normalizeIso } from '@/lib/backup';

export const BACKUP_REMINDER_KEY = 'vega-last-backup-at-v1';
export const BACKUP_DISMISS_KEY_PREFIX = 'vega-backup-banner-dismissed:';
export const BACKUP_REMINDER_DAYS = 7;
/** Tolerated clock skew for future-dated stamps (device clock fixes). */
const FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

export type ReminderReason =
  | 'no-data'      // empty/new model — never nag
  | 'never'        // meaningful data, no stamp at all
  | 'invalid'      // stamp exists but unparseable — treat as unsafe, show
  | 'future'       // stamp implausibly ahead — do not nag on bogus data
  | 'fresh'        // backed up within the window
  | 'stale';       // ≥ BACKUP_REMINDER_DAYS since last backup

export interface BackupReminderState {
  visible: boolean;
  reason: ReminderReason;
  /** Whole days elapsed; null when unknowable (never / invalid / future). */
  daysSince: number | null;
}

function dayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function evaluateBackupReminder(
  nowMs: number,
  lastRaw: string | null | undefined,
  hasMeaningfulData: boolean,
): BackupReminderState {
  if (!hasMeaningfulData) return { visible: false, reason: 'no-data', daysSince: null };
  if (lastRaw === null || lastRaw === undefined || lastRaw.trim() === '') {
    return { visible: true, reason: 'never', daysSince: null };
  }
  const normalized = normalizeIso(lastRaw);
  if (!normalized) return { visible: true, reason: 'invalid', daysSince: null };
  const thenMs = Date.parse(normalized);
  if (thenMs > nowMs + FUTURE_SKEW_MS) return { visible: false, reason: 'future', daysSince: null };
  if (thenMs <= nowMs - FUTURE_SKEW_MS && thenMs > nowMs) {
    // unreachable numerically; kept for clarity of intent
  }
  const daysSince = Math.floor((nowMs - thenMs) / 86_400_000);
  if (daysSince < BACKUP_REMINDER_DAYS) return { visible: false, reason: 'fresh', daysSince };
  return { visible: true, reason: 'stale', daysSince };
}

/** Persist "user initiated a backup download right now". Raw ISO string. */
export function markBackedUpNow(
  nowMs: number = Date.now(),
  storage: { setItem(key: string, value: string): void } | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): void {
  if (!storage) return;
  try {
    storage.setItem(BACKUP_REMINDER_KEY, new Date(nowMs).toISOString());
  } catch {
    // metadata is best-effort; a failed write must not break the download
  }
}

/** Session-scoped dismissal: hides until the next UTC day, falsifies nothing. */
export function dismissForToday(
  nowMs: number = Date.now(),
  storage: { setItem(key: string, value: string): void } | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): void {
  if (!storage) return;
  try {
    storage.setItem(BACKUP_DISMISS_KEY_PREFIX + dayKey(nowMs), '1');
  } catch {
    /* best-effort */
  }
}

export function isDismissedToday(
  nowMs: number = Date.now(),
  storage: { getItem(key: string): string | null } | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(BACKUP_DISMISS_KEY_PREFIX + dayKey(nowMs)) === '1';
  } catch {
    return false;
  }
}
