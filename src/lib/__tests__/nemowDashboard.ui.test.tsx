// Nemow first-page dashboard UI: seeded-snapshot rendering, empty state,
// clear-back-to-empty. The file-picker path itself is covered by
// nemowPull.test.ts (pure engine); exceljs stays out of jsdom here.
import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import BusinessModelApp from '@/components/rebuild/BusinessModelApp';
import { pullNemowPackages } from '@/lib/nemowPull';

const NOW = '2026-09-15T08:00:00.000Z';
const KEY = 'vega-nemow-pull-v1';

const AOA = [
  ['باركود', 'مدينة المرسل', 'التحصيل الأصلي', 'الحالة', 'ارجعت بواسطة', 'تا ريخ اخر حركة'],
  ['1001', 'الرياض', '367.9', 'تم توصيلها', '', '09/09/2026 13:00'],
  ['1002', 'جدة', '100', 'تم إرجاعها', 'driver-A', '08/09/2026 19:13'],
  ['1003', 'الرياض', '', 'بانتظار التحميل', '', ''],
  ['المجموع', '', 0, '', '', ''],
];

function seed(summary: unknown) {
  localStorage.setItem(KEY, JSON.stringify(summary));
}

function summarize(aoa: unknown[][]) {
  const result = pullNemowPackages(aoa, 'f.xlsx', 'Packages', NOW);
  if (!result.ok) throw new Error(`fixture failed: ${result.error}`);
  return result.summary;
}

describe('nemow first-page dashboard', () => {
  beforeEach(() => {
    localStorage.clear();
    cleanup();
  });

  it('shows empty hint with a pull button when nothing was pulled', () => {
    render(<BusinessModelApp />);
    expect(screen.getByTestId('nemow-dashboard')).toBeTruthy();
    expect(screen.getByTestId('nemow-empty')).toBeTruthy();
    expect(screen.getByTestId('nemow-pull-btn')).toBeTruthy();
    expect(screen.queryByTestId('nemow-kpis')).toBeNull();
  });

  it('renders KPIs, statuses, drivers and trend from a seeded pull', () => {
    seed(summarize(AOA));
    render(<BusinessModelApp />);
    const kpis = screen.getByTestId('nemow-kpis');
    expect(kpis.textContent).toContain('3');
    expect(kpis.textContent).toContain('1');
    expect(kpis.textContent).toContain('2');
    expect(screen.getByTestId('nemow-statuses').textContent).toContain('تم إرجاعها');
    expect(screen.getByTestId('nemow-no-driver')).toBeTruthy();
    expect(screen.getByTestId('nemow-money').textContent).toContain('468');
    expect(screen.getByTestId('nemow-trend')).toBeTruthy();
    expect(screen.getByTestId('nemow-meta').textContent).toContain('f.xlsx');
  });

  it('states honestly when the export has no driver column', () => {
    seed(summarize([
      ['باركود الطرد', 'اسم المستقبل', 'الحالة', 'COD'],
      ['2001', 'recv', 'تم توصيلها', 50],
    ]));
    render(<BusinessModelApp />);
    expect(screen.getByTestId('nemow-no-driver')).toBeTruthy();
    expect(screen.queryByTestId('nemow-drivers')).toBeNull();
  });

  it('clear returns the panel to empty without touching other data', () => {
    seed(summarize(AOA));
    render(<BusinessModelApp />);
    expect(screen.getByTestId('nemow-kpis')).toBeTruthy();
    fireEvent.click(screen.getByTestId('nemow-clear-btn'));
    expect(screen.getByTestId('nemow-empty')).toBeTruthy();
    expect(localStorage.getItem(KEY)).toBe('null');
  });

  it('shows provenance, city workload, and selected-date comparison for v2 pulls', () => {
    seed(summarize(AOA));
    render(<BusinessModelApp />);
    expect(screen.getByTestId('nemow-source-reconciliation').textContent).toContain('Source rows');
    expect(screen.getByTestId('nemow-cities').textContent).toContain('الرياض');
    expect(screen.getByTestId('nemow-selected-compare')).toBeTruthy();
  });

  it('suppresses legacy metrics until the workbook is re-imported', () => {
    const legacy = summarize(AOA);
    delete (legacy as { schemaVersion?: number }).schemaVersion;
    seed(legacy);
    render(<BusinessModelApp />);
    expect(screen.getByTestId('nemow-legacy-suppressed')).toBeTruthy();
    expect(screen.queryByTestId('nemow-kpis')).toBeNull();
    expect(screen.queryByTestId('nemow-statuses')).toBeNull();
  });
});
