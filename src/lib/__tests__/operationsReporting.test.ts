import { describe, it, expect } from 'vitest';
import {
  buildDriverPerformance,
  buildCodRemittanceLag,
  buildFuelControl,
  buildFailurePareto,
  driverIdentityKey,
  type DailyRecord,
  type FailureReasonKey,
} from '@/lib/operationsReporting';
import { calculateFinancials } from '@/lib/calculations';
import { defaultFinancialInput } from '@/lib/mockData';

const output = calculateFinancials(defaultFinancialInput);

const stop = (overrides: { driverName?: string; carNumber?: string; plateNumber?: string; status: string; operationDate: string }) => ({
  driverName: overrides.driverName,
  carNumber: overrides.carNumber,
  plateNumber: overrides.plateNumber,
  status: overrides.status,
  operationDate: overrides.operationDate,
});

const record = (date: string, overrides: Partial<DailyRecord> = {}): DailyRecord => ({
  date,
  completedShipments: 10,
  failedShipments: 2,
  fuelCost: 100,
  driversPresent: 3,
  notes: '',
  updatedAt: '2026-08-01T10:00:00.000Z',
  ...overrides,
});

describe('R6 — driverIdentityKey', () => {
  it('builds a stable key from driver + car + plate', () => {
    expect(driverIdentityKey('Ahmed', '10', 'ABC123')).toBe('Ahmed|10|ABC123');
  });

  it('falls back to em-dash for missing fields', () => {
    expect(driverIdentityKey('Ahmed')).toBe('Ahmed|—|—');
  });
});

describe('R6 — buildDriverPerformance', () => {
  it('aggregates stops by driver identity, worst miss rate first', () => {
    const stops = [
      stop({ driverName: 'Ahmed', carNumber: '10', plateNumber: 'ABC', status: 'delivered', operationDate: '2026-08-10' }),
      stop({ driverName: 'Ahmed', carNumber: '10', plateNumber: 'ABC', status: 'delivered', operationDate: '2026-08-10' }),
      stop({ driverName: 'Ahmed', carNumber: '10', plateNumber: 'ABC', status: 'failed', operationDate: '2026-08-10' }),
      stop({ driverName: 'Sara', carNumber: '20', plateNumber: 'XYZ', status: 'delivered', operationDate: '2026-08-10' }),
      stop({ driverName: 'Sara', carNumber: '20', plateNumber: 'XYZ', status: 'delivered', operationDate: '2026-08-10' }),
    ];
    const rows = buildDriverPerformance(stops);
    expect(rows).toHaveLength(2);
    // Sara 0% miss, Ahmed 33% miss → Ahmed first (worst)
    expect(rows[0]).toMatchObject({ driverName: 'Ahmed', delivered: 2, missed: 1, attempts: 3 });
    expect(rows[0].missRatePercent).toBeCloseTo(33.33, 1);
    expect(rows[1]).toMatchObject({ driverName: 'Sara', delivered: 2, missed: 0, attempts: 2 });
    expect(rows[1].missRatePercent).toBe(0);
  });

  it('treats failed + returned as misses, ignores planned/pending', () => {
    const stops = [
      stop({ driverName: 'Ahmed', status: 'delivered', operationDate: '2026-08-10' }),
      stop({ driverName: 'Ahmed', status: 'failed', operationDate: '2026-08-10' }),
      stop({ driverName: 'Ahmed', status: 'returned', operationDate: '2026-08-10' }),
      stop({ driverName: 'Ahmed', status: 'planned', operationDate: '2026-08-10' }),
      stop({ driverName: 'Ahmed', status: 'pending', operationDate: '2026-08-10' }),
    ];
    const rows = buildDriverPerformance(stops);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ delivered: 1, missed: 2, attempts: 3 });
  });

  it('omits stops without a driver name', () => {
    const stops = [
      stop({ status: 'delivered', operationDate: '2026-08-10' }),
      stop({ driverName: 'Ahmed', status: 'delivered', operationDate: '2026-08-10' }),
    ];
    const rows = buildDriverPerformance(stops);
    expect(rows).toHaveLength(1);
    expect(rows[0].driverName).toBe('Ahmed');
  });

  it('returns empty array when no stops have drivers', () => {
    const stops = [
      stop({ status: 'delivered', operationDate: '2026-08-10' }),
    ];
    expect(buildDriverPerformance(stops)).toEqual([]);
  });

  it('groups same driver with different cars as separate rows', () => {
    const stops = [
      stop({ driverName: 'Ahmed', carNumber: '10', status: 'delivered', operationDate: '2026-08-10' }),
      stop({ driverName: 'Ahmed', carNumber: '20', status: 'failed', operationDate: '2026-08-10' }),
    ];
    const rows = buildDriverPerformance(stops);
    expect(rows).toHaveLength(2);
  });
});

describe('R6 — buildCodRemittanceLag', () => {
  it('computes lag days between operation and remittance date', () => {
    const records = {
      '2026-08-10': record('2026-08-10', { cashCollectedSar: 500, cashRemittedSar: 500, codRemittedOn: '2026-08-12' }),
      '2026-08-11': record('2026-08-11', { cashCollectedSar: 300, cashRemittedSar: 300, codRemittedOn: '2026-08-11' }),
    };
    const points = buildCodRemittanceLag(records);
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ date: '2026-08-10', lagDays: 2, collected: 500, remitted: 500 });
    expect(points[1]).toMatchObject({ date: '2026-08-11', lagDays: 0, collected: 300, remitted: 300 });
  });

  it('excludes records without a valid remittance date', () => {
    const records = {
      '2026-08-10': record('2026-08-10', { cashCollectedSar: 500 }),
      '2026-08-11': record('2026-08-11', { codRemittedOn: 'not-a-date' }),
    };
    expect(buildCodRemittanceLag(records)).toEqual([]);
  });

  it('excludes draft records', () => {
    const records = {
      '2026-08-10': record('2026-08-10', { closeStatus: 'draft', codRemittedOn: '2026-08-12' }),
      '2026-08-11': record('2026-08-11', { closeStatus: 'reconciled', codRemittedOn: '2026-08-12' }),
    };
    const points = buildCodRemittanceLag(records);
    expect(points).toHaveLength(1);
    expect(points[0].date).toBe('2026-08-11');
  });

  it('sorts chronologically', () => {
    const records = {
      '2026-08-12': record('2026-08-12', { codRemittedOn: '2026-08-13' }),
      '2026-08-10': record('2026-08-10', { codRemittedOn: '2026-08-11' }),
    };
    const points = buildCodRemittanceLag(records);
    expect(points.map(p => p.date)).toEqual(['2026-08-10', '2026-08-12']);
  });
});

describe('R6 — buildFuelControl', () => {
  it('computes fuel cost vs model daily expectation', () => {
    const modelDaily = output.fuelMonthlyCost / 26;
    const records = {
      '2026-08-10': record('2026-08-10', { fuelCost: modelDaily * 1.2 }),
      '2026-08-11': record('2026-08-11', { fuelCost: modelDaily * 0.8 }),
    };
    const points = buildFuelControl(records, output);
    expect(points).toHaveLength(2);
    expect(points[0].actual).toBeCloseTo(modelDaily * 1.2, 2);
    expect(points[0].model).toBeCloseTo(modelDaily, 2);
    expect(points[0].variancePercent).toBeCloseTo(20, 1);
    expect(points[1].variancePercent).toBeCloseTo(-20, 1);
  });

  it('excludes draft records', () => {
    const records = {
      '2026-08-10': record('2026-08-10', { closeStatus: 'draft', fuelCost: 999 }),
      '2026-08-11': record('2026-08-11', { closeStatus: 'reconciled', fuelCost: 100 }),
    };
    const points = buildFuelControl(records, output);
    expect(points).toHaveLength(1);
    expect(points[0].date).toBe('2026-08-11');
  });

  it('sorts chronologically', () => {
    const records = {
      '2026-08-12': record('2026-08-12', { fuelCost: 100 }),
      '2026-08-10': record('2026-08-10', { fuelCost: 100 }),
    };
    const points = buildFuelControl(records, output);
    expect(points.map(p => p.date)).toEqual(['2026-08-10', '2026-08-12']);
  });
});

describe('R6 — buildFailurePareto', () => {
  it('computes count, share, and cumulative share', () => {
    const records = [
      record('2026-08-10', { failureReasons: { noDriver: 5, addressIssue: 3, other: 2 } }),
    ];
    const pareto = buildFailurePareto(records);
    expect(pareto).toHaveLength(3);
    // Sorted by count desc: noDriver(5), addressIssue(3), other(2)
    expect(pareto[0]).toMatchObject({ key: 'noDriver', count: 5, percent: 50, cumulativePercent: 50 });
    expect(pareto[1]).toMatchObject({ key: 'addressIssue', count: 3, percent: 30, cumulativePercent: 80 });
    expect(pareto[2]).toMatchObject({ key: 'other', count: 2, percent: 20, cumulativePercent: 100 });
  });

  it('aggregates across multiple records', () => {
    const records = [
      record('2026-08-10', { failureReasons: { noDriver: 2 } }),
      record('2026-08-11', { failureReasons: { noDriver: 3, addressIssue: 5 } }),
    ];
    const pareto = buildFailurePareto(records);
    expect(pareto[0]).toMatchObject({ key: 'noDriver', count: 5 });
    expect(pareto[1]).toMatchObject({ key: 'addressIssue', count: 5 });
  });

  it('returns empty array when no failure reasons exist', () => {
    const records = [record('2026-08-10')];
    expect(buildFailurePareto(records)).toEqual([]);
  });

  it('ignores zero/negative reason counters', () => {
    const records = [record('2026-08-10', { failureReasons: { noDriver: 0, addressIssue: -2, other: 3 } })];
    const pareto = buildFailurePareto(records);
    expect(pareto).toHaveLength(1);
    expect(pareto[0].key).toBe('other');
  });
});

describe('R6 — recorded-data-only provenance', () => {
  it('buildDriverPerformance uses only stop-level data (no financial assumptions)', () => {
    const stops = [
      stop({ driverName: 'Ahmed', status: 'delivered', operationDate: '2026-08-10' }),
      stop({ driverName: 'Ahmed', status: 'failed', operationDate: '2026-08-10' }),
    ];
    const rows = buildDriverPerformance(stops);
    expect(rows[0]).toMatchObject({ delivered: 1, missed: 1, attempts: 2 });
  });

  it('buildCodRemittanceLag uses only recorded DailyRecord fields', () => {
    const records = {
      '2026-08-10': record('2026-08-10', { cashCollectedSar: 500, cashRemittedSar: 500, codRemittedOn: '2026-08-12' }),
    };
    const points = buildCodRemittanceLag(records);
    expect(points[0]).toMatchObject({ lagDays: 2, collected: 500, remitted: 500 });
  });

  it('buildFuelControl uses only recorded fuelCost vs model', () => {
    const records = { '2026-08-10': record('2026-08-10', { fuelCost: 200 }) };
    const points = buildFuelControl(records, output);
    expect(points[0].actual).toBe(200);
    expect(points[0].model).toBeCloseTo(output.fuelMonthlyCost / 26, 2);
  });

  it('buildFailurePareto uses only recorded failureReasons', () => {
    const records = [record('2026-08-10', { failureReasons: { noDriver: 5 } })];
    const pareto = buildFailurePareto(records);
    expect(pareto[0]).toMatchObject({ key: 'noDriver' as FailureReasonKey, count: 5 });
  });

  it('drafts are excluded from all R6 metrics', () => {
    const draftRecord = record('2026-08-10', {
      closeStatus: 'draft',
      fuelCost: 999,
      cashCollectedSar: 999,
      codRemittedOn: '2026-08-12',
      failureReasons: { noDriver: 99 },
    });
    const reconciledRecord = record('2026-08-11', {
      closeStatus: 'reconciled',
      fuelCost: 100,
      cashCollectedSar: 500,
      cashRemittedSar: 500,
      codRemittedOn: '2026-08-12',
      failureReasons: { noDriver: 2 },
    });
    const records = { '2026-08-10': draftRecord, '2026-08-11': reconciledRecord };

    expect(buildCodRemittanceLag(records)).toHaveLength(1);
    expect(buildCodRemittanceLag(records)[0].date).toBe('2026-08-11');

    expect(buildFuelControl(records, output)).toHaveLength(1);
    expect(buildFuelControl(records, output)[0].date).toBe('2026-08-11');

    expect(buildFailurePareto(Object.values(records))[0]).toMatchObject({ count: 2 });
  });
});
