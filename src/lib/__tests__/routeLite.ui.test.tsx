// @vitest-environment jsdom
// Route-lite Phase 1 UI (Release R7): suggest preview → accept → undo, discard.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

const NOW = '2026-08-26T06:00:00.000Z';
const DATE = '2026-08-26';
let tick = 0;
function stop(over: Partial<StopRecord> = {}): StopRecord {
  tick += 1;
  return createStopRecord({
    operationDate: DATE, customerName: 'C', stopLabel: `L${tick}`, driverName: 'سالم', ...over,
  }, new Date(Date.parse(NOW) + tick * 1000).toISOString());
}

const drivers: DriverRecord[] = [
  { id: 'd1', fullName: 'سالم', phone: '', nationalId: '', assignedVehicle: 'Van-1', status: 'active' },
];

const RUN = 'سالم|—|—';

function renderBoard(stops: StopRecord[]) {
  const setStops = vi.fn();
  render(<DispatchBoardView stops={stops} setStops={setStops} drivers={drivers} />);
  fireEvent.change(document.querySelector('[name="dispatch-date"]') as HTMLInputElement, { target: { value: DATE } });
  return { setStops };
}

function writtenStops(): StopRecord[] {
  return ((commitBundleSpy.mock.calls[commitBundleSpy.mock.calls.length - 1] as unknown[])[0] as { stops: StopRecord[] }).stops;
}

function seqOf(stops: StopRecord[], ref: string): number | undefined {
  return stops.find(s => s.reference === ref)?.sequence;
}

beforeEach(() => { commitBundleSpy.mockClear(); tick = 0; });
afterEach(() => cleanup());

describe('route-lite suggestion (R7 Phase 1)', () => {
  it('previews a window-grouped suggestion, accepts it, then undoes it', () => {
    const a = stop({ reference: 'R-A', serviceWindow: 'morning', sequence: 1 });
    const b = stop({ reference: 'R-B', serviceWindow: 'evening', sequence: 2 });
    const c = stop({ reference: 'R-C', serviceWindow: 'morning', sequence: 3 });
    renderBoard([a, b, c]);

    fireEvent.click(screen.getByTestId(`suggest-${RUN}`));
    const preview = screen.getByTestId(`suggest-preview-${RUN}`);
    const suggested = within(preview).getByText('businessModel.dispatch.routelite.suggestedList')
      .parentElement as HTMLElement;
    const items = within(suggested).getAllByRole('listitem').map(li => li.textContent);
    expect(items[0]).toContain('R-A');
    expect(items[1]).toContain('R-C');
    expect(items[2]).toContain('R-B');

    fireEvent.click(screen.getByTestId(`accept-${RUN}`));
    expect(commitBundleSpy).toHaveBeenCalledTimes(1);
    const written = writtenStops();
    expect(seqOf(written, 'R-A')).toBe(1);
    expect(seqOf(written, 'R-C')).toBe(2);
    expect(seqOf(written, 'R-B')).toBe(3);

    // Manual order is recoverable via undo.
    fireEvent.click(screen.getByTestId(`undo-${RUN}`));
    expect(commitBundleSpy).toHaveBeenCalledTimes(2);
    const restored = writtenStops();
    expect(seqOf(restored, 'R-A')).toBe(1);
    expect(seqOf(restored, 'R-B')).toBe(2);
    expect(seqOf(restored, 'R-C')).toBe(3);
  });

  it('discard closes the preview without writing anything', () => {
    const a = stop({ reference: 'R-A', sequence: 1 });
    const b = stop({ reference: 'R-B', sequence: 2 });
    renderBoard([a, b]);
    fireEvent.click(screen.getByTestId(`suggest-${RUN}`));
    expect(screen.queryByTestId(`suggest-preview-${RUN}`)).not.toBeNull();
    fireEvent.click(screen.getByTestId(`discard-${RUN}`));
    expect(screen.queryByTestId(`suggest-preview-${RUN}`)).toBeNull();
    expect(commitBundleSpy).not.toHaveBeenCalled();
  });
});
