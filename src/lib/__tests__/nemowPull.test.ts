// Nemow pull tests: both observed export variants, totals-row exclusion,
// Arabic-Indic digits, datetime objects, honest error taxonomy.
import { describe, expect, it } from 'vitest';

import {
  nemowColumnIndexes,
  nemowDayKey,
  nemowFieldText,
  pullNemowPackages,
} from '@/lib/nemowPull';

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
    // ارجعت بواسطة is a return operator field, not a driver roster.
    expect(s.drivers).toEqual([]);
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

// Live-export regressions (16-09-2026 review): both were caused by choosing the first
// MATCHING HEADER instead of the first NON-EMPTY alias cell.
describe('pullNemowPackages — live export column traps', () => {
  const aoa = [
    // إسم المستقبل is present but empty; إسم المتجر carries the shipper name.
    // تاريخ إستلام التحصيل sits before تا ريخ اخر حركة and must NOT win.
    ['باركود', 'تاريخ إستلام التحصيل', 'إسم الزبون', 'إسم المستقبل', 'هاتف المستقبل',
     'تا ريخ اخر حركة', 'إسم المتجر', 'الحالة'],
    ['1001', '01/09/2026 08:00', 'شركة طرود لتقنية المعلومات شخص واحد', '', '',
     new Date(2026, 8, 9, 13, 28, 15), 'متجر أ', 'تم توصيلها'],
    ['1002', '', 'شركة طرود لتقنية المعلومات شخص واحد', '', '',
     '08/09/2026 22:34', 'متجر ب', 'تم توصيلها'],
  ];
  const cols = nemowColumnIndexes(aoa[0]);

  it('falls back per row to a populated name column', () => {
    expect(nemowFieldText(aoa[1], cols, 'name')).toBe('متجر أ');   // empty إسم المستقبل
    expect(nemowFieldText(aoa[2], cols, 'name')).toBe('متجر ب');
  });
  it('never treats the client account column as a recipient name', () => {
    expect(nemowFieldText(aoa[1], cols, 'name')).not.toContain('شركة طرود');
  });
  it('prefers the real activity date over the collection date', () => {
    const result = pullNemowPackages(aoa, 'f.xlsx', 'Packages', NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.total).toBe(2);
    expect(result.summary.daysEnd).toBe('2026-09-09');
    expect(result.summary.days[13]).toEqual({ day: '2026-09-09', total: 1, delivered: 1 });
    // the collection date (01/09) must carry nothing even though it is inside the window
    expect(result.summary.days.find(day => day.day === '2026-09-01')?.total).toBe(0);
  });
  it('keeps alias priority independent of column order', () => {
    expect(cols.name?.[0]).toBe(3);      // إسم المستقبل first even though it sits after إسم الزبون
    expect(cols.name).not.toContain(2);   // the account column is not a name alias
    expect(cols.date?.[0]).toBe(5);       // تا ريخ اخر حركة before تاريخ إستلام التحصيل
  });

  it('excludes every canonical totals label and gives return/cancel precedence', () => {
    const result = pullNemowPackages([
      ['رقم الشحنة', 'الحالة', 'مصدر الطرد'],
      ['1', 'تم توصيلها – ثم إرجاع', ''],
      ['2', 'تم توصيلها – ملغاة', ''],
      ['3', 'تم توصيلها', ''],
      ['المجموع الكلي', '', ''],
      ['x الإجمالي', '', ''],
      ['total', '', ''],
    ], 'f.xlsx', 'Packages', NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.total).toBe(3);
    expect(result.summary.buckets).toEqual({ delivered: 1, returned: 1, cancelled: 1, active: 0 });
    expect(result.summary.sourceTotal).toBe(3);
  });

  it('keeps invalid and absent COD distinguishable from a real zero', () => {
    const result = pullNemowPackages([
      ['باركود', 'الحالة', 'التحصيل'],
      ['1', 'تم توصيلها', '0'],
      ['2', 'بانتظار', 'not-a-number'],
      ['3', 'بانتظار', ''],
    ], 'f.xlsx', 'Packages', NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.codTotalSar).toBe(0);
    expect(result.summary.codKnownCount).toBe(1);
    expect(result.summary.coverage?.invalidCod).toBe(1);
    expect(result.summary.coverage?.missingCod).toBe(1);
  });

  it('segregates integration source rows before KPI totals', () => {
    const result = pullNemowPackages([
      ['باركود', 'الحالة', 'مصدر'],
      ['1', 'تم توصيلها', 'سلة'],
      ['2', 'تم توصيلها', 'Nemow'],
    ], 'f.xlsx', 'Packages', NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.sourceTotal).toBe(2);
    expect(result.summary.excludedIntegration).toBe(1);
    expect(result.summary.total).toBe(1);
  });

  it('returns a successful empty KPI scope when every source row is integration data', () => {
    const result = pullNemowPackages([
      ['باركود', 'الحالة', 'مصدر'],
      ['1', 'تم توصيلها', ' سلة '],
    ], 'f.xlsx', 'Packages', NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.total).toBe(0);
    expect(result.summary.sourceTotal).toBe(1);
    expect(result.summary.excludedIntegration).toBe(1);
  });

  it('rejects impossible dates and negative or malformed amounts', () => {
    expect(nemowDayKey('31/02/2026')).toBeNull();
    expect(nemowDayKey('31-02-2026')).toBeNull();
    const result = pullNemowPackages([
      ['باركود', 'الحالة', 'التحصيل', 'تاريخ التوصيل'],
      ['1', 'تم توصيلها', '-2', '31/02/2026'],
      ['2', 'تم توصيلها', 'bad', '01/09/2026'],
    ], 'f.xlsx', 'Packages', NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.coverage?.invalidCod).toBe(2);
    expect(result.summary.coverage?.missingDate).toBe(1);
  });

  it('keeps duplicate aliases and first non-empty priority deterministic', () => {
    const cols = nemowColumnIndexes(['باركود', 'اسم المستقبل', 'اسم المستقبل', 'الحالة']);
    expect(cols.name).toEqual([1, 2]);
    expect(nemowFieldText(['1', '', 'receiver', 'تم توصيلها'], cols, 'name')).toBe('receiver');
  });
});
