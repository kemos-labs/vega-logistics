import { describe, it, expect } from 'vitest';
import { buildCostPerStopSeries, buildDeliverySeries, buildNarrativeFacts, buildReportModel, deriveInsights, fmtInt, fmtSar, type DeliveryPoint, type NarrativeKey, type ReportTotals } from '@/lib/reportEngine';
import { buildCustomerPerformance } from '@/lib/operationsReporting';
import { calculateFinancials } from '@/lib/calculations';
import { aggregateFailureReasons, type DailyMetrics } from '@/lib/operationsReporting';
import { defaultFinancialInput } from '@/lib/mockData';
import type { DailyRecord } from '@/lib/operationsReporting';

const input = defaultFinancialInput;
const output = calculateFinancials(input);
const dailyPlan = Math.round(output.totalDailyShipments);

const record = (date: string, completedShipments: number, failedShipments = 0, extra: Partial<DailyRecord> = {}): DailyRecord => ({
  date,
  completedShipments,
  failedShipments,
  fuelCost: 100,
  driversPresent: input.companyDriverCount,
  notes: '',
  updatedAt: '2026-08-01T10:00:00.000Z',
  ...extra,
});

// Fixed "today" so the trailing window is deterministic.
const FOCUS = new Date('2026-08-14T12:00:00');
const FOCUS_ISO = '2026-08-14';

function windowDates(days: number): string[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(FOCUS);
    date.setDate(FOCUS.getDate() - (days - index - 1));
    return `2026-08-${String(date.getDate()).padStart(2, '0')}`;
  });
}

describe('report engine — delivery series', () => {
  it('marks unrecorded days as plan-only with zero bars', () => {
    const series = buildDeliverySeries({}, output, FOCUS, 5);
    expect(series).toHaveLength(5);
    expect(series.every(point => !point.recorded && point.delivered === 0 && point.missed === 0)).toBe(true);
    expect(series.at(-1)?.target).toBe(dailyPlan);
  });

  it('carries real delivered/missed counts for recorded days only', () => {
    const dates = windowDates(3);
    const records = Object.fromEntries([
      [dates[1], record(dates[1], 150, 10)],
    ].map(([key, value]) => [key, value]));
    const series = buildDeliverySeries(records, output, FOCUS, 3);
    expect(series.map(point => point.recorded)).toEqual([false, true, false]);
    expect(series[1].delivered).toBe(150);
    expect(series[1].missed).toBe(10);
  });
});

describe('report engine — totals and adaptation', () => {
  it('aggregates recorded days: completion, miss rate, target achievement', () => {
    const dates = windowDates(4);
    const records = {
      [dates[0]]: record(dates[0], 180, 20), // 90% completion
      [dates[2]]: record(dates[2], 200, 0), // 100% completion
    };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: records[dates[2]], records, input, output, focusDate: FOCUS, windowDays: 4 });
    expect(model.totals.days).toBe(2);
    expect(model.totals.attempts).toBe(400);
    expect(model.totals.completionRate).toBeCloseTo(95, 5);
    expect(model.totals.missRate).toBeCloseTo(5, 5);
    expect(model.totals.targetTotal).toBe(dailyPlan * 2);
    expect(model.totals.targetAchievedPercent).toBeCloseTo(380 / (dailyPlan * 2) * 100, 5);
  });

  it('adapts to an empty history with the noRecords insight and no tables data crash', () => {
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: record('2026-08-14', 0), records: {}, input, output, focusDate: FOCUS, windowDays: 7 });
    expect(model.insights).toEqual([{ level: 'warn', key: 'noRecords' }]);
    expect(model.totals.days).toBe(0);
    expect(model.monthly).toEqual([]);
  });

  it('flags a single recorded day as singleDay', () => {
    const dates = windowDates(7);
    const records = { [dates[3]]: record(dates[3], dailyPlan, dailyPlan / 10) };
    const model = buildReportModel({ kind: 'daily', locale: 'en', record: records[dates[3]], records, input, output, focusDate: FOCUS, windowDays: 7 });
    expect(model.insights.some(insight => insight.key === 'singleDay')).toBe(true);
  });
});

const fullTotalsShared = (overrides: Partial<ReportTotals>): ReportTotals => ({
    days: 1, delivered: 100, missed: 0, attempts: 100, targetTotal: dailyPlan,
    targetAchievedPercent: 50, completionRate: 100, missRate: 0,
    revenue: 900, allocatedCost: 600, profit: 300, fuelCost: 50, extraCosts: 0, customerVisits: 0, recovered: 0, safetyIncidents: 0, podIncompleteDays: 0, podTrackedDays: 0, codShipments: 0, prepaidShipments: 0, cashCollectedSar: 0, cashOutstandingSar: 0, reasonTotals: [], ...overrides,
  });

describe('report engine — insight thresholds', () => {
  const fullTotals = (overrides: Partial<ReportTotals>): ReportTotals => ({
    days: 1, delivered: 100, missed: 0, attempts: 100, targetTotal: dailyPlan,
    targetAchievedPercent: 50, completionRate: 100, missRate: 0,
    revenue: 900, allocatedCost: 600, profit: 300, fuelCost: 50, extraCosts: 0, customerVisits: 0, recovered: 0, safetyIncidents: 0, podIncompleteDays: 0, podTrackedDays: 0, codShipments: 0, prepaidShipments: 0, cashCollectedSar: 0, cashOutstandingSar: 0, reasonTotals: [], ...overrides,
  });
  const fullMetrics = (overrides: Partial<DailyMetrics>): DailyMetrics => ({
    plannedShipments: dailyPlan, recordedAttempts: 100, completionRate: 100,
    revenue: 900, allocatedCost: 600, profit: 300, fuelCost: 50, ...overrides,
  });

  it('above/on/below target bands', () => {
    const make = (delivered: number, target: number) => ({
      record: record('2026-08-14', delivered),
      totals: fullTotals({ days: 2, attempts: delivered + 10, missed: 10, targetTotal: target, targetAchievedPercent: delivered / target * 100 }),
      metrics: fullMetrics({}),
      series: [] as DeliveryPoint[],
    });
    expect(deriveInsights(make(dailyPlan * 2 * 1.1, dailyPlan * 2), input, output).map(i => i.key)).toContain('aboveTarget');
    expect(deriveInsights(make(dailyPlan * 2 * 0.99, dailyPlan * 2), input, output).map(i => i.key)).toContain('onTarget');
    expect(deriveInsights(make(dailyPlan * 2 * 0.8, dailyPlan * 2), input, output).find(i => i.key === 'belowTarget')?.level).toBe('bad');
  });

  it('miss-rate bands: healthy ≤3%, high >8%', () => {
    const make = (missRate: number) => ({
      record: record('2026-08-14', 100),
      totals: fullTotals({ days: 1, attempts: 100, delivered: 100 - missRate, missed: missRate, missRate }),
      metrics: fullMetrics({}),
      series: [] as DeliveryPoint[],
    });
    expect(deriveInsights(make(2), input, output).find(i => i.key.startsWith('missRate'))?.key).toBe('missRateGood');
    expect(deriveInsights(make(5), input, output).find(i => i.key.startsWith('missRate'))?.key).toBe('missRateWatch');
    expect(deriveInsights(make(9), input, output).find(i => i.key.startsWith('missRate'))?.key).toBe('missRateHigh');
  });

  it('flags driver shortfall and excessive fuel on the focus day', () => {
    const expectedFuel = output.fuelMonthlyCost / 26;
    const model = {
      record: record('2026-08-14', 100, 0, { driversPresent: input.companyDriverCount - 1, fuelCost: expectedFuel * 1.5 }),
      totals: fullTotals({}),
      metrics: fullMetrics({}),
      series: [] as DeliveryPoint[],
    };
    const keys = deriveInsights(model, input, output).map(insight => insight.key);
    expect(keys).toContain('driverShortfall');
    expect(keys).toContain('fuelOverModel');
  });

  it('flags loss days', () => {
    const model = {
      record: record('2026-08-14', 1),
      totals: fullTotals({ days: 1, delivered: 1, attempts: 1, targetAchievedPercent: 1 }),
      series: [] as DeliveryPoint[],
      metrics: fullMetrics({ plannedShipments: dailyPlan, recordedAttempts: 1, revenue: 9, allocatedCost: 1200, profit: -1191, fuelCost: 0 }),
    };
    expect(deriveInsights(model, input, output).find(i => i.key === 'lossDay')).toMatchObject({ level: 'bad' });
  });
});

describe('report engine — formatters', () => {
  it('keeps Latin digits in Arabic locale and formats SAR', () => {
    expect(fmtInt('ar', 12345)).toBe('12,345');
    expect(fmtSar('en', 49140)).toContain('49,140');
    expect(fmtSar('ar', 17.5, 1)).toContain('17.5');
  });
});

describe('report engine — miss reasons & narrative facts', () => {
  it('aggregates failure reasons across days, largest first', () => {
    const aggregated = aggregateFailureReasons([
      record('2026-08-12', 10, 5, { failureReasons: { noDriver: 3, addressIssue: 2 } }),
      record('2026-08-13', 10, 4, { failureReasons: { noDriver: 2, vehicleBreakdown: 2 } }),
    ]);
    expect(aggregated[0]).toEqual({ key: 'noDriver', count: 5 });
    expect(aggregated.map(entry => entry.key)).toEqual(['noDriver', 'addressIssue', 'vehicleBreakdown']);
  });

  it('ignores zero/negative reason counters', () => {
    const aggregated = aggregateFailureReasons([record('2026-08-12', 10, 0, { failureReasons: { other: 0, noDriver: -2 } })]);
    expect(aggregated).toEqual([]);
  });

  it('buildNarrativeFacts adapts sentences to inserted data', () => {
    const base = {
      metrics: { plannedShipments: dailyPlan },
      fuelAmount: 120,
      expectedFuel: 100,
      driversPresent: input.companyDriverCount,
      driversTotal: input.companyDriverCount,
    };
    const withMisses: Array<{ key: NarrativeKey; params: Record<string, string | number> }> = buildNarrativeFacts({
      ...base,
      totals: fullTotalsShared({ missed: 12, attempts: 212, missRate: 5.7, delivered: 90, targetAchievedPercent: 90 }),
      topReason: { key: 'noDriver', count: 7 },
    });
    expect(withMisses.map(fact => fact.key)).toEqual(['lead', 'targetGap', 'missReasons', 'fuelLine', 'crewLine']);
    expect(withMisses.find(fact => fact.key === 'missReasons')?.params).toMatchObject({ missed: 12, reasonCount: 7 });
    expect(withMisses.find(fact => fact.key === 'fuelLine')?.params).toMatchObject({ amount: 120, expected: 100 });
    const clean: Array<{ key: NarrativeKey; params: Record<string, string | number> }> = buildNarrativeFacts({
      ...base,
      totals: fullTotalsShared({ missed: 0, attempts: 200, missRate: 0, customerVisits: 2, extraCosts: 80 }),
    });
    expect(clean.map(fact => fact.key)).toContain('noMisses');
    expect(clean.map(fact => fact.key)).toContain('visitsLine');
    expect(clean.map(fact => fact.key)).toContain('extrasLine');
  });
});

describe('report engine — customer scorecard & POD', () => {
  const providers = [
    { id: 'p1', name: 'Customer 1', shipmentsPerDay: 100, pricePerShipment: 9, enabled: true },
    { id: 'p2', name: 'Customer 2', shipmentsPerDay: 50, pricePerShipment: 12, enabled: true },
  ];
  const richInput = { ...input, providers };

  it('aggregates per-customer delivered/missed across days, worst first', () => {
    const records = {
      '2026-08-10': record('2026-08-10', 10, 0, { customerBreakdown: { p1: { delivered: 90, missed: 10 }, p2: { delivered: 48, missed: 2 } } }),
      '2026-08-11': record('2026-08-11', 10, 0, { customerBreakdown: { p1: { delivered: 80, missed: 20 } } }),
    };
    const rows = buildCustomerPerformance(records, richInput);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 'p1', delivered: 170, missed: 30, attempts: 200 });
    expect(rows[0].missRatePercent).toBeCloseTo(15, 5);
    expect(rows[1].missRatePercent).toBeCloseTo(4, 5);
  });

  it('omits customers without attribution and unknown ids keep raw id as name', () => {
    const records = {
      '2026-08-10': record('2026-08-10', 5, 0, { customerBreakdown: { ghost: { delivered: 5, missed: 5 } } }),
      '2026-08-11': record('2026-08-11', 5, 0),
    };
    const rows = buildCustomerPerformance(records, richInput);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('ghost');
  });

  it('flags a bleeding customer above thresholds via insights', () => {
    const records = {
      '2026-08-10': record('2026-08-10', 10, 0, { customerBreakdown: { p1: { delivered: 80, missed: 20 } } }),
    };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: records['2026-08-10'], records, input: richInput, output, focusDate: FOCUS, windowDays: 7 });
    const insight = model.insights.find(item => item.key === 'customerMisses');
    expect(insight?.params).toMatchObject({ name: 'Customer 1', attempts: 100 });
  });

  it('warns on incomplete POD for the focus day', () => {
    const focus = record(FOCUS_ISO, 50, 2, { podStatus: 'partial' });
    const model = buildReportModel({ kind: 'daily', locale: 'en', record: focus, records: { [FOCUS_ISO]: focus }, input, output, focusDate: FOCUS, windowDays: 3 });
    expect(model.insights.find(item => item.key === 'podGap')).toBeTruthy();
    expect(model.totals.podIncompleteDays).toBe(1);
  });
});

describe('report engine — customer trend & POD share', () => {
  const providers = [
    { id: 'p1', name: 'Customer 1', shipmentsPerDay: 100, pricePerShipment: 9, enabled: true },
    { id: 'p2', name: 'Customer 2', shipmentsPerDay: 50, pricePerShipment: 12, enabled: true },
  ];
  const richInput = { ...input, providers };
  // "today" for the recency cutoff is real Date.now() — build dates relative to it.
  const dayKey = (offsetDays: number) => {
    const date = new Date();
    date.setDate(date.getDate() - offsetDays);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  it('computes trendDelta from trailing-7-day rate vs lifetime rate', () => {
    const records = {
      [dayKey(30)]: record(dayKey(30), 10, 0, { customerBreakdown: { p1: { delivered: 100, missed: 0 } } }),
      [dayKey(2)]: record(dayKey(2), 10, 0, { customerBreakdown: { p1: { delivered: 70, missed: 30 } } }),
    };
    const rows = buildCustomerPerformance(records, richInput);
    const p1 = rows.find(row => row.id === 'p1');
    expect(p1?.missRatePercent).toBeCloseTo(15, 1);
    expect(p1?.recentMissRatePercent).toBeCloseTo(30, 5);
    expect(p1?.trendDelta).toBeGreaterThan(0);
  });

  it('leaves trend undefined when nothing recent exists', () => {
    const records = { [dayKey(30)]: record(dayKey(30), 10, 0, { customerBreakdown: { p1: { delivered: 95, missed: 5 } } }) };
    const rows = buildCustomerPerformance(records, richInput);
    expect(rows[0].trendDelta).toBeUndefined();
  });

  it('tracks POD completeness over the window', () => {
    const dates = windowDates(4);
    const records = {
      [dates[0]]: record(dates[0], 10, 0, { podStatus: 'complete' }),
      [dates[1]]: record(dates[1], 10, 0, { podStatus: 'partial' }),
      [dates[2]]: record(dates[2], 10, 0),
      [dates[3]]: record(dates[3], 10, 0, { podStatus: 'none' }),
    };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: records[dates[3]], records, input, output, focusDate: FOCUS, windowDays: 4 });
    expect(model.totals.podTrackedDays).toBe(3);
    expect(model.totals.podIncompleteDays).toBe(2);
  });
});

describe('report engine — payment split', () => {
  it('emits a payments fact when COD/prepaid data is inserted', () => {
    const facts = buildNarrativeFacts({
      totals: fullTotalsShared({ codShipments: 120, prepaidShipments: 80, cashCollectedSar: 940 }),
      metrics: { plannedShipments: dailyPlan },
      fuelAmount: 100,
      expectedFuel: 90,
      driversPresent: input.companyDriverCount,
      driversTotal: input.companyDriverCount,
    });
    expect(facts.map(fact => fact.key)).toContain('paymentsLine');
    expect(facts.find(fact => fact.key === 'paymentsLine')?.params).toMatchObject({ cash: 120, prepaid: 80, amount: 940 });
  });

  it('aggregates COD totals across the window', () => {
    const dates = windowDates(3);
    const records = {
      [dates[0]]: record(dates[0], 10, 0, { codShipments: 60, prepaidShipments: 40, cashCollectedSar: 500 }),
      [dates[1]]: record(dates[1], 10, 0, { codShipments: 30, prepaidShipments: 70 }),
    };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: records[dates[1]], records, input, output, focusDate: FOCUS, windowDays: 3 });
    expect(model.totals.codShipments).toBe(90);
    expect(model.totals.prepaidShipments).toBe(110);
    expect(model.totals.cashCollectedSar).toBe(500);
  });
});

describe('report engine — COD remittance', () => {
  it('computes outstanding cash = collected − remitted across days', () => {
    const dates = windowDates(3);
    const records = {
      [dates[0]]: record(dates[0], 10, 0, { codShipments: 50, cashCollectedSar: 800, cashRemittedSar: 800 }),
      [dates[1]]: record(dates[1], 10, 0, { codShipments: 40, cashCollectedSar: 600 }),
      [dates[2]]: record(dates[2], 10, 0, { codShipments: 30, cashCollectedSar: 450, cashRemittedSar: 300 }),
    };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: records[dates[2]], records, input, output, focusDate: FOCUS, windowDays: 3 });
    expect(model.totals.cashCollectedSar).toBe(1850);
    expect(model.totals.cashOutstandingSar).toBe(750);
  });
});

function byDate(series: Array<{ date: string }>, date: string): { date: string; recorded?: boolean; delivered?: number } {
  const point = series.find(p => p.date === date);
  if (!point) throw new Error(`missing series point ${date}`);
  return point;
}

describe('R4-D — drafts are invisible to EVERY definitive report path', () => {
  const DRAFT = {
    date: '2026-08-20', completedShipments: 90, failedShipments: 90, fuelCost: 999,
    driversPresent: 9, notes: '', updatedAt: '2026-08-20T12:00:00Z', closeStatus: 'draft' as const,
    cashCollectedSar: 999, customerBreakdown: { ghost: { delivered: 90, missed: 0 } },
    codShipments: 90,
  };
  const LEGACY = { date: '2026-08-19', completedShipments: 10, failedShipments: 2, fuelCost: 50, driversPresent: 2, notes: '', updatedAt: '2026-08-19T12:00:00Z' };
  const RECONCILED = { ...LEGACY, date: '2026-08-18', completedShipments: 20, failedShipments: 1, closeStatus: 'reconciled' as const, closedAt: '2026-08-18T20:00:00.000Z' };
  const records = Object.fromEntries([DRAFT, LEGACY, RECONCILED].map(r => [r.date, r]));

  it('buildDeliverySeries treats a draft day as UNRECORDED; legacy+reconciled stay', () => {
    const focus = new Date('2026-08-20T12:00:00');
    const series = buildDeliverySeries(records, output, focus, 3); // 18..20
    expect(byDate(series, '2026-08-20').recorded).toBe(false);
    expect(byDate(series, '2026-08-20').delivered).toBe(0);
    expect(byDate(series, '2026-08-19').recorded).toBe(true);
    expect(byDate(series, '2026-08-18').delivered).toBe(20);
  });

  it('buildCostPerStopSeries excludes drafts entirely', () => {
    const series = buildCostPerStopSeries(records, output);
    expect(series.map(p => p.date)).toEqual(['2026-08-18', '2026-08-19']);
  });

  it('buildReportModel aggregates (totals/monthly/customers/hasHistory) never see the draft', () => {
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: LEGACY, records, input: input, output, focusDate: new Date('2026-08-19T12:00:00') });
    expect(model.totals.delivered).toBe(30); // 10 + 20; draft's 90 invisible
    expect(model.hasHistory).toBe(true);
    expect(model.customerPerformance.find(row => row.name === 'ghost')).toBeUndefined();
    const modelDraftOnly = buildReportModel({ kind: 'daily', locale: 'en', record: DRAFT, records: { '2026-08-20': DRAFT }, input, output });
    expect(modelDraftOnly.hasHistory).toBe(false); // a lone draft is NOT history
    expect(modelDraftOnly.totals.days).toBe(0);
    expect(modelDraftOnly.monthly).toEqual([]);
  });
});

describe('R6 — operational analytics in report model', () => {
  const FOCUS = new Date('2026-08-14T12:00:00');

  it('buildReportModel includes driverPerformance from stops', () => {
    const stops = [
      { driverName: 'Ahmed', carNumber: '10', plateNumber: 'ABC', status: 'delivered', operationDate: '2026-08-14' },
      { driverName: 'Ahmed', carNumber: '10', plateNumber: 'ABC', status: 'failed', operationDate: '2026-08-14' },
      { driverName: 'Sara', carNumber: '20', plateNumber: 'XYZ', status: 'delivered', operationDate: '2026-08-14' },
    ];
    const record = recordWith('2026-08-14', 3, 1);
    const records = { '2026-08-14': record };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record, records, input, output, focusDate: FOCUS, windowDays: 7, stops });
    expect(model.driverPerformance).toHaveLength(2);
    expect(model.driverPerformance[0]).toMatchObject({ driverName: 'Ahmed', delivered: 1, missed: 1 });
    expect(model.driverPerformance[1]).toMatchObject({ driverName: 'Sara', delivered: 1, missed: 0 });
  });

  it('buildReportModel includes codRemittanceLag from records', () => {
    const records = {
      '2026-08-12': recordWith('2026-08-12', 10, 2, { cashCollectedSar: 500, cashRemittedSar: 500, codRemittedOn: '2026-08-14' }),
      '2026-08-13': recordWith('2026-08-13', 10, 0, { cashCollectedSar: 300, cashRemittedSar: 300, codRemittedOn: '2026-08-13' }),
    };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: records['2026-08-13'], records, input, output, focusDate: FOCUS, windowDays: 7 });
    expect(model.codRemittanceLag).toHaveLength(2);
    expect(model.codRemittanceLag[0]).toMatchObject({ date: '2026-08-12', lagDays: 2 });
    expect(model.codRemittanceLag[1]).toMatchObject({ date: '2026-08-13', lagDays: 0 });
  });

  it('buildReportModel includes fuelControl from records', () => {
    const modelDaily = output.fuelMonthlyCost / 26;
    const records = {
      '2026-08-12': recordWith('2026-08-12', 10, 2, { fuelCost: modelDaily * 1.3 }),
      '2026-08-13': recordWith('2026-08-13', 10, 0, { fuelCost: modelDaily * 0.9 }),
    };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: records['2026-08-13'], records, input, output, focusDate: FOCUS, windowDays: 7 });
    expect(model.fuelControl).toHaveLength(2);
    expect(model.fuelControl[0].variancePercent).toBeCloseTo(30, 0);
    expect(model.fuelControl[1].variancePercent).toBeCloseTo(-10, 0);
  });

  it('buildReportModel includes failurePareto from records', () => {
    const records = {
      '2026-08-12': recordWith('2026-08-12', 10, 5, { failureReasons: { noDriver: 3, addressIssue: 2 } }),
    };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: records['2026-08-12'], records, input, output, focusDate: FOCUS, windowDays: 7 });
    expect(model.failurePareto).toHaveLength(2);
    expect(model.failurePareto[0]).toMatchObject({ key: 'noDriver', count: 3, percent: 60, cumulativePercent: 60 });
    expect(model.failurePareto[1]).toMatchObject({ key: 'addressIssue', count: 2, percent: 40, cumulativePercent: 100 });
  });

  it('buildReportModel returns empty arrays when no data exists', () => {
    const record: DailyRecord = {
      date: '2026-08-14',
      completedShipments: 0,
      failedShipments: 0,
      fuelCost: 0,
      driversPresent: 0,
      notes: '',
      updatedAt: '2026-08-14T10:00:00.000Z',
      closeStatus: 'draft',
    };
    const records = { '2026-08-14': record };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record, records, input, output, focusDate: FOCUS, windowDays: 7 });
    expect(model.driverPerformance).toEqual([]);
    expect(model.codRemittanceLag).toEqual([]);
    expect(model.fuelControl).toEqual([]);
    expect(model.failurePareto).toEqual([]);
  });
});

function recordWith(date: string, completedShipments: number, failedShipments = 0, extra: Partial<DailyRecord> = {}): DailyRecord {
  return {
    date,
    completedShipments,
    failedShipments,
    fuelCost: 100,
    driversPresent: 3,
    notes: '',
    updatedAt: '2026-08-01T10:00:00.000Z',
    closeStatus: 'reconciled',
    ...extra,
  };
}
