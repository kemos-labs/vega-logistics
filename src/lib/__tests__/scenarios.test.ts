import { describe, it, expect } from 'vitest';
import { buildBackup, createScenario, parseBackup } from '@/lib/scenarios';
import { defaultFinancialInput } from '@/lib/mockData';
import { buildMonthlyRollup, type DailyRecord } from '@/lib/operationsReporting';
import { calculateFinancials } from '@/lib/calculations';

describe('scenario snapshots', () => {
  it('creates a sanitized snapshot with fallback name', () => {
    const s = createScenario('  Fuel +20%  ', defaultFinancialInput, []);
    expect(s.name).toBe('Fuel +20%');
    expect(s.input).not.toBe(defaultFinancialInput);
    expect(s.input.vehicleClasses.length).toBeGreaterThan(0);
  });

  it('falls back to numbered name when blank', () => {
    const existing = [createScenario('a', defaultFinancialInput, [])];
    const s = createScenario('   ', defaultFinancialInput, existing);
    expect(s.name).toBe('Scenario 2');
  });

  it('snapshot survives round-trip through JSON with identical outputs', () => {
    const s = createScenario('base', defaultFinancialInput, []);
    const restored = JSON.parse(JSON.stringify(s));
    const a = calculateFinancials(s.input);
    const b = calculateFinancials(restored.input);
    expect(b.totalRevenue).toBeCloseTo(a.totalRevenue, 6);
    expect(b.totalCost).toBeCloseTo(a.totalCost, 6);
  });
});

describe('backup parse/validate', () => {
  it('accepts a valid backup and sanitizes input', () => {
    const backup = buildBackup(defaultFinancialInput, {}, []);
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed).not.toBeNull();
    expect(parsed!.input.vehicleClasses.length).toBeGreaterThan(0);
  });

  it('rejects garbage, wrong version, missing arrays', () => {
    expect(parseBackup('not json')).toBeNull();
    expect(parseBackup('{"version":2,"input":{}}')).toBeNull();
    expect(parseBackup(JSON.stringify({ version: 1, input: { drivers: [] } }))).toBeNull();
    expect(parseBackup('[]')).toBeNull();
  });

  it('filters invalid daily records but keeps good ones', () => {
    const backup = buildBackup(defaultFinancialInput, {
      '2026-08-20': { date: '2026-08-20', completedShipments: 10, failedShipments: 1, fuelLitres: 5, driversPresent: 3, notes: 'ok', updatedAt: '' },
      'bad-date': { date: 'bad-date', completedShipments: 9, failedShipments: 0, fuelLitres: 0, driversPresent: 0, notes: '', updatedAt: '' },
      '2026-08-21': { date: '2026-08-21', completedShipments: NaN, failedShipments: 'x', fuelLitres: null, driversPresent: {}, notes: 42, updatedAt: 7 } as unknown as DailyRecord,
    }, []);
    const parsed = parseBackup(JSON.stringify(backup))!;
    expect(Object.keys(parsed.dailyRecords)).toEqual(['2026-08-20']);
  });
});

describe('monthly variance rollup', () => {
  const output = calculateFinancials(defaultFinancialInput);
  const record = (date: string, completed: number): DailyRecord => ({ date, completedShipments: completed, failedShipments: 0, fuelLitres: 10, driversPresent: 4, notes: '', updatedAt: '' });

  it('aggregates by month newest first with variance', () => {
    const rollups = buildMonthlyRollup({
      '2026-08-01': record('2026-08-01', 130),
      '2026-08-02': record('2026-08-02', 140),
      '2026-07-15': record('2026-07-15', 100),
    }, output, 2.18);
    expect(rollups.map(r => r.month)).toEqual(['2026-08', '2026-07']);
    const aug = rollups[0];
    expect(aug.recordedDays).toBe(2);
    expect(aug.completedShipments).toBe(270);
    expect(aug.completionRate).toBe(100);
    expect(aug.plannedRevenue).toBeCloseTo((output.totalRevenue / 26) * 2, 6);
    expect(aug.variancePercent).toBeCloseTo(((aug.actualRevenue - aug.plannedRevenue) / aug.plannedRevenue) * 100, 6);
  });

  it('handles empty records', () => {
    expect(buildMonthlyRollup({}, output, 2.18)).toEqual([]);
  });
});
