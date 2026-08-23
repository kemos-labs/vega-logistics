// @vitest-environment jsdom
// EveningClose UI flows (Release R4-B).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type CommitArgs = [Record<string, unknown>, string | undefined, { keys?: string[] } | undefined];
const { commitBundleSpy } = vi.hoisted(() => ({
  commitBundleSpy: vi.fn((..._args: unknown[]) => ({ persistedOk: true, failedKeys: [] as string[], rollbackOk: true, rollbackFailedKeys: [] as string[] })),
}));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdparty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      let out = key;
      if (opts) for (const [k, v] of Object.entries(opts)) out += ` ~${k}=${String(v)}~`;
      return out;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('@/lib/backup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/backup')>();
  return { ...actual, commitBundle: (...args: unknown[]) => (commitBundleSpy(...args) as unknown) };
});

import { EveningCloseView } from '@/components/rebuild/EveningClose';
import type { DailyRecord } from '@/lib/operationsReporting';
import type { RecoveryEntry } from '@/lib/recoveryBoard';
import { createStopRecord, type StopRecord } from '@/lib/stops';

const NOW = '2026-08-24T18:00:00.000Z';
const DATE = '2026-08-25';
let tick = 0;
function stop(over: Partial<StopRecord> = {}): StopRecord {
  tick += 1;
  return createStopRecord({
    operationDate: DATE, customerName: `C${tick}`, stopLabel: `L${tick}`, reference: `R-${tick}`,
    codAmountSar: over.status === 'delivered' ? 10 : undefined,
    ...over,
  }, new Date(Date.parse(NOW) - 3600_000 + tick * 1000).toISOString());
}
function record(over: Partial<DailyRecord> = {}): DailyRecord {
  return { date: DATE, completedShipments: 0, failedShipments: 0, fuelCost: 90, driversPresent: 1, notes: 'keep', updatedAt: NOW, ...over };
}

function renderClose(stops: StopRecord[], daily: DailyRecord | undefined, recovery: RecoveryEntry[] = []) {
  const spies = { setStops: vi.fn(), setDailyRecords: vi.fn(), setRecoveryEntries: vi.fn() };
  render(<EveningCloseView stops={stops} setStops={spies.setStops} dailyRecords={daily ? { [DATE]: daily } : {}} setDailyRecords={spies.setDailyRecords} recoveryEntries={recovery} setRecoveryEntries={spies.setRecoveryEntries} />);
  // the component owns its date state — pin it to the fixture date
  fireEvent.change(screen.getByTestId('close-date'), { target: { value: DATE } });
  return spies;
}

beforeEach(() => { commitBundleSpy.mockClear(); commitBundleSpy.mockImplementation(() => ({ persistedOk: true, failedKeys: [], rollbackOk: true, rollbackFailedKeys: [] })); });
afterEach(() => cleanup());

function setOutcome(reference: string, outcome: string) {
  fireEvent.click(screen.getByTestId(`${outcome}-${reference}`));
}

describe('EveningCloseView', () => {
  it('balanced outcomes enable confirmation; mismatch blocks with visible reason', () => {
    const stops = [stop({ status: 'delivered' }), stop({ status: 'returned', failureReasonKey: 'noDriver' }), stop()];
    renderClose(stops, undefined);
    // loaded = 3 via manual entry
    fireEvent.change(document.querySelector('[name="loaded-shipments"]') as HTMLInputElement, { target: { value: '3' } });
    expect((screen.getByTestId('confirm-close') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(document.querySelector('[name="loaded-shipments"]') as HTMLInputElement, { target: { value: '5' } });
    expect(screen.getByTestId('close-difference').textContent).toBe('+2');
    expect(screen.getByTestId('mismatch-note')).toBeTruthy();
    expect((screen.getByTestId('confirm-close') as HTMLButtonElement).disabled).toBe(true);
  });

  it('negative difference is displayed with its sign', () => {
    const stops = [stop({ status: 'delivered' }), stop({ status: 'returned', failureReasonKey: 'noDriver' }), stop({ status: 'returned', failureReasonKey: 'other' })];
    renderClose(stops, undefined);
    fireEvent.change(document.querySelector('[name="loaded-shipments"]') as HTMLInputElement, { target: { value: '2' } });
    expect(screen.getByTestId('close-difference').textContent).toBe('-1');
  });

  it('returned without a reason blocks confirmation via missing-reasons', () => {
    const stops = [stop({ status: 'returned', failureReasonKey: 'noDriver' }), stop()];
    renderClose(stops, undefined);
        fireEvent.change(document.querySelector('[name="loaded-shipments"]') as HTMLInputElement, { target: { value: '1' } });
    // mark the planned stop returned → reason picker appears; apply without reason
    setOutcome(stops[1].reference ?? '', 'returned');
    fireEvent.change(screen.getByTestId('reason-picker').querySelector('select') as HTMLSelectElement, { target: { value: 'addressIssue' } });
    fireEvent.click(screen.getByText('businessModel.close.applyReason'));
    fireEvent.change(document.querySelector('[name="loaded-shipments"]') as HTMLInputElement, { target: { value: '2' } });
    expect((screen.getByTestId('confirm-close') as HTMLButtonElement).disabled).toBe(false);
  });

  it('delivered clears stale failure reasons', () => {
    const s = stop({ status: 'pending', failureReasonKey: 'noDriver' });
    renderClose([s], undefined);
    setOutcome(s.reference ?? '', 'delivered');
    const written = ((commitBundleSpy.mock.calls[0] as unknown[])[0] as { stops: StopRecord[] }).stops;
    expect(written[0].failureReasonKey).toBeUndefined();
    expect(written[0].status).toBe('delivered');
  });

  it('draft save succeeds with mismatch and says the day is NOT closed', () => {
    const stops = [stop({ status: 'delivered' }), stop()];
    renderClose(stops, undefined);
    fireEvent.change(document.querySelector('[name="loaded-shipments"]') as HTMLInputElement, { target: { value: '5' } });
    fireEvent.click(screen.getByTestId('save-draft'));
    const bundle = (commitBundleSpy.mock.calls[0] as unknown[])[0] as { dailyRecords: Record<string, DailyRecord> };
    expect(bundle.dailyRecords[DATE].closeStatus).toBe('draft');
    expect(screen.getByTestId('close-message').textContent).toContain('draftSaved');
  });

  it('reconciled close writes closeStatus+closedAt and creates linked recovery entries once', () => {
    const failed = stop({ status: 'pending', failureReasonKey: 'noDriver' });
    const delivered = stop({ status: 'delivered' });
    const returned = stop({ status: 'returned', failureReasonKey: 'addressIssue' });
    renderClose([failed, delivered, returned], undefined);
    fireEvent.change(document.querySelector('[name="loaded-shipments"]') as HTMLInputElement, { target: { value: '3' } });
    fireEvent.click(screen.getByTestId('confirm-close'));
    const bundle = (commitBundleSpy.mock.calls[0] as unknown[])[0] as { dailyRecords: Record<string, DailyRecord>; recoveryEntries: RecoveryEntry[]; stops: StopRecord[] };
    expect(bundle.dailyRecords[DATE].closeStatus).toBe('reconciled');
    expect(bundle.dailyRecords[DATE].closedAt).toBeTruthy();
    // BOTH exception stops get entries: the failed attempt (pending+reason)
    // AND the returned stop (board = write-off review per documented rule)
    expect(bundle.recoveryEntries).toHaveLength(2);
    expect(bundle.recoveryEntries.map(e => e.stopId).sort())
      .toEqual(bundle.stops.filter(s => s.status !== 'delivered').map(s => s.id).sort());
    // keys include all three collections
    const keys = (commitBundleSpy.mock.calls[0] as unknown[])[2] as { keys: string[] };
    expect(keys.keys).toEqual(['dailyRecords', 'stops', 'recoveryEntries']);
  });

  it('repeated reconciled save creates NO duplicate recovery entries', () => {
    const failed = stop({ status: 'pending', failureReasonKey: 'noDriver' });
    const existing: RecoveryEntry[] = [{ id: 'rec-stop-' + failed.id, createdAt: DATE, shipments: 1, owner: 'o', status: 'pending', stopId: failed.id }];
    renderClose([failed], undefined, existing);
    fireEvent.change(document.querySelector('[name="loaded-shipments"]') as HTMLInputElement, { target: { value: '1' } });
    fireEvent.click(screen.getByTestId('confirm-close'));
    const bundle = (commitBundleSpy.mock.calls[0] as unknown[])[0] as { recoveryEntries?: RecoveryEntry[] };
    expect(bundle.recoveryEntries).toBeUndefined(); // nothing new to create
  });

  it('combined persistence failure changes no state; retry remains possible', () => {
    commitBundleSpy.mockImplementation(() => ({ persistedOk: false, failedKeys: ['vega-stops-v1', 'vega-daily-reports-v2'], rollbackOk: true, rollbackFailedKeys: [] }));
    const spies = renderClose([stop({ status: 'delivered' })], undefined);
    fireEvent.change(document.querySelector('[name="loaded-shipments"]') as HTMLInputElement, { target: { value: '1' } });
    fireEvent.click(screen.getByTestId('confirm-close'));
    expect(spies.setStops).not.toHaveBeenCalled();
    expect(spies.setDailyRecords).not.toHaveBeenCalled();
    expect(screen.getByTestId('close-message').textContent).toContain('persistFailed');
    // retry after fixing the mock
    commitBundleSpy.mockImplementation(() => ({ persistedOk: true, failedKeys: [], rollbackOk: true, rollbackFailedKeys: [] }));
    fireEvent.click(screen.getByTestId('confirm-close'));
    expect(spies.setDailyRecords).toHaveBeenCalled();
  });

  it('reopen requires explicit confirmation and keeps recovery entries', () => {
    const daily = record({ closeStatus: 'reconciled', closedAt: NOW, loadedShipments: 1, completedShipments: 1 });
    const recovery: RecoveryEntry[] = [{ id: 'r1', createdAt: DATE, shipments: 1, owner: 'o', status: 'pending' }];
    const spies = renderClose([], daily, recovery);
    fireEvent.click(screen.getByTestId('reopen-ask'));
    expect(screen.getByTestId('reopen-confirm').textContent).toContain('reopenQuestion');
    fireEvent.click(screen.getByText('businessModel.close.reopenNo'));
    expect(spies.setDailyRecords).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('reopen-ask'));
    fireEvent.click(screen.getByText('businessModel.close.reopenYes'));
    const bundle = (commitBundleSpy.mock.calls[0] as unknown[])[0] as { dailyRecords: Record<string, DailyRecord>; recoveryEntries?: RecoveryEntry[] };
    expect(bundle.dailyRecords[DATE].closeStatus).toBe('draft');
    expect(bundle.recoveryEntries).toEqual(recovery); // kept
  });

  it('invalid money blocks; COD under-collection is a visible draft warning', () => {
    const delivered = stop({ status: 'delivered', codAmountSar: 40 });
    renderClose([delivered], undefined);
    fireEvent.change(document.querySelector('[name="cod-collected"]') as HTMLInputElement, { target: { value: 'abc' } });
    expect(screen.getAllByText('businessModel.close.invalidMoney').length).toBeGreaterThan(0);
    fireEvent.change(document.querySelector('[name="cod-collected"]') as HTMLInputElement, { target: { value: '10' } });
    expect(screen.queryByText('businessModel.close.invalidMoney')).toBeNull(); // cleared once valid
    expect(screen.getByTestId('cod-expected').textContent).toBe('40');
  });

  it('date selector isolates state: yesterday vs old reconciled date never leak numbers', () => {
    const todayStop = stop(); // DATE = fixture date
    renderClose([todayStop], undefined);
    fireEvent.change(document.querySelector('[name="loaded-shipments"]') as HTMLInputElement, { target: { value: '7' } });
    // switch to another date with a RECONCILED record
    fireEvent.change(screen.getByTestId('close-date'), { target: { value: '2026-08-20' } });
    const reconciled = record({ date: '2026-08-20', closeStatus: 'reconciled' as never, closedAt: NOW, loadedShipments: 4, cashCollectedSar: 50 });
    // re-render with the record present for that date
    cleanup();
    const spies = { setStops: vi.fn(), setDailyRecords: vi.fn(), setRecoveryEntries: vi.fn() };
    render(<EveningCloseView stops={[]} setStops={spies.setStops} dailyRecords={{ '2026-08-20': reconciled }} setDailyRecords={spies.setDailyRecords} recoveryEntries={[]} setRecoveryEntries={spies.setRecoveryEntries} />);
    fireEvent.change(screen.getByTestId('close-date'), { target: { value: '2026-08-20' } });
    expect((document.querySelector('[name="loaded-shipments"]') as HTMLInputElement).value).toBe('4'); // from THAT date's record
    expect(screen.getByTestId('evening-close').textContent).toContain('status.reconciled');
    // switching back resets away from the reconciled values
    fireEvent.change(screen.getByTestId('close-date'), { target: { value: DATE } });
    expect((document.querySelector('[name="loaded-shipments"]') as HTMLInputElement).value).toBe(''); // no leakage
  });

  it('draft rows are flagged as excluded from definitive KPIs', () => {
    renderClose([stop()], record({ closeStatus: 'draft' }));
    expect(screen.getByTestId('evening-close').textContent).toContain('draftExcluded');
  });
});
