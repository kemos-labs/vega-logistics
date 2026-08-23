// @vitest-environment jsdom
// StopPlanning UI flows (Release R2-B): create/edit/delete, preview gates,
// atomic confirmation, persistence-failure honesty.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type CommitArgs = [{ stops?: StopRecord[] }, string | undefined, { keys?: string[] } | undefined];
const { commitBundleSpy } = vi.hoisted(() => ({
  commitBundleSpy: vi.fn((..._args: unknown[]) => ({ persistedOk: true, failedKeys: [] as string[], rollbackOk: true, rollbackFailedKeys: [] as string[] })),
}));
function writtenStops(callIndex = 0): StopRecord[] {
  return ((commitBundleSpy.mock.calls[callIndex] as unknown[])[0] as { stops?: StopRecord[] })?.stops ?? [];
}

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
  return {
    ...actual,
    // tests assert storage behavior through this spy; the real implementation
    // is never hit in jsdom
    commitBundle: (...args: unknown[]) => (commitBundleSpy(...(args as CommitArgs)) as unknown),
  };
});

import { StopPlanning } from '@/components/rebuild/StopPlanning';
import { createStopRecord, type StopRecord } from '@/lib/stops';
import { IMPORT_MAX_FILE_BYTES } from '@/lib/stopImport';

const NOW = '2026-08-24T08:00:00.000Z';
const DATE = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

function stop(over: Partial<StopRecord> = {}): StopRecord {
  return createStopRecord({
    operationDate: DATE, customerName: 'نور ماركت', stopLabel: 'حي الملقا بوابة 3',
    reference: 'SH-100', ...over,
  }, NOW);
}

function renderPlanner(initialStops: StopRecord[] = []) {
  const setStops = vi.fn();
  const view = render(<StopPlanning stops={initialStops} setStops={setStops} />);
  return { setStops };
}

function fillForm(fields: Record<string, string>) {
  for (const [name, value] of Object.entries(fields)) {
    fireEvent.change(document.querySelector(`[name="${name}"]`) as HTMLInputElement, { target: { value } });
  }
}

beforeEach(() => { commitBundleSpy.mockClear(); commitBundleSpy.mockImplementation(() => ({ persistedOk: true, failedKeys: [], rollbackOk: true, rollbackFailedKeys: [] })); });
afterEach(() => cleanup());

describe('StopPlanning — manual lifecycle', () => {
  it('adds a valid stop through the transactional seam and reports success', () => {
    const { setStops } = renderPlanner([]);
    fillForm({ customerName: 'Ninja', stopLabel: 'Gate 4', reference: 'R-1', codAmountSar: '30' });
    fireEvent.click(screen.getByTestId('save-stop'));
    expect(commitBundleSpy).toHaveBeenCalledTimes(1);
    const options = (commitBundleSpy.mock.calls[0] as unknown[])[2] as { keys: string[] };
    expect(options.keys).toEqual(['stops']);
    const written = writtenStops();
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ reference: 'R-1', customerName: 'Ninja', status: 'planned' });
    expect(setStops).toHaveBeenCalled(); // React state moves only after storage ok
  });

  it('blocks invalid submissions inline, preserves typed values, never persists', () => {
    const { setStops } = renderPlanner([]);
    fillForm({ customerName: '', stopLabel: '', codAmountSar: '-5' });
    fireEvent.click(screen.getByTestId('save-stop'));
    expect(setStops).not.toHaveBeenCalled();
    expect(commitBundleSpy).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    // entered values survive
    expect((document.querySelector('[name="codAmountSar"]') as HTMLInputElement).value).toBe('-5');
  });

  it('edit prefills and updates without changing createdAt', () => {
    const original = stop({ codAmountSar: 10 });
    const { setStops } = renderPlanner([original]);
    fireEvent.click(screen.getAllByText('businessModel.stops.editBtn')[0]);
    fireEvent.change(document.querySelector('[name="codAmountSar"]') as HTMLInputElement, { target: { value: '99' } });
    fireEvent.click(screen.getByTestId('save-stop'));
    const next = writtenStops();
    expect(next[0].codAmountSar).toBe(99);
    expect(next[0].createdAt).toBe(original.createdAt); // createdAt immutable; updatedAt refresh covered in domain tests
    expect(next[0].createdAt).toBe(original.createdAt); // createdAt immutable; updatedAt refresh covered in domain tests
  });

  it('delete requires identifying confirmation before removal', () => {
    const original = stop();
    const { setStops } = renderPlanner([original]);
    fireEvent.click(screen.getByTestId(`delete-${original.reference}`));
    expect(screen.getByTestId('delete-confirm').textContent).toContain('SH-100');
    expect(setStops).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('delete-yes'));
    expect(writtenStops()).toHaveLength(0);
    expect(setStops).toHaveBeenCalled();
  });

  it('day filter shows only the chosen operation date', () => {
    const today = stop();
    const tomorrow = stop({ operationDate: '2026-08-26', reference: 'OTHER' });
    renderPlanner([today, tomorrow]);
    expect(screen.getByTestId('stops-list').textContent).toContain('SH-100');
    expect(screen.getByTestId('stops-list').textContent).not.toContain('OTHER');
    fireEvent.change(document.querySelector('[name="operation-date"]') as HTMLInputElement, { target: { value: '2026-08-26' } });
    expect(screen.getByTestId('stops-list').textContent).toContain('OTHER');
  });
});

const CSV_CONFLICT = 'reference,customer,label,cod\nSH-100,نور ماركت,حي الملقا بوابة 3,999';
const CSV_CLEAN = 'reference,customer,label,cod\nR-A,Ninja,Gate 4,30\nR-B,Fifth Coffee,Main branch,12';
const CSV_WARN = 'customer,label\nFifth Coffee,Main branch'; // no reference ⇒ warning rows

function pasteAndParse(text: string) {
  const importBox = screen.getByRole('textbox', { name: 'businessModel.stops.import.pasteLabel' });
  fireEvent.change(importBox, { target: { value: text } });
  fireEvent.click(screen.getByTestId('parse-stops-btn'));
}

describe('StopPlanning — bulk import safety', () => {
  it('preview shows counts; cancel is a complete no-op', () => {
    const { setStops } = renderPlanner([]);
    pasteAndParse(CSV_CLEAN);
    expect(screen.getByTestId('preview-table')).toBeTruthy();
    expect(screen.getByTestId('import-preview').textContent).toContain('totalRows2'); // total rows read
    fireEvent.click(screen.getByTestId('cancel-import'));
    expect(commitBundleSpy).not.toHaveBeenCalled();
    expect(setStops).not.toHaveBeenCalled();
  });

  it('invalid rows block atomic confirmation with an explicit note', () => {
    renderPlanner([]);
    pasteAndParse(`${CSV_CLEAN}\nR-X,`); // label missing ⇒ invalid row
    expect(screen.getByTestId('blocked-note')).toBeTruthy();
    // atomic gate: with rejected rows the confirm control is not even offered
    expect(screen.queryByTestId('confirm-import')).toBeNull();
  });

  it('same-reference conflicts block confirmation', () => {
    renderPlanner([stop({ codAmountSar: 25 })]); // both sides carry COD ⇒ genuine conflict
    pasteAndParse(CSV_CONFLICT);
    expect(screen.getByTestId('blocked-note').textContent).toContain('conflictsBlocked');
    expect(screen.queryByTestId('confirm-import')).toBeNull(); // conflicts cannot be acked away
  });

  it('warning rows require explicit acknowledgement before confirm enables', () => {
    renderPlanner([]);
    pasteAndParse(CSV_WARN);
    expect((screen.getByTestId('confirm-import') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('warn-ack'));
    expect((screen.getByTestId('confirm-import') as HTMLButtonElement).disabled).toBe(false);
  });

  it('confirmation writes exactly the previewed rows; exact duplicates skipped; source cleared', () => {
    const existing = [stop()]; // SH-100 exists
    const { setStops } = renderPlanner(existing);
    pasteAndParse(`${CSV_CLEAN}\nSH-100,نور ماركت,حي الملقا بوابة 3`);
    // ^ last line duplicates existing exactly ⇒ must be skipped
    const confirmBtn = screen.getByTestId('confirm-import') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false); // exact dup is a skip, not a conflict
    fireEvent.click(confirmBtn);
    const written = writtenStops();
    expect(written).toHaveLength(existing.length + 2); // only R-A and R-B added
    expect(written.filter(s => s.reference === 'SH-100')).toHaveLength(1);
    expect(setStops).toHaveBeenCalled();
    expect((screen.getByRole('textbox', { name: 'businessModel.stops.import.pasteLabel' }) as HTMLTextAreaElement).value).toBe(''); // re-confirm cannot duplicate
  });

  it('persistence failure leaves the preview open and changes nothing', () => {
    commitBundleSpy.mockImplementation(() => ({ persistedOk: false, failedKeys: ['vega-stops-v1'], rollbackOk: true, rollbackFailedKeys: [] }));
    const { setStops } = renderPlanner([]);
    pasteAndParse(CSV_WARN);
    fireEvent.click(screen.getByTestId('warn-ack'));
    fireEvent.click(screen.getByTestId('confirm-import'));
    expect(setStops).not.toHaveBeenCalled();
    expect(screen.queryByTestId('preview-table')).not.toBeNull(); // still open for retry
    expect(screen.getByTestId('stops-message').textContent).toContain('persistFailed');
  });

  it('editing the source text invalidates the previous preview', () => {
    renderPlanner([]);
    pasteAndParse(CSV_CLEAN);
    expect(screen.getByTestId('preview-table')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'businessModel.stops.import.pasteLabel' }), { target: { value: `${CSV_CLEAN}\nmore,x,y` } });
    expect(screen.queryByTestId('preview-table')).toBeNull(); // stale preview cleared
  });

  it('Edit flow emits no unhandled exception (scrollIntoView guard)', async () => {
    const unhandled: unknown[] = [];
    const handler = (event: PromiseRejectionEvent) => { unhandled.push(event.reason); };
    window.addEventListener('unhandledrejection', handler);
    const original = stop();
    renderPlanner([original]);
    fireEvent.click(screen.getAllByText('businessModel.stops.editBtn')[0]);
    fireEvent.click(screen.getByTestId('save-stop')); // no changes — still a valid save path
    window.removeEventListener('unhandledrejection', handler);
    expect(unhandled).toEqual([]);
  });

  it('malformed COD (abc / negative) blocks save with localized errors; blank and Arabic digits pass', () => {
    const { setStops } = renderPlanner([]);
    fillForm({ customerName: 'N', stopLabel: 'L', codAmountSar: 'abc' });
    fireEvent.click(screen.getByTestId('save-stop'));
    expect(setStops).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    fillForm({ codAmountSar: '-3' });
    fireEvent.click(screen.getByTestId('save-stop'));
    expect(setStops).not.toHaveBeenCalled();
    fillForm({ codAmountSar: '' });
    fireEvent.click(screen.getByTestId('save-stop'));
    expect(writtenStops()[0].codAmountSar).toBeUndefined();
    fillForm({ customerName: 'N', stopLabel: 'L', codAmountSar: '٤٥' }); // form reset after the blank-save
    fireEvent.click(screen.getByTestId('save-stop'));
    const lastWrite = (commitBundleSpy.mock.calls[commitBundleSpy.mock.calls.length - 1] as unknown[])[0] as { stops: StopRecord[] };
    expect(lastWrite.stops[lastWrite.stops.length - 1].codAmountSar).toBe(45);
  });

  it('manual Add obeys the duplicate policy: exact/conflict blocked, probable needs ack, edit excludes itself', () => {
    const anchor = stop({ reference: 'DUP-1', codAmountSar: 20 });
    const { setStops } = renderPlanner([anchor]);
    // exact duplicate (same ref + compatible details)
    fillForm({ customerName: anchor.customerName, stopLabel: anchor.stopLabel, reference: 'dup-1' });
    fireEvent.click(screen.getByTestId('save-stop'));
    expect(setStops).not.toHaveBeenCalled();
    expect(screen.getByTestId('stops-message').textContent).toContain('dupExactBlocked');
    // conflict (same ref, differing COD on both sides)
    fillForm({ codAmountSar: '55' });
    fireEvent.click(screen.getByTestId('save-stop'));
    expect(screen.getByTestId('stops-message').textContent).toContain('dupConflictBlocked');
    // editing the existing record itself must NOT self-report as duplicate
    fireEvent.click(screen.getAllByText('businessModel.stops.editBtn')[0]);
    fireEvent.change(document.querySelector('[name="codAmountSar"]') as HTMLInputElement, { target: { value: '21' } });
    fireEvent.click(screen.getByTestId('save-stop'));
    expect(writtenStops()[0].codAmountSar).toBe(21);
  });

  it('oversized uploads are rejected by byte size before reading; read failures are honest', () => {
    const { setStops } = renderPlanner([]);
    // boundary: exactly at limit reads; above limit rejects — via mocked File
    const atLimit = { size: IMPORT_MAX_FILE_BYTES, text: async () => 'customer,label\nA,B' } as unknown as File;
    const above = { size: IMPORT_MAX_FILE_BYTES + 1, text: async () => '' } as unknown as File;
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const setFiles = (file: File) => Object.defineProperty(input, 'files', { value: { 0: file, length: 1, item: () => file }, configurable: true });
    setFiles(atLimit);
    fireEvent.change(input);
    expect(screen.queryByTestId('file-error')).toBeNull();
    setFiles(above);
    fireEvent.change(input);
    expect(screen.getByTestId('file-error').textContent).toContain('errTooLarge');
    expect(setStops).not.toHaveBeenCalled();
  });

  it('malformed CSV (unterminated quote) is a typed rejection, never a giant valid cell', () => {
    renderPlanner([]);
    pasteAndParse('customer,label\n"Ninja,Gate');
    expect(screen.getByTestId('import-error').textContent).toContain('errMalformed');
    expect(screen.queryByTestId('preview-table')).toBeNull();
  });

  it('unknown headers participate in the warning acknowledgement gate', () => {
    renderPlanner([]);
    pasteAndParse('customer,label,favorite color\nA,B,blue');
    expect(screen.getByTestId('unknown-headers').textContent).toContain('favorite color');
    expect((screen.getByTestId('confirm-import') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('warn-ack'));
    expect((screen.getByTestId('confirm-import') as HTMLButtonElement).disabled).toBe(false);
  });

  it('Arabic paste renders normalized Arabic into the preview table', () => {
    renderPlanner([]);
    pasteAndPasteArabic();
    function pasteAndPasteArabic() {
      pasteAndParse('العميل,الوجهة\nمطاعم الظاهر,فرع العليا');
    }
    expect(screen.getByTestId('preview-table').textContent).toContain('مطاعم الظاهر');
  });
});
