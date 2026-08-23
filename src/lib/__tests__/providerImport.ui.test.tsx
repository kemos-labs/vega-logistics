// @vitest-environment jsdom
// ProviderImportCard UI — review/confirm flow (contract H-8/H-9).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProviderImportCard } from '@/components/rebuild/BusinessModelApp';
import type { DailyRecord } from '@/lib/operationsReporting';
import { STORAGE_KEYS } from '@/lib/backup';

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

const BALANCED = 'يعقوب عبدالقادر سياره10 لوحه4684 تحميل25 توصيل18 راجع7';
const UNBALANCED = 'يعقوب عبدالقادر سياره10 لوحه4684 تحميل25 توصيل18 راجع2';
const JUNK = 'كيف الحال ان شاء الله بخير';

function baseRecord(overrides: Partial<DailyRecord> = {}): DailyRecord {
  return { date: '2026-08-22', completedShipments: 0, failedShipments: 0, fuelCost: 90, driversPresent: 1, notes: '', updatedAt: '', ...overrides };
}

function renderCard(records: Record<string, DailyRecord>, onApply = vi.fn()) {
  const view = render(<ProviderImportCard dailyRecords={records} onApply={onApply} />);
  return { onApply, ...view };
}

function pasteAndParse(text: string) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
  fireEvent.click(screen.getByTestId('parse-btn'));
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('ProviderImportCard', () => {
  it('junk input → explicit error, no preview grid, nothing applied', () => {
    const onApply = vi.fn();
    renderCard({}, onApply);
    pasteAndParse(JUNK);
    expect(screen.getByTestId('parse-error')).toBeTruthy();
    expect(screen.queryByTestId('preview-grid')).toBeNull();
    fireEvent.click(screen.getByTestId('import-confirm'));
    expect(onApply).not.toHaveBeenCalled();
  });

  it('unreconciled totals block confirmation and surface the exact difference', async () => {
    const onApply = vi.fn();
    renderCard({}, onApply);
    pasteAndParse(UNBALANCED);
    await screen.findByTestId('preview-grid');
    expect(screen.getByTestId('mismatch').textContent).toContain('~difference=5~');
    expect((screen.getByTestId('import-confirm') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('import-confirm'));
    expect(onApply).not.toHaveBeenCalled(); // blocked even on click
  });

  it('balanced fresh date confirms: completed=delivered, failed=returned, driver fields mapped', async () => {
    const onApply = vi.fn();
    renderCard({ '2026-08-21': baseRecord() }, onApply);
    pasteAndParse(BALANCED);
    await screen.findByTestId('preview-grid');
    const confirm = screen.getByTestId('import-confirm') as HTMLButtonElement;
    expect(confirm.disabled).toBe(false); // empty date ⇒ no overwrite gate
    fireEvent.click(confirm);
    const [date, record] = (onApply as ReturnType<typeof vi.fn>).mock.calls[0] as unknown as [string, DailyRecord];
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(record.completedShipments).toBe(18);
    expect(record.failedShipments).toBe(7);
    expect(record.driverName).toContain('يعقوب');
    expect(record.carNumber).toBe('10');
    expect(record.plateNumber).toBe('4684');
  });

  it('confirm PRESERVES unrelated existing DailyRecord fields (fuel cash, notes, POD…)', async () => {
    const existing = baseRecord({
      date: '2026-08-22',
      completedShipments: 5, failedShipments: 1,
      fuelCost: 130, notes: 'old notes kept', podStatus: 'complete',
      cashCollectedSar: 400, customerBreakdown: { 'Ninja': { delivered: 3, missed: 1 } },
    });
    const onApply = vi.fn();
    renderCard({ '2026-08-22': existing }, onApply);
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-08-22' } });
    pasteAndParse(BALANCED);
    await screen.findByTestId('preview-grid');
    // overwrite gate visible + confirm disabled until acknowledged
    expect(screen.getByTestId('overwrite-note')).toBeTruthy();
    expect((screen.getByTestId('import-confirm') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('overwrite-ack'));
    expect((screen.getByTestId('import-confirm') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId('import-confirm'));

    const [, record] = (onApply as ReturnType<typeof vi.fn>).mock.calls[0] as unknown as [string, DailyRecord];
    expect(record.completedShipments).toBe(18);   // reviewed values applied
    expect(record.failedShipments).toBe(7);
    expect(record.fuelCost).toBe(130);            // unrelated fields preserved
    expect(record.notes).toBe('old notes kept');
    expect(record.podStatus).toBe('complete');
    expect(record.cashCollectedSar).toBe(400);
    expect(record.customerBreakdown).toEqual(existing.customerBreakdown);
    expect(localStorage.getItem(STORAGE_KEYS.dailyRecords)).toBeNull(); // card itself never writes
  });

  it('editing source text after parse invalidates the stale preview (confirm becomes no-op)', async () => {
    const onApply = vi.fn();
    renderCard({}, onApply);
    pasteAndParse(BALANCED);
    await screen.findByTestId('preview-grid');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: BALANCED + ' تعديل' } });
    // preview is cleared outright — a stale preview must never be confirmable
    expect(screen.queryByTestId('preview-grid')).toBeNull();
    expect((screen.getByTestId('import-confirm') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('import-confirm'));
    expect(onApply).not.toHaveBeenCalled();
  });

  it('blank/invalid record date cannot be confirmed and shows an explicit error', async () => {
    const onApply = vi.fn();
    renderCard({}, onApply);
    pasteAndParse(BALANCED);
    await screen.findByTestId('preview-grid');
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '' } });
    expect(screen.getByTestId('date-error')).toBeTruthy();
    expect((screen.getByTestId('import-confirm') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('import-confirm'));
    expect(onApply).not.toHaveBeenCalled();
  });

  it('existing-date overwrite requires EXPLICIT acknowledgement before confirm enables', async () => {
    const onApply = vi.fn();
    renderCard({ '2026-08-22': baseRecord({ completedShipments: 5 }) }, onApply);
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-08-22' } });
    pasteAndParse(BALANCED);
    await screen.findByTestId('preview-grid');
    expect((screen.getByTestId('import-confirm') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('overwrite-ack'));
    fireEvent.click(screen.getByTestId('import-confirm'));
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});

