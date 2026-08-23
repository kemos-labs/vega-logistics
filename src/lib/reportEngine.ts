import type { FinancialInput, FinancialOutput } from '@/lib/types';
import {
  aggregateFailureReasons,
  buildMonthlyRollup,
  buildCustomerPerformance,
  calculateDailyMetrics,
  filterDefinitiveRecords,
  isDefinitiveDailyRecord,
  toDateString,
  WORKING_DAYS_PER_MONTH,
  type DailyMetrics,
  type DailyRecord,
  type FailureReasonKey,
  type MonthlyRollup,
  type CustomerPerformanceRow,
} from '@/lib/operationsReporting';

/** Report kinds: quick single-day facts sheet vs multi-section pro dossier. */
export type ReportKind = 'daily' | 'pro';
export type InsightLevel = 'good' | 'warn' | 'bad';

export type InsightKey =
  | 'noRecords' | 'singleDay'
  | 'aboveTarget' | 'onTarget' | 'belowTarget'
  | 'missRateGood' | 'missRateWatch' | 'missRateHigh'
  | 'driverShortfall' | 'fuelOverModel' | 'lossDay'
  | 'topMissReason' | 'extraCosts' | 'visitsLogged' | 'recoveries' | 'incidents'
  | 'customerMisses' | 'podGap';;

export interface DeliveryPoint {
  date: string;
  label: string; // MM-DD axis label
  target: number;
  delivered: number;
  missed: number;
  recorded: boolean;
}

export interface ReportTotals {
  days: number;
  delivered: number;
  missed: number;
  attempts: number;
  targetTotal: number;
  targetAchievedPercent: number; // delivered vs target across recorded days
  completionRate: number;
  missRate: number;
  revenue: number;
  allocatedCost: number;
  profit: number;
  fuelCost: number;
  extraCosts: number;
  customerVisits: number;
  /** Misses from earlier days that were re-delivered inside the window. */
  recovered: number;
  safetyIncidents: number;
  /** Recorded days whose POD was not 'complete'. */
  podIncompleteDays: number;
  /** Recorded days that carry any POD status at all. */
  podTrackedDays: number;
  codShipments: number;
  prepaidShipments: number;
  cashCollectedSar: number;
  /** Collected − remitted across the window. Positive = cash still with crew. */
  cashOutstandingSar: number;
  /** Miss reasons across the window, largest first. */
  reasonTotals: Array<{ key: FailureReasonKey; count: number }>;
}

export interface ReportInsight {
  level: InsightLevel;
  key: InsightKey;
  params?: Record<string, string | number>;
  /** Set when the insight refers to a failure-reason category. */
  reasonKey?: FailureReasonKey;
}

/** Overall RAG verdict derived from insight levels (industry-standard daily report header). */
export type ReportStatus = 'green' | 'amber' | 'red';

export function deriveStatus(insights: ReportInsight[]): ReportStatus {
  if (insights.some(insight => insight.level === 'bad')) return 'red';
  if (insights.some(insight => insight.level === 'warn')) return 'amber';
  return 'green';
}

/** Pending follow-up actions surfaced inside the dossier (owner accountability). */
export interface ReportAction { id: number; text: string; owner: string }

export interface ReportModel {
  kind: ReportKind;
  locale: 'en' | 'ar';
  focusDate: string;
  record: DailyRecord;
  metrics: DailyMetrics;
  series: DeliveryPoint[];
  totals: ReportTotals;
  monthly: MonthlyRollup[];
  insights: ReportInsight[];
  hasHistory: boolean;
  /** Model expectation for one working day of fuel — narrative baseline. */
  expectedDailyFuel: number;
  /** Planned driver headcount (companyDriverCount). */
  driversTotal: number;
  /** True when the document should render both EN and AR content. */
  bilingual?: boolean;
  /** Pending follow-up actions shown in the dossier (max ~5). */
  openActions?: ReportAction[];
  /** Recovery-board snapshot attached by the caller at open time. */
  recoveryBoard?: { pendingEntries: number; pendingShipments: number; recoveredShipments: number; closeRatePercent: number; overdueSharePercent: number };
  /** Open recovery rows rendered in the dossier PDF. */
  openRecoveryEntries?: Array<{ id: string; createdAt: string; shipments: number; owner: string; status: 'pending' | 'recovered' | 'written_off' }>;
  /** Recovered vs written-off shipments per week, oldest first. */
  recoveryTrend?: Array<{ weekStart: string; label: string; recovered: number; writtenOff: number }>;
  /** Per-customer delivered/missed scorecard across recorded history. */
  customerPerformance: CustomerPerformanceRow[];
  /** Fully-loaded cost per delivered stop, per recorded day (chronological). */
  costPerStopSeries: Array<{ date: string; label: string; value: number; completed: number }>;
}

/** Fully-loaded daily cost per completed stop: allocation + fuel cash + extras.
 *  Research method: include retries/claims overhead, divide by COMPLETED stops. */
export function buildCostPerStopSeries(records: Record<string, DailyRecord>, output: FinancialOutput): Array<{ date: string; label: string; value: number; completed: number }> {
  return Object.values(filterDefinitiveRecords(records))
    .filter(record => record.completedShipments > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(record => ({
      date: record.date,
      label: record.date.slice(5),
      completed: record.completedShipments,
      value: (output.totalCost / WORKING_DAYS_PER_MONTH + record.fuelCost + (record.extraCosts ?? 0)) / record.completedShipments,
    }));
}

const DAY_MS = 86_400_000;

function shift(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Trailing delivery series ending at `focusDate`. Recorded days carry real
 * delivered / missed counts; unrecorded days show the plan as target with no
 * bars — the report only ever claims numbers that were actually inserted.
 */
export function buildDeliverySeries(records: Record<string, DailyRecord>, output: FinancialOutput, focusDate: Date, days: number): DeliveryPoint[] {
  const dailyPlan = output.totalDailyShipments;
  return Array.from({ length: days }, (_, index) => {
    const date = shift(focusDate, index - (days - 1));
    const key = toDateString(date);
    const record = records[key];
    const definitive = record && isDefinitiveDailyRecord(record);
    return {
      date: key,
      label: key.slice(5),
      target: Math.round(dailyPlan),
      delivered: record && definitive ? record.completedShipments : 0,
      missed: record && definitive ? record.failedShipments : 0,
      recorded: Boolean(record && definitive),
    };
  });
}

function buildTotals(series: DeliveryPoint[], records: Record<string, DailyRecord>, output: FinancialOutput): ReportTotals {
  const recorded = series.filter(point => point.recorded);
  const sourceRecords = recorded.map(point => records[point.date]).filter(Boolean);
  const delivered = recorded.reduce((sum, point) => sum + point.delivered, 0);
  const missed = recorded.reduce((sum, point) => sum + point.missed, 0);
  const attempts = delivered + missed;
  const targetTotal = recorded.reduce((sum, point) => sum + point.target, 0);
  return {
    days: recorded.length,
    delivered,
    missed,
    attempts,
    targetTotal,
    targetAchievedPercent: targetTotal > 0 ? delivered / targetTotal * 100 : 0,
    completionRate: attempts > 0 ? delivered / attempts * 100 : 0,
    missRate: attempts > 0 ? missed / attempts * 100 : 0,
    revenue: delivered * output.avgRevenuePerShipment,
    allocatedCost: output.totalCost / WORKING_DAYS_PER_MONTH * Math.max(1, recorded.length),
    profit: delivered * output.avgRevenuePerShipment - output.totalCost / WORKING_DAYS_PER_MONTH * Math.max(1, recorded.length),
    fuelCost: 0,
    extraCosts: sourceRecords.reduce((sum, rec) => sum + (rec.extraCosts ?? 0), 0),
    customerVisits: sourceRecords.reduce((sum, rec) => sum + (rec.newCustomerVisits ?? 0), 0),
    recovered: sourceRecords.reduce((sum, rec) => sum + (rec.recoveredShipments ?? 0), 0),
    safetyIncidents: sourceRecords.reduce((sum, rec) => sum + (rec.safetyIncidents ?? 0), 0),
    podIncompleteDays: sourceRecords.filter(rec => rec.podStatus === 'partial' || rec.podStatus === 'none').length,
    podTrackedDays: sourceRecords.filter(rec => Boolean(rec.podStatus)).length,
    codShipments: sourceRecords.reduce((sum, rec) => sum + (rec.codShipments ?? 0), 0),
    prepaidShipments: sourceRecords.reduce((sum, rec) => sum + (rec.prepaidShipments ?? 0), 0),
    cashCollectedSar: sourceRecords.reduce((sum, rec) => sum + (rec.cashCollectedSar ?? 0), 0),
    cashOutstandingSar: sourceRecords.reduce((sum, rec) => sum + (rec.cashCollectedSar ?? 0) - (rec.cashRemittedSar ?? 0), 0),
    reasonTotals: aggregateFailureReasons(sourceRecords),
  };
}

/**
 * Rule-based insights. Every threshold lives here so tests pin the exact
 * behaviour and both the preview and the PDF stay in agreement.
 */
export function deriveInsights(model: Pick<ReportModel, 'series' | 'totals' | 'metrics' | 'record'>, input: FinancialInput, output: FinancialOutput, customerRows: CustomerPerformanceRow[] = []): ReportInsight[] {
  const { totals, metrics, record } = model;
  const insights: ReportInsight[] = [];
  if (totals.days === 0) return [{ level: 'warn', key: 'noRecords' }];
  if (totals.days === 1) insights.push({ level: 'good', key: 'singleDay' });

  if (totals.targetTotal > 0) {
    if (totals.targetAchievedPercent >= 102) {
      insights.push({ level: 'good', key: 'aboveTarget', params: { percent: Math.round(totals.targetAchievedPercent - 100) } });
    } else if (totals.targetAchievedPercent >= 98) {
      insights.push({ level: 'good', key: 'onTarget' });
    } else {
      insights.push({
        level: totals.targetAchievedPercent >= 85 ? 'warn' : 'bad',
        key: 'belowTarget',
        params: { percent: Math.round(100 - totals.targetAchievedPercent), delivered: totals.delivered, target: totals.targetTotal },
      });
    }
  }

  if (totals.attempts > 0) {
    if (totals.missRate <= 3) insights.push({ level: 'good', key: 'missRateGood', params: { rate: Number(totals.missRate.toFixed(1)) } });
    else if (totals.missRate > 8) insights.push({ level: 'bad', key: 'missRateHigh', params: { rate: Number(totals.missRate.toFixed(1)), missed: totals.missed } });
    else insights.push({ level: 'warn', key: 'missRateWatch', params: { rate: Number(totals.missRate.toFixed(1)) } });
  }

  // Fuel burned beyond the model's expectation for one working day.
  const expectedFuel = output.fuelMonthlyCost / WORKING_DAYS_PER_MONTH;
  if (expectedFuel > 0 && record.fuelCost > expectedFuel * 1.15) {
    insights.push({ level: 'warn', key: 'fuelOverModel', params: { amount: Math.round(record.fuelCost), expected: Math.round(expectedFuel) } });
  }

  // Driver shortfall on the recorded day reduces capacity vs plan.
  if (record.driversPresent < input.companyDriverCount) {
    insights.push({ level: 'warn', key: 'driverShortfall', params: { present: record.driversPresent, total: input.companyDriverCount } });
  }

  // Dominant miss reason — the actionable signal behind the miss rate.
  const topReason = totals.reasonTotals[0];
  if (topReason && totals.missed > 0) {
    insights.push({
      level: totals.missRate > 8 ? 'bad' : 'warn',
      key: 'topMissReason',
      params: { count: topReason.count, percent: Math.round(topReason.count / Math.max(1, totals.missed) * 100) },
      reasonKey: topReason.key,
    });
  }

  // Unplanned spend creeping above a twentieth of the day's allocation.
  if (totals.extraCosts > Math.max(1, totals.allocatedCost / totals.days) * 0.05 && totals.extraCosts > 0) {
    insights.push({ level: 'warn', key: 'extraCosts', params: { amount: Math.round(totals.extraCosts) } });
  }
  if (totals.customerVisits > 0) {
    insights.push({ level: 'good', key: 'visitsLogged', params: { visits: totals.customerVisits } });
  }
  // A specific customer bleeding deliveries beats generic averages.
  const worstCustomer = customerRows.find(row => row.attempts >= 10);
  if (worstCustomer && worstCustomer.missRatePercent > 15) {
    insights.push({ level: 'bad', key: 'customerMisses', params: { name: worstCustomer.name, rate: Number(worstCustomer.missRatePercent.toFixed(1)), attempts: worstCustomer.attempts } });
  } else if (worstCustomer && worstCustomer.missRatePercent > 8) {
    insights.push({ level: 'warn', key: 'customerMisses', params: { name: worstCustomer.name, rate: Number(worstCustomer.missRatePercent.toFixed(1)), attempts: worstCustomer.attempts } });
  }

  // Missing proof of delivery creates dispute/payment risk.
  if ((record.podStatus === 'partial' || record.podStatus === 'none') && metrics.recordedAttempts > 0) {
    insights.push({ level: 'warn', key: 'podGap', params: {} });
  }

  // Safety first: any recorded incident escalates the day's status.
  if (totals.safetyIncidents > 0) {
    insights.unshift({ level: 'bad', key: 'incidents', params: { count: totals.safetyIncidents } });
  }

  // Recovery loop closing: previous misses being re-delivered.
  if (totals.recovered > 0) {
    const rate = Math.round(totals.recovered / Math.max(1, totals.missed + totals.recovered) * 100);
    insights.push({ level: rate >= 50 ? 'good' : 'warn', key: 'recoveries', params: { recovered: totals.recovered, rate } });
  }

  if (metrics.profit < 0) insights.push({ level: 'bad', key: 'lossDay', params: { amount: Math.round(Math.abs(metrics.profit)) } });
  return insights;
}

/** Full adaptive report model. Everything downstream renders from this. */
export function buildReportModel(options: {
  kind: ReportKind;
  locale: 'en' | 'ar';
  record: DailyRecord;
  records: Record<string, DailyRecord>;
  input: FinancialInput;
  output: FinancialOutput;
  focusDate?: Date;
  windowDays?: number;
}): ReportModel {
  const { kind, locale, record, input, output } = options;
  // ONE filtered source for every definitive aggregate: a draft close can
  // never move report revenue, delivery/failure totals, cost-per-stop,
  // customer scorecard or history presence. The focus day itself still
  // renders (the operator opened it) but contributes nothing below.
  const definitiveRecords = filterDefinitiveRecords(options.records);
  const focusDate = options.focusDate ?? new Date(`${record.date}T12:00:00`);
  const windowDays = options.windowDays ?? (kind === 'pro' ? 14 : 7);
  const series = buildDeliverySeries(definitiveRecords, output, focusDate, windowDays);
  const totals = buildTotals(series, definitiveRecords, output);
  // Focus-day fuel cost attaches to totals so single-day reports carry it too.
  totals.fuelCost = record.fuelCost;
  const metrics = calculateDailyMetrics(record, input, output);
  const performance = buildCustomerPerformance(definitiveRecords, input);
  const base = { series, totals, metrics, record };
  return {
    kind,
    locale,
    focusDate: record.date,
    record,
    metrics,
    series,
    totals,
    monthly: buildMonthlyRollup(definitiveRecords, output),
    customerPerformance: performance,
    costPerStopSeries: buildCostPerStopSeries(definitiveRecords, output),
    insights: deriveInsights(base, input, output, performance),
    hasHistory: Object.keys(definitiveRecords).length > 0,
    expectedDailyFuel: output.fuelMonthlyCost / WORKING_DAYS_PER_MONTH,
    driversTotal: input.companyDriverCount,
  };
}

/* ── Locale-aware formatters (Latin digits even in Arabic — standard in
      Saudi business tooling, matching the app convention). ───────────── */
export const reportLocaleTag = (locale: 'en' | 'ar') => (locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-SA');

export function fmtSar(locale: 'en' | 'ar', value: number, digits = 0): string {
  return new Intl.NumberFormat(reportLocaleTag(locale), { style: 'currency', currency: 'SAR', maximumFractionDigits: digits }).format(value);
}

export function fmtInt(locale: 'en' | 'ar', value: number): string {
  return new Intl.NumberFormat(reportLocaleTag(locale)).format(Math.round(value));
}

export function fmtPercent(locale: 'en' | 'ar', value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function fmtReportDate(locale: 'en' | 'ar', iso: string): string {
  const parsed = iso.includes('T') ? iso : `${iso}T12:00:00`;
  return new Intl.DateTimeFormat(reportLocaleTag(locale), { dateStyle: 'long' }).format(new Date(parsed));
}

export interface NarrativeInput {
  totals: Pick<ReportTotals, 'days' | 'delivered' | 'missed' | 'attempts' | 'targetTotal' | 'targetAchievedPercent' | 'missRate' | 'extraCosts' | 'customerVisits' | 'recovered' | 'codShipments' | 'prepaidShipments' | 'cashCollectedSar'>;
  metrics: Pick<DailyMetrics, 'plannedShipments'>;
  topReason?: { key: FailureReasonKey; count: number };
  /** Focus-day fuel spend (SAR). */
  fuelAmount: number;
  expectedFuel: number;
  driversPresent: number;
  driversTotal: number;
}

/** Sentence keys consumed per language by the renderer. */
export type NarrativeKey =
  | 'lead' | 'targetGap' | 'missReasons' | 'noMisses'
  | 'fuelLine' | 'crewLine' | 'extrasLine' | 'visitsLine' | 'recoveredLine' | 'paymentsLine';

/** The facts each sentence template needs, resolved at render time so the
 *  engine stays translation-free while preview and PDF stay in sync. */
export function buildNarrativeFacts(input: NarrativeInput): Array<{ key: NarrativeKey; params: Record<string, string | number> }> {
  const facts: Array<{ key: NarrativeKey; params: Record<string, string | number> }> = [];
  const { totals } = input;
  if (totals.days === 0) return [{ key: 'lead', params: { delivered: 0, target: Math.round(input.metrics.plannedShipments), days: 0 } }];
  facts.push({ key: 'lead', params: { delivered: totals.delivered, target: totals.targetTotal, days: totals.days } });
  if (totals.targetTotal > 0 && totals.delivered < totals.targetTotal) {
    facts.push({ key: 'targetGap', params: { short: totals.targetTotal - totals.delivered, percent: Math.round(100 - totals.targetAchievedPercent) } });
  }
  if (totals.missed > 0) {
    if (input.topReason) {
      facts.push({ key: 'missReasons', params: { missed: totals.missed, rate: Number(totals.missRate.toFixed(1)), reasonCount: input.topReason.count, reasonPercent: Math.round(input.topReason.count / Math.max(1, totals.missed) * 100) } });
    } else {
      facts.push({ key: 'missReasons', params: { missed: totals.missed, rate: Number(totals.missRate.toFixed(1)) } });
    }
  } else if (totals.attempts > 0) {
    facts.push({ key: 'noMisses', params: {} });
  }
  facts.push({ key: 'fuelLine', params: { amount: Math.round(input.fuelAmount), expected: Math.round(input.expectedFuel) } });
  facts.push({ key: 'crewLine', params: { present: input.driversPresent, total: input.driversTotal } });
  if (totals.extraCosts > 0) facts.push({ key: 'extrasLine', params: { amount: Math.round(totals.extraCosts) } });
  if (totals.customerVisits > 0) facts.push({ key: 'visitsLine', params: { visits: totals.customerVisits } });
  if (totals.recovered > 0) facts.push({ key: 'recoveredLine', params: { recovered: totals.recovered, missed: totals.missed } });
  if (totals.codShipments > 0 || totals.prepaidShipments > 0) {
    facts.push({ key: 'paymentsLine', params: { cash: totals.codShipments, prepaid: totals.prepaidShipments, amount: Math.round(totals.cashCollectedSar) } });
  }
  return facts;
}
