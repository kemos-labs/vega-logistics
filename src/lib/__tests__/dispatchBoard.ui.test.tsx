// @vitest-environment jsdom
// DispatchBoard UI (Release R3): assignment, accessible ordering, manifest.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const commitBundleSpy = vi.fn<(...callArgs: unknown[]) => { persistedOk: boolean; failedKeys: string[]; rollbackOk: boolean; rollbackFailedKeys: string[] }>(
  () => ({ persistedOk: true, failedKeys: [], rollbackOk: true, rollbackFailedKeys: [] }),
);

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

import { DispatchBoardView } from '@/components/rebuild/DispatchBoard';
import { createStopRecord, type StopRecord } from '@/lib/stops';
import type { DriverRecord } from '@/lib/types';

const NOW = '2026-08-24T06:00:00.000Z';
let tick = 0;
function stop(over: Partial<StopRecord> = {}): StopRecord {
  tick += 1;
  return createStopRecord({
    operationDate: '2026-08-25', customerName: `C${tick}`, stopLabel: `L${tick}`, reference: `R-${tick}`,
    ...over,
  }, new Date(Date.parse(NOW) + tick * 1000).toISOString());
}

const drivers: DriverRecord[] = [
  { id: 'd1', fullName: 'سالم', phone: '', nationalId: '', assignedVehicle: 'Van-1', status: 'active' },
  { id: 'd2', fullName: 'موقوف', phone: '', nationalId: '', assignedVehicle: 'Van-2', status: 'inactive' },
];

function renderBoard(stops: StopRecord[]) {
  const setStops = vi.fn();
  render(<DispatchBoardView stops={stops} setStops={setStops} drivers={drivers} />);
  // pin the date to the fixture date
  fireEvent.change(document.querySelector('[name="dispatch-date"]') as HTMLInputElement, { target: { value: '2026-08-25' } });
  return { setStops };
}

function writtenStops(): StopRecord[] {
  return ((commitBundleSpy.mock.calls[commitBundleSpy.mock.calls.length - 1] as unknown[])[0] as { stops: StopRecord[] }).stops;
}

beforeEach(() => { commitBundleSpy.mockClear(); });
afterEach(() => cleanup());

describe('DispatchBoardView', () => {
  it('assigns an unassigned stop to the ACTIVE driver only (inactive not offered)', () => {
    const a = stop();
    const { setStops } = renderBoard([a]);
    const select = screen.getByTestId(`assign-${a.reference}`) as HTMLSelectElement;
    const options = Array.from(select.options).map(option => option.textContent);
    expect(options.join('|')).not.toContain('موقوف');
    fireEvent.change(select, { target: { value: 'd1' } });
    const written = writtenStops();
    expect(written.find(s => s.id === a.id)).toMatchObject({ driverName: 'سالم', carNumber: 'Van-1', status: 'planned' });
    expect(setStops).toHaveBeenCalled();
  });

  it('move buttons reorder within the run through the transactional seam', () => {
    const a = stop({ driverName: 'سالم', carNumber: 'Van-1', sequence: 1 });
    const b = stop({ driverName: 'سالم', carNumber: 'Van-1', sequence: 2 });
    renderBoard([a, b]);
    fireEvent.click(screen.getByTestId(`down-${a.reference}`));
    const written = writtenStops();
    expect(written.find(s => s.id === a.id)?.sequence).toBe(2);
    expect(written.find(s => s.id === b.id)?.sequence).toBe(1);
  });

  it('persistence failure changes nothing and shows the honest message', () => {
    commitBundleSpy.mockImplementation(() => ({ persistedOk: false, failedKeys: ['vega-stops-v1'], rollbackOk: true, rollbackFailedKeys: [] }));
    const setStops = vi.fn();
    const a = stop();
    render(<DispatchBoardView stops={[a]} setStops={setStops} drivers={drivers} />);
    fireEvent.change(document.querySelector('[name="dispatch-date"]') as HTMLInputElement, { target: { value: '2026-08-25' } });
    fireEvent.change(screen.getByTestId(`assign-${a.reference}`), { target: { value: 'd1' } });
    expect(setStops).not.toHaveBeenCalled();
    expect(screen.getByTestId('dispatch-message').textContent).toContain('persistFailed');
  });

  it('two runs sharing a display name but different vehicles print their OWN stops', () => {
    const a = stop({ driverName: 'سالم', carNumber: 'Van-1', sequence: 1, reference: 'VA' });
    const b = stop({ driverName: 'سالم', carNumber: 'Van-2', sequence: 1, reference: 'VB' });
    renderBoard([a, b]);
    expect(screen.getByTestId('run-سالم|Van-1|—')).toBeTruthy();
    expect(screen.getByTestId('run-سالم|Van-2|—')).toBeTruthy();
    window.print = vi.fn();
    fireEvent.click(screen.getByTestId('print-سالم|Van-2|—'));
    const sheet = screen.getByTestId('driver-sheet');
    expect(sheet.textContent).toContain('VB');
    expect(sheet.textContent).not.toContain('VA');
  });

  it('workload line reports count, COD and missing-data counts per run', () => {
    const a = stop({ driverName: 'سالم', carNumber: 'Van-1', sequence: 1, codAmountSar: 30 });
    renderBoard([a]);
    expect(screen.getByTestId('workload-سالم').textContent).toContain('workload.count: 1');
    expect(screen.getByTestId('workload-سالم').textContent).toContain('workload.cod: 30');
    expect(screen.getByTestId('workload-سالم').textContent).toContain('workload.missingPhone: 1'); // optional, counted not required
  });

  it('print targets the chosen run and the sheet carries the mandatory disclaimer', async () => {
    const a = stop({ driverName: 'سالم', carNumber: 'Van-1', sequence: 1 });
    const printSpy = vi.fn();
    window.print = printSpy;
    renderBoard([a]);
    fireEvent.click(screen.getByTestId('print-سالم|Van-1|—'));
    const sheet = screen.getByTestId('driver-sheet');
    expect(sheet.textContent).toContain('مستند تشغيلي داخلي');
    expect(sheet.textContent).toContain('not an official transport document');
    expect(sheet.textContent).toContain('R-'); // the stop row rendered
    // print fires on the next animation frame
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(printSpy).toHaveBeenCalled();
  });
});
