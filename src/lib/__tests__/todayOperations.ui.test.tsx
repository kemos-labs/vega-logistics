import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TodayOperations } from '@/components/rebuild/TodayOperations';
import { createStopRecord } from '@/lib/stops';
import type { DailyRecord } from '@/lib/operationsReporting';

const DATE = '2026-08-27';
const NOW = '2026-08-27T12:00:00.000Z';

function stop(over: Partial<ReturnType<typeof createStopRecord>> = {}) {
  return createStopRecord({ operationDate: DATE, customerName: 'C', stopLabel: 'L', addressNotes: 'حي الملقا', ...over }, NOW);
}

describe('TodayOperations rendering', () => {
  beforeEach(() => { localStorage.clear(); });

  it('renders H1, one primary CTA, four workflow steps with provenance', () => {
    const onNavigate = vi.fn();
    const onDateChange = vi.fn();
    render(<TodayOperations selectedDate={DATE} onDateChange={onDateChange} stops={[]} dailyRecords={{}} recoveryEntries={[]} onNavigate={onNavigate} />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toBeTruthy();
    const primary = screen.getAllByTestId('today-primary-cta');
    expect(primary).toHaveLength(1);
    const steps = screen.getAllByTestId(/^today-step-/);
    expect(steps.filter(el => el.getAttribute('data-testid')?.startsWith('today-step-') && !el.getAttribute('data-testid')?.includes('btn'))).toHaveLength(4);
    expect(screen.getByTestId('today-pulse')).toBeTruthy();
    expect(screen.getByTestId('today-tile-planned')).toBeTruthy();
    expect(screen.getByTestId('today-tile-cod')).toBeTruthy();
  });

  it('every exception row navigates to correct workflow and selected date', () => {
    const onNavigate = vi.fn();
    const s1 = stop({ addressNotes: undefined, reference: 'R1' });
    const base = stop({ addressNotes: 'ok', reference: 'R2' });
    const rawFailed = { ...base, id: 'raw-missing', status: 'returned' as const, failureReasonKey: undefined } as unknown as ReturnType<typeof createStopRecord>;
    const daily: Record<string, DailyRecord> = { [DATE]: { date: DATE, completedShipments: 0, failedShipments: 0, fuelCost: 0, driversPresent: 2, notes: '', updatedAt: NOW, closeStatus: 'draft', loadedShipments: 10 } };
    const recoveries = [{ id: 'r1', createdAt: DATE, shipments: 1, owner: '', status: 'pending' as const }];
    render(<TodayOperations selectedDate={DATE} onDateChange={() => {}} stops={[s1, rawFailed]} dailyRecords={daily} recoveryEntries={recoveries} onNavigate={onNavigate} />);
    // Check expected kinds are present with correct targets
    const expected: Array<[string, string]> = [
      ['missing-address', 'stops'],
      ['missing-phone', 'stops'],
      ['unassigned', 'dispatch'],
      ['missing-reason', 'close'],
      ['shipment-gap', 'close'],
      ['draft-close', 'close'],
      ['pending-recovery', 'recovery'],
    ];
    for (const [kind, target] of expected) {
      const btn = screen.getByTestId(`today-exception-go-${kind}`);
      expect(btn).toBeTruthy();
      onNavigate.mockClear();
      fireEvent.click(btn);
      expect(onNavigate).toHaveBeenCalledWith(target, DATE);
    }
    // No missing detail duplication for shipment-gap: detail shown once via label, not duplicated as small
    const gapBtn = screen.getByTestId('today-exception-go-shipment-gap');
    expect(gapBtn).toBeTruthy();
    const smalls = gapBtn.querySelectorAll('small');
    expect(smalls.length).toBe(0); // gap shows detail only inside label, not duplicated
  });

  it('shows yesterday warning as non-blocking banner and has legacy copy', () => {
    const onNavigate = vi.fn();
    const yesterday = '2026-08-26';
    const daily: Record<string, DailyRecord> = { [yesterday]: { date: yesterday, completedShipments: 1, failedShipments: 0, fuelCost: 0, driversPresent: 2, notes: '', updatedAt: NOW, closeStatus: 'draft' } };
    const { unmount: unmount1 } = render(<TodayOperations selectedDate={DATE} onDateChange={() => {}} stops={[stop({ addressNotes: 'ok' })]} dailyRecords={daily} recoveryEntries={[]} onNavigate={onNavigate} />);
    const warning = screen.getByTestId('today-yesterday-warning');
    expect(warning).toBeTruthy();
    const primary = screen.getByTestId('today-primary-cta');
    expect(primary.textContent).not.toMatch(/أمس|yesterday/i);
    unmount1();
    // legacy case — must show dedicated legacy text, not missing/open
    const legacyDaily: Record<string, DailyRecord> = { [yesterday]: { date: yesterday, completedShipments: 1, failedShipments: 0, fuelCost: 0, driversPresent: 2, notes: '', updatedAt: NOW } };
    render(<TodayOperations selectedDate={DATE} onDateChange={() => {}} stops={[stop({ addressNotes: 'ok' })]} dailyRecords={legacyDaily} recoveryEntries={[]} onNavigate={vi.fn()} />);
    const legacyWarning = screen.getByTestId('today-yesterday-warning');
    expect(legacyWarning.textContent).toMatch(/legacy|مسجّل سابقاً/i);
  });

  it('displays provenance labels and BDI for dates', () => {
    const onNavigate = vi.fn();
    const daily: Record<string, DailyRecord> = { [DATE]: { date: DATE, completedShipments: 1, failedShipments: 0, fuelCost: 0, driversPresent: 2, notes: '', updatedAt: NOW, closeStatus: 'reconciled', closedAt: NOW, loadedShipments: 1, returnedShipments: 0, pendingShipments: 0, cashCollectedSar: 10, cashRemittedSar: 10, codExpectedSar: 10 } };
    const { container } = render(<TodayOperations selectedDate={DATE} onDateChange={() => {}} stops={[stop({ status: 'delivered', codAmountSar: 10, addressNotes: 'ok', driverName: 'D', carNumber: 'V' })]} dailyRecords={daily} recoveryEntries={[]} onNavigate={onNavigate} />);
    expect(container.textContent).toMatch(/recorded|مسجّل|derived|reconciled/i);
    expect(screen.getByTestId('today-date-input')).toBeTruthy();
  });

  it('workflow rail has exactly one aria-current step', () => {
    const onNavigate = vi.fn();
    // Scenario: empty day -> first step not complete, so first should be current
    const { unmount } = render(<TodayOperations selectedDate={DATE} onDateChange={() => {}} stops={[]} dailyRecords={{}} recoveryEntries={[]} onNavigate={onNavigate} />);
    let currents = document.querySelectorAll('[aria-current="step"]');
    expect(currents).toHaveLength(1);
    expect(currents[0].getAttribute('data-testid')).toBe('today-step-btn-plan');
    unmount();
    // Scenario: all complete -> Report should be current
    const reconciled: Record<string, DailyRecord> = { [DATE]: { date: DATE, completedShipments: 1, failedShipments: 0, fuelCost: 0, driversPresent: 2, notes: '', updatedAt: NOW, closeStatus: 'reconciled', closedAt: NOW, loadedShipments: 1, returnedShipments: 0, pendingShipments: 0, cashCollectedSar: 10, cashRemittedSar: 10, codExpectedSar: 10 } };
    const s = stop({ status: 'delivered', codAmountSar: 10, addressNotes: 'ok', driverName: 'D', carNumber: 'V' });
    render(<TodayOperations selectedDate={DATE} onDateChange={() => {}} stops={[s]} dailyRecords={reconciled} recoveryEntries={[]} onNavigate={vi.fn()} />);
    currents = document.querySelectorAll('[aria-current="step"]');
    expect(currents).toHaveLength(1);
    expect(currents[0].getAttribute('data-testid')).toBe('today-step-btn-report');
  });

  it('COD tile shows notRecorded when no DailyRecord exists', () => {
    const onNavigate = vi.fn();
    render(<TodayOperations selectedDate={DATE} onDateChange={() => {}} stops={[stop({ status: 'delivered', codAmountSar: 5, addressNotes: 'ok', driverName: 'D', carNumber: 'V' })]} dailyRecords={{}} recoveryEntries={[]} onNavigate={onNavigate} />);
    const codTile = screen.getByTestId('today-tile-cod');
    expect(codTile.textContent).toMatch(/notRecorded|not recorded|غير مسجّل/i);
  });

  it('reconciled day remains visibly complete even with optional phone warnings', () => {
    const onNavigate = vi.fn();
    const s = stop({ addressNotes: 'ok', phone: undefined, status: 'delivered', codAmountSar: 10, driverName: 'D', carNumber: 'V' });
    const rec: Record<string, DailyRecord> = { [DATE]: { date: DATE, completedShipments: 1, failedShipments: 0, fuelCost: 0, driversPresent: 2, notes: '', updatedAt: NOW, closeStatus: 'reconciled', closedAt: NOW, loadedShipments: 1, returnedShipments: 0, pendingShipments: 0, cashCollectedSar: 10, cashRemittedSar: 10, codExpectedSar: 10 } };
    render(<TodayOperations selectedDate={DATE} onDateChange={() => {}} stops={[s]} dailyRecords={rec} recoveryEntries={[]} onNavigate={onNavigate} />);
    expect(screen.getByTestId('today-complete')).toBeTruthy();
    expect(screen.getByTestId('today-exception-missing-phone')).toBeTruthy();
    expect(screen.getByTestId('today-complete').textContent).toMatch(/withRemaining|withWarnings|optional|اختيارية|متابعات/i);
  });
});
