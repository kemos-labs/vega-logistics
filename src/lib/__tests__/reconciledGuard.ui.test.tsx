import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { EveningCloseView } from '@/components/rebuild/EveningClose';
import { createStopRecord } from '@/lib/stops';
import type { DailyRecord } from '@/lib/operationsReporting';

const DATE = '2026-08-27';
const NOW = '2026-08-27T18:00:00.000Z';

function stop() { return createStopRecord({ operationDate: DATE, customerName: 'C', stopLabel: 'L', addressNotes: 'ok' }, NOW); }

describe('reconciled close read-only guard', () => {
  beforeEach(() => { localStorage.clear(); });

  it('disables outcome, loaded, COD, fuel, attendance, Save Draft and Confirm when reconciled', () => {
    const s = stop();
    const rec: DailyRecord = { date: DATE, completedShipments: 0, failedShipments: 0, fuelCost: 100, driversPresent: 2, notes: '', updatedAt: NOW, closeStatus: 'reconciled', closedAt: NOW, loadedShipments: 1, returnedShipments: 0, pendingShipments: 1, cashCollectedSar: 0, cashRemittedSar: 0 };
    const setStops = vi.fn();
    const setRecords = vi.fn();
    const setRecovery = vi.fn();
    render(<EveningCloseView initialDate={DATE} stops={[s]} setStops={setStops} dailyRecords={{ [DATE]: rec }} setDailyRecords={setRecords} recoveryEntries={[]} setRecoveryEntries={setRecovery} />);
    // outcome buttons disabled
    const btn = screen.getByTestId(`delivered-${s.reference ?? s.id}`);
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    // loaded input disabled
    expect((document.querySelector('input[name="loaded-shipments"]') as HTMLInputElement).disabled).toBe(true);
    // COD inputs disabled
    expect((document.querySelector('input[name="cod-collected"]') as HTMLInputElement).disabled).toBe(true)
    // fuel and drivers
    expect((document.querySelector('input[name=\"close-fuel\"]') as HTMLInputElement).disabled).toBe(true);
    expect((document.querySelector('input[name=\"close-drivers\"]') as HTMLInputElement).disabled).toBe(true);
    // Save Draft disabled
    expect((screen.getByTestId('save-draft') as HTMLButtonElement).disabled).toBe(true);
    // Confirm disabled
    expect((screen.getByTestId('confirm-close') as HTMLButtonElement).disabled).toBe(true);
    // date picker still enabled
    expect((screen.getByTestId('close-date') as HTMLInputElement).disabled).toBe(false);
    // handlers guarded: clicking outcome should not call setStops
    act(() => { fireEvent.click(btn); });
    expect(setStops).not.toHaveBeenCalled();
    // save draft handler guarded
    act(() => { fireEvent.click(screen.getByTestId('save-draft')); });
    expect(setRecords).not.toHaveBeenCalled();
  });

  it('reopen flow re-enables editing', async () => {
    const s = stop();
    const rec: DailyRecord = { date: DATE, completedShipments: 0, failedShipments: 0, fuelCost: 100, driversPresent: 2, notes: '', updatedAt: NOW, closeStatus: 'reconciled', closedAt: NOW, loadedShipments: 1, returnedShipments: 0, pendingShipments: 1, cashCollectedSar: 0, cashRemittedSar: 0 };
    const setRecords = vi.fn();
    render(<EveningCloseView initialDate={DATE} stops={[s]} setStops={() => {}} dailyRecords={{ [DATE]: rec }} setDailyRecords={setRecords} recoveryEntries={[]} setRecoveryEntries={() => {}} />);
    // ask reopen
    act(() => { fireEvent.click(screen.getByTestId('reopen-ask')); });
    expect(screen.getByTestId('reopen-confirm')).toBeTruthy();
    act(() => { fireEvent.click(screen.getByText('businessModel.close.reopenYes')); });
    // setRecords should have been called with draft
    expect(setRecords).toHaveBeenCalled();
  });
});
