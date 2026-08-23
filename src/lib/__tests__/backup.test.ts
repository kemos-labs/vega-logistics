// Backup integrity tests — P1 gate (reviewer contract, COMMIT B §6).
import { describe, expect, it } from 'vitest';

import {
  applyBackupMerge,
  buildBackup,
  mergeDailyRecords,
  parseBackup,
  replaceWithBackup,
  type FollowUpAction,
  type StateBundle,
} from '@/lib/backup';
import type { DailyRecord } from '@/lib/operationsReporting';
import type { RecoveryEntry } from '@/lib/recoveryBoard';
import type { Scenario } from '@/lib/scenarios';
import { defaultFinancialInput } from '@/lib/mockData';

function record(date: string, completed: number, failed: number, extra: Partial<DailyRecord> = {}): DailyRecord {
  return {
    date,
    completedShipments: completed,
    failedShipments: failed,
    fuelCost: 120,
    driversPresent: 3,
    notes: '',
    updatedAt: `${date}T18:00:00.000Z`,
    ...extra,
  };
}

const scenario = (id: string, savedAt: string): Scenario => ({
  id,
  name: id,
  savedAt,
  input: structuredClone(defaultFinancialInput),
});

const recovery = (id: string, createdAt: string, status: RecoveryEntry['status'], resolvedAt?: string): RecoveryEntry => ({
  id,
  createdAt,
  shipments: 2,
  owner: 'Yaquob',
  status,
  ...(resolvedAt ? { resolvedAt } : {}),
});

const action = (id: number, done = false): FollowUpAction => ({ id, text: `Action ${id}: review pricing`, owner: 'Ops', done });

function fullBundle(): StateBundle {
  return {
    financialInput: structuredClone(defaultFinancialInput),
    dailyRecords: {
      '2026-08-20': record('2026-08-20', 37, 14),
      '2026-08-21': record('2026-08-21', 40, 8),
    },
    scenarios: [scenario('scn-1', '2026-08-01T10:00:00.000Z')],
    recoveryEntries: [recovery('rec-1', '2026-08-19', 'recovered', '2026-08-21T12:00:00.000Z')],
    followUpActions: [action(1), action(2, true)],
  };
}

describe('backup round-trip (export → JSON → import)', () => {
  it('replace mode reproduces the original state by deep equality', () => {
    const bundle = fullBundle();
    const json = JSON.stringify(buildBackup(bundle));
    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const next = replaceWithBackup(bundle, parsed.file);
    expect(next).toEqual(bundle); // toEqual treats undefined-absent as equal
    expect(Object.keys(next.dailyRecords)).toEqual(['2026-08-20', '2026-08-21']);
  });
});

describe('every optional DailyRecord field survives', () => {
  it('round-trips every documented optional field', () => {
    const rich = record('2026-08-22', 25, 5, {
      tomorrowNote: 'Recover Al-Nahdi misses first',
      failureReasons: { addressIssue: 2, customerUnavailable: 3 },
      extraCosts: 85,
      newCustomerVisits: 2,
      recoveredShipments: 4,
      safetyIncidents: 1,
      customerBreakdown: { 'Yaquob Abdulqader': { delivered: 20, missed: 4 }, 'Ninja': { delivered: 5, missed: 1 } },
      podStatus: 'complete',
      driverName: 'يعقوب عبدالقادر',
      carNumber: '10',
      plateNumber: '4684',
      codShipments: 18,
      prepaidShipments: 7,
      cashCollectedSar: 940,
      cashRemittedSar: 900,
      weatherCondition: 'sand',
    });
    const bundle: StateBundle = { ...fullBundle(), dailyRecords: { '2026-08-22': rich } };
    const json = JSON.stringify(buildBackup(bundle));
    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const restored = replaceWithBackup(bundle, parsed.file).dailyRecords['2026-08-22'];
    expect(restored).toEqual(rich);
    // spot-check every optional field explicitly (guard against silent drops)
    expect(restored.tomorrowNote).toBe('Recover Al-Nahdi misses first');
    expect(restored.failureReasons).toEqual({ addressIssue: 2, customerUnavailable: 3 });
    expect(restored.extraCosts).toBe(85);
    expect(restored.newCustomerVisits).toBe(2);
    expect(restored.recoveredShipments).toBe(4);
    expect(restored.safetyIncidents).toBe(1);
    expect(restored.customerBreakdown?.['Ninja']).toEqual({ delivered: 5, missed: 1 });
    expect(restored.podStatus).toBe('complete');
    expect(restored.driverName).toBe('يعقوب عبدالقادر');
    expect(restored.carNumber).toBe('10');
    expect(restored.plateNumber).toBe('4684');
    expect(restored.codShipments).toBe(18);
    expect(restored.prepaidShipments).toBe(7);
    expect(restored.cashCollectedSar).toBe(940);
    expect(restored.cashRemittedSar).toBe(900);
    expect(restored.weatherCondition).toBe('sand');
  });
});

describe('scenarios, recovery entries and follow-up actions survive', () => {
  it('carries all collections through a v2 file', () => {
    const bundle = fullBundle();
    const parsed = parseBackup(JSON.stringify(buildBackup(bundle)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const next = replaceWithBackup(bundle, parsed.file);
    expect(next.scenarios).toEqual(bundle.scenarios);
    expect(next.recoveryEntries).toEqual(bundle.recoveryEntries);
    expect(next.followUpActions).toEqual(bundle.followUpActions);
  });
});

describe('corrupt data is rejected without deleting current data', () => {
  it('rejects malformed inputs with typed errors and never mutates state', () => {
    const bundle = fullBundle();
    const before = structuredClone(bundle);
    for (const [label, raw] of [
      ['truncated json', '{"format":"vega-logistics-backup","version":2,"data":{'],
      ['not an object', '[1,2,3]'],
      ['wrong version', JSON.stringify({ format: 'vega-logistics-backup', version: 99, data: {} })],
      ['wrong format', JSON.stringify({ version: 2, data: {} })],
      ['missing financials', JSON.stringify({ format: 'vega-logistics-backup', version: 2, exportedAt: '', data: {} })],
    ] as const) {
      const parsed = parseBackup(raw);
      expect(parsed.ok, label).toBe(false);
    }
    expect(bundle).toEqual(before); // nothing touched
  });

  it('drops corrupt day records instead of importing phantom zeros', () => {
    const raw = JSON.stringify({
      format: 'vega-logistics-backup',
      version: 2,
      exportedAt: '2026-08-23T09:00:00.000Z',
      data: {
        financialInput: defaultFinancialInput,
        dailyRecords: {
          '2026-08-20': { date: '2026-08-20', completedShipments: 'many', failedShipments: null, fuelCost: 0, driversPresent: 0, notes: '', updatedAt: '' },
          '2026-08-21': record('2026-08-21', 10, 2),
        },
      },
    });
    const parsed = parseBackup(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(Object.keys(parsed.file.data.dailyRecords)).toEqual(['2026-08-21']);
  });
});

describe('v1 migration works', () => {
  it('maps legacy ModelBackup into the v2 envelope', () => {
    const v1 = {
      version: 1,
      exportedAt: '2026-07-01T08:00:00.000Z',
      input: structuredClone(defaultFinancialInput),
      dailyRecords: { '2026-06-30': record('2026-06-30', 30, 6) },
      scenarios: [scenario('scn-old', '2026-06-01T00:00:00.000Z')],
    };
    const parsed = parseBackup(JSON.stringify(v1));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.migratedFrom).toBe(1);
    expect(parsed.file.version).toBe(2);
    expect(parsed.file.data.dailyRecords['2026-06-30'].completedShipments).toBe(30);
    expect(parsed.file.data.scenarios[0].id).toBe('scn-old');
    // collections that did not exist in v1 arrive empty, not undefined
    expect(parsed.file.data.recoveryEntries).toEqual([]);
    expect(parsed.file.data.followUpActions).toEqual([]);
  });
});

describe('merge conflicts behave deterministically', () => {
  it('newer updatedAt wins; ties keep local; counts are exact and order-stable', () => {
    const local: Record<string, DailyRecord> = {
      '2026-08-20': record('2026-08-20', 37, 14, { updatedAt: '2026-08-20T18:00:00.000Z' }),
      '2026-08-21': record('2026-08-21', 40, 8, { updatedAt: '2026-08-21T18:00:00.000Z' }),
    };
    const incoming: Record<string, DailyRecord> = {
      // newer → updated
      '2026-08-20': record('2026-08-20', 51, 0, { updatedAt: '2026-08-20T19:30:00.000Z' }),
      // older tie/loss → conflict, local kept
      '2026-08-21': record('2026-08-21', 1, 1, { updatedAt: '2026-08-21T09:00:00.000Z' }),
      // brand-new → added
      '2026-08-22': record('2026-08-22', 33, 3),
    };
    const first = mergeDailyRecords(local, incoming);
    expect(first.stats).toEqual({ added: 1, updated: 1, conflicts: 1 });
    expect(first.merged['2026-08-20'].completedShipments).toBe(51);
    expect(first.merged['2026-08-21'].completedShipments).toBe(40);

    // swapped roles: the 3-day side now holds everything → nothing "added",
    // but the same deterministic timestamps pick the SAME winners
    const second = mergeDailyRecords(incoming, local);
    expect(second.stats).toEqual({ added: 0, updated: 1, conflicts: 1 });
    expect(second.merged['2026-08-20'].completedShipments).toBe(51); // newer wins both ways
    expect(second.merged['2026-08-21'].completedShipments).toBe(40); // tie/older loses both ways
  });

  it('applyBackupMerge keeps singleton model inputs and surfaces them as conflicts', () => {
    const current = fullBundle();
    const incomingState: StateBundle = {
      ...structuredClone(current),
      financialInput: { ...structuredClone(defaultFinancialInput), companyDriverCount: 9 },
      dailyRecords: {
        '2026-08-20': record('2026-08-20', 99, 0, { updatedAt: '2026-08-20T20:00:00.000Z' }),
      },
    };
    const parsed = parseBackup(JSON.stringify(buildBackup(incomingState)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const { next, stats } = applyBackupMerge(current, parsed.file);
    // incoming day (20:00) beats local (18:00) → updated; differing model
    // inputs are kept and surfaced as the visible conflict
    expect(stats).toEqual({ added: 0, updated: 1, conflicts: 1 });
    expect(next.financialInput.companyDriverCount).not.toBe(9); // merge never overwrites inputs
    expect(next.dailyRecords['2026-08-20'].completedShipments).toBe(99); // incoming (20:00) beat local (18:00)

    // repeated application converges to the identical state
    const again = applyBackupMerge(next, parsed.file);
    expect(again.next).toEqual(next);
    expect(again.stats).toEqual({ added: 0, updated: 0, conflicts: 2 }); // day tie + inputs still differ
  });

  it('replace mode adopts everything, including model inputs', () => {
    const current = fullBundle();
    const incomingState: StateBundle = {
      ...structuredClone(current),
      financialInput: { ...structuredClone(defaultFinancialInput), companyDriverCount: 9 },
    };
    const parsed = parseBackup(JSON.stringify(buildBackup(incomingState)));
    if (!parsed.ok) throw new Error('parse failed');
    const next = replaceWithBackup(current, parsed.file);
    expect(next.financialInput.companyDriverCount).toBe(9);
    expect(next.recoveryEntries.length).toBe(1);
  });
});
