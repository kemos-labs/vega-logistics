import { describe, expect, it } from 'vitest';
import { calculateFinancials } from '../calculations';
import { defaultFinancialInput } from '../mockData';
import { buildProjection, calculateDailyMetrics, type DailyRecord } from '../operationsReporting';

describe('company baseline', () => {
  it('models 200 shipments per day with one driver for each of 4 cars', () => {
    const result = calculateFinancials(structuredClone(defaultFinancialInput));
    const cars = defaultFinancialInput.vehicleClasses.reduce((sum, row) => sum + row.quantity, 0);

    expect(cars).toBe(4);
    expect(defaultFinancialInput.companyDriverCount).toBe(4);
    expect(defaultFinancialInput.drivers).toHaveLength(4);
    expect(result.totalDailyShipments).toBe(200);
    expect(result.totalMonthlyShipments).toBe(5_200);
  });

  it('uses only the supplied baseline costs with no hidden insurance or software charges', () => {
    const result = calculateFinancials(structuredClone(defaultFinancialInput));

    expect(result.fuelMonthlyCost).toBeCloseTo(3_787.992, 3);
    expect(result.costBreakdown.people).toBe(20_000);
    expect(result.costBreakdown.facilities).toBe(7_500);
    expect(result.costBreakdown.other).toBe(0);
    expect(result.totalCost).toBeCloseTo(31_287.992, 3);
  });

  it('calculates a recorded daily report without counting fuel twice', () => {
    const result = calculateFinancials(structuredClone(defaultFinancialInput));
    const record: DailyRecord = { date: '2026-08-20', completedShipments: 190, failedShipments: 10, fuelCost: 68.4, driversPresent: 4, notes: '', updatedAt: '' };
    const metrics = calculateDailyMetrics(record, defaultFinancialInput, result);

    expect(metrics.recordedAttempts).toBe(200);
    expect(metrics.completionRate).toBe(95);
    expect(metrics.revenue).toBeCloseTo(1_795.5, 1);
    expect(metrics.allocatedCost).toBeCloseTo(result.totalCost / 26, 6);
    expect(metrics.profit).toBeCloseTo(metrics.revenue - metrics.allocatedCost, 6);
  });

  it('replaces projection values with recorded daily shipments', () => {
    const result = calculateFinancials(structuredClone(defaultFinancialInput));
    const record: DailyRecord = { date: '2026-08-20', completedShipments: 190, failedShipments: 10, fuelCost: 68.4, driversPresent: 4, notes: '', updatedAt: '' };
    const trend = buildProjection(result, 14, { [record.date]: record }, new Date(2026, 7, 20, 12, 0, 0));

    expect(trend).toHaveLength(14);
    expect(trend.at(-1)).toMatchObject({ date: '2026-08-20', shipments: 190, recorded: true });
  });
});
