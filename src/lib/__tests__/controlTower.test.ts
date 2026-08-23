// Control Tower selectors — deterministic, recorded-data-only (Release R1).
import { describe, expect, it } from 'vitest';

import { buildControlTowerSnapshot, yesterdayKey, type ControlTowerInput } from '@/lib/controlTower';
import { toDateString } from '@/lib/operationsReporting';
import type { DailyRecord } from '@/lib/operationsReporting';
import type { RecoveryEntry } from '@/lib/recoveryBoard';

const NOW = new Date('2026-08-23T12:00:00+03:00').getTime(); // Sunday noon Riyadh

function record(overrides: Partial<DailyRecord> & { date: string }): DailyRecord {
  return {
    completedShipments: 0, failedShipments: 0, fuelCost: 0, driversPresent: 1,
    notes: '', updatedAt: '2026-01-01T00:00:00Z', ...overrides,
  };
}

function recovery(overrides: Partial<RecoveryEntry> & { id: string }): RecoveryEntry {
  return {
    createdAt: '2026-08-20', shipments: 2, owner: 'owner', status: 'pending',
    ...overrides,
  } as RecoveryEntry;
}

function snap(over: Partial<ControlTowerInput> = {}) {
  return buildControlTowerSnapshot({
    records: {}, recoveryEntries: [], plannedShipmentsPerDay: 100,
    nowMs: NOW, backup: null, ...over,
  });
}

describe('yesterdayKey (local-time law)', () => {
  it('uses LOCAL calendar arithmetic — never a UTC slice (zone-portable proof)', () => {
    // The law: yesterdayKey(ms) === local toDateString(ms − 24h) for ANY zone.
    // (A UTC slice coincides in SOME zones/instants — the positive law above is the invariant.)
    for (const iso of ['2026-08-23T01:00:00+03:00', '2026-08-23T20:00:00-05:00', '2026-01-01T00:30:00+03:00']) {
      const ms = new Date(iso).getTime();
      const expected = toDateString(new Date(ms - 86_400_000));
      expect(yesterdayKey(ms)).toBe(expected);
    }
  });
});

describe('buildControlTowerSnapshot', () => {
  it('yesterday with data reports planned vs delivered/failed/recovered', () => {
    const s = snap({ records: { '2026-08-22': record({ date: '2026-08-22', completedShipments: 82, failedShipments: 9, recoveredShipments: 4 }) } });
    expect(s.yesterday).toEqual({ date: '2026-08-22', planned: 100, delivered: 82, failed: 9, recovered: 4, hasData: true });
  });

  it('missing yesterday is honest "no data" — never zero-filled — and raises record-yesterday action', () => {
    const s = snap({});
    expect(s.yesterday).toBeNull();
    expect(s.actions.some(a => a.id === 'record-yesterday')).toBe(true);
  });

  it('COD outstanding nets collected − remitted across all recorded days', () => {
    const s = snap({
      records: {
        '2026-08-21': record({ date: '2026-08-21', cashCollectedSar: 500, cashRemittedSar: 300 }),
        '2026-08-22': record({ date: '2026-08-22', cashCollectedSar: 200, cashRemittedSar: 250 }),
      },
    });
    expect(s.codOutstandingSar).toBe(150); // (500+200) − (300+250); remittances pay down older cash
  });

  it('over-remittance never displays as negative “outstanding” (clamped ≥ 0)', () => {
    const s = snap({
      records: { '2026-08-22': record({ date: '2026-08-22', cashCollectedSar: 100, cashRemittedSar: 400 }) },
    });
    expect(s.codOutstandingSar).toBe(0);
    expect(s.actions.some(a => a.id === 'cod-outstanding')).toBe(false);
  });

  it('actions are severity-sorted BEFORE slicing: backup-stale cannot be displaced by mediums', () => {
    const s = snap({
      records: {
        '2026-08-22': record({ date: '2026-08-22', failedShipments: 5, podStatus: 'partial', cashCollectedSar: 400 }),
      },
      backup: { visible: true, reason: 'stale', daysSince: 12 }, // high severity, pushed AFTER two mediums pre-fix
    });
    expect(s.actions.map(a => a.id)).toEqual(['backup-stale', 'cod-outstanding', 'failed-yesterday']); // domain priority: data-loss risk above cash
    // the regression: pre-fix, insertion order let pod-gaps/failed (mediums)
    // occupy the slice while backup-stale (high) fell off the list entirely
    expect(s.actions.slice(0, 2).every(a => a.severity === 'high')).toBe(true);
    expect(s.actions.some(a => a.id === 'backup-stale')).toBe(true);
    expect(s.actions.some(a => a.id === 'pod-gaps')).toBe(false);
  });

  it('POD gaps list partial/none dates newest first; complete/absent ignored', () => {
    const s = snap({
      records: {
        '2026-08-18': record({ date: '2026-08-18', podStatus: 'none' }),
        '2026-08-21': record({ date: '2026-08-21', podStatus: 'partial' }),
        '2026-08-22': record({ date: '2026-08-22', podStatus: 'complete' }),
        '2026-08-20': record({ date: '2026-08-20' }),
      },
    });
    expect(s.podGapDates).toEqual(['2026-08-21', '2026-08-18']);
  });

  it('recovery aging counts open entries and >7d overdue separately', () => {
    const s = snap({
      recoveryEntries: [
        recovery({ id: 'a', createdAt: '2026-08-10' }),            // overdue
        recovery({ id: 'b', createdAt: '2026-08-22' }),            // fresh open
        recovery({ id: 'c', createdAt: '2026-08-12', status: 'recovered' }), // closed
      ],
    });
    expect(s.recoveryOpen).toBe(2);
    expect(s.recoveryOverdue).toBe(1);
  });

  it('top actions are severity-ordered and capped at three', () => {
    const s = snap({
      records: {
        '2026-08-22': record({ date: '2026-08-22', failedShipments: 5, cashCollectedSar: 400, podStatus: 'partial' }),
      },
      recoveryEntries: [recovery({ id: 'a', createdAt: '2026-08-01' })],
      backup: { visible: true, reason: 'stale', daysSince: 9 },
    });
    expect(s.actions.length).toBe(3);
    expect(['recovery-overdue','cod-outstanding']).toContain(s.actions[0].id);
    expect(s.actions[1].severity).toBe('high');
  });

  it('clean operation produces zero actions', () => {
    const s = snap({
      records: { '2026-08-22': record({ date: '2026-08-22', completedShipments: 92, failedShipments: 0, cashCollectedSar: 100, cashRemittedSar: 100, podStatus: 'complete' }) },
      backup: { visible: false, reason: 'fresh', daysSince: 1 },
    });
    expect(s.actions).toEqual([]);
    expect(s.recoveryOpen).toBe(0);
  });
});
