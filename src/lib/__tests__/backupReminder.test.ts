// Backup-age reminder — pure logic (contract G2, clock-injected).
import { describe, expect, it } from 'vitest';

import {
  BACKUP_REMINDER_DAYS,
  BACKUP_REMINDER_KEY,
  dismissForToday,
  evaluateBackupReminder,
  isDismissedToday,
  markBackedUpNow,
} from '@/lib/backupReminder';
import { memoryStorage } from './helpers/memoryStorage';

const NOW = Date.parse('2026-08-30T12:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe('evaluateBackupReminder', () => {
  it('never nags an empty/new model', () => {
    const state = evaluateBackupReminder(NOW, null, false);
    expect(state).toEqual({ visible: false, reason: 'no-data', daysSince: null });
    expect(evaluateBackupReminder(NOW, undefined, false).visible).toBe(false);
  });

  it('shows "never" when meaningful data exists without any stamp', () => {
    const state = evaluateBackupReminder(NOW, null, true);
    expect(state.visible).toBe(true);
    expect(state.reason).toBe('never');
  });

  it('hides while fresh (<7 days) and shows at the 7-day boundary', () => {
    const fresh = evaluateBackupReminder(NOW, daysAgo(BACKUP_REMINDER_DAYS - 1), true);
    expect(fresh).toEqual({ visible: false, reason: 'fresh', daysSince: BACKUP_REMINDER_DAYS - 1 });

    const boundary = evaluateBackupReminder(NOW, daysAgo(BACKUP_REMINDER_DAYS), true);
    expect(boundary.visible).toBe(true);
    expect(boundary.reason).toBe('stale');
    expect(boundary.daysSince).toBe(BACKUP_REMINDER_DAYS);
  });

  it('treats invalid stamps as unsafe and shows the banner', () => {
    const state = evaluateBackupReminder(NOW, 'not-a-timestamp', true);
    expect(state.visible).toBe(true);
    expect(state.reason).toBe('invalid');
    expect(state.daysSince).toBeNull();
  });

  it('ignores implausible future timestamps instead of nagging', () => {
    const future = new Date(NOW + 10 * 86_400_000).toISOString();
    const state = evaluateBackupReminder(NOW, future, true);
    expect(state.visible).toBe(false);
    expect(state.reason).toBe('future');
  });

  it('tolerates small clock skew within a day as fresh', () => {
    const slightlyAhead = new Date(NOW + 2 * 3600_000).toISOString();
    const state = evaluateBackupReminder(NOW, slightlyAhead, true);
    expect(state.reason).toBe('fresh');
  });
});

describe('metadata storage helpers', () => {
  it('markBackedUpNow writes RAW ISO under the device key', () => {
    const store = memoryStorage();
    markBackedUpNow(NOW, store as never);
    expect(store.getItem(BACKUP_REMINDER_KEY)).toBe('2026-08-30T12:00:00.000Z');
  });

  it('swallowing quota errors: metadata failure must not break downloads', () => {
    const throwing = { setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); } };
    expect(() => markBackedUpNow(NOW, throwing as never)).not.toThrow();
    expect(() => dismissForToday(NOW, throwing as never)).not.toThrow();
    expect(isDismissedToday(NOW, throwing as never)).toBe(false);
  });

  it('dismissal is scoped to the calendar day and never falsifies backup age', () => {
    const store = memoryStorage();
    markBackedUpNow(Date.parse(daysAgo(9)), store);
    dismissForToday(NOW, store as never);
    expect(isDismissedToday(NOW, store as never)).toBe(true);
    // next day: dismissal expired, stale stamp still evaluated truthfully
    const tomorrow = NOW + 26 * 3600_000;
    expect(isDismissedToday(tomorrow, store as never)).toBe(false);
    expect(evaluateBackupReminder(tomorrow, store.getItem(BACKUP_REMINDER_KEY), true).reason).toBe('stale');
  });
});
