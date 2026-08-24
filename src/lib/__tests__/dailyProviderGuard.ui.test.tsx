import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import BusinessModelApp from '@/components/rebuild/BusinessModelApp';
import { ProviderImportCard } from '@/components/rebuild/BusinessModelApp';

describe('DailyReport reconciled save guard and ProviderImport reconciled overwrite guard', () => {
  beforeEach(() => { localStorage.clear(); });

  it('DailyReport cannot save a reconciled record; draft and legacy remain editable', async () => {
    const reconciledDate = '2026-08-27';
    const draftDate = '2026-08-26';
    const legacyDate = '2026-08-25';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reconciled: any = { date: reconciledDate, completedShipments: 5, failedShipments: 0, fuelCost: 100, driversPresent: 2, notes: 'orig', updatedAt: new Date().toISOString(), closeStatus: 'reconciled', closedAt: new Date().toISOString() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const draft: any = { date: draftDate, completedShipments: 3, failedShipments: 0, fuelCost: 80, driversPresent: 2, notes: '', updatedAt: new Date().toISOString(), closeStatus: 'draft' };
    const legacy = { date: legacyDate, completedShipments: 2, failedShipments: 0, fuelCost: 70, driversPresent: 2, notes: '', updatedAt: new Date().toISOString() };
    localStorage.setItem('vega-daily-reports-v2', JSON.stringify({ [reconciledDate]: reconciled, [draftDate]: draft, [legacyDate]: legacy }));
    render(<BusinessModelApp />);
    act(() => { screen.getByTestId('primary-nav-reports').click(); });
    act(() => { screen.getAllByRole('button', { name: /Daily report/i })[0].click(); });
    const dateInput = screen.getByLabelText('Report date') as HTMLInputElement;

    // Reconciled: fieldset disabled and save guarded
    fireEvent.change(dateInput, { target: { value: reconciledDate } });
    await waitFor(() => expect(screen.getByTestId('daily-edit-fieldset')).toBeTruthy());
    const fieldset = screen.getByTestId('daily-edit-fieldset') as HTMLFieldSetElement;
    expect(fieldset.disabled).toBe(true);
    expect(screen.getByTestId('daily-reconciled-blocked')).toBeTruthy();
    const saveBtn = screen.getByText(/Save daily report/i).closest('button') as HTMLButtonElement;
    const before = JSON.parse(localStorage.getItem('vega-daily-reports-v2') || '{}');
    // Temporarily enable fieldset to prove handler guard, not just disabled UI
    fieldset.disabled = false;
    act(() => { fireEvent.click(saveBtn); });
    expect(screen.getByTestId('daily-reconciled-blocked')).toBeTruthy();
    const after = JSON.parse(localStorage.getItem('vega-daily-reports-v2') || '{}');
    expect(after[reconciledDate].notes).toBe('orig');
    fieldset.disabled = true;

    // Draft remains editable
    fireEvent.change(dateInput, { target: { value: draftDate } });
    await waitFor(() => expect((screen.getByTestId('daily-edit-fieldset') as HTMLFieldSetElement).disabled).toBe(false));
    expect(screen.queryByTestId('daily-reconciled-blocked')).toBeNull();

    // Legacy remains editable
    fireEvent.change(dateInput, { target: { value: legacyDate } });
    await waitFor(() => expect((screen.getByTestId('daily-edit-fieldset') as HTMLFieldSetElement).disabled).toBe(false));
  });

  it('ProviderImport cannot overwrite a reconciled date; draft and legacy remain allowed', async () => {
    const reconciledDate = '2026-08-27';
    const draftDate = '2026-08-28';
    const legacyDate = '2026-08-29';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reconciled: any = { date: reconciledDate, completedShipments: 1, failedShipments: 0, fuelCost: 10, driversPresent: 2, notes: '', updatedAt: new Date().toISOString(), closeStatus: 'reconciled', closedAt: new Date().toISOString() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const draft: any = { date: draftDate, completedShipments: 1, failedShipments: 0, fuelCost: 10, driversPresent: 2, notes: '', updatedAt: new Date().toISOString(), closeStatus: 'draft' };
    const legacy = { date: legacyDate, completedShipments: 1, failedShipments: 0, fuelCost: 10, driversPresent: 2, notes: '', updatedAt: new Date().toISOString() };
    const onApply = vi.fn();
    const { rerender } = render(<ProviderImportCard dailyRecords={{ [reconciledDate]: reconciled }} onApply={onApply} />);
    // Need to parse a valid message: use provider message that reconciles: تحميل 5 توصيل 3 راجع 2  => balanced (3+2=5)
    const validMsg = 'يعقوب عبدالقادر سياره10 لوحه4684 تحميل5 توصيل3 راجع2';
    const input = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: validMsg } });
    fireEvent.click(screen.getByTestId('parse-btn'));
    await waitFor(() => expect(screen.getByTestId('preview-grid')).toBeTruthy());
    // Change date to reconciled date
    const dateField = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateField, { target: { value: reconciledDate } });
    await waitFor(() => expect(screen.getByTestId('reconciled-blocked')).toBeTruthy());
    expect((screen.getByTestId('import-confirm') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('import-confirm'));
    expect(onApply).not.toHaveBeenCalled();
    // Preview should remain (not cleared)
    expect(screen.getByTestId('preview-grid')).toBeTruthy();

    // Draft should be allowed after ack
    fireEvent.change(dateField, { target: { value: draftDate } });
    rerender(<ProviderImportCard dailyRecords={{ [draftDate]: draft }} onApply={onApply} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: validMsg } });
    fireEvent.click(screen.getByTestId('parse-btn'));
    await waitFor(() => expect(screen.getByTestId('preview-grid')).toBeTruthy());
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: draftDate } });
    await waitFor(() => expect(screen.getByTestId('overwrite-note')).toBeTruthy());
    fireEvent.click(screen.getByTestId('overwrite-ack'));
    await waitFor(() => expect(screen.queryByTestId('reconciled-blocked')).toBeNull());
    expect((screen.getByTestId('import-confirm') as HTMLButtonElement).disabled).toBe(false);

    // Legacy should be allowed after ack
    rerender(<ProviderImportCard dailyRecords={{ [legacyDate]: legacy }} onApply={onApply} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: validMsg } });
    fireEvent.click(screen.getByTestId('parse-btn'));
    await waitFor(() => expect(screen.getByTestId('preview-grid')).toBeTruthy());
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: legacyDate } });
    await waitFor(() => expect(screen.getByTestId('overwrite-note')).toBeTruthy());
    fireEvent.click(screen.getByTestId('overwrite-ack'));
    await waitFor(() => expect(screen.queryByTestId('reconciled-blocked')).toBeNull());
    expect((screen.getByTestId('import-confirm') as HTMLButtonElement).disabled).toBe(false);
  });
});
