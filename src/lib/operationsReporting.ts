import type { FinancialInput, FinancialOutput } from '@/lib/types';

export interface DailyRecord {
  date: string;
  completedShipments: number;
  failedShipments: number;
  fuelLitres: number;
  driversPresent: number;
  notes: string;
  updatedAt: string;
}

export interface DailyMetrics {
  plannedShipments: number;
  recordedAttempts: number;
  completionRate: number;
  revenue: number;
  allocatedCost: number;
  profit: number;
  fuelCost: number;
}

export const WORKING_DAYS_PER_MONTH = 26;

export function calculateDailyMetrics(record: DailyRecord, input: FinancialInput, output: FinancialOutput): DailyMetrics {
  const recordedAttempts = record.completedShipments + record.failedShipments;
  const revenue = record.completedShipments * output.avgRevenuePerShipment;
  const allocatedCost = output.totalCost / WORKING_DAYS_PER_MONTH;
  return {
    plannedShipments: output.totalDailyShipments,
    recordedAttempts,
    completionRate: recordedAttempts > 0 ? record.completedShipments / recordedAttempts * 100 : 0,
    revenue,
    allocatedCost,
    profit: revenue - allocatedCost,
    fuelCost: record.fuelLitres * input.fuelPricePerLiter,
  };
}

export function buildProjection(output: FinancialOutput, days: number, records: Record<string, DailyRecord>, endDate = new Date()) {
  const factors = [0.92, 0.97, 1.03, 1, 1.06, 0.95, 1.02];
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(endDate);
    date.setUTCDate(endDate.getUTCDate() - (days - index - 1));
    const key = date.toISOString().slice(0, 10);
    const record = records[key];
    const factor = factors[index % factors.length];
    return {
      date: key,
      label: key.slice(5),
      revenue: record ? record.completedShipments * output.avgRevenuePerShipment : output.totalRevenue / WORKING_DAYS_PER_MONTH * factor,
      cost: output.totalCost / WORKING_DAYS_PER_MONTH,
      shipments: record ? record.completedShipments : Math.round(output.totalDailyShipments * factor),
      recorded: Boolean(record),
    };
  });
}
