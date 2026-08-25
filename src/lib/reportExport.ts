import type { FinancialInput, FinancialOutput } from '@/lib/types';
import { buildCustomerPerformance, calculateDailyMetrics, type DailyRecord } from '@/lib/operationsReporting';
import {
  deriveStatus,
  fmtInt,
  fmtPercent,
  fmtReportDate,
  fmtSar,
  type InsightKey,
  type ReportModel,
} from '@/lib/reportEngine';
import { buildWeeklyRecoveryTrend, entryAgeDays, RECOVERY_TARGETS } from '@/lib/recoveryBoard';

const amount = (value: number) => Math.round(value * 100) / 100;

/* ── Localized strings for generated documents. Built by the caller from
      i18next so this lib stays translation-free. ──────────────────────── */
export interface ReportLabels {
  dailySheetTitle: string; proTitle: string; brandLine: string;
  reportDate: string; recordedAt: string; unsavedDraft: string;
  preparedAt: string; period: string; focusDay: string; windowTotals: string; confidential: string;
  plannedShipments: string; completedShipments: string; failedShipments: string; completionRate: string;
  driversPresent: string; fuelUsed: string; fuelCostLabel: string; safetyIncidents: string; dailyRevenue: string; allocatedCost: string; dailyProfit: string;
  notes: string; noNotes: string; nextDayFocus: string;
  statusGreen: string; statusAmber: string; statusRed: string;
  openActionsHead: string; fleetCrewHead: string;
  recoveryHead: string; recoverySummary: string; costPerStop: string;
  kpiDelivered: string; kpiMissed: string; kpiTarget: string; kpiCompletion: string; kpiTargetHit: string; kpiProfit: string;
  chartDelivery: string; legendDelivered: string; legendMissed: string; legendTarget: string;
  missAnalysisHead: string;
  tableVariance: string; thMonth: string; thDays: string; thDelivered: string; thMissed: string;
  thCompletion: string; thRevenue: string; thPlanned: string; thVariance: string;
  insights: string; sectionHistoryTable: string; thDate: string; thAttempts: string; thDrivers: string; thFuel: string;
  insightNoRecords: string; insightSingleDay: string; insightAboveTarget: string; insightOnTarget: string;
  insightBelowTarget: string; insightMissRateGood: string; insightMissRateWatch: string; insightMissRateHigh: string;
  insightFuelOverModel: string; insightDriverShortfall: string; insightLossDay: string;
  insightTopMissReason: string; insightExtraCosts: string; insightVisitsLogged: string; insightRecoveries: string; insightIncidents: string;
  insightCustomerMisses: string; insightPodGap: string;
  scorecardHead: string; thMissRate: string; podLine: string;
  thTrend: string; podShareLine: string;
  codShipments: string; prepaidShipments: string; cashCollected: string; cashOutstanding: string;
  costTrendHead: string; thOwner: string; thDaysOpen: string; targetLine: string;
  // R6 operational analytics labels
  driverScorecardHead: string; driverScorecardDesc: string; thDriver: string; thCar: string; thPlate: string; noDriverData: string;
  codLagHead: string; codLagDesc: string; thLagDays: string; thCollected: string; thRemitted: string; codLagTarget: string; noCodLag: string;
  fuelControlHead: string; fuelControlDesc: string; thActual: string; thModel: string; thFuelVariance: string; fuelOverModel: string; noFuelData: string;
  failureParetoHead: string; failureParetoDesc: string; thCount: string; thShare: string; thCumulative: string; noFailureData: string;
}

const INSIGHT_LABEL_KEYS: Record<InsightKey, keyof ReportLabels> = {
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

function fillTemplate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(params[key] ?? ''));
}

/* ── Arabic font embedding (IBM Plex Sans Arabic, OFL — self-hosted). ─── */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const FONT_FILES = { normal: 'IBMPlexSansArabic-Regular.ttf', bold: 'IBMPlexSansArabic-SemiBold.ttf', heavy: 'IBMPlexSansArabic-Bold.ttf' } as const;
const bufferCache = new Map<string, ArrayBuffer>();

async function fetchFont(file: string): Promise<ArrayBuffer> {
  const cached = bufferCache.get(file);
  if (cached) return cached;
  const response = await fetch(`${BASE}/fonts/${file}`);
  if (!response.ok) throw new Error(`Font ${file} unavailable (${response.status})`);
  const buffer = await response.arrayBuffer();
  bufferCache.set(file, buffer);
  return buffer;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

async function embedArabicFonts(doc: import('jspdf').jsPDF): Promise<void> {
  for (const [style, file] of Object.entries(FONT_FILES)) {
    doc.addFileToVFS(file, toBase64(await fetchFont(file)));
    doc.addFont(file, 'PlexArabic', style === 'heavy' ? 'bold' : style === 'bold' ? 'semibold' : 'normal');
  }
}
type PdfStyle = 'normal' | 'semibold' | 'bold';

interface PdfTheme {
  pine: [number, number, number];
  pineDeep: [number, number, number];
  brass: [number, number, number];
  red: [number, number, number];
  greenTint: [number, number, number];
  redTint: [number, number, number];
  paper: [number, number, number];
  ink: [number, number, number];
  muted: [number, number, number];
  line: [number, number, number];
}
const THEME: PdfTheme = {
  pine: [28, 74, 54], pineDeep: [19, 41, 31], brass: [164, 118, 31], red: [172, 58, 46],
  greenTint: [223, 234, 221], redTint: [244, 223, 217], paper: [251, 250, 244],
  ink: [27, 35, 30], muted: [95, 105, 97], line: [221, 215, 196],
};

interface BilingualOptions {
  /** Secondary-language line drawn beneath the primary text. */
  sub?: string;
}

class ReportDoc {
  readonly doc: import('jspdf').jsPDF;
  readonly rtl: boolean;
  private y = 0;
  constructor(doc: import('jspdf').jsPDF, locale: 'en' | 'ar', readonly bi = false) {
    this.doc = doc;
    this.rtl = locale === 'ar';
    this.y = 16;
  }
  get cursor(): number { return this.y; }
  set cursor(value: number) { this.y = value; }
  /** x anchored to the reading side (right in Arabic). */
  edge(): number { return this.rtl ? 192 : 18; }
  span(): number { return 174; }
  text(value: string, x: number, options: { size?: number; style?: PdfStyle; color?: [number, number, number]; align?: 'left' | 'right' | 'center'; maxWidth?: number } = {}) {
    const { size = 10, color = THEME.ink, align = this.rtl ? 'right' : 'left', maxWidth } = options;
    this.doc.setFont(this.rtl ? 'PlexArabic' : 'helvetica', this.styleOf(options.style ?? 'normal'));
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
    this.doc.text(value, x, this.y, { align, maxWidth });
  }
  /** jsPDF built-ins lack 'semibold'; map it to bold for Helvetica. */
  private styleOf(style: PdfStyle): string {
    if (!this.rtl && style === 'semibold') return 'bold';
    return style;
  }
  styleOfPublic(style: PdfStyle): string { return this.styleOf(style); }
  /** Draw text plus its bilingual counterpart stacked underneath. */
  dual(value: string, x: number, options: Parameters<ReportDoc['text']>[2] & BilingualOptions = {}) {
    const { sub, ...rest } = options;
    const size = rest.size ?? 10;
    this.text(value, x, { ...rest, size });
    if (this.bi && sub) {
      const keepY = this.y;
      this.y += size * 0.52;
      this.text(sub, x, { ...rest, size: size * 0.74, color: rest.color ?? THEME.muted });
      this.y = keepY;
    }
  }
  band(height: number, color: [number, number, number]) {
    this.doc.setFillColor(...color);
    this.doc.rect(0, this.y - height + 8, 210, height, 'F');
  }
  row(cells: { text: string; sub?: string; weight?: boolean; color?: [number, number, number] }[], stripe = false) {
    const width = this.span();
    const left = Math.min(this.edge(), this.edge() - width);
    const height = cells.some(cell => cell.sub && this.bi) ? 12 : 9;
    if (stripe) { this.doc.setFillColor(244, 242, 232); this.doc.rect(left, this.y - 5.5, width, height, 'F'); }
    // Column order flips with direction; first cell is the label.
    const positions = this.rtl
      ? [this.edge(), left + 1]
      : [left + 3, this.edge()];
    cells.forEach((cell, index) => {
      const align = index === 0 ? (this.rtl ? 'right' : 'left') : (this.rtl ? 'left' : 'right');
      this.doc.setFont(this.rtl ? 'PlexArabic' : 'helvetica', cell.weight ? this.styleOf('semibold') : 'normal');
      this.doc.setFontSize(10);
      this.doc.setTextColor(...(cell.color ?? THEME.ink));
      this.doc.text(cell.text, positions[index], this.y + 1.5, { align });
      if (cell.sub && this.bi) {
        this.doc.setFontSize(7.2);
        this.doc.setTextColor(...THEME.muted);
        this.doc.text(cell.sub, positions[index], this.y + 5.4, { align });
        this.doc.setFontSize(10);
      }
    });
    this.y += cells.some(cell => cell.sub && this.bi) ? 12 : 9;
  }
  newPage() { this.doc.addPage(); this.y = 18; }
}

/** Shared quick daily sheet — bilingual, one page. */
export async function exportDailyReportPdf(
  record: DailyRecord,
  input: FinancialInput,
  output: FinancialOutput,
  options?: { locale?: 'en' | 'ar'; bilingual?: boolean; labels?: Partial<ReportLabels>; labelsAlt?: Partial<ReportLabels> },
) {
  const locale = options?.locale ?? 'en';
  const bilingual = options?.bilingual ?? false;
  const labels = options?.labels;
  const altLabels = bilingual ? options?.labelsAlt : undefined;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  if (locale === 'ar' || bilingual) await embedArabicFonts(doc);
  const sheet = new ReportDoc(doc, locale, bilingual);
  // Bilingual helper: primary string from `labels`, secondary from `altLabels`.
  const pick = (key: keyof ReportLabels, fallback: string) => ({
    main: labels?.[key] ?? fallback,
    sub: (bilingual && altLabels?.[key]) || undefined,
  });
  const metrics = calculateDailyMetrics(record, input, output);
  const L = (key: keyof ReportLabels, fallback: string) => labels?.[key] ?? fallback;

  const titleT = pick('dailySheetTitle', 'VEGA Daily Operations Report');
  sheet.band(bilingual ? 32 : 26, THEME.pine);
  sheet.cursor = bilingual ? 18 : 20;
  sheet.dual(titleT.main, sheet.edge(), { sub: titleT.sub, size: 17, style: 'bold', color: [245, 246, 236] });
  sheet.cursor = bilingual ? 34 : 27;
  sheet.text(`${L('brandLine', 'VEGA Logistics OS')} · ${L('reportDate', 'Report date')}: ${fmtReportDate(locale, record.date)}`, sheet.edge(), { size: 9.5, color: [214, 222, 210] });

  sheet.cursor = bilingual ? 47 : 40;
  sheet.text(record.updatedAt ? `${L('recordedAt', 'Recorded')}: ${new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-SA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(record.updatedAt))}` : L('unsavedDraft', 'Status: unsaved draft'), sheet.edge(), { size: 9, color: THEME.muted });

  sheet.cursor += 6;
  const rows: Array<[string, string, [number, number, number]?]> = [
    [L('plannedShipments', 'Planned shipments'), fmtInt(locale, metrics.plannedShipments)],
    [L('completedShipments', 'Completed shipments'), fmtInt(locale, record.completedShipments), THEME.pine],
    [L('failedShipments', 'Failed shipments'), fmtInt(locale, record.failedShipments), THEME.red],
    [L('completionRate', 'Completion rate'), fmtPercent(locale, metrics.completionRate)],
    [L('driversPresent', 'Drivers present'), `${fmtInt(locale, record.driversPresent)} / ${fmtInt(locale, input.companyDriverCount)}`],
    [L('fuelUsed', 'Fuel spent'), fmtSar(locale, record.fuelCost)],
    [L('fuelCostLabel', 'Fuel cost'), fmtSar(locale, metrics.fuelCost)],
    [L('dailyRevenue', 'Daily revenue'), fmtSar(locale, metrics.revenue)],
    [L('allocatedCost', 'Allocated daily cost'), fmtSar(locale, metrics.allocatedCost)],
    [L('dailyProfit', 'Daily profit / loss'), fmtSar(locale, metrics.profit), metrics.profit < 0 ? THEME.red : THEME.pine],
  ];
  const rowKeys: Array<keyof ReportLabels> = ['plannedShipments','completedShipments','failedShipments','completionRate','driversPresent','fuelUsed','fuelCostLabel','dailyRevenue','allocatedCost','dailyProfit'];
  rows.forEach((row, index) => {
    const labelPair = pick(rowKeys[index], String(row[0]));
    sheet.row([
      { text: labelPair.main, sub: labelPair.sub, color: THEME.muted },
      { text: row[1], weight: true, color: row[2] ?? THEME.ink },
    ], index % 2 === 0);
  });

  sheet.cursor += 4;
  sheet.text(L('notes', 'Notes'), sheet.edge(), { size: 11, style: 'bold' });
  sheet.cursor += 7;
  sheet.text(record.notes || L('noNotes', 'No notes recorded.'), sheet.edge(), { size: 10, color: [60, 70, 63], maxWidth: sheet.span() });

  sheet.cursor = 286;
  sheet.text(L('confidential', 'Generated from the local VEGA business model. Verify inputs before operational use.'), sheet.edge(), { size: 8, color: THEME.muted, maxWidth: sheet.span() });
  doc.save(`vega-daily-report-${record.date}.pdf`);
}

/** Pro dossier — multi-page, vector charts, fully localized, optional EN+AR. */
export async function exportProReportPdf(model: ReportModel, labels: ReportLabels, labelsAlt?: ReportLabels) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const bilingual = model.bilingual === true;
  if (model.locale === 'ar' || bilingual) await embedArabicFonts(doc);
  const pdf = new ReportDoc(doc, model.locale, bilingual);
  // Bilingual pair for a label key.
  const pair = (key: keyof ReportLabels): { main: string; sub?: string } => ({
    main: labels[key],
    sub: (bilingual && labelsAlt?.[key]) || undefined,
  });
  const { totals, series, metrics, monthly } = model;
  const locale = model.locale;

  /* Page 1 — cover band + narrative + KPI grid + delivery chart + insights */
  pdf.band(bilingual ? 42 : 34, THEME.pineDeep);
  pdf.cursor = bilingual ? 19 : 22;
  const titlePair = pair('proTitle');
  pdf.dual(titlePair.main, pdf.edge(), { sub: titlePair.sub, size: 19, style: 'bold', color: [245, 246, 236] });
  pdf.cursor += bilingual ? 12 : 8;
  pdf.text(labels.brandLine, pdf.edge(), { size: 10, color: [180, 196, 178] });
  pdf.cursor = bilingual ? 53 : 44;
  pdf.text(`${labels.focusDay}: ${fmtReportDate(locale, model.focusDate)} · ${labels.period.replace('{{days}}', String(series.length))}`, pdf.edge(), { size: 9.5, color: THEME.muted });
  pdf.cursor += 5.5;
  pdf.text(labels.preparedAt.replace('{{value}}', new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-SA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())), pdf.edge(), { size: 9.5, color: THEME.muted });

  /* KPI cards — 2 rows × 3 columns */
  const cardWidth = 56, gap = 3, gridTop = pdf.cursor + 4;
  const cards: Array<{ label: string; value: string; tone: [number, number, number] | null }> = [
    { label: labels.kpiDelivered, value: fmtInt(locale, totals.delivered), tone: THEME.pine },
    { label: labels.kpiMissed, value: fmtInt(locale, totals.missed), tone: totals.missed > 0 ? THEME.red : null },
    { label: labels.kpiTargetHit, value: fmtPercent(locale, totals.targetAchievedPercent, 0), tone: totals.targetAchievedPercent >= 98 ? THEME.pine : totals.targetAchievedPercent >= 85 ? THEME.brass : THEME.red },
    { label: labels.kpiCompletion, value: fmtPercent(locale, totals.completionRate, 1), tone: totals.completionRate >= 95 ? THEME.pine : THEME.red },
    { label: labels.kpiProfit, value: fmtSar(locale, totals.profit), tone: totals.profit < 0 ? THEME.red : THEME.pine },
    { label: labels.kpiTarget, value: `${fmtInt(locale, metrics.plannedShipments)} / ${locale === 'ar' ? 'يوم' : 'day'}`, tone: null },
  ];
  const cardKeys: Array<keyof ReportLabels> = ['kpiDelivered','kpiMissed','kpiTargetHit','kpiCompletion','kpiProfit','kpiTarget'];
  const cardHeight = bilingual ? 25 : 21;
  cards.forEach((card, index) => {
    const column = index % 3, row = Math.floor(index / 3);
    const x = pdf.rtl ? 192 - cardWidth - column * (cardWidth + gap) : 18 + column * (cardWidth + gap);
    const y = gridTop + row * (cardHeight + 3);
    const labelPair = pair(cardKeys[index]);
    pdf.doc.setFillColor(...THEME.paper);
    pdf.doc.setDrawColor(...THEME.line);
    pdf.doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');
    pdf.doc.setFont(pdf.rtl ? 'PlexArabic' : 'helvetica', pdf.styleOfPublic('normal'));
    pdf.doc.setFontSize(7.5);
    pdf.doc.setTextColor(...THEME.muted);
    pdf.doc.text(labelPair.main, x + cardWidth / 2, y + 7, { align: 'center' });
    if (labelPair.sub) {
      pdf.doc.setFontSize(6.4);
      pdf.doc.text(labelPair.sub, x + cardWidth / 2, y + 10.8, { align: 'center' });
      pdf.doc.setFontSize(7.5);
    }
    pdf.doc.setFont(pdf.rtl ? 'PlexArabic' : 'helvetica', pdf.styleOfPublic('semibold'));
    pdf.doc.setFontSize(12.5);
    pdf.doc.setTextColor(...(card.tone ?? THEME.ink));
    pdf.doc.text(card.value, x + cardWidth / 2, y + (bilingual ? 20 : 15.5), { align: 'center' });
  });
  pdf.cursor = gridTop + (cards.length / 3) * (cardHeight + 3) + 8;

  /* Stacked delivery bars vs target line */
  const chartPair = pair('chartDelivery');
  pdf.dual(chartPair.main, pdf.edge(), { sub: chartPair.sub, size: 12, style: 'bold' });
  pdf.cursor += bilingual ? 8 : 4;
  drawDeliveryChart(pdf, series, labels);

  /* Miss analysis — where the lost deliveries went */
  if (totals.reasonTotals.length > 0) {
    pdf.cursor += 2;
    const missPair = pair('missAnalysisHead');
    pdf.dual(missPair.main, pdf.edge(), { sub: missPair.sub, size: 12, style: 'bold' });
    pdf.cursor += 6;
    const maxReason = Math.max(...totals.reasonTotals.map(entry => entry.count), 1);
    totals.reasonTotals.slice(0, 5).forEach(entry => {
      const labelEn = labels[entry.key as keyof ReportLabels] ?? entry.key;
      const barWidth = Math.max(4, entry.count / maxReason * 110);
      const barX = pdf.rtl ? pdf.edge() - 118 : pdf.edge() - pdf.span();
      // Label on the reading side, bar filling toward it.
      pdf.doc.setFont(pdf.rtl ? 'PlexArabic' : 'helvetica', pdf.styleOfPublic('normal'));
      pdf.doc.setFontSize(9);
      pdf.doc.setTextColor(...THEME.ink);
      pdf.doc.text(pdf.rtl ? labelEn : labelEn, pdf.rtl ? pdf.edge() : pdf.edge() - pdf.span(), pdf.cursor + 1, { align: pdf.rtl ? 'right' : 'left' });
      pdf.doc.setFillColor(...THEME.red);
      pdf.doc.roundedRect(pdf.rtl ? barX : barX + 34, pdf.cursor - 3, barWidth * 0.72, 4.6, 1.5, 1.5, 'F');
      pdf.doc.setFont(pdf.rtl ? 'PlexArabic' : 'helvetica', pdf.styleOfPublic('semibold'));
      pdf.doc.text(String(entry.count), pdf.rtl ? barX - 2 : barX + 40 + barWidth * 0.72, pdf.cursor + 1, { align: pdf.rtl ? 'left' : 'left' });
      pdf.cursor += 7.5;
    });
    pdf.cursor += 2;
  }

  /* Insights box */
  pdf.cursor += 6;
  const insightsPair = pair('insights');
  pdf.dual(insightsPair.main, pdf.edge(), { sub: insightsPair.sub, size: 12, style: 'bold' });
  if (bilingual) pdf.cursor += 4.5;
  pdf.cursor += 5;
  const insightsHeight = model.insights.length * 7 + 6;
  pdf.doc.setFillColor(247, 245, 236);
  pdf.doc.roundedRect(Math.min(pdf.edge(), pdf.edge() - pdf.span()), pdf.cursor - 4, pdf.span(), insightsHeight, 2, 2, 'F');
  model.insights.forEach(insight => {
    const template = labels[INSIGHT_LABEL_KEYS[insight.key]];
    const bullet = pdf.rtl ? '◂' : '▸';
    const bulletColor = insight.level === 'bad' ? THEME.red : insight.level === 'warn' ? THEME.brass : THEME.pine;
    pdf.doc.setTextColor(...bulletColor);
    pdf.doc.setFont(pdf.rtl ? 'PlexArabic' : 'helvetica', pdf.styleOfPublic('semibold'));
    const bulletX = pdf.rtl ? pdf.edge() - 4 : pdf.edge() - pdf.span() + 4;
    pdf.doc.text(bullet, bulletX, pdf.cursor + 1.5, { align: 'center' });
    pdf.text(fillTemplate(template, insight.params), pdf.edge(), { size: 9.5, maxWidth: pdf.span() - 8 });
    pdf.cursor += 7;
  });

  /* Page 2 — tables */
  if (monthly.length > 0 || totals.days > 0) {
    pdf.newPage();
    if (monthly.length > 0) {
      const varPair = pair('tableVariance');
      pdf.dual(varPair.main, pdf.edge(), { sub: varPair.sub, size: 13, style: 'bold' });
      pdf.cursor += bilingual ? 11 : 7;
      const header = [labels.thMonth, labels.thDays, labels.thDelivered, labels.thMissed, labels.thCompletion, labels.thRevenue, labels.thPlanned, labels.thVariance];
      drawTableHeader(pdf, header);
      monthly.forEach((month, index) => {
        pdf.row([
          { text: month.month, weight: true },
          { text: fmtInt(locale, month.recordedDays) },
          { text: fmtInt(locale, month.completedShipments) },
          { text: fmtInt(locale, month.failedShipments), color: month.failedShipments > 0 ? THEME.red : THEME.ink },
          { text: fmtPercent(locale, month.completionRate) },
          { text: fmtSar(locale, month.actualRevenue) },
          { text: fmtSar(locale, month.plannedRevenue) },
          { text: `${month.variancePercent >= 0 ? '+' : ''}${fmtPercent(locale, month.variancePercent)}`, color: month.variancePercent >= 0 ? THEME.pine : THEME.red },
        ], index % 2 === 0);
      });
      pdf.cursor += 8;
    }

    const recordedDays = series.filter(point => point.recorded);
    if (recordedDays.length > 0) {
      const histPair = pair('sectionHistoryTable');
      pdf.dual(histPair.main, pdf.edge(), { sub: histPair.sub, size: 13, style: 'bold' });
      pdf.cursor += bilingual ? 11 : 7;
      drawTableHeader(pdf, [labels.thDate, labels.thAttempts, labels.thDelivered, labels.thMissed, labels.thDrivers, labels.thFuel]);
      recordedDays.forEach((point, index) => {
        // Only the focus day carries live driver/fuel detail from the draft.
        const source = point.date === model.focusDate ? model.record : undefined;
        pdf.row([
          { text: point.date, weight: true },
          { text: fmtInt(locale, point.delivered + point.missed) },
          { text: fmtInt(locale, point.delivered), color: THEME.pine },
          { text: fmtInt(locale, point.missed), color: point.missed > 0 ? THEME.red : THEME.ink },
          { text: source ? fmtInt(locale, source.driversPresent) : '—' },
          { text: source ? fmtSar(locale, source.fuelCost) : '—' },
        ], index % 2 === 0);
      });
    }
  }

  /* RAG status line under the meta (industry-standard daily report header) */
  const status = deriveStatus(model.insights);
  const statusLabel = status === 'red' ? labels.statusRed : status === 'amber' ? labels.statusAmber : labels.statusGreen;
  pdf.text(`● ${statusLabel}`, pdf.edge(), { size: 10.5, style: 'semibold', color: status === 'red' ? THEME.red : status === 'amber' ? THEME.brass : THEME.pine });
  pdf.cursor += 7;

  /* Driver identity — providers report per driver + plate */
  if (model.record.driverName || model.record.plateNumber) {
    const identity = [model.record.driverName, model.record.carNumber && `#${model.record.carNumber}`, model.record.plateNumber && `${locale === 'ar' ? 'لوحة' : 'plate'} ${model.record.plateNumber}`].filter(Boolean).join(' · ');
    doc.setFont(pdf.rtl ? 'PlexArabic' : 'helvetica', 'semibold');
    doc.setFontSize(10);
    doc.setTextColor(...THEME.ink);
    doc.text(identity, pdf.edge(), pdf.cursor + 1, { align: pdf.rtl ? 'right' : 'left' });
    pdf.cursor += 8;
  }

  /* Fleet & crew block */
  const crewPair = pair('fleetCrewHead');
  pdf.dual(crewPair.main, pdf.edge(), { sub: crewPair.sub, size: 12, style: 'bold' });
  if (bilingual) pdf.cursor += 4.5;
  pdf.cursor += 4;
  pdf.row([
    { text: `${labels.driversPresent}`, color: THEME.muted },
    { text: `${fmtInt(locale, model.record.driversPresent)} / ${fmtInt(locale, model.driversTotal)}`, weight: true },
  ]);
  pdf.row([
    { text: `${labels.fuelUsed}`, color: THEME.muted },
    { text: `${fmtSar(locale, model.record.fuelCost)} (${fmtSar(locale, Math.round(model.expectedDailyFuel))})`, weight: true },
  ]);
  pdf.row([
    { text: labels.costPerStop, color: THEME.muted },
    { text: fmtSar(locale, metrics.allocatedCost / Math.max(1, model.record.completedShipments)), weight: true },
  ]);
  if ((model.record.codShipments ?? 0) > 0 || (model.record.prepaidShipments ?? 0) > 0) {
    pdf.row([
      { text: `${labels.codShipments} / ${labels.prepaidShipments}`, color: THEME.muted },
      { text: `${fmtInt(locale, model.record.codShipments ?? 0)} / ${fmtInt(locale, model.record.prepaidShipments ?? 0)}`, weight: true },
    ]);
    if ((model.record.cashCollectedSar ?? 0) > 0) {
      pdf.row([
        { text: labels.cashCollected, color: THEME.muted },
        { text: fmtSar(locale, model.record.cashCollectedSar ?? 0), weight: true, color: THEME.pine },
      ], true);
    }
    const outstanding = model.totals.cashOutstandingSar;
    if (outstanding !== 0) {
      pdf.row([
        { text: labels.cashOutstanding, color: THEME.muted },
        { text: fmtSar(locale, outstanding), weight: true, color: outstanding > 0 ? THEME.red : THEME.pine },
      ], true);
    }
  }
  if (model.totals.podTrackedDays > 0) {
    pdf.row([
      { text: fillTemplate(labels.podShareLine, { complete: model.totals.podTrackedDays - model.totals.podIncompleteDays, tracked: model.totals.podTrackedDays }), color: THEME.muted },
      { text: '', weight: false },
    ]);
  }
  if (model.record.podStatus) {
    const podLabel = model.record.podStatus === 'complete' ? labels.statusGreen : model.record.podStatus === 'none' ? labels.statusRed : labels.statusAmber;
    pdf.row([
      { text: labels.podLine, color: THEME.muted },
      { text: podLabel, weight: true, color: model.record.podStatus === 'complete' ? THEME.pine : model.record.podStatus === 'none' ? THEME.red : THEME.brass },
    ], true);
  }
  pdf.row([
    { text: labels.safetyIncidents ?? 'Safety incidents', color: THEME.muted },
    { text: fmtInt(locale, model.record.safetyIncidents ?? 0), weight: true, color: (model.record.safetyIncidents ?? 0) > 0 ? THEME.red : THEME.pine },
  ], true);
  pdf.cursor += 6;

  /* Customer scorecard — worst accounts first */
  if (model.customerPerformance.length > 0) {
    pdf.cursor += 2;
    const scorePair = pair('scorecardHead');
    pdf.dual(scorePair.main, pdf.edge(), { sub: scorePair.sub, size: 12, style: 'bold' });
    pdf.cursor += bilingual ? 10 : 6;
    drawTableHeader(pdf, [labels.thDate, labels.kpiDelivered, labels.kpiMissed, labels.thMissRate]);
    model.customerPerformance.slice(0, 8).forEach(row => {
      const tone = row.missRatePercent > 15 ? THEME.red : row.missRatePercent <= 8 ? THEME.pine : THEME.ink;
      const glyph = row.trendDelta === undefined || Math.abs(row.trendDelta) < 1 ? '—' : row.trendDelta > 0 ? '▲' : '▼';
      const glyphColor = glyph === '▲' ? THEME.red : glyph === '▼' ? THEME.pine : THEME.muted;
      pdf.row([
        { text: row.name, weight: true },
        { text: fmtInt(locale, row.delivered), color: THEME.pine },
        { text: fmtInt(locale, row.missed), color: row.missed > 0 ? THEME.red : THEME.ink },
        { text: fmtPercent(locale, row.missRatePercent), color: tone },
        { text: `${glyph}${row.trendDelta !== undefined && Math.abs(row.trendDelta) >= 1 ? ` ${Math.abs(Math.round(row.trendDelta))}%` : ''}`, color: glyphColor },
      ]);
    });
    pdf.cursor += 4;
  }

  /* Cost-per-stop trend */
  if (model.costPerStopSeries.length >= 2) {
    const costPair = pair('costTrendHead');
    pdf.dual(costPair.main, pdf.edge(), { sub: costPair.sub, size: 12, style: 'bold' });
    pdf.cursor += bilingual ? 10 : 6;
    drawSparkline(pdf, model.costPerStopSeries, locale);
    pdf.cursor += 4;
  }

  /* Recovery-board snapshot + open rows */
  if (model.recoveryBoard) {
    const recPair = pair('recoveryHead');
    pdf.dual(recPair.main, pdf.edge(), { sub: recPair.sub, size: 12, style: 'bold' });
    if (bilingual) pdf.cursor += 4.5;
    pdf.cursor += 4;
    const summaryText = fillTemplate(labels.recoverySummary, {
      pending: model.recoveryBoard.pendingShipments,
      recovered: model.recoveryBoard.recoveredShipments,
      rate: model.recoveryBoard.closeRatePercent,
    });
    doc.setFont(pdf.rtl ? 'PlexArabic' : 'helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...THEME.ink);
    doc.text(summaryText, Math.min(pdf.edge(), pdf.edge() - pdf.span()), pdf.cursor + 2, { maxWidth: pdf.span(), align: pdf.rtl ? 'right' : 'left' });
    pdf.cursor += bilingual ? 14 : 10;
    // Weekly recovered/written-off mini bars
    if (model.recoveryTrend && model.recoveryTrend.some(week => week.recovered + week.writtenOff > 0)) {
      const weeks = model.recoveryTrend;
      const slotW = pdf.span() / weeks.length;
      const maxWeek = Math.max(...weeks.map(week => week.recovered + week.writtenOff), 1);
      const baseY = pdf.cursor + 26;
      doc.setDrawColor(...THEME.line);
      doc.setLineWidth(0.3);
      doc.line(Math.min(pdf.edge(), pdf.edge() - pdf.span()), baseY, pdf.edge(), baseY);
      weeks.forEach((week, index) => {
        const slotX = Math.min(pdf.edge(), pdf.edge() - pdf.span()) + slotW * index;
        const barCenter = slotX + slotW / 2;
        const barWidth = Math.min(9, slotW * 0.5);
        const scaleH = (value: number) => value / maxWeek * 20;
        if (week.recovered > 0) {
          doc.setFillColor(...THEME.pine);
          doc.rect(barCenter - barWidth / 2, baseY - scaleH(week.recovered), barWidth, scaleH(week.recovered), 'F');
        }
        if (week.writtenOff > 0) {
          doc.setFillColor(...THEME.brass);
          doc.rect(barCenter - barWidth / 2, baseY - scaleH(week.recovered) - scaleH(week.writtenOff), barWidth, scaleH(week.writtenOff), 'F');
        }
        doc.setFontSize(6.5);
        doc.setTextColor(...THEME.muted);
        doc.text(week.label, barCenter, baseY + 4, { align: 'center' });
        if (week.recovered > 0) {
          doc.setFont(pdf.rtl ? 'PlexArabic' : 'helvetica', 'semibold');
          doc.setTextColor(...THEME.pine);
          doc.text(String(week.recovered), barCenter, baseY - scaleH(week.recovered) - scaleH(week.writtenOff) - 2, { align: 'center' });
        }
      });
      pdf.cursor = baseY + 10;
    }
    // Open rows with age — the actionable part of the loop
    const openRows = (model.openRecoveryEntries ?? []).filter(entry => entry.status === 'pending').slice(0, 8);
    if (openRows.length > 0) {
      drawTableHeader(pdf, [labels.thDate, labels.thMissRate.replace(labels.thMissRate, labels.kpiMissed), labels.thOwner, labels.thDaysOpen]);
      openRows.forEach((entry, index) => {
        const age = entryAgeDays(entry);
        pdf.row([
          { text: entry.createdAt },
          { text: fmtInt(locale, entry.shipments), weight: true, color: THEME.red },
          { text: entry.owner || '—' },
          { text: `${age}`, color: age > RECOVERY_TARGETS.overdueDays ? THEME.red : THEME.ink },
        ], index % 2 === 0);
      });
      pdf.cursor += 4;
    }
  }

  /* Open follow-up actions with owners */
  if (model.openActions && model.openActions.length > 0) {
    const actPair = pair('openActionsHead');
    pdf.dual(actPair.main, pdf.edge(), { sub: actPair.sub, size: 12, style: 'bold' });
    if (bilingual) pdf.cursor += 4.5;
    pdf.cursor += 4;
    model.openActions.forEach((action, index) => {
      pdf.row([
        { text: action.text, sub: bilingual ? labelsAlt?.openActionsHead : undefined },
      ], index % 2 === 0);
      // owner on the trailing edge
      doc.setFont(pdf.rtl ? 'PlexArabic' : 'helvetica', pdf.styleOfPublic('normal'));
      doc.setFontSize(9);
      doc.setTextColor(...THEME.muted);
      doc.text(action.owner, pdf.rtl ? 22 : 188, pdf.cursor - 3.5, { align: pdf.rtl ? 'left' : 'right' });
    });
    pdf.cursor += 4;
  }

  /* Next-day focus — standard closing section of a daily ops report */
  if (model.record.tomorrowNote) {
    pdf.cursor += 8;
    const focusPair = pair('nextDayFocus');
    pdf.dual(focusPair.main, pdf.edge(), { sub: focusPair.sub, size: 13, style: 'bold' });
    pdf.cursor += bilingual ? 11 : 7;
    doc.setFont(pdf.rtl ? 'PlexArabic' : 'helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...THEME.ink);
    doc.text(model.record.tomorrowNote, Math.min(pdf.edge(), pdf.edge() - pdf.span()), pdf.cursor + 2, { maxWidth: pdf.span(), align: pdf.rtl ? 'right' : 'left' });
    pdf.cursor += 14;
  }

  /* Footer on every page */
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont(pdf.rtl ? 'PlexArabic' : 'helvetica', pdf.styleOfPublic('normal'));
    doc.setFontSize(7.5);
    doc.setTextColor(...THEME.muted);
    doc.text(labels.confidential, 105, 290, { align: 'center', maxWidth: 170 });
    doc.text(`${page} / ${pageCount}`, pdf.rtl ? 18 : 192, 290, { align: pdf.rtl ? 'left' : 'right' });
  }
  doc.save(`vega-pro-report-${model.focusDate}.pdf`);
}

/* Chart + table primitives shared by both exporters */
function drawDeliveryChart(pdf: ReportDoc, series: ReportModel['series'], labels: ReportLabels) {
  const doc = pdf.doc;
  const chartX = 18, chartW = 174, chartH = 52, baseY = pdf.cursor + chartH;
  const maxBar = Math.max(...series.map(point => point.delivered + point.missed), ...series.map(point => point.target), 1);
  const slot = chartW / series.length;
  const barWidth = Math.min(7, slot * 0.55);
  doc.setDrawColor(...THEME.line);
  doc.setLineWidth(0.3);
  doc.line(chartX, baseY, chartX + chartW, baseY);
  series.forEach((point, index) => {
    const centerX = chartX + slot * index + slot / 2;
    const scale = (value: number) => value / maxBar * (chartH - 6);
    if (point.recorded) {
      const deliveredHeight = scale(point.delivered);
      const missedHeight = scale(point.missed);
      doc.setFillColor(...THEME.pine);
      doc.rect(centerX - barWidth / 2, baseY - deliveredHeight, barWidth, deliveredHeight, 'F');
      if (point.missed > 0) {
        doc.setFillColor(...THEME.red);
        doc.rect(centerX - barWidth / 2, baseY - deliveredHeight - missedHeight, barWidth, missedHeight, 'F');
      }
    }
    doc.setDrawColor(...THEME.brass);
    doc.setLineWidth(0.5);
    const targetY = baseY - scale(point.target);
    doc.line(centerX - barWidth / 2 - 1.5, targetY, centerX + barWidth / 2 + 1.5, targetY);
    doc.setFontSize(5.5);
    doc.setTextColor(...THEME.muted);
    doc.text(point.label, centerX, baseY + 4, { align: 'center' });
  });
  // Legend
  const legendY = baseY + 10;
  const entries: Array<[string, [number, number, number]]> = [
    [labels.legendDelivered, THEME.pine],
    [labels.legendMissed, THEME.red],
    [labels.legendTarget, THEME.brass],
  ];
  let legendX = pdf.rtl ? pdf.edge() : chartX;
  entries.forEach(([text, color]) => {
    doc.setFillColor(...color);
    doc.rect(legendX, legendY - 2.5, 3.5, 3.5, 'F');
    doc.setFont(pdf.rtl ? 'PlexArabic' : 'helvetica', pdf.styleOfPublic('normal'));
    doc.setFontSize(8);
    doc.setTextColor(...THEME.muted);
    if (pdf.rtl) { doc.text(text, legendX - 5, legendY + 0.5, { align: 'right' }); legendX -= doc.getTextWidth(text) + 14; }
    else { doc.text(text, legendX + 5.5, legendY + 0.5); legendX += doc.getTextWidth(text) + 14; }
  });
  pdf.cursor = legendY + 6;
}

/** Minimal vector sparkline for the cost-per-stop trend. */
function drawSparkline(pdf: ReportDoc, series: NonNullable<ReportModel['costPerStopSeries']>, locale: 'en' | 'ar') {
  const doc = pdf.doc;
  const x0 = 18, width = 174, height = 40, baseline = pdf.cursor + height;
  const values = series.map(point => point.value);
  const max = Math.max(...values), min = Math.min(...values);
  const span = Math.max(0.01, max - min);
  const step = width / Math.max(1, values.length - 1);
  const yOf = (value: number) => baseline - ((value - min) / span) * (height - 8) - 4;
  doc.setDrawColor(...THEME.line);
  doc.setLineWidth(0.3);
  doc.line(x0, baseline, x0 + width, baseline);
  doc.setDrawColor(...THEME.pine);
  doc.setLineWidth(0.8);
  values.forEach((value, index) => {
    if (index === 0) return;
    doc.line(x0 + (index - 1) * step, yOf(values[index - 1]), x0 + index * step, yOf(value));
  });
  const lastX = x0 + (values.length - 1) * step;
  doc.setFillColor(...THEME.brass);
  doc.circle(lastX, yOf(values.at(-1)!), 1.2, 'F');
  doc.setFont(pdf.rtl ? 'PlexArabic' : 'helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...THEME.muted);
  doc.text(series[0].label, x0, baseline + 4, { align: pdf.rtl ? 'right' : 'left' });
  doc.text(series.at(-1)!.label, x0 + width, baseline + 4, { align: pdf.rtl ? 'left' : 'right' });
  doc.text(fmtSar(locale, min), x0, baseline - height + 1);
  doc.text(fmtSar(locale, max), x0 + width, baseline - height + 1, { align: 'right' });
  pdf.cursor = baseline + 8;
}

function drawTableHeader(pdf: ReportDoc, header: string[]) {
  const doc = pdf.doc;
  const width = pdf.span();
  const left = Math.min(pdf.edge(), pdf.edge() - width);
  doc.setFillColor(...THEME.paper);
  doc.rect(left, pdf.cursor - 5, width, 8.5, 'F');
  const columnWidth = width / header.length;
  header.forEach((title, index) => {
    const x = pdf.rtl
      ? pdf.edge() - columnWidth * index - columnWidth / 2
      : left + columnWidth * index + columnWidth / 2;
    doc.setFont(pdf.rtl ? 'PlexArabic' : 'helvetica', pdf.styleOfPublic('semibold'));
    doc.setFontSize(7.5);
    doc.setTextColor(...THEME.muted);
    doc.text(title, x, pdf.cursor + 0.5, { align: 'center' });
  });
  pdf.cursor += 9.5;
}

/* Excel workbook export — dynamic exceljs import; optional scorecard/recovery
 * sheets when the caller supplies daily records and board entries. */
export async function exportBusinessModelExcel(
  record: DailyRecord,
  input: FinancialInput,
  output: FinancialOutput,
  extras?: {
    records?: Record<string, DailyRecord>;
    recoveryEntries?: Array<{ createdAt: string; shipments: number; reasonKey?: string; customer?: string; owner: string; status: 'pending' | 'recovered' | 'written_off'; resolvedAt?: string }>;
  },
) {
  const ExcelJS = await import('exceljs');
  const metrics = calculateDailyMetrics(record, input, output);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VEGA Logistics OS';

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [{ width: 28 }, { width: 20 }];
  summary.addRows([
    ['VEGA Business Model', 'Current value'],
    ['Monthly revenue', amount(output.totalRevenue)], ['Monthly cost', amount(output.totalCost)],
    ['Monthly profit / loss', amount(output.netMargin)], ['Net margin %', amount(output.netMarginPercent)],
    ['Shipments / day', output.totalDailyShipments], ['Cars and drivers', input.companyDriverCount],
    ['Cost / shipment', amount(output.costPerShipment)], ['Revenue / shipment', amount(output.avgRevenuePerShipment)],
  ]);

  const daily = workbook.addWorksheet('Daily report');
  daily.columns = [{ width: 28 }, { width: 20 }];
  daily.addRows([
    ['Daily report', record.date], ['Planned shipments', metrics.plannedShipments],
    ['Completed shipments', record.completedShipments], ['Failed shipments', record.failedShipments],
    ['Completion rate %', amount(metrics.completionRate)], ['Drivers present', record.driversPresent],
    ['Fuel spend (SAR)', amount(record.fuelCost)],
    ['Driver', record.driverName ?? ''], ['Car', record.carNumber ?? ''], ['Plate', record.plateNumber ?? ''],
    ['COD shipments', record.codShipments ?? 0], ['Prepaid shipments', record.prepaidShipments ?? 0], ['Cash collected (SAR)', amount(record.cashCollectedSar ?? 0)],
    ['Cash remitted (SAR)', amount(record.cashRemittedSar ?? 0)],
    ['Revenue', amount(metrics.revenue)], ['Allocated cost', amount(metrics.allocatedCost)],
    ['Profit / loss', amount(metrics.profit)], ['Notes', record.notes],
  ]);

  const costs = workbook.addWorksheet('Company costs');
  costs.columns = [{ header: 'Category', key: 'category', width: 28 }, { header: 'Monthly SAR', key: 'monthlySar', width: 20 }];
  costs.addRows([
    { category: 'Vehicle ownership', monthlySar: amount(output.costBreakdown.vehicleOwnership) },
    { category: 'Vehicle running', monthlySar: amount(output.costBreakdown.vehicleRunning) },
    { category: 'People', monthlySar: amount(output.costBreakdown.people) },
    { category: 'Facilities', monthlySar: amount(output.costBreakdown.facilities) },
    { category: 'Per shipment', monthlySar: amount(output.costBreakdown.perShipment) },
    { category: 'Other', monthlySar: amount(output.costBreakdown.other) },
  ]);

  const fleet = workbook.addWorksheet('Cars and drivers');
  fleet.columns = [
    { header: 'Vehicle type', key: 'name', width: 28 }, { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Rent / vehicle', key: 'rent', width: 20 }, { header: 'Insurance + maintenance', key: 'overhead', width: 24 },
    { header: 'Fuel L/100km', key: 'efficiency', width: 16 }, { header: 'Distance km/day', key: 'distance', width: 18 },
  ];
  input.vehicleClasses.forEach(vehicle => fleet.addRow({
    name: vehicle.name, quantity: vehicle.quantity, rent: vehicle.monthlyRent,
    overhead: vehicle.variableCost, efficiency: vehicle.fuelEfficiency, distance: vehicle.avgDailyDistance,
  }));

  const customers = workbook.addWorksheet('Customers');
  customers.columns = [
    { header: 'Customer', key: 'customer', width: 28 }, { header: 'Shipments / day', key: 'shipmentsPerDay', width: 16 },
    { header: 'Price / shipment', key: 'pricePerShipment', width: 18 }, { header: 'Enabled', key: 'enabled', width: 10 },
  ];
  input.providers.forEach(provider => customers.addRow({
    customer: provider.name, shipmentsPerDay: provider.shipmentsPerDay,
    pricePerShipment: provider.pricePerShipment, enabled: provider.enabled ? 'Yes' : 'No',
  }));

  [costs, fleet, customers].forEach(sheet => sheet.getRow(1).font = { bold: true });

  /* Customer scorecard — from attributed daily breakdowns */
  if (extras?.records) {
    const performance = buildCustomerPerformance(extras.records, input);
    if (performance.length > 0) {
      const scorecard = workbook.addWorksheet('Customer scorecard');
      scorecard.columns = [
        { header: 'Customer', key: 'name', width: 30 }, { header: 'Delivered', key: 'delivered', width: 12 },
        { header: 'Missed', key: 'missed', width: 12 }, { header: 'Attempts', key: 'attempts', width: 12 },
        { header: 'Miss %', key: 'missRate', width: 10 }, { header: 'Trend (recent-lifetime, pp)', key: 'trend', width: 26 },
      ];
      performance.forEach(row => scorecard.addRow({
        name: row.name, delivered: row.delivered, missed: row.missed, attempts: row.attempts,
        missRate: amount(row.missRatePercent),
        trend: row.trendDelta === undefined ? '—' : `${row.trendDelta > 0 ? '+' : ''}${amount(row.trendDelta)}`,
      }));
      scorecard.getRow(1).font = { bold: true };
    }

    /* Recovery board */
    const entries = extras.recoveryEntries ?? [];
    if (entries.length > 0) {
      const recovery = workbook.addWorksheet('Recovery board');
      recovery.columns = [
        { header: 'Missed on', key: 'created', width: 14 }, { header: 'Shipments', key: 'shipments', width: 12 },
        { header: 'Reason', key: 'reason', width: 22 }, { header: 'Customer', key: 'customer', width: 24 },
        { header: 'Owner', key: 'owner', width: 20 }, { header: 'Status', key: 'status', width: 14 },
        { header: 'Days open', key: 'daysOpen', width: 12 },
      ];
      entries.forEach(entry => recovery.addRow({
        created: entry.createdAt, shipments: entry.shipments, reason: entry.reasonKey ?? '',
        customer: entry.customer ?? '', owner: entry.owner, status: entry.status,
        daysOpen: entry.status === 'pending' ? entryAgeDays({ ...entry, createdAt: entry.createdAt } as Parameters<typeof entryAgeDays>[0]) : '',
      }));
      recovery.getRow(1).font = { bold: true };

      /* Weekly recovered vs written-off trend */
      const trend = buildWeeklyRecoveryTrend(entries as never[], 6);
      if (trend.some(week => week.recovered + week.writtenOff > 0)) {
        const trendSheet = workbook.addWorksheet('Recovery trend');
        trendSheet.columns = [
          { header: 'Week start', key: 'week', width: 14 }, { header: 'Recovered', key: 'recovered', width: 12 },
          { header: 'Written off', key: 'woff', width: 12 }, { header: 'Closed total', key: 'total', width: 12 },
        ];
        trend.forEach(week => trendSheet.addRow({
          week: week.weekStart, recovered: week.recovered, woff: week.writtenOff,
          total: week.recovered + week.writtenOff,
        }));
        trendSheet.getRow(1).font = { bold: true };
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `vega-business-model-${record.date}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
