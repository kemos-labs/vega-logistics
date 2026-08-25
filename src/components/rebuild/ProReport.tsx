'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Globe, Printer, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  buildNarrativeFacts,
  deriveStatus,
  fmtInt,
  fmtPercent,
  fmtReportDate,
  fmtSar,
  type InsightKey,
  type NarrativeKey,
  type ReportModel,
} from '@/lib/reportEngine';
import { exportProReportPdf, type ReportLabels } from '@/lib/reportExport';

const INSIGHT_KEY_TO_LOCALE: Record<InsightKey, string> = {
  noRecords: 'insightNoRecords',
  singleDay: 'insightSingleDay',
  aboveTarget: 'insightAboveTarget',
  onTarget: 'insightOnTarget',
  belowTarget: 'insightBelowTarget',
  missRateGood: 'insightMissRateGood',
  missRateWatch: 'insightMissRateWatch',
  missRateHigh: 'insightMissRateHigh',
  fuelOverModel: 'insightFuelOverModel',
  driverShortfall: 'insightDriverShortfall',
  lossDay: 'insightLossDay',
  topMissReason: 'insightTopMissReason',
  extraCosts: 'insightExtraCosts',
  visitsLogged: 'insightVisitsLogged',
  recoveries: 'insightRecoveries',
  incidents: 'insightIncidents',
  customerMisses: 'insightCustomerMisses',
  podGap: 'insightPodGap',
};

const NARRATIVE_KEY_TO_LOCALE: Record<NarrativeKey, string> = {
  lead: 'narrativeLead',
  targetGap: 'narrativeTargetGap',
  missReasons: 'narrativeMissReasons',
  noMisses: 'narrativeNoMisses',
  fuelLine: 'narrativeFuelLine',
  crewLine: 'narrativeCrewLine',
  extrasLine: 'narrativeExtrasLine',
  visitsLine: 'narrativeVisitsLine',
  recoveredLine: 'narrativeRecoveredLine',
  paymentsLine: 'narrativePaymentsLine',
};

export function buildReportLabels(t: (key: string) => string): ReportLabels {
  return {
    dailySheetTitle: t('businessModel.report.dailySheetTitle'),
    proTitle: t('businessModel.report.proTitle'),
    brandLine: t('businessModel.report.brandLine'),
    reportDate: t('businessModel.report.focusDay'),
    recordedAt: t('businessModel.daily.lastSaved').split('{{')[0].trim(),
    unsavedDraft: t('businessModel.daily.draft'),
    preparedAt: t('businessModel.report.preparedAt'),
    period: t('businessModel.report.period'),
    focusDay: t('businessModel.report.focusDay'),
    windowTotals: t('businessModel.report.windowTotals'),
    confidential: t('businessModel.report.confidential'),
    plannedShipments: t('businessModel.daily.kpiPlanned'),
    completedShipments: t('businessModel.daily.kpiCompleted'),
    failedShipments: t('businessModel.daily.failedShipments'),
    completionRate: t('businessModel.daily.kpiCompletionRate'),
    driversPresent: t('businessModel.daily.driversPresent'),
    fuelUsed: t('businessModel.daily.fuelSpent'),
    fuelCostLabel: t('businessModel.daily.factFuelCost'),
    dailyRevenue: t('businessModel.daily.factRevenue'),
    allocatedCost: t('businessModel.daily.factAllocatedCost'),
    dailyProfit: t('businessModel.daily.kpiProfitLoss'),
    notes: t('businessModel.daily.notes'),
    noNotes: t('businessModel.report.noNotes'),
    nextDayFocus: t('businessModel.report.nextDayFocus'),
    statusGreen: t('businessModel.report.statusGreen'),
    statusAmber: t('businessModel.report.statusAmber'),
    statusRed: t('businessModel.report.statusRed'),
    openActionsHead: t('businessModel.report.openActionsHead'),
    fleetCrewHead: t('businessModel.report.fleetCrewHead'),
    recoveryHead: t('businessModel.report.recoveryHead'),
    recoverySummary: t('businessModel.report.recoverySummary'),
    costPerStop: t('businessModel.report.costPerStop'),
    costTrendHead: t('businessModel.report.costTrendHead'),
    thOwner: t('businessModel.recovery.ownerName'),
    thDaysOpen: t('businessModel.report.thDaysOpen'),
    targetLine: t('businessModel.report.targetLine'),
    kpiDelivered: t('businessModel.report.kpiDelivered'),
    kpiMissed: t('businessModel.report.kpiMissed'),
    kpiTarget: t('businessModel.report.kpiTarget'),
    kpiCompletion: t('businessModel.report.kpiCompletion'),
    kpiTargetHit: t('businessModel.report.kpiTargetHit'),
    kpiProfit: t('businessModel.report.kpiProfit'),
    chartDelivery: t('businessModel.report.chartDeliveryHead'),
    legendDelivered: t('businessModel.report.legendDelivered'),
    legendMissed: t('businessModel.report.legendMissed'),
    legendTarget: t('businessModel.report.legendTarget'),
    missAnalysisHead: t('businessModel.report.missAnalysisHead'),
    tableVariance: t('businessModel.report.tableVariance'),
    thMonth: t('businessModel.report.thMonth'),
    thDays: t('businessModel.report.thDays'),
    thDelivered: t('businessModel.report.thDelivered'),
    thMissed: t('businessModel.report.thMissed'),
    thCompletion: t('businessModel.report.thCompletion'),
    thRevenue: t('businessModel.report.thRevenue'),
    thPlanned: t('businessModel.report.thPlanned'),
    thVariance: t('businessModel.report.thVariance'),
    insights: t('businessModel.report.insights'),
    sectionHistoryTable: t('businessModel.report.sectionHistoryTable'),
    thDate: t('businessModel.report.thDate'),
    thAttempts: t('businessModel.report.thAttempts'),
    thDrivers: t('businessModel.report.thDrivers'),
    thFuel: t('businessModel.report.thFuel'),
    insightNoRecords: t('businessModel.report.insightNoRecords'),
    insightSingleDay: t('businessModel.report.insightSingleDay'),
    insightAboveTarget: t('businessModel.report.insightAboveTarget'),
    insightOnTarget: t('businessModel.report.insightOnTarget'),
    insightBelowTarget: t('businessModel.report.insightBelowTarget'),
    insightMissRateGood: t('businessModel.report.insightMissRateGood'),
    insightMissRateWatch: t('businessModel.report.insightMissRateWatch'),
    insightMissRateHigh: t('businessModel.report.insightMissRateHigh'),
    insightFuelOverModel: t('businessModel.report.insightFuelOverModel'),
    insightDriverShortfall: t('businessModel.report.insightDriverShortfall'),
    insightLossDay: t('businessModel.report.insightLossDay'),
    insightTopMissReason: t('businessModel.report.insightTopMissReason'),
    insightExtraCosts: t('businessModel.report.insightExtraCosts'),
    insightVisitsLogged: t('businessModel.report.insightVisitsLogged'),
    insightRecoveries: t('businessModel.report.insightRecoveries'),
    insightIncidents: t('businessModel.report.insightIncidents'),
    insightCustomerMisses: t('businessModel.report.insightCustomerMisses'),
    insightPodGap: t('businessModel.report.insightPodGap'),
    scorecardHead: t('businessModel.report.scorecardHead'),
    thMissRate: t('businessModel.report.thMissRate'),
    podLine: t('businessModel.report.podLine'),
    thTrend: t('businessModel.report.thTrend'),
    podShareLine: t('businessModel.report.podShareLine'),
    codShipments: t('businessModel.report.codShipments'),
    prepaidShipments: t('businessModel.report.prepaidShipments'),
    cashCollected: t('businessModel.report.cashCollected'),
    cashOutstanding: t('businessModel.report.cashOutstanding'),
    safetyIncidents: t('businessModel.report.safetyIncidents'),
    driverScorecardHead: t('businessModel.report.driverScorecardHead'),
    driverScorecardDesc: t('businessModel.report.driverScorecardDesc'),
    thDriver: t('businessModel.report.thDriver'),
    thCar: t('businessModel.report.thCar'),
    thPlate: t('businessModel.report.thPlate'),
    noDriverData: t('businessModel.report.noDriverData'),
    codLagHead: t('businessModel.report.codLagHead'),
    codLagDesc: t('businessModel.report.codLagDesc'),
    thLagDays: t('businessModel.report.thLagDays'),
    thCollected: t('businessModel.report.thCollected'),
    thRemitted: t('businessModel.report.thRemitted'),
    codLagTarget: t('businessModel.report.codLagTarget'),
    noCodLag: t('businessModel.report.noCodLag'),
    fuelControlHead: t('businessModel.report.fuelControlHead'),
    fuelControlDesc: t('businessModel.report.fuelControlDesc'),
    thActual: t('businessModel.report.thActual'),
    thModel: t('businessModel.report.thModel'),
    thFuelVariance: t('businessModel.report.thVariance'),
    fuelOverModel: t('businessModel.report.fuelOverModel'),
    noFuelData: t('businessModel.report.noFuelData'),
    failureParetoHead: t('businessModel.report.failureParetoHead'),
    failureParetoDesc: t('businessModel.report.failureParetoDesc'),
    thCount: t('businessModel.report.thCount'),
    thShare: t('businessModel.report.thShare'),
    thCumulative: t('businessModel.report.thCumulative'),
    noFailureData: t('businessModel.report.noFailureData'),
  };
}

function renderTrend(row: { trendDelta?: number }, locale: string, t: (key: string, opts?: Record<string, unknown>) => string, lng: 'en' | 'ar' | 'both') {
  if (row.trendDelta === undefined || Math.abs(row.trendDelta) < 1) return <span className="bm-trend-flat">—</span>;
  const worsening = row.trendDelta > 0;
  return (
    <span className={`bm-trend-pill ${worsening ? 'up' : 'down'}`} title={t(`businessModel.report.${worsening ? 'trendWorsening' : 'trendImproving'}`, { lng })}>
      {worsening ? '▲' : '▼'} {Math.abs(row.trendDelta).toFixed(0)}%
    </span>
  );
}

export default function ProReport({ model, onClose }: { model: ReportModel; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const appLng = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  // Report language is switchable independently — including a bilingual
  // EN+AR dossier where every heading carries both languages.
  const [lng, setLng] = useState<'en' | 'ar' | 'both'>(appLng);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dir = lng === 'ar' ? 'rtl' : 'ltr';
  const labels = useMemo(() => buildReportLabels(key => t(key, { lng: lng === 'both' ? 'en' : lng })), [t, lng]);
  const bi = (key: string) => {
    const en = t(key, { lng: 'en' });
    const ar = t(key, { lng: 'ar' });
    return lng === 'both' ? `${en} · ${ar}` : lng === 'ar' ? ar : en;
  };

  useEffect(() => {
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const { totals, series, metrics, monthly, insights } = model;
  const locale = lng === 'both' ? 'en' : lng;
  const num = (value: number) => fmtInt(locale, value);
  const donutRadius = 46, donutCircumference = 2 * Math.PI * donutRadius;
  const donutFraction = totals.attempts > 0 ? totals.delivered / totals.attempts : 0;

  const downloadPdf = async () => {
    await exportProReportPdf({ ...model, locale: lng === 'both' ? 'en' : lng, bilingual: lng === 'both' }, labels);
  };

  const narrativeFacts = buildNarrativeFacts({
    totals,
    metrics,
    topReason: totals.reasonTotals[0],
    fuelAmount: model.record.fuelCost,
    expectedFuel: model.expectedDailyFuel,
    driversPresent: model.record.driversPresent,
    driversTotal: model.driversTotal,
  });
  const status = deriveStatus(insights);
  const narrativeLine = (lngSide: 'en' | 'ar') => narrativeFacts.map(fact => {
    const templateKey = fact.key === 'missReasons' && !fact.params.reasonCount ? 'narrativeMissReasonsPlain' : NARRATIVE_KEY_TO_LOCALE[fact.key];
    return t(`businessModel.report.${templateKey}`, { lng: lngSide, ...fact.params });
  }).join(' ');

  /* Bars mirror reading order: newest on the left in Arabic. */
  const chartSeries = dir === 'rtl' ? [...series].reverse() : series;
  const maxBar = Math.max(...chartSeries.map(point => point.delivered + point.missed), ...chartSeries.map(point => point.target), 1);
  const width = 720, height = 250, padX = 14, padBottom = 34, padTop = 16;
  const slot = (width - padX * 2) / chartSeries.length;
  const barWidth = Math.min(26, slot * 0.52);
  const scaleY = (value: number) => (height - padBottom - padTop) * (value / maxBar);
  const baseline = height - padBottom;

  return (
    <div className="bm-pro-overlay" role="dialog" aria-modal="true" aria-label={labels.proTitle} dir={dir}>
      <div className="bm-pro-toolbar">
        <div className="bm-pro-toolbar-title"><FileText size={17} aria-hidden /> <strong>{labels.proTitle}</strong></div>
        <div className="bm-pro-toolbar-actions">
          <div className="bm-lang-switch" role="group" aria-label={t('businessModel.report.language')}>
            <button className={lng === 'en' ? 'active' : ''} onClick={() => setLng('en')}><Globe size={13} aria-hidden /> English</button>
            <button className={lng === 'ar' ? 'active' : ''} onClick={() => setLng('ar')}>العربية</button>
            <button className={lng === 'both' ? 'active' : ''} onClick={() => setLng('both')}>{bi('businessModel.report.langBoth')}</button>
          </div>
          <button className="bm-pro-tool" onClick={() => window.print()}><Printer size={15} aria-hidden /> {t('businessModel.report.print')}</button>
          <button className="bm-pro-tool bm-pro-tool--primary" onClick={downloadPdf}><Download size={15} aria-hidden /> {t('businessModel.report.downloadPdf')}</button>
          <button className="bm-pro-tool" ref={closeButtonRef} onClick={onClose} aria-label={t('businessModel.report.close')}><X size={16} aria-hidden /></button>
        </div>
      </div>

      <article className={`bm-sheet ${dir}`} lang={lng}>
        <header className="bm-sheet-cover">
          <div className="bm-sheet-brandmark" aria-hidden>◈</div>
          <div>
            <p className="bm-sheet-kicker">{labels.brandLine}</p>
            <h2>{labels.proTitle}</h2>
            <p className="bm-sheet-meta">
              {labels.focusDay}: {fmtReportDate(locale, model.focusDate)}
              {' · '}
              {labels.period.replace('{{days}}', String(series.length))}
            </p>
            <p className="bm-sheet-meta">
              <span className={`bm-rag bm-rag--${status}`} aria-label={t(`businessModel.report.status${status.charAt(0).toUpperCase()+status.slice(1)}`)}>
                <i /> {t(`businessModel.report.status${status.charAt(0).toUpperCase()+status.slice(1)}`, { lng })}
              </span>
            </p>
          </div>
          <svg className="bm-sheet-donut" viewBox="0 0 120 120" role="img" aria-label={`${labels.kpiCompletion}: ${fmtPercent(locale, totals.completionRate)}`}>
            <circle className="track" cx="60" cy="60" r={donutRadius} />
            <circle
              className="value"
              cx="60" cy="60" r={donutRadius}
              strokeDasharray={`${donutFraction * donutCircumference} ${donutCircumference}`}
              transform="rotate(-90 60 60)"
            />
            <text x="60" y="57" textAnchor="middle">{fmtPercent(locale, totals.completionRate, 0)}</text>
            <text x="60" y="72" textAnchor="middle" className="small">{labels.kpiCompletion}</text>
          </svg>
        </header>

        <section className="bm-sheet-panel bm-sheet-narrative">
          <h3>{bi('businessModel.report.narrativeTitle')}</h3>
          <p dir={dir}>{narrativeLine(lng === 'ar' ? 'ar' : 'en')}</p>
          {lng === 'both' && <p dir="rtl" className="bm-narrative-ar">{narrativeLine('ar')}</p>}
        </section>

        <div className="bm-sheet-kpis">
          <Kpi label={bi('businessModel.report.kpiDelivered')} value={num(totals.delivered)} tone="good" sub={totals.recovered > 0 ? `+${num(totals.recovered)} ${locale === 'ar' ? 'مسترجعة' : 'recovered'}` : `${num(series.filter(p => p.recorded).length)} ${locale === 'ar' ? 'يوم مسجل' : 'recorded days'}`} />
          <Kpi label={bi('businessModel.report.kpiMissed')} value={num(totals.missed)} tone={totals.missed > 0 ? 'bad' : undefined} sub={`${fmtPercent(locale, totals.missRate)} ${locale === 'ar' ? 'نسبة فوات' : 'miss rate'}`} />
          <Kpi label={bi('businessModel.report.kpiTargetHit')} value={fmtPercent(locale, totals.targetAchievedPercent, 0)} tone={totals.targetAchievedPercent >= 98 ? 'good' : totals.targetAchievedPercent >= 85 ? 'warn' : 'bad'} sub={`${num(totals.delivered)} / ${num(totals.targetTotal)}`} />
          <Kpi label={bi('businessModel.report.kpiTarget')} value={num(metrics.plannedShipments)} sub={locale === 'ar' ? 'شحنة كل يوم' : 'shipments / day'} />
          <Kpi label={bi('businessModel.report.kpiProfit')} value={fmtSar(locale, totals.profit)} tone={totals.profit < 0 ? 'bad' : 'good'} sub={totals.extraCosts > 0 ? `${locale === 'ar' ? 'إضافية' : 'extra'} −${fmtSar(locale, totals.extraCosts)}` : `${labels.kpiDelivered} × ${fmtSar(locale, model.metrics.revenue / Math.max(1, model.metrics.plannedShipments), 2)}`} />
          <Kpi label={bi('businessModel.report.fuelUsed')} value={fmtSar(locale, model.record.fuelCost)} sub={`${locale === 'ar' ? 'المتوقع' : 'model day'} ≈ ${fmtSar(locale, model.expectedDailyFuel)}`} />
        </div>

        <section className="bm-sheet-panel">
          <div className="bm-sheet-panel-head">
            <h3>{t('businessModel.report.chartDelivery')}</h3>
            <div className="bm-sheet-legend">
              <span><i className="delivered" /> {labels.legendDelivered}</span>
              <span><i className="missed" /> {labels.legendMissed}</span>
              <span><i className="target" /> {labels.legendTarget}</span>
            </div>
          </div>
          <svg className="bm-sheet-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('businessModel.report.chartDeliveryHead')}>
            {[0.25, 0.5, 0.75, 1].map(fraction => (
              <line key={fraction} className="gridline"
                x1={padX} x2={width - padX}
                y1={baseline - scaleY(maxBar * fraction)} y2={baseline - scaleY(maxBar * fraction)} />
            ))}
            <line className="axis" x1={padX} x2={width - padX} y1={baseline} y2={baseline} />
            {chartSeries.map((point, index) => {
              const centerX = padX + slot * index + slot / 2;
              const deliveredHeight = scaleY(point.delivered);
              const missedHeight = scaleY(point.missed);
              const targetY = baseline - scaleY(point.target);
              return (
                <g key={point.date} className={point.recorded ? undefined : 'empty'}>
                  <rect className="bar-delivered" x={centerX - barWidth / 2} y={baseline - deliveredHeight} width={barWidth} height={Math.max(0, deliveredHeight)} rx="2.5" />
                  {point.missed > 0 && <rect className="bar-missed" x={centerX - barWidth / 2} y={baseline - deliveredHeight - missedHeight} width={barWidth} height={Math.max(0, missedHeight)} rx="2.5" />}
                  {!point.recorded && <circle className="plan-dot" cx={centerX} cy={targetY} r="2.5" />}
                  <line className="target-tick" x1={centerX - barWidth / 2 - 4} x2={centerX + barWidth / 2 + 4} y1={targetY} y2={targetY} />
                  <text className="tick" x={centerX} y={baseline + 14}>{point.label}</text>
                  {point.recorded && index % 2 === 0 && <text className="tick value" x={centerX} y={baseline - deliveredHeight - missedHeight - 6}>{num(point.delivered)}</text>}
                </g>
              );
            })}
          </svg>
          {totals.days === 0 && <p className="bm-sheet-note">{t('businessModel.report.noDataBars')}</p>}
        </section>

        {/* Miss analysis — where the lost deliveries went */}
        <section className="bm-sheet-panel">
          <h3>{bi('businessModel.report.missAnalysisHead')}</h3>
          {totals.reasonTotals.length === 0
            ? <p className="bm-sheet-note">{t('businessModel.report.noMissesLogged', { lng })}</p>
            : <div className="bm-miss-list">
                {totals.reasonTotals.map(entry => (
                  <div key={entry.key} className="bm-miss-row">
                    <span>{t(`businessModel.report.${entry.key}`, { lng })}</span>
                    <i><b style={{ width: `${Math.max(3, entry.count / Math.max(1, totals.missed) * 100)}%` }} /></i>
                    <strong>{num(entry.count)}</strong>
                    <small>{Math.round(entry.count / Math.max(1, totals.missed) * 100)}%</small>
                  </div>
                ))}
              </div>}
        </section>

        {/* Customer scorecard — worst accounts first, trend vs trailing week */}
        {model.customerPerformance.length > 0 && (
          <section className="bm-sheet-panel">
            <h3>{bi('businessModel.report.scorecardHead')}</h3>
            <div className="bm-sheet-tablewrap">
              <table>
                <thead>
                  <tr>{[t('businessModel.customers.colCustomer', { lng }), labels.kpiDelivered, labels.kpiMissed, labels.thMissRate, t('businessModel.report.thTrend', { lng })].map((h, i) => <th key={`${h}-${i}`}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {model.customerPerformance.map(row => (
                    <tr key={row.id}>
                      <th scope="row">{row.name}</th>
                      <td className="good">{num(row.delivered)}</td>
                      <td className={row.missed > 0 ? 'bad' : ''}>{num(row.missed)}</td>
                      <td className={row.missRatePercent > 15 ? 'bad' : row.missRatePercent > 8 ? '' : 'good'}>{fmtPercent(locale, row.missRatePercent, 1)}</td>
                      <td>{renderTrend(row, locale, t, lng)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Driver scorecard — worst miss rate first, trend vs trailing week (R6) */}
        {model.driverPerformance.length > 0 && (
          <section className="bm-sheet-panel" data-testid="driver-scorecard">
            <h3>{bi('businessModel.report.driverScorecardHead')}</h3>
            <p className="bm-sheet-note">{bi('businessModel.report.driverScorecardDesc')}</p>
            <div className="bm-sheet-tablewrap">
              <table>
                <thead>
                  <tr>{[labels.thDriver, labels.thCar, labels.thPlate, labels.kpiDelivered, labels.kpiMissed, labels.thAttempts, labels.thMissRate, labels.thTrend].map((h, i) => <th key={`${h}-${i}`}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {model.driverPerformance.map(row => (
                    <tr key={row.key} data-testid={`driver-scorecard-row-${row.key}`}>
                      <th scope="row">{row.driverName}</th>
                      <td>{row.carNumber ?? '—'}</td>
                      <td>{row.plateNumber ?? '—'}</td>
                      <td className="good">{num(row.delivered)}</td>
                      <td className={row.missed > 0 ? 'bad' : ''}>{num(row.missed)}</td>
                      <td>{num(row.attempts)}</td>
                      <td className={row.missRatePercent > 15 ? 'bad' : row.missRatePercent > 8 ? '' : 'good'}>{fmtPercent(locale, row.missRatePercent, 1)}</td>
                      <td>{renderTrend(row, locale, t, lng)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {model.driverPerformance.length === 0 && (
          <section className="bm-sheet-panel">
            <h3>{bi('businessModel.report.driverScorecardHead')}</h3>
            <p className="bm-sheet-note">{bi('businessModel.report.noDriverData')}</p>
          </section>
        )}

        {/* COD remittance lag — days between operation and remittance (R6) */}
        {model.codRemittanceLag.length > 0 && (
          <section className="bm-sheet-panel" data-testid="cod-lag">
            <h3>{bi('businessModel.report.codLagHead')}</h3>
            <p className="bm-sheet-note">{bi('businessModel.report.codLagDesc')}</p>
            <div className="bm-sheet-tablewrap">
              <table>
                <thead>
                  <tr>{[labels.thDate, labels.thCollected, labels.thRemitted, labels.thLagDays].map((h, i) => <th key={`${h}-${i}`}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {model.codRemittanceLag.map(point => (
                    <tr key={point.date} data-testid={`cod-lag-row-${point.date}`}>
                      <th scope="row">{point.label}</th>
                      <td>{fmtSar(locale, point.collected)}</td>
                      <td>{fmtSar(locale, point.remitted)}</td>
                      <td className={point.lagDays > 1 ? 'bad' : 'good'}>{point.lagDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="bm-sheet-note">{bi('businessModel.report.codLagTarget')}</p>
          </section>
        )}
        {model.codRemittanceLag.length === 0 && (
          <section className="bm-sheet-panel">
            <h3>{bi('businessModel.report.codLagHead')}</h3>
            <p className="bm-sheet-note">{bi('businessModel.report.noCodLag')}</p>
          </section>
        )}

        {/* Fuel control — daily fuel cost vs model expectation (R6) */}
        {model.fuelControl.length > 0 && (
          <section className="bm-sheet-panel" data-testid="fuel-control">
            <h3>{bi('businessModel.report.fuelControlHead')}</h3>
            <p className="bm-sheet-note">{bi('businessModel.report.fuelControlDesc')}</p>
            <div className="bm-sheet-tablewrap">
              <table>
                <thead>
                  <tr>{[labels.thDate, labels.thActual, labels.thModel, labels.thFuelVariance].map((h, i) => <th key={`${h}-${i}`}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {model.fuelControl.map(point => (
                    <tr key={point.date} data-testid={`fuel-control-row-${point.date}`}>
                      <th scope="row">{point.label}</th>
                      <td>{fmtSar(locale, point.actual)}</td>
                      <td>{fmtSar(locale, point.model)}</td>
                      <td className={point.variancePercent > 15 ? 'bad' : point.variancePercent < -15 ? 'good' : ''}>{point.variancePercent >= 0 ? '+' : ''}{fmtPercent(locale, point.variancePercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {model.fuelControl.length === 0 && (
          <section className="bm-sheet-panel">
            <h3>{bi('businessModel.report.fuelControlHead')}</h3>
            <p className="bm-sheet-note">{bi('businessModel.report.noFuelData')}</p>
          </section>
        )}

        {/* Failure Pareto — vital few reasons driving most misses (R6) */}
        {model.failurePareto.length > 0 && (
          <section className="bm-sheet-panel" data-testid="failure-pareto">
            <h3>{bi('businessModel.report.failureParetoHead')}</h3>
            <p className="bm-sheet-note">{bi('businessModel.report.failureParetoDesc')}</p>
            <div className="bm-sheet-tablewrap">
              <table>
                <thead>
                  <tr>{[t('businessModel.report.missAnalysisHead', { lng }), labels.thCount, labels.thShare, labels.thCumulative].map((h, i) => <th key={`${h}-${i}`}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {model.failurePareto.map(entry => (
                    <tr key={entry.key} data-testid={`failure-pareto-row-${entry.key}`}>
                      <th scope="row">{t(`businessModel.report.${entry.key}`, { lng })}</th>
                      <td>{num(entry.count)}</td>
                      <td>{fmtPercent(locale, entry.percent)}</td>
                      <td>{fmtPercent(locale, entry.cumulativePercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {model.failurePareto.length === 0 && (
          <section className="bm-sheet-panel">
            <h3>{bi('businessModel.report.failureParetoHead')}</h3>
            <p className="bm-sheet-note">{bi('businessModel.report.noFailureData')}</p>
          </section>
        )}

        {/* Cost per delivered stop — fully loaded, per recorded day */}
        {model.costPerStopSeries.length >= 2 && (
          <section className="bm-sheet-panel">
            <div className="bm-panel-head"><h3>{bi('businessModel.report.costTrendHead')}</h3>
              <span className="bm-trend-now">{fmtSar(locale, model.costPerStopSeries.at(-1)?.value ?? 0)}</span></div>
            <svg className="bm-sheet-chart bm-spark" viewBox="0 0 600 120" role="img" aria-label={bi('businessModel.report.costTrendHead')}>
              {(() => {
                const values = model.costPerStopSeries.map(point => point.value);
                const max = Math.max(...values), min = Math.min(...values);
                const span = Math.max(0.01, max - min);
                const step = 560 / (values.length - 1);
                const y = (value: number) => 100 - ((value - min) / span) * 80;
                const points = values.map((value, index) => `${20 + index * step},${y(value)}`).join(' ');
                return <>
                  {[0.5, 1].map(fraction => <line key={fraction} className="gridline" x1="20" x2="580" y1={100 - fraction * 80} y2={100 - fraction * 80} />)}
                  <polyline className="spark-line" points={points} />
                  {model.costPerStopSeries.map((point, index) => (
                    <circle key={point.date} className={index === values.length - 1 ? 'spark-dot last' : 'spark-dot'} cx={20 + index * step} cy={y(point.value)} r={index === values.length - 1 ? 4 : 2.5}>
                      <title>{`${point.label}: ${fmtSar(locale, point.value)} · ${point.completed} ${locale === 'ar' ? 'توصيلة' : 'stops'}`}</title>
                    </circle>
                  ))}
                  <text className="tick" x="20" y="116">{model.costPerStopSeries[0].label}</text>
                  <text className="tick" x="580" y="116" textAnchor="end">{model.costPerStopSeries.at(-1)?.label}</text>
                  <text className="tick value" x="20" y="12">{fmtSar(locale, min)}</text>
                  <text className="tick value" x="580" y="12" textAnchor="end">{fmtSar(locale, max)}</text>
                </>;
              })()}
            </svg>
          </section>
        )}

        {/* Recovery board snapshot */}
        {model.recoveryBoard && (
          <section className="bm-sheet-panel">
            <h3>{bi('businessModel.report.recoveryHead')}</h3>
            <p className="bm-sheet-recovery-note">
              {t('businessModel.report.recoverySummary', { lng: lng === 'both' ? 'en' : lng, pending: model.recoveryBoard.pendingShipments, recovered: model.recoveryBoard.recoveredShipments, rate: model.recoveryBoard.closeRatePercent })}
              {lng === 'both' && <> · {t('businessModel.report.recoverySummary', { lng: 'ar', pending: model.recoveryBoard.pendingShipments, recovered: model.recoveryBoard.recoveredShipments, rate: model.recoveryBoard.closeRatePercent })}</>}
            </p>
            {model.recoveryTrend && model.recoveryTrend.some(week => week.recovered + week.writtenOff > 0) && (
              <div className="bm-recovery-trend">
                {model.recoveryTrend.map(week => {
                  const total = week.recovered + week.writtenOff;
                  const recoveredShare = total > 0 ? Math.round(week.recovered / total * 100) : 0;
                  return (
                    <div key={week.weekStart} className="bm-week-col" title={`${week.label}: ${t('businessModel.report.legendRecoveredCount', { lng, count: week.recovered })} · ${t('businessModel.report.legendWrittenOff', { lng, count: week.writtenOff })}`}>
                      <div className="bm-week-bars">
                        {total > 0 ? <>
                          <b className="rec" style={{ height: `${Math.max(6, recoveredShare)}%` }} />
                          <b className="woff" style={{ height: `${Math.max(6, 100 - recoveredShare)}%` }} />
                        </> : <b className="empty" style={{ height: '6%' }} />}
                      </div>
                      <small>{week.label}</small>
                      <strong>{week.recovered}</strong>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Fleet & crew status */}
        <section className="bm-sheet-panel">
          <h3>{bi('businessModel.report.fleetCrewHead')}</h3>
          <dl className="bm-facts bm-facts-plain">
            {(model.record.driverName || model.record.plateNumber) && <div><dt>{bi('businessModel.daily.driverName')}{model.record.carNumber ? ` · ${bi('businessModel.daily.carNumber')}` : ''}</dt><dd>{model.record.driverName ?? '—'}{model.record.carNumber ? ` · ${model.record.carNumber}` : ''}{model.record.plateNumber ? ` · ${bi('businessModel.daily.plateNumber')} ${model.record.plateNumber}` : ''}</dd></div>}
            <div><dt>{bi('businessModel.daily.driversPresent')}</dt><dd>{num(model.record.driversPresent)} / {num(model.driversTotal)}</dd></div>
            <div><dt>{bi('businessModel.daily.fuelSpent')}</dt><dd>{fmtSar(locale, model.record.fuelCost)} <small>({locale === 'ar' ? 'المتوقع' : 'model'} {fmtSar(locale, Math.round(model.expectedDailyFuel))})</small></dd></div>
            <div><dt>{bi('businessModel.report.safetyIncidents')}</dt><dd className={(model.record.safetyIncidents ?? 0) > 0 ? 'text-bad' : ''}>{num(model.record.safetyIncidents ?? 0)}</dd></div>
            <div><dt>{bi('businessModel.report.costPerStop')}</dt><dd>{fmtSar(locale, metrics.allocatedCost / Math.max(1, model.record.completedShipments))}</dd></div>
            <div><dt>{bi('businessModel.report.codShipments')}</dt><dd>{num(model.record.codShipments ?? 0)} <small>({locale === 'ar' ? 'نقدي' : 'COD'})</small></dd></div>
            <div><dt>{bi('businessModel.report.cashCollected')}</dt><dd>{fmtSar(locale, model.record.cashCollectedSar ?? 0)}</dd></div>
            {model.totals.cashOutstandingSar !== 0 && <div><dt>{bi('businessModel.report.cashOutstanding')}</dt><dd className={model.totals.cashOutstandingSar > 0 ? 'text-bad' : ''}>{fmtSar(locale, model.totals.cashOutstandingSar)}</dd></div>}
            {(model.record.extraCosts ?? 0) > 0 && <div><dt>{bi('businessModel.report.extraCosts')}</dt><dd>{fmtSar(locale, model.record.extraCosts ?? 0)}</dd></div>}
            {totals.podTrackedDays > 0 && <div><dt>{bi('businessModel.report.podLine')}</dt><dd className={totals.podIncompleteDays > 0 ? 'text-bad' : ''}>{t('businessModel.report.podShareLine', { lng: lng === 'both' ? 'en' : lng, complete: totals.podTrackedDays - totals.podIncompleteDays, tracked: totals.podTrackedDays })}{lng === 'both' && <> · {t('businessModel.report.podShareLine', { lng: 'ar', complete: totals.podTrackedDays - totals.podIncompleteDays, tracked: totals.podTrackedDays })}</>}</dd></div>}
          </dl>
        </section>

        {/* Open follow-up actions with owners */}
        {model.openActions && model.openActions.length > 0 && (
          <section className="bm-sheet-panel">
            <h3>{bi('businessModel.report.openActionsHead')}</h3>
            <ul className="bm-sheet-open-actions">
              {model.openActions.map(action => (
                <li key={action.id}><strong>{action.text}</strong><span>{action.owner}</span></li>
              ))}
            </ul>
          </section>
        )}

        <section className="bm-sheet-panel">
          <h3>{bi('businessModel.report.insights')}</h3>
          <ul className="bm-sheet-insights">
            {insights.map(insight => {
              const levelClass = insight.level === 'good' ? 'good' : insight.level === 'warn' ? 'warn' : 'bad';
              const params = { ...insight.params, reason: insight.reasonKey ? t(`businessModel.report.${insight.reasonKey}`, { lng }) : '' };
              return (
                <li key={insight.key} className={levelClass}>
                  {t(`businessModel.report.${INSIGHT_KEY_TO_LOCALE[insight.key]}`, { lng: lng === 'both' ? 'en' : lng, ...params })}
                  {lng === 'both' && <span dir="rtl" className="bm-insight-ar">{t(`businessModel.report.${INSIGHT_KEY_TO_LOCALE[insight.key]}`, { lng: 'ar', ...params })}</span>}
                </li>
              );
            })}
          </ul>
        </section>

        {monthly.length > 0 && (
          <section className="bm-sheet-panel">
            <h3>{labels.tableVariance}</h3>
            <div className="bm-sheet-tablewrap">
              <table>
                <thead>
                  <tr>{[labels.thMonth, labels.thDays, labels.thDelivered, labels.thMissed, labels.thCompletion, labels.thRevenue, labels.thPlanned, labels.thVariance].map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {monthly.map(row => (
                    <tr key={row.month}>
                      <th scope="row">{row.month}</th>
                      <td>{num(row.recordedDays)}</td>
                      <td>{num(row.completedShipments)}</td>
                      <td className={row.failedShipments > 0 ? 'bad' : ''}>{num(row.failedShipments)}</td>
                      <td>{fmtPercent(locale, row.completionRate)}</td>
                      <td>{fmtSar(locale, row.actualRevenue)}</td>
                      <td>{fmtSar(locale, row.plannedRevenue)}</td>
                      <td className={row.variancePercent >= 0 ? 'good' : 'bad'}>{row.variancePercent >= 0 ? '+' : ''}{fmtPercent(locale, row.variancePercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {totals.days > 0 && (
          <section className="bm-sheet-panel">
            <h3>{labels.sectionHistoryTable}</h3>
            <div className="bm-sheet-tablewrap">
              <table>
                <thead>
                  <tr>{[labels.thDate, labels.thAttempts, labels.thDelivered, labels.thMissed, labels.thDrivers, labels.thFuel].map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {series.filter(point => point.recorded).map(point => {
                    const source = point.date === model.focusDate ? model.record : null;
                    return (
                      <tr key={point.date}>
                        <th scope="row">{fmtReportDate(locale, point.date)}</th>
                        <td>{num(point.delivered + point.missed)}</td>
                        <td className="good">{num(point.delivered)}</td>
                        <td className={point.missed > 0 ? 'bad' : ''}>{num(point.missed)}</td>
                        <td>{source ? num(source.driversPresent) : '—'}</td>
                        <td>{source ? fmtSar(locale, source.fuelCost) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {model.record.tomorrowNote && (
          <section className="bm-sheet-panel bm-sheet-tomorrow">
            <h3>{bi('businessModel.report.nextDayFocus')}</h3>
            <p>{model.record.tomorrowNote}</p>
          </section>
        )}

        <footer className="bm-sheet-foot">
          <span>{labels.confidential}</span>
          <span className="bm-sheet-mark">VEGA · {new Date().getFullYear()}</span>
        </footer>
      </article>
    </div>
  );
}

function Kpi({ label, value, tone, sub }: { label: string; value: string; tone?: 'good' | 'bad' | 'warn'; sub?: string }) {
  return <div className={`bm-sheet-kpi ${tone ?? ''}`}><span>{label}</span><strong>{value}</strong>{sub && <small>{sub}</small>}</div>;
}
