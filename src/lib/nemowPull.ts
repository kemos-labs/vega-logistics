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

export interface NemowSummary {
  fileName: string;
  sheetName: string;
  pulledAt: string;
  total: number;
  delivered: number;
  pending: number;
  completionPct: number;
  codTotalSar: number;
  codDeliveredSar: number;
  statuses: NemowStatusSlice[];
  drivers: NemowDriverSlice[];
  driversTotal: number;
  cities: NemowCitySlice[];
  /** Last 14 calendar days ending at the newest dated row (empty when dateless). */
  days: NemowDaySlice[];
  daysEnd: string | null;
}

export type NemowPullResult =
  | { ok: true; summary: NemowSummary }
  | { ok: false; error: NemowPullError; missing?: string[] };

type NemowField = 'barcode' | 'name' | 'city' | 'status' | 'date' | 'cod' | 'driver';

const HEADER_ALIASES: Record<NemowField, string[]> = {
  barcode: ['باركود', 'باركود الطرد'],
  name: ['إسم المستقبل', 'اسم المستقبل', 'إسم الزبون', 'اسم الزبون', 'إسم المتجر', 'اسم المتجر', 'منشئ الطرد', 'اسم المرسل', 'إسم المرسل'],
  city: ['المدينة', 'مدينة المرسل', 'مدينة المستقبل', 'الفرع الحالي'],
  status: ['الحالة'],
  date: ['تاريخ التوصيل', 'تا ريخ اخر حركة', 'تاريخ اخر حركة', 'تاريخ إستلام التحصيل', 'تاريخ استلام التحصيل', 'تاريخ أول وجهة نهائية'],
  cod: ['التحصيل الأصلي', 'cod', 'المبلغ'],
  driver: ['إسم السائق', 'اسم السائق', 'ارجعت بواسطة'],
};

function normalizeHeader(raw: unknown): string {
  return String(raw ?? '').replace(/\uFEFF/g, '').trim().replace(/\s+/g, ' ');
}

function cellText(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === 'object') {
    const maybe = raw as Record<string, unknown>;
    if (typeof maybe.text === 'string') return maybe.text.trim();
    return '';
  }
  return String(raw).replace(/\uFEFF/g, '').trim();
}

function parseCod(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw * 100) / 100;
  const num = Number(normalizeDigits(cellText(raw)).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(num) && cellText(raw) !== '' ? Math.round(num * 100) / 100 : null;
}

/** Export date → local YYYY-MM-DD day key (datetimes, DD/MM/YYYY, YYYY-MM-DD). */
export function nemowDayKey(raw: unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const m = `${raw.getMonth() + 1}`.padStart(2, '0');
    const d = `${raw.getDate()}`.padStart(2, '0');
    return `${raw.getFullYear()}-${m}-${d}`;
  }
  const text = normalizeDigits(cellText(raw));
  let m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  m = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

const DELIVERED_STATUS = 'تم توصيلها';

export function pullNemowPackages(
  aoa: unknown[][],
  fileName: string,
  sheetName: string,
  nowIso: string,
): NemowPullResult {
  const rows = aoa.filter(row => Array.isArray(row) && row.some(cell => cellText(cell) !== ''));
  if (rows.length === 0) return { ok: false, error: 'empty' };
  if (rows.length - 1 > NEMOW_MAX_ROWS) return { ok: false, error: 'too-large' };

  const headers = (rows[0] as unknown[]).map(normalizeHeader);
  const col: Partial<Record<NemowField, number>> = {};
  headers.forEach((header, index) => {
    (Object.entries(HEADER_ALIASES) as Array<[NemowField, string[]]>).forEach(([field, aliases]) => {
      if (col[field] === undefined && aliases.includes(header)) col[field] = index;
    });
  });
  const missing: string[] = [];
  if (col.barcode === undefined) missing.push('باركود');
  if (col.status === undefined) missing.push('الحالة');
  if (missing.length > 0) return { ok: false, error: 'missing-headers', missing };

  const packages: NemowPackage[] = [];
  for (const row of rows.slice(1)) {
    const cells = row as unknown[];
    const barcode = cellText(cells[col.barcode as number]);
    if (barcode === '' || barcode === 'المجموع') continue; // totals row is never a package
    const status = cellText(cells[col.status as number]);
    packages.push({
      barcode,
      name: col.name === undefined ? '' : cellText(cells[col.name]),
      city: col.city === undefined ? '' : cellText(cells[col.city]),
      status,
      delivered: normalizeHeader(status) === DELIVERED_STATUS,
      codSar: col.cod === undefined ? null : parseCod(cells[col.cod]),
      driver: col.driver === undefined ? '' : cellText(cells[col.driver]),
      day: col.date === undefined ? null : nemowDayKey(cells[col.date]),
    });
  }
  if (packages.length === 0) return { ok: false, error: 'no-rows' };

  const delivered = packages.filter(p => p.delivered).length;
  const total = packages.length;
  const codTotalSar = Math.round(packages.reduce((sum, p) => sum + (p.codSar ?? 0), 0) * 100) / 100;
  const codDeliveredSar = Math.round(packages.reduce((sum, p) => sum + (p.delivered ? (p.codSar ?? 0) : 0), 0) * 100) / 100;

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
    .sort((a, b) => b.total - a.total || a.driver.localeCompare(b.driver, 'ar'))
    .slice(0, 8);

  const cityCounts = new Map<string, number>();
  for (const p of packages) {
    if (p.city === '') continue;
    cityCounts.set(p.city, (cityCounts.get(p.city) ?? 0) + 1);
  }
  const cities: NemowCitySlice[] = [...cityCounts.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, 'ar'))
    .slice(0, 8);

  const dated = packages.filter(p => p.day !== null) as Array<NemowPackage & { day: string }>;
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
      fileName, sheetName, pulledAt: nowIso,
      total, delivered, pending: total - delivered,
      completionPct: Math.round((delivered / total) * 1000) / 10,
      codTotalSar, codDeliveredSar,
      statuses, drivers, driversTotal: driverGroups.size, cities, days, daysEnd,
    },
  };
}
