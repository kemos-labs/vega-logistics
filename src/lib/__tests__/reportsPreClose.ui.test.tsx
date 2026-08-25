// Reports without a financial close (R6 early slice).
//
// Stop-level delivery truth exists independently of the close. The report view
// must show recorded per-driver deliveries honestly BEFORE a close exists,
// while print/export stay gated on a definitive close and cash fields stay
// absent (never zero-filled).
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ReportsView } from '@/components/rebuild/ReportsView';
import type { StopRecord } from '@/lib/stops';

const DATE = '2026-08-24';

function stop(over: Partial<StopRecord> = {}): StopRecord {
  return {
    id: Math.random().toString(36).slice(2),
    operationDate: DATE, customerName: 'نور ماركت', stopLabel: 'بوابة 4',
    status: 'delivered', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    ...over,
  };
}

describe('reports before any close exists', () => {
  beforeEach(() => {
    localStorage.clear();
    cleanup();
  });

  const stops: StopRecord[] = [
    stop({ id: 's1', driverName: 'خالد', carNumber: 'CAR-12', plateNumber: 'أ ب ج 1234', codAmountSar: 50, podStatus: 'complete' }),
    stop({ id: 's2', driverName: 'خالد', carNumber: 'CAR-12', plateNumber: 'أ ب ج 1234', status: 'pending', codAmountSar: 30 }),
    stop({ id: 's3', driverName: 'سالم', carNumber: 'Van-1', status: 'returned', failureReasonKey: 'customerUnavailable', codAmountSar: 20 }),
  ];

  it('shows honest per-driver delivery counts WITHOUT cash columns, print or export', () => {
    render(<ReportsView operationDate={DATE} onOperationDateChange={() => {}} stops={stops} dailyRecords={{}} onGotoClose={() => {}} />);

    // honest pre-close note instead of silent empty state
    expect(screen.getByTestId('reports-no-close-note')).toBeTruthy();
    // stop-derived company numbers render
    expect(screen.getByTestId('reports-company-stops-only')).toBeTruthy();
    expect(screen.getByTestId('reports-cod-expected-stops-only').textContent).toContain('50');

    // per-driver cards exist, grouped by catalog identity
    expect(screen.getByTestId(`reports-run-خالد|CAR-12|أ ب ج 1234`)).toBeTruthy();
    expect(screen.getByTestId('reports-run-سالم|Van-1|—')).toBeTruthy();

    // NO print buttons, no company print/export while unclosed
    expect(document.querySelector('[data-testid^="reports-print-"]')).toBeNull();
    expect(screen.queryByTestId('reports-print-company')).toBeNull();
    expect(screen.queryByTestId('reports-export-excel')).toBeNull();
  });

  it('keeps collected/remitted ABSENT (no phantom zeros) until Evening Close records them', () => {
    render(<ReportsView operationDate={DATE} onOperationDateChange={() => {}} stops={stops} dailyRecords={{}} onGotoClose={() => {}} />);
    expect(screen.queryByTestId('reports-outstanding')).toBeNull();
    expect(screen.queryByTestId('reports-cash-attribution')).toBeNull();
  });

  it('still routes the operator to Evening Close when nothing is recorded at all', () => {
    render(<ReportsView operationDate={DATE} onOperationDateChange={() => {}} stops={[]} dailyRecords={{}} onGotoClose={() => {}} />);
    expect(screen.getByTestId('reports-empty')).toBeTruthy();
    expect(screen.getByTestId('reports-cta-close')).toBeTruthy();
  });
});
