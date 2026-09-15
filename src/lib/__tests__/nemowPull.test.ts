// Nemow pull tests: both observed export variants, totals-row exclusion,
// Arabic-Indic digits, datetime objects, honest error taxonomy.
import { describe, expect, it } from 'vitest';

import { nemowDayKey, pullNemowPackages } from '@/lib/nemowPull';

const NOW = '2026-09-15T08:00:00.000Z';

describe('nemowDayKey', () => {
  it('reads Date objects as local calendar days', () => {
    expect(nemowDayKey(new Date(2026, 8, 9, 13, 28, 15))).toBe('2026-09-09');
  });
  it('reads DD/MM/YYYY strings with optional time', () => {
    expect(nemowDayKey('08/09/2026 19:13')).toBe('2026-09-08');
    expect(nemowDayKey('2026-09-10')).toBe('2026-09-10');
  });
  it('returns null for empty/unparseable cells', () => {
    expect(nemowDayKey('')).toBeNull();
    expect(nemowDayKey(undefined)).toBeNull();
    expect(nemowDayKey('بانتظار التحميل')).toBeNull();
  });
});

describe('pullNemowPackages — Packages variant', () => {
  const aoa = [
    ['باركود', 'العنوان الوطني', 'مدينة المرسل', 'التحصيل الأصلي', 'الحالة', 'إسم الزبون', 'تا ريخ اخر حركة', 'ارجعت بواسطة', 'إسم المستقبل', 'هاتف المستقبل'],
    ['1001', 'addr', 'الرياض', '367.9', 'تم توصيلها', 'store', new Date(2026, 8, 9, 13, 0, 0), '', 'recv', '05xxxxxxxx'],
    ['1002', 'addr', 'جدة', '١٠٠', 'تم إرجاعها', 'store', '08/09/2026 19:13', 'driver-A', 'recv', ''],
    ['1003', 'addr', 'الرياض', '', 'بانتظار التحميل – لم تُستلم من المزود', 'store', '', '', 'recv', ''],
    ['المجموع', '', '', 0, '', '', '', '', '', ''],
  ];
  it('counts 3 packages, splits delivered/pending, skips المجموع', () => {
    const result = pullNemowPackages(aoa, 'f.xlsx', 'Packages', NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = result.summary;
    expect(s.total).toBe(3);
    expect(s.delivered).toBe(1);
    expect(s.pending).toBe(2);
    expect(s.completionPct).toBeCloseTo(33.3, 1);
    expect(s.codTotalSar).toBeCloseTo(467.9, 2);
    expect(s.codDeliveredSar).toBeCloseTo(367.9, 2);
    expect(s.statuses.map(x => x.status)).toContain('تم إرجاعها');
    expect(s.drivers).toEqual([{ driver: 'driver-A', total: 1, delivered: 0 }]);
    expect(s.cities.map(x => x.city)).toEqual(['الرياض', 'جدة']);
    expect(s.daysEnd).toBe('2026-09-09');
    expect(s.days).toHaveLength(14);
    expect(s.days[13]).toEqual({ day: '2026-09-09', total: 1, delivered: 1 });
  });
});

describe('pullNemowPackages — Driver Packages Report variant', () => {
  const aoa = [
    ['باركود الطرد', 'اسم المرسل', 'اسم المستقبل', 'مدينة المستقبل', 'الحالة', 'COD'],
    ['2001', 'sender', 'recv', 'الدرعية', 'تم توصيلها', 367.9],
    ['2002', 'sender', 'recv', 'الرياض', 'تم توصيلها', 0],
  ];
  it('maps variant headers and reports no drivers honestly', () => {
    const result = pullNemowPackages(aoa, 'd.xlsx', 'Driver Packages Report', NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.total).toBe(2);
    expect(result.summary.delivered).toBe(2);
    expect(result.summary.drivers).toEqual([]);
    expect(result.summary.driversTotal).toBe(0);
    expect(result.summary.days).toEqual([]);
    expect(result.summary.daysEnd).toBeNull();
  });
});

describe('pullNemowPackages — errors', () => {
  it('rejects empty sheets', () => {
    expect(pullNemowPackages([], 'f.xlsx', 'S', NOW)).toEqual({ ok: false, error: 'empty' });
  });
  it('reports missing barcode/status headers', () => {
    const result = pullNemowPackages([['foo', 'bar'], ['1', 'x']], 'f.xlsx', 'S', NOW);
    expect(result).toEqual({ ok: false, error: 'missing-headers', missing: ['باركود', 'الحالة'] });
  });
  it('reports sheets with headers but zero packages', () => {
    const result = pullNemowPackages([['باركود', 'الحالة'], ['المجموع', '']], 'f.xlsx', 'S', NOW);
    expect(result).toEqual({ ok: false, error: 'no-rows' });
  });
});
