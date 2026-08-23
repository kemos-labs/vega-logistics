import type { FinancialInput, FinancialOutput } from '@/lib/types';

/** Structured miss accounting — feeds the miss-analysis chart and "what we
 *  lost of target" reporting. All counters optional for backward compat. */
export type FailureReasonKey =
  | 'vehicleBreakdown' | 'noDriver' | 'addressIssue'
  | 'customerUnavailable' | 'refusedDelivery' | 'weatherDelay' | 'other';

export type FailureReasonBreakdown = Partial<Record<FailureReasonKey, number>>;

export type WeatherCondition = 'clear' | 'rain' | 'fog' | 'sand';

export const FAILURE_REASON_KEYS: FailureReasonKey[] = [
  'vehicleBreakdown', 'noDriver', 'addressIssue',
  'customerUnavailable', 'refusedDelivery', 'weatherDelay', 'other',
];

export interface DailyRecord {
  date: string;
  completedShipments: number;
  failedShipments: number;
  /** Cash spent on fuel today (SAR) — drivers think in money, not litres. */
  fuelCost: number;
  driversPresent: number;
  notes: string;
  updatedAt: string;
  /** What the operation should focus on tomorrow (report-writing best practice:
   *  every daily report closes with next actions). */
  tomorrowNote?: string;
  /** Why shipments failed today — powers miss-analysis charts. */
  failureReasons?: FailureReasonBreakdown;
  /** Unplanned spend (repairs, tolls, penalties) in SAR. */
  extraCosts?: number;
  /** Commercial follow-up: prospect/customer visits made today. */
  newCustomerVisits?: number;
  /** Shipments from previous misses that were successfully re-delivered today. */
  recoveredShipments?: number;
  /** Accidents / injuries / near-misses today (standard daily-report field). */
  safetyIncidents?: number;
  /** Per-customer attribution of today's deliveries and misses. */
  customerBreakdown?: Record<string, { delivered: number; missed: number }>;
  /** Proof-of-delivery completeness for the day (dispute-risk signal). */
  podStatus?: 'complete' | 'partial' | 'none';
  /** Driver on duty this day (provider reports lead with names). */
  driverName?: string;
  /** Car / unit number from the provider fleet. */
  carNumber?: string;
  /** License plate as printed on the vehicle. */
  plateNumber?: string;
  /** Completed shipments paid in cash on delivery (COD). */
  codShipments?: number;
  /** Completed shipments already paid digitally / prepaid. */
  prepaidShipments?: number;
  /** Cash physically collected today (SAR) — remittance reconciliation. */
  cashCollectedSar?: number;
  /** Cash handed over to finance today (SAR). Outstanding = collected − remitted. */
  cashRemittedSar?: number;
  weatherCondition?: WeatherCondition;
  // --- Evening close (R4) - optional, backward compatible ---
  loadedShipments?: number;
  returnedShipments?: number;
  pendingShipments?: number;
  codExpectedSar?: number;
  closeStatus?: 'draft' | 'reconciled';
  closedAt?: string;
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
    fuelCost: record.fuelCost,
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

export interface CustomerPerformanceRow {
  id: string;
  name: string;
  delivered: number;
  missed: number;
  attempts: number;
  missRatePercent: number;
  /** Miss rate across the trailing 7 recorded days (undefined if none). */
  recentMissRatePercent?: number;
  /** recent − overall; positive means worsening. */
  trendDelta?: number;
}

/** Aggregate per-customer delivered/missed across ALL recorded days,
 *  worst first. Customers without attributed data are omitted. */
export function buildCustomerPerformance(records: Record<string, DailyRecord>, input: FinancialInput): CustomerPerformanceRow[] {
  const totalsMap = new Map<string, { delivered: number; missed: number }>();
  for (const record of Object.values(records)) {
    for (const [providerId, cell] of Object.entries(record.customerBreakdown ?? {})) {
      const bucket = totalsMap.get(providerId) ?? { delivered: 0, missed: 0 };
      bucket.delivered += Math.max(0, Number(cell?.delivered) || 0);
      bucket.missed += Math.max(0, Number(cell?.missed) || 0);
      totalsMap.set(providerId, bucket);
    }
  }
  const nameOf = new Map(input.providers.map(provider => [provider.id, provider.name]));
  const rowsWithRates: CustomerPerformanceRow[] = [...totalsMap.entries()]
      .filter(([, bucket]) => bucket.delivered + bucket.missed > 0)
      .map(([id, bucket]) => {
        const attempts = bucket.delivered + bucket.missed;
        return { id, name: nameOf.get(id) ?? id, delivered: bucket.delivered, missed: bucket.missed, attempts, missRatePercent: bucket.missed / attempts * 100 };
      });
    // Recurrence/trend ≈20% of account-health models (research): compare the
    // trailing-7-day miss rate against the lifetime rate.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    for (const row of rowsWithRates) {
      let recentDelivered = 0, recentMissed = 0;
      for (const record of Object.values(records)) {
        if (record.date < cutoffKey) continue;
        const cell = record.customerBreakdown?.[row.id];
        if (!cell) continue;
        recentDelivered += Math.max(0, Number(cell.delivered) || 0);
        recentMissed += Math.max(0, Number(cell.missed) || 0);
      }
      if (recentDelivered + recentMissed > 0) {
        row.recentMissRatePercent = recentMissed / (recentDelivered + recentMissed) * 100;
        row.trendDelta = row.recentMissRatePercent - row.missRatePercent;
      }
    }
    return rowsWithRates.sort((a, b) => b.missRatePercent - a.missRatePercent || b.attempts - a.attempts);
}

/** Convert v2 records (fuelLitres) to the current cash-based shape. Old
 *  litres are converted at today's pump price — an approximation that only
 *  affects reports written before this upgrade. */
export function migrateDailyRecords(records: Record<string, DailyRecord>, pricePerLiter: number): Record<string, DailyRecord> {
  const migrated: Record<string, DailyRecord> = {};
  let changed = false;
  for (const [key, raw] of Object.entries(records)) {
    const record = raw as DailyRecord & { fuelLitres?: number };
    if (typeof record.fuelLitres === 'number' && typeof record.fuelCost !== 'number') {
      migrated[key] = { ...record, fuelCost: Number((record.fuelLitres * Math.max(0.01, pricePerLiter)).toFixed(2)) };
      delete (migrated[key] as { fuelLitres?: number }).fuelLitres;
      changed = true;
    } else {
      migrated[key] = record;
    }
  }
  return changed ? migrated : records;
}

/** Aggregate miss reasons across recorded days, largest first. */
export function aggregateFailureReasons(records: Iterable<DailyRecord>): Array<{ key: FailureReasonKey; count: number }> {
  const totals = new Map<FailureReasonKey, number>();
  for (const record of records) {
    for (const [key, value] of Object.entries(record.failureReasons ?? {}) as Array<[FailureReasonKey, number]>) {
      if (!Number.isFinite(value) || value <= 0) continue;
      totals.set(key, (totals.get(key) ?? 0) + value);
    }
  }
  return [...totals.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

/** Aggregate recorded daily reports by month and compare against the plan. */
export function buildMonthlyRollup(records: Record<string, DailyRecord>, output: FinancialOutput): MonthlyRollup[] {
  const months = new Map<string, { days: number; completed: number; failed: number; revenue: number; fuel: number }>();
  for (const record of Object.values(records)) {
    const month = record.date.slice(0, 7);
    const bucket = months.get(month) ?? { days: 0, completed: 0, failed: 0, revenue: 0, fuel: 0 };
    bucket.days += 1;
    bucket.completed += record.completedShipments;
    bucket.failed += record.failedShipments;
    bucket.revenue += record.completedShipments * output.avgRevenuePerShipment;
    bucket.fuel += record.fuelCost;
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
