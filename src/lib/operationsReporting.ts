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

/** Local-timezone YYYY-MM-DD key. Never use UTC ISO slices for "today" —
 *  Saudi Arabia (UTC+3) would misfile reports between 00:00 and 03:00. */
export function toDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

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

export interface MonthlyRollup {
  month: string; // YYYY-MM
  recordedDays: number;
  completedShipments: number;
  failedShipments: number;
  completionRate: number; // %
  actualRevenue: number;
  plannedRevenue: number; // what the model projects for the same days
  fuelCost: number;
  variancePercent: number; // (actual - planned) / planned * 100
}

/** Aggregate recorded daily reports by month and compare against the plan. */
export function buildMonthlyRollup(records: Record<string, DailyRecord>, output: FinancialOutput, fuelPricePerLiter: number): MonthlyRollup[] {
  const months = new Map<string, { days: number; completed: number; failed: number; revenue: number; fuel: number }>();
  for (const record of Object.values(records)) {
    const month = record.date.slice(0, 7);
    const bucket = months.get(month) ?? { days: 0, completed: 0, failed: 0, revenue: 0, fuel: 0 };
    bucket.days += 1;
    bucket.completed += record.completedShipments;
    bucket.failed += record.failedShipments;
    bucket.revenue += record.completedShipments * output.avgRevenuePerShipment;
    bucket.fuel += record.fuelLitres * fuelPricePerLiter;
    months.set(month, bucket);
  }
  return [...months.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, bucket]) => {
      const plannedRevenue = (output.totalRevenue / WORKING_DAYS_PER_MONTH) * bucket.days;
      return {
        month,
        recordedDays: bucket.days,
        completedShipments: bucket.completed,
        failedShipments: bucket.failed,
        completionRate: bucket.completed + bucket.failed > 0 ? (bucket.completed / (bucket.completed + bucket.failed)) * 100 : 0,
        actualRevenue: bucket.revenue,
        plannedRevenue,
        fuelCost: bucket.fuel,
        variancePercent: plannedRevenue > 0 ? ((bucket.revenue - plannedRevenue) / plannedRevenue) * 100 : 0,
      };
    });
}

export function buildProjection(output: FinancialOutput, days: number, records: Record<string, DailyRecord>, endDate = new Date()) {
  const factors = [0.92, 0.97, 1.03, 1, 1.06, 0.95, 1.02];
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(endDate);
    date.setDate(endDate.getDate() - (days - index - 1));
    const key = toDateString(date);
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
