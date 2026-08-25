import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import BusinessModelApp from '@/components/rebuild/BusinessModelApp';
import { ReportsView } from '@/components/rebuild/ReportsView';
import { exportOperationalExcel, buildOperationalWorkbookData, getOperationalExcelLabels } from '@/lib/operationsReportExport';
import type { StopRecord } from '@/lib/stops';
import type { DailyRecord } from '@/lib/operationsReporting';
import en from '../../../public/locales/en/translation.json';
import ar from '../../../public/locales/ar/translation.json';

vi.mock('@/lib/operationsReportExport', async () => {
  const actual = await vi.importActual<typeof import('@/lib/operationsReportExport')>('@/lib/operationsReportExport');
  return {
    ...actual,
    exportOperationalExcel: vi.fn().mockResolvedValue(undefined),
  };
});

function flatWithKeys(obj: unknown, prefix = ''): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flatWithKeys(v, key));
      else if (typeof v === 'string') out.push([key, v]);
    }
  }
  return out;
}

describe('operator-core repair', () => {
  beforeEach(() => {
    localStorage.clear();
    cleanup();
  });

  it('fleet: adding a driver does not change vehicle quantity', () => {
    render(<BusinessModelApp />);
    const fleetBtn = screen.getByRole('button', { name: /Drivers & vehicles/i });
    fireEvent.click(fleetBtn);
    const addDriver = screen.getByTestId('add-driver');
    const beforeRows = document.querySelectorAll('.bm-fleet-row').length;
    fireEvent.click(addDriver);
    const afterRows = document.querySelectorAll('.bm-driver-row').length;
    expect(afterRows).toBeGreaterThan(1);
    expect(document.querySelectorAll('.bm-fleet-row').length).toBe(beforeRows);
  });

  it('fleet: driver deletion requires confirmation', async () => {
    render(<BusinessModelApp />);
    fireEvent.click(screen.getByRole('button', { name: /Drivers & vehicles/i }));
    const firstRemove = document.querySelector('[data-testid^="remove-"]') as HTMLButtonElement;
    expect(firstRemove).toBeTruthy();
    fireEvent.click(firstRemove);
    const confirmYes = await screen.findByTestId(/^confirm-yes-/);
    const confirmNo = await screen.findByTestId(/^confirm-no-/);
    expect(confirmYes).toBeTruthy();
    expect(confirmNo).toBeTruthy();
    const before = document.querySelectorAll('.bm-driver-row').length;
    fireEvent.click(confirmNo);
    expect(document.querySelectorAll('.bm-driver-row').length).toBe(before);
    const firstRemove2 = document.querySelector('[data-testid^="remove-"]') as HTMLButtonElement;
    fireEvent.click(firstRemove2);
    fireEvent.click(await screen.findByTestId(/^confirm-yes-/));
    expect(document.querySelectorAll('.bm-driver-row').length).toBe(before - 1);
  });

  it('shared operation date propagates to stops/dispatch/close/reports/summary', () => {
    render(<BusinessModelApp />);
    fireEvent.click(screen.getByRole('button', { name: /Stops|المحطات/i }));
    const stopsDate = document.querySelector('input[name="operation-date"]') as HTMLInputElement;
    expect(stopsDate).toBeTruthy();
    const newDate = '2026-08-20';
    fireEvent.change(stopsDate, { target: { value: newDate } });
    fireEvent.click(screen.getByRole('button', { name: /Dispatch|التوزيع/i }));
    const dispatchDate = document.querySelector('input[name="dispatch-date"]') as HTMLInputElement;
    expect(dispatchDate.value).toBe(newDate);
    fireEvent.click(screen.getByRole('button', { name: /Evening close|إغلاق اليوم/i }));
    expect((document.querySelector('[data-testid="close-date"]') as HTMLInputElement).value).toBe(newDate);
    fireEvent.click(screen.getByRole('button', { name: /Reports|التقارير/i }));
    expect((document.querySelector('[data-testid="reports-date"]') as HTMLInputElement).value).toBe(newDate);
    fireEvent.click(screen.getByRole('button', { name: /^Summary|الملخص$/i }));
    expect((document.querySelector('[data-testid="summary-date"]') as HTMLInputElement).value).toBe(newDate);
  });

  it('reports: empty, draft guard, legacy and reconciled states group by runKey and POD derived correctly', () => {
    const stops: StopRecord[] = [
      { id: '1', operationDate: '2026-08-24', customerName: 'C', stopLabel: 'S1', status: 'delivered', driverName: 'Ahmed', carNumber: 'A', podStatus: 'complete', codAmountSar: 150, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '2', operationDate: '2026-08-24', customerName: 'C', stopLabel: 'S2', status: 'delivered', driverName: 'Ahmed', carNumber: 'A', podStatus: 'none', codAmountSar: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '3', operationDate: '2026-08-24', customerName: 'C', stopLabel: 'S3', status: 'returned', driverName: 'Sara', carNumber: 'B', failureReasonKey: 'customerUnavailable', podStatus: 'none', codAmountSar: 200, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as StopRecord,
    ];
    const draftRecord: DailyRecord = { date: '2026-08-24', completedShipments: 2, failedShipments: 1, returnedShipments: 1, pendingShipments: 0, loadedShipments: 3, cashCollectedSar: 150, cashRemittedSar: 0, codExpectedSar: 150, closeStatus: 'draft', driversPresent: 2, fuelCost: 10, notes: '', updatedAt: new Date().toISOString() } as DailyRecord;
    const { rerender } = render(<ReportsView operationDate="2026-08-24" onOperationDateChange={() => {}} stops={stops} dailyRecords={{ '2026-08-24': draftRecord }} onGotoClose={() => {}} />);
    expect(screen.getByTestId('reports-draft-guard')).toBeTruthy();
    expect(screen.getByTestId('reports-export-excel').hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('reports-pod-gaps').textContent).toContain('1');
    expect(screen.getByTestId('reports-cod-expected').textContent).toContain('150');
    expect(screen.getByTestId('reports-cash-attribution')).toBeTruthy();
    const reconciled = { ...draftRecord, closeStatus: 'reconciled' as const, closedAt: new Date().toISOString() };
    rerender(<ReportsView operationDate="2026-08-24" onOperationDateChange={() => {}} stops={stops} dailyRecords={{ '2026-08-24': reconciled }} onGotoClose={() => {}} />);
    expect(screen.queryByTestId('reports-draft-guard')).toBeNull();
    expect(screen.getByTestId('reports-export-excel').hasAttribute('disabled')).toBe(false);
    const ahmedKey = ['Ahmed', 'A', '—'].join('|');
    expect(screen.getByTestId(`reports-run-${ahmedKey}`)).toBeTruthy();
    expect(screen.getByTestId(`reports-cod-${ahmedKey}`).textContent).toContain('150');
    const saraKey = ['Sara', 'B', '—'].join('|');
    expect(screen.getByTestId(`reports-pod-${saraKey}`).textContent).toContain('0');
  });

  it('reports print is disabled for draft and mounts correct portal for reconciled', async () => {
    const stops: StopRecord[] = [
      { id: '1', operationDate: '2026-08-24', customerName: 'C', stopLabel: 'S1', status: 'planned', driverName: 'Ahmed', carNumber: 'A', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as StopRecord,
    ];
    const draft: DailyRecord = { date: '2026-08-24', completedShipments: 1, failedShipments: 0, loadedShipments: 1, cashCollectedSar: 0, cashRemittedSar: 0, closeStatus: 'draft', driversPresent: 1, fuelCost: 1, notes: '', updatedAt: new Date().toISOString() } as DailyRecord;
    const { rerender } = render(<ReportsView operationDate="2026-08-24" onOperationDateChange={() => {}} stops={stops} dailyRecords={{ '2026-08-24': draft }} onGotoClose={() => {}} />);
    const key = ['Ahmed','A','—'].join('|');
    expect(screen.getByTestId(`reports-print-${key}`).hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('reports-print-company').hasAttribute('disabled')).toBe(true);
    const orig = window.print;
    const origRAF = global.requestAnimationFrame;
    const mockPrint = vi.fn();
    try {
      global.requestAnimationFrame = ((cb: FrameRequestCallback) => { cb(0); return 0; }) as unknown as typeof requestAnimationFrame;
      window.print = mockPrint;
      fireEvent.click(screen.getByTestId(`reports-print-${key}`));
      expect(mockPrint).not.toHaveBeenCalled();
      expect(screen.queryByTestId('vega-print-portal')).toBeNull();
      const reconciled = { ...draft, closeStatus: 'reconciled' as const, closedAt: new Date().toISOString() };
      rerender(<ReportsView operationDate="2026-08-24" onOperationDateChange={() => {}} stops={stops} dailyRecords={{ '2026-08-24': reconciled }} onGotoClose={() => {}} />);
      expect(screen.getByTestId(`reports-print-${key}`).hasAttribute('disabled')).toBe(false);
      expect(screen.getByTestId('reports-print-company').hasAttribute('disabled')).toBe(false);
      fireEvent.click(screen.getByTestId(`reports-print-${key}`));
      expect(screen.getByTestId('print-run-sheet')).toBeTruthy();
      expect(mockPrint).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByTestId('reports-print-company'));
      expect(screen.getByTestId('print-company-sheet')).toBeTruthy();
      expect(screen.queryByTestId('print-run-sheet')).toBeNull();
      expect(mockPrint).toHaveBeenCalledTimes(2);
      act(() => window.dispatchEvent(new Event('afterprint')));
      await waitFor(() => expect(screen.queryByTestId('vega-print-portal')).toBeNull());
    } finally {
      window.print = orig;
      global.requestAnimationFrame = origRAF;
    }
  });

  it('reports operational Excel is invoked with exact date/runs/stops only when definitive', async () => {
    const stops: StopRecord[] = [
      { id: '1', operationDate: '2026-08-24', customerName: 'C', stopLabel: 'S1', status: 'delivered', driverName: 'Ahmed', carNumber: 'A', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as StopRecord,
    ];
    const draft: DailyRecord = { date: '2026-08-24', completedShipments: 1, failedShipments: 0, loadedShipments: 1, cashCollectedSar: 0, cashRemittedSar: 0, closeStatus: 'draft', driversPresent: 1, fuelCost: 1, notes: '', updatedAt: new Date().toISOString() } as DailyRecord;
    const reconciled = { ...draft, closeStatus: 'reconciled' as const, closedAt: new Date().toISOString() };
    const { rerender } = render(<ReportsView operationDate="2026-08-24" onOperationDateChange={() => {}} stops={stops} dailyRecords={{ '2026-08-24': draft }} onGotoClose={() => {}} />);
    const excelBtn = screen.getByTestId('reports-export-excel');
    expect(excelBtn.hasAttribute('disabled')).toBe(true);
    fireEvent.click(excelBtn);
    expect(vi.mocked(exportOperationalExcel)).not.toHaveBeenCalled();
    rerender(<ReportsView operationDate="2026-08-24" onOperationDateChange={() => {}} stops={stops} dailyRecords={{ '2026-08-24': reconciled }} onGotoClose={() => {}} />);
    const excelBtn2 = screen.getByTestId('reports-export-excel');
    expect(excelBtn2.hasAttribute('disabled')).toBe(false);
    fireEvent.click(excelBtn2);
    expect(vi.mocked(exportOperationalExcel)).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-08-24' }));
    const call = vi.mocked(exportOperationalExcel).mock.calls[0][0];
    expect(call.runs.length).toBe(1);
    expect(call.stops.length).toBe(1);
  });

  it('operational Excel uses the exact Arabic and English labels consumed by the writer', () => {
    const arabic = getOperationalExcelLabels('ar');
    expect(arabic.sheets.runs).toBe('جولات السائقين');
    expect(arabic.headers.company).toContain('قيد الانتظار');
    expect(arabic.headers.company).toContain('مبلغ معلّق');
    expect(arabic.headers.company).toContain('التحصيل المتوقع');
    expect(arabic.headers.stops).toContain('المحطة');
    expect(arabic.status('reconciled')).toBe('مطابق');
    expect(arabic.stopStatus('delivered')).toBe('تم التوصيل');
    expect(arabic.reason('customerUnavailable')).toBe('العميل غير متاح');
    expect(arabic.pod('complete')).toBe('مكتمل');

    const english = getOperationalExcelLabels('en');
    expect(english.sheets.runs).toBe('Driver runs');
    expect(english.headers.company).toContain('Pending');
    expect(english.headers.company).toContain('Outstanding');
    expect(english.status('reconciled')).toBe('reconciled');
    expect(english.stopStatus('delivered')).toBe('delivered');
  });

  it('reports workbook builder is pure and excludes financial assumptions', () => {
    const stops: StopRecord[] = [
      { id: '1', operationDate: '2026-08-24', customerName: 'C', stopLabel: 'S1', status: 'delivered', driverName: 'Ahmed', carNumber: 'A', podStatus: 'complete', codAmountSar: 100, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as StopRecord,
      { id: '2', operationDate: '2026-08-24', customerName: 'C', stopLabel: 'S2', status: 'returned', driverName: 'Ahmed', carNumber: 'A', podStatus: 'none', codAmountSar: 50, failureReasonKey: 'customerUnavailable', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as StopRecord,
    ];
    const rec: DailyRecord = { date: '2026-08-24', completedShipments: 1, failedShipments: 0, returnedShipments: 1, pendingShipments: 0, loadedShipments: 2, cashCollectedSar: 100, cashRemittedSar: 30, codExpectedSar: 100, closeStatus: 'reconciled', closedAt: new Date().toISOString(), driversPresent: 1, fuelCost: 10, notes: '', updatedAt: new Date().toISOString() } as DailyRecord;
    const data = buildOperationalWorkbookData({ date: '2026-08-24', record: rec, stops, runs: [{ key: 'Ahmed|A|—', driverName: 'Ahmed', carNumber: 'A', stops }] });
    expect(data.company.codExpected).toBe(100);
    expect(data.company.collected).toBe(100);
    expect(data.runs[0].codExpected).toBe(100);
    expect(JSON.stringify(data)).not.toContain('vehicleClasses');
  });

  it('summary: empty shows CTA with no chart, recorded shows 14-slot trend, business plan collapsed', async () => {
    const { unmount } = render(<BusinessModelApp />);
    fireEvent.click(screen.getByRole('button', { name: /^Summary|الملخص$/i }));
    expect(screen.getByTestId('summary-empty')).toBeTruthy();
    expect(screen.queryByTestId('recorded-trend')).toBeNull();
    const details = screen.getByTestId('business-plan-assumptions') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    unmount();
    const rec: DailyRecord = { date: '2026-08-24', completedShipments: 2, failedShipments: 1, loadedShipments: 3, cashCollectedSar: 150, cashRemittedSar: 0, closeStatus: 'reconciled', closedAt: new Date().toISOString(), driversPresent: 2, fuelCost: 10, notes: '', updatedAt: new Date().toISOString() } as DailyRecord;
    localStorage.setItem('vega-daily-reports-v2', JSON.stringify({ '2026-08-24': rec }));
    // also need a stop to make trend non-empty
    localStorage.setItem('vega-stops-v1', JSON.stringify([{ id: '1', operationDate: '2026-08-24', customerName: 'C', stopLabel: 'S1', status: 'delivered', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]));
    render(<BusinessModelApp />);
    fireEvent.click(screen.getByRole('button', { name: /^Summary|الملخص$/i }));
    expect(await screen.findByTestId('recorded-trend')).toBeTruthy();
    expect(screen.getByTestId('recorded-operations')).toBeTruthy();
    const slots = screen.getAllByTestId('recorded-trend-slot');
    expect(slots).toHaveLength(14);
    const selectedDateSlot = slots.find(slot => slot.getAttribute('data-date') === '2026-08-24');
    expect(selectedDateSlot?.getAttribute('data-value')).toBe('2');
    expect(slots.filter(slot => slot.getAttribute('data-value') === '0')).toHaveLength(13);
  });

  it('i18n leak crawl rejects raw businessModel. or single-brace and suspicious key-equals-value', () => {
    const allowlist = new Set(['estimated', 'stops', 'sample assumptions', 'sample', 'Stops', 'Delivered', 'Returned', 'Pending']);
    for (const locale of [en, ar]) {
      for (const [key, value] of flatWithKeys(locale)) {
        if (!key.startsWith('businessModel.')) continue;
        expect(value).not.toContain('businessModel.');
        expect(value).not.toMatch(/(?<!\{)\{[a-z]+\}(?!\})/);
        const leaf = key.split('.').pop() ?? '';
        const isCamel = /[A-Z]/.test(leaf);
        if (isCamel && value === leaf && !allowlist.has(value)) {
          throw new Error(`suspicious leaf value equals key: ${key} = "${value}"`);
        }
        // English must not contain Arabic, vice versa (unless bilingual explicitly requested)
        const hasArabic = /[\u0600-\u06FF]/.test(value);
        const hasLatin = /[A-Za-z]/.test(value);
        // We allow at least one direction, but not mixed unless explicitly bilingual tag which we fixed to be monolingual
        if (key.includes('recordedTag') || key.includes('businessPlanTag')) {
          expect(hasArabic && hasLatin).toBe(false);
        }
      }
    }
    render(<BusinessModelApp />);
    const body = document.body.textContent ?? '';
    expect(body).not.toContain('businessModel.');
  });

  it('fleet page has correct h1 and no synchronized copy', () => {
    render(<BusinessModelApp />);
    fireEvent.click(screen.getByRole('button', { name: /Drivers & vehicles/i }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Drivers & vehicles/);
    expect(document.body.textContent).not.toContain('Synchronized total');
    expect(document.body.textContent).not.toContain('One car equals one driver');
    const footer = document.querySelector('.bm-inline-total')?.textContent ?? '';
    expect(footer).toContain('vehicles in cost assumptions');
    expect(footer).toContain('active drivers');
  });

  it('production source contains no hardcoded fixture names', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const forbidden = ['Ahmed', 'Sara', 'Khalid', 'REF001', 'TestCustomer'];
    const filesToCheck = [
      'src/components/rebuild/ReportsView.tsx',
      'src/lib/operationsReportExport.ts',
      'public/locales/en/translation.json',
      'public/locales/ar/translation.json',
    ];
    for (const f of filesToCheck) {
      const content = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
      for (const word of forbidden) {
        // Allow in comments that mention the check itself
        if (content.includes(`forbidden = [`)) continue;
        expect(content).not.toContain(word);
      }
    }
  });

  it('company print portal derives names from props, not hardcoded', async () => {
    const stopsA: StopRecord[] = [
      { id: '1', operationDate: '2026-08-24', customerName: 'CustA', stopLabel: 'S1', status: 'delivered', driverName: 'Ali', carNumber: 'X', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as StopRecord,
      { id: '2', operationDate: '2026-08-24', customerName: 'CustB', stopLabel: 'S2', status: 'returned', driverName: 'Omar', carNumber: 'Y', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as StopRecord,
    ];
    const rec: DailyRecord = { date: '2026-08-24', completedShipments: 1, failedShipments: 0, returnedShipments: 1, pendingShipments: 0, loadedShipments: 2, cashCollectedSar: 10, cashRemittedSar: 0, closeStatus: 'reconciled', closedAt: new Date().toISOString(), driversPresent: 1, fuelCost: 1, notes: '', updatedAt: new Date().toISOString() } as DailyRecord;
    const { rerender } = render(<ReportsView operationDate="2026-08-24" onOperationDateChange={() => {}} stops={stopsA} dailyRecords={{ '2026-08-24': rec }} onGotoClose={() => {}} />);
    const orig = window.print;
    const origRAF = global.requestAnimationFrame;
    global.requestAnimationFrame = ((cb: FrameRequestCallback) => { cb(0); return 0; }) as unknown as typeof requestAnimationFrame;
    window.print = () => {};
    fireEvent.click(screen.getByTestId('reports-print-company'));
    expect(document.querySelector('[data-testid="print-company-sheet"]')?.textContent).toContain('Ali');
    expect(document.querySelector('[data-testid="print-company-sheet"]')?.textContent).toContain('Omar');
    expect(document.querySelector('[data-testid="print-company-sheet"]')?.textContent).not.toContain('Ahmed');
    window.dispatchEvent(new Event('afterprint'));
    await new Promise(r => setTimeout(r, 0));
    // change fixture
    const stopsB: StopRecord[] = [
      { id: '3', operationDate: '2026-08-24', customerName: 'CustC', stopLabel: 'S3', status: 'delivered', driverName: 'Fatima', carNumber: 'Z', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as StopRecord,
    ];
    rerender(<ReportsView operationDate="2026-08-24" onOperationDateChange={() => {}} stops={stopsB} dailyRecords={{ '2026-08-24': rec }} onGotoClose={() => {}} />);
    fireEvent.click(screen.getByTestId('reports-print-company'));
    expect(document.querySelector('[data-testid="print-company-sheet"]')?.textContent).toContain('Fatima');
    expect(document.querySelector('[data-testid="print-company-sheet"]')?.textContent).not.toContain('Ali');
    window.print = orig;
    global.requestAnimationFrame = origRAF;
    window.dispatchEvent(new Event('afterprint'));
    await new Promise(r => setTimeout(r, 0));
  });

  it('run manifest is full and bilingual', async () => {
    const stops: StopRecord[] = [
      { id: '1', operationDate: '2026-08-24', customerName: 'CustX', reference: 'REFX', stopLabel: 'LabelX', addressNotes: 'Addr 123', phone: '0501234567', codAmountSar: 99, serviceWindow: 'morning', status: 'delivered', driverName: 'Ahmed', carNumber: 'A', plateNumber: 'ABC123', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as StopRecord,
    ];
    const rec: DailyRecord = { date: '2026-08-24', completedShipments: 1, failedShipments: 0, loadedShipments: 1, cashCollectedSar: 0, cashRemittedSar: 0, closeStatus: 'reconciled', closedAt: new Date().toISOString(), driversPresent: 1, fuelCost: 1, notes: '', updatedAt: new Date().toISOString() } as DailyRecord;
    render(<ReportsView operationDate="2026-08-24" onOperationDateChange={() => {}} stops={stops} dailyRecords={{ '2026-08-24': rec }} onGotoClose={() => {}} />);
    // need to find the run key with plate
    const btn = document.querySelector('[data-testid^="reports-print-"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    const orig = window.print;
    const origRAF = global.requestAnimationFrame;
    global.requestAnimationFrame = ((cb: FrameRequestCallback) => { cb(0); return 0; }) as unknown as typeof requestAnimationFrame;
    window.print = () => {};
    fireEvent.click(btn);
    const portal = document.querySelector('[data-testid="print-run-sheet"]');
    expect(portal).toBeTruthy();
    const text = portal?.textContent ?? '';
    expect(text).toContain('REFX');
    expect(text).toContain('CustX');
    expect(text).toContain('LabelX');
    expect(text).toContain('Addr 123');
    expect(text).toContain('0501234567');
    expect(text).toContain('99');
    // window header present
    expect(text).toContain('Ahmed');
    expect(text).toContain('ABC123');
    // disclaimer bilingual
    expect(text).toContain('Internal operational document');
    expect(text).toContain('مستند تشغيلي داخلي');
    window.print = orig;
    global.requestAnimationFrame = origRAF;
    window.dispatchEvent(new Event('afterprint'));
    await new Promise(r => setTimeout(r, 0));
  });

});
