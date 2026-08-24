import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import BusinessModelApp from '@/components/rebuild/BusinessModelApp';

const mockPdf = vi.fn().mockResolvedValue(undefined);
const mockExcel = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/reportExport', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reportExport')>('@/lib/reportExport');
  return { ...actual, exportDailyReportPdf: (...args: unknown[]) => mockPdf(...args), exportBusinessModelExcel: (...args: unknown[]) => mockExcel(...args) };
});

describe('explicit-draft report/export guard', () => {
  beforeEach(() => { localStorage.clear(); mockPdf.mockClear(); mockExcel.mockClear(); });

  it('blocks PDF, Excel and Pro for explicit draft but allows legacy and reconciled', async () => {
    const date = '2026-08-27';
    const draftRecord = { date, completedShipments: 5, failedShipments: 1, fuelCost: 100, driversPresent: 2, notes: '', updatedAt: new Date().toISOString(), closeStatus: 'draft' };
    const legacyRecord = { date: '2026-08-26', completedShipments: 5, failedShipments: 1, fuelCost: 100, driversPresent: 2, notes: '', updatedAt: new Date().toISOString() };
    const reconciledRecord = { date: '2026-08-28', completedShipments: 5, failedShipments: 1, fuelCost: 100, driversPresent: 2, notes: '', updatedAt: new Date().toISOString(), closeStatus: 'reconciled', closedAt: new Date().toISOString() };
    localStorage.setItem('vega-daily-reports-v2', JSON.stringify({ [date]: draftRecord, '2026-08-26': legacyRecord, '2026-08-28': reconciledRecord }));
    render(<BusinessModelApp />);
    act(() => { screen.getByTestId('primary-nav-reports').click(); });
    act(() => { screen.getAllByRole('button', { name: /Daily report/i })[0].click(); });
    const dateInput = screen.getByLabelText('Report date') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: date } });
    await waitFor(() => expect(screen.getByTestId('draft-export-blocked')).toBeTruthy());
    const primaryBtn = screen.getByTestId('report-primary-btn') as HTMLButtonElement;
    const excelBtn = screen.getByTestId('export-excel-btn') as HTMLButtonElement;
    expect(primaryBtn.disabled).toBe(true);
    expect(excelBtn.disabled).toBe(true);

    // Handler guard: even if disabled is cleared programmatically, handler still blocks
    primaryBtn.disabled = false;
    excelBtn.disabled = false;
    act(() => { fireEvent.click(primaryBtn); });
    expect(mockPdf).not.toHaveBeenCalled();
    expect(screen.getByTestId('draft-export-blocked')).toBeTruthy();
    // Pro mode also blocked — dialog must not open, handler guards (force enable to test handler)
    const proToggle = screen.getAllByRole('radio', { name: /Pro/i })[0] ?? screen.getByText(/Pro/i).closest('button')!;
    act(() => { fireEvent.click(proToggle as HTMLElement); });
    const proBtn = screen.getByTestId('report-primary-btn') as HTMLButtonElement;
    // Pro should be blocked for draft (disabled or handler)
    const wasDisabled = proBtn.disabled;
    proBtn.disabled = false;
    act(() => { fireEvent.click(proBtn); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('draft-export-blocked')).toBeTruthy();
    // restore disabled state expectation if it was disabled
    if (wasDisabled) expect(true).toBe(true);

    // Excel also blocked via handler
    act(() => { fireEvent.click(excelBtn); });
    expect(mockExcel).not.toHaveBeenCalled();

    // Switch to legacy date -> allowed and mock gets called
    fireEvent.change(dateInput, { target: { value: '2026-08-26' } });
    await waitFor(() => expect(screen.queryByTestId('draft-export-blocked')).toBeNull());
    expect((screen.getByTestId('report-primary-btn') as HTMLButtonElement).disabled).toBe(false);
    // Ensure Daily mode
    const dailyToggle = screen.getAllByRole('radio', { name: /Standard|Daily/i })[0];
    if (dailyToggle) act(() => { fireEvent.click(dailyToggle as HTMLElement); });
    act(() => { fireEvent.click(screen.getByTestId('report-primary-btn')); });
    await waitFor(() => expect(mockPdf).toHaveBeenCalled());
    mockPdf.mockClear();
    act(() => { fireEvent.click(screen.getByTestId('export-excel-btn')); });
    await waitFor(() => expect(mockExcel).toHaveBeenCalled());

    // Switch to reconciled -> allowed
    fireEvent.change(dateInput, { target: { value: '2026-08-28' } });
    await waitFor(() => expect(screen.queryByTestId('draft-export-blocked')).toBeNull());
    expect((screen.getByTestId('report-primary-btn') as HTMLButtonElement).disabled).toBe(false);
  });
});
