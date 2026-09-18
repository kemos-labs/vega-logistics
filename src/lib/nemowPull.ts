// VEGA — Nemow Excel pull (first-page dashboard feed).
// Pure, deterministic, offline. NOTHING here touches storage or the network —
// it turns first-worksheet rows (aoa) from a Nemow packages export into a
// dashboard-ready summary the operator reviews on the landing page.
//
// Tolerant Arabic header mapping covers the observed export variants:
//   * "Packages" sheet (barcode/city/status/COD/driver … + المجموع totals row)
//   * "Driver Packages Report" sheet (باركود الطرد/اسم المستقبل/الحالة/COD …)
// Unknown columns are ignored; the المجموع row is never counted as a package.
// Delivered = الحالة exactly 'تم توصيلها' (whitespace-collapsed); every other
// status counts as pending and is listed verbatim in the breakdown.

import { normalizeDigits } from '@/lib/providerMessageParser';
import columnSpec from '@/lib/nemowContract.json';

/** Hard cap: larger sheets are rejected rather than silently sliced. */
export const NEMOW_MAX_ROWS = 5000;

export type NemowPullError = 'empty' | 'missing-headers' | 'no-rows' | 'too-large';

export interface NemowPackage {
  barcode: string;
  name: string;
  city: string;
  status: string;
  delivered: boolean;
  codSar: number | null;
  driver: string;
  /** Local calendar day YYYY-MM-DD, or null when the export carries no date. */
  day: string | null;
}

export interface NemowStatusSlice { status: string; count: number; sharePct: number }
export interface NemowDriverSlice { driver: string; total: number; delivered: number }
export interface NemowCitySlice { city: string; count: number }
export interface NemowDaySlice { day: string; total: number; delivered: number }
export interface NemowBuckets { delivered: number; returned: number; cancelled: number; active: number }
export interface NemowCoverage { missingDate: number; missingCod: number; missingDriver: number; missingCity: number; invalidCod: number }

export interface NemowSummary {
  fileName: string;
  sheetName: string;
  pulledAt: string;
  total: number;
  delivered: number;
  pending: number;
  completionPct: number;
  codTotalSar: number | null;
  codDeliveredSar: number | null;
  statuses: NemowStatusSlice[];
  drivers: NemowDriverSlice[];
  driversTotal: number;
  cities: NemowCitySlice[];
  /** Last 14 calendar days ending at the newest dated row (empty when dateless). */
  days: NemowDaySlice[];
  allDays?: NemowDaySlice[];
  daysEnd: string | null;
  schemaVersion?: number;
  sourceTotal?: number;
  excludedIntegration?: number;
  buckets?: NemowBuckets;
  periodStart?: string | null;
  periodEnd?: string | null;
  coverage?: NemowCoverage;
  codKnownCount?: number;
  codDeliveredKnownCount?: number;
}

export type NemowPullResult =
  | { ok: true; summary: NemowSummary }
  | { ok: false; error: NemowPullError; missing?: string[] };

export type NemowField = 'barcode' | 'name' | 'city' | 'status' | 'date' | 'cod' | 'driver' | 'source';

// Alias order IS priority order. Resolution walks this list and takes the first
// non-empty cell, so an existing-but-empty column (إسم المستقبل is filled for only
// 19/856 rows in the live export) can never shadow a populated fallback column.
// Mirrored in /data/Nemow Logistics/config/nemow_columns.json — keep both in step.
// 'إسم الزبون' is deliberately absent from `name`: it holds the CLIENT account
// ('شركة طرود لتقنية المعلومات شخص واحد') for 855/856 rows, never a recipient.
const spec = columnSpec as { fields: Record<string, string[]>; name_chain: string[]; date_chain: string[]; business_tokens: Record<string, string[]> };
const HEADER_ALIASES: Record<NemowField, string[]> = {
  barcode: spec.fields.barcode,
  name: spec.name_chain.flatMap(key => spec.fields[key] ?? []),
  city: spec.fields.city,
  status: spec.fields.status,
  date: spec.date_chain.flatMap(key => spec.fields[key] ?? []),
  cod: spec.fields.cod,
  driver: spec.fields.driver,
  source: spec.fields.source,
};
const TOKENS = spec.business_tokens;

function normalizeHeader(raw: unknown): string {
  return String(raw ?? '').replace(/\uFEFF/g, '').trim().replace(/\s+/g, ' ');
}

/** Alias columns per field, in alias priority order (exported for tests). */
export function nemowColumnIndexes(headers: unknown[]): Partial<Record<NemowField, number[]>> {
  const normalized = headers.map(normalizeHeader);
  const cols: Partial<Record<NemowField, number[]>> = {};
  (Object.entries(HEADER_ALIASES) as Array<[NemowField, string[]]>).forEach(([field, aliases]) => {
    cols[field] = aliases.flatMap(alias => normalized
      .map((header, index) => header === alias ? index : -1)
      .filter(index => index >= 0));
  });
  return cols;
}

/** First NON-EMPTY cell for a field, walking the alias columns in priority order. */
export function nemowFieldText(
  cells: unknown[],
  cols: Partial<Record<NemowField, number[]>>,
  field: NemowField,
): string {
  for (const index of cols[field] ?? []) {
    const text = cellText(cells[index]);
    if (text !== '') return text;
  }
  return '';
}

function cellText(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? '' : raw.toISOString();
  if (typeof raw === 'object') {
    const maybe = raw as Record<string, unknown>;
    if (typeof maybe.text === 'string') return maybe.text.trim();
    return '';
  }
  return String(raw).replace(/\uFEFF/g, '').trim();
}

function parseCod(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return Math.round(raw * 100) / 100;
  const normalized = normalizeDigits(cellText(raw)).replace(/[,،\s]/g, '');
  if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;
  const num = Number(normalized);
  return Number.isFinite(num) && num >= 0 ? Math.round(num * 100) / 100 : null;
}

/** Export date → local YYYY-MM-DD day key (datetimes, DD/MM/YYYY, YYYY-MM-DD). */
export function nemowDayKey(raw: unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return validDay(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
  }
  const text = normalizeDigits(cellText(raw));
  let m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const [, d, mo, y] = m;
    return validDay(Number(y), Number(mo), Number(d));
  }
  m = text.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m) return validDay(Number(m[3]), Number(m[2]), Number(m[1]));
  m = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return validDay(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

function validDay(year: number, month: number, day: number): string | null {
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function pullNemowPackages(
  aoa: unknown[][],
  fileName: string,
  sheetName: string,
  nowIso: string,
): NemowPullResult {
  const rows = aoa.filter(row => Array.isArray(row) && row.some(cell => cellText(cell) !== ''));
  if (rows.length === 0) return { ok: false, error: 'empty' };
  if (rows.length - 1 > NEMOW_MAX_ROWS) return { ok: false, error: 'too-large' };

  const cols = nemowColumnIndexes(rows[0] as unknown[]);
  const cellField = (cells: unknown[], field: NemowField): string =>
    nemowFieldText(cells, cols, field);
  const missing: string[] = [];
  if ((cols.barcode ?? []).length === 0) missing.push('باركود');
  if ((cols.status ?? []).length === 0) missing.push('الحالة');
  if (missing.length > 0) return { ok: false, error: 'missing-headers', missing };

  const packages: NemowPackage[] = [];
  let sourceTotal = 0;
  let excludedIntegration = 0;
  const coverage: NemowCoverage = { missingDate: 0, missingCod: 0, missingDriver: 0, missingCity: 0, invalidCod: 0 };
  let codKnownCount = 0;
  let codDeliveredKnownCount = 0;
  const isToken = (status: string, tokens: readonly string[]) => tokens.some(token => status.includes(token));
  const isTotal = (barcode: string) => TOKENS.totals_row.some((token: string) => barcode.toLowerCase().includes(token.toLowerCase()));
  const classify = (status: string): keyof NemowBuckets => {
    if (isToken(status, TOKENS.cancelled)) return 'cancelled';
    if (isToken(status, TOKENS.returned)) return 'returned';
    if (isToken(status, TOKENS.delivered)) return 'delivered';
    return 'active';
  };
  for (const row of rows.slice(1)) {
    const cells = row as unknown[];
    const barcode = cellField(cells, 'barcode');
    if (barcode === '' || isTotal(barcode)) continue; // totals row is never a package
    sourceTotal += 1;
    const status = cellField(cells, 'status');
    const source = cellField(cells, 'source');
    if (TOKENS.integration_sources.some((token: string) => source.trim().toLocaleLowerCase() === token.trim().toLocaleLowerCase())) { excludedIntegration += 1; continue; }
    const codRaw = (cols.cod ?? []).map(index => cells[index]).find(value => cellText(value) !== '');
    const codSar = codRaw === undefined ? null : parseCod(codRaw);
    if (codRaw === undefined) coverage.missingCod += 1;
    else if (codSar === null) coverage.invalidCod += 1;
    else codKnownCount += 1;
    const name = cellField(cells, 'name');
    const city = cellField(cells, 'city');
    const driver = cellField(cells, 'driver');
    const dateIndex = (cols.date ?? []).find(index => cellText(cells[index]) !== '');
    const day = dateIndex === undefined ? null : nemowDayKey(cells[dateIndex]);
    if (day === null) coverage.missingDate += 1;
    if (city === '') coverage.missingCity += 1;
    if (driver === '') coverage.missingDriver += 1;
    const delivered = classify(status) === 'delivered';
    if (delivered && codSar !== null) codDeliveredKnownCount += 1;
    packages.push({
      barcode,
      name,
      city,
      status,
      delivered,
      codSar,
      driver,
      day,
    });
  }
  if (packages.length === 0 && excludedIntegration === 0) return { ok: false, error: 'no-rows' };

  const delivered = packages.filter(p => p.delivered).length;
  const buckets: NemowBuckets = { delivered: 0, returned: 0, cancelled: 0, active: 0 };
  packages.forEach(p => { buckets[classify(p.status)] += 1; });
  const total = packages.length;
  const knownCod = packages.filter(p => p.codSar !== null);
  const deliveredKnownCod = packages.filter(p => p.delivered && p.codSar !== null);
  const codTotalSar = knownCod.length > 0 ? Math.round(knownCod.reduce((sum, p) => sum + (p.codSar as number), 0) * 100) / 100 : null;
  const codDeliveredSar = deliveredKnownCod.length > 0 ? Math.round(deliveredKnownCod.reduce((sum, p) => sum + (p.codSar as number), 0) * 100) / 100 : null;

  const statusCounts = new Map<string, number>();
  for (const p of packages) statusCounts.set(p.status === '' ? '—' : p.status, (statusCounts.get(p.status === '' ? '—' : p.status) ?? 0) + 1);
  const statuses: NemowStatusSlice[] = [...statusCounts.entries()]
    .map(([status, count]) => ({ status, count, sharePct: Math.round((count / total) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status, 'ar'));

  const driverGroups = new Map<string, { total: number; delivered: number }>();
  for (const p of packages) {
    if (p.driver === '') continue;
    const g = driverGroups.get(p.driver) ?? { total: 0, delivered: 0 };
    g.total += 1;
    if (p.delivered) g.delivered += 1;
    driverGroups.set(p.driver, g);
  }
  const drivers: NemowDriverSlice[] = [...driverGroups.entries()]
    .map(([driver, g]) => ({ driver, ...g }))
    .sort((a, b) => b.total - a.total || a.driver.localeCompare(b.driver, 'ar'));

  const cityCounts = new Map<string, number>();
  for (const p of packages) {
    if (p.city === '') continue;
    cityCounts.set(p.city, (cityCounts.get(p.city) ?? 0) + 1);
  }
  const cities: NemowCitySlice[] = [...cityCounts.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, 'ar'));

  const dated = packages.filter(p => p.day !== null) as Array<NemowPackage & { day: string }>;
  const allDayMap = new Map<string, NemowDaySlice>();
  dated.forEach(p => { const row = allDayMap.get(p.day) ?? { day: p.day, total: 0, delivered: 0 }; row.total += 1; if (p.delivered) row.delivered += 1; allDayMap.set(p.day, row); });
  const allDays = [...allDayMap.values()].sort((a, b) => a.day.localeCompare(b.day));
  let days: NemowDaySlice[] = [];
  let daysEnd: string | null = null;
  if (dated.length > 0) {
    daysEnd = dated.reduce((max, p) => (p.day > max ? p.day : max), dated[0].day);
    const end = new Date(`${daysEnd}T12:00:00`);
    const keys: string[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      keys.push(`${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`);
    }
    days = keys.map(day => {
      const inDay = dated.filter(p => p.day === day);
      return { day, total: inDay.length, delivered: inDay.filter(p => p.delivered).length };
    });
  }

  return {
    ok: true,
    summary: {
      fileName, sheetName, pulledAt: nowIso, schemaVersion: 2,
      sourceTotal, excludedIntegration, buckets,
      periodStart: dated.length > 0 ? dated.reduce((min, p) => p.day < min ? p.day : min, dated[0].day) : null,
      periodEnd: daysEnd,
      coverage, codKnownCount, codDeliveredKnownCount,
      total, delivered, pending: total - delivered, allDays,
      completionPct: Math.round((delivered / total) * 1000) / 10,
      codTotalSar, codDeliveredSar,
      statuses, drivers, driversTotal: driverGroups.size, cities, days, daysEnd,
    },
  };
}
