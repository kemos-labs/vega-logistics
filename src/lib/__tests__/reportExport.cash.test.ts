import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportBusinessModelExcel, exportDailyReportPdf, exportProReportPdf } from '@/lib/reportExport';
import { buildReportLabels } from '@/components/rebuild/ProReport';
import { buildReportModel } from '@/lib/reportEngine';
import { calculateFinancials } from '@/lib/calculations';
import { defaultFinancialInput } from '@/lib/mockData';
import type { DailyRecord } from '@/lib/operationsReporting';

const captured = vi.hoisted(() => ({ sheets: new Map<string, unknown[][]>(), pdfText: [] as string[], pdfPositions: [] as Array<{ text: string; x: number }> }));
vi.mock('exceljs', () => ({
  Workbook: class {
    xlsx = { writeBuffer: async () => new ArrayBuffer(1) };
    addWorksheet(name: string) {
      const rows: unknown[][] = [];
      captured.sheets.set(name, rows);
      return { columns: [], addRows: (values: unknown[][]) => rows.push(...values), addRow: (value: unknown[]) => rows.push(value), getRow: () => ({ font: {} }) };
    }
  },
}));
vi.mock('jspdf', () => ({
  jsPDF: class {
    setFont() {} setFontSize() {} setTextColor() {} setFillColor() {} rect() {} save() {}
    addPage() {} circle() {} line() {} roundedRect() {} setDrawColor() {} setLineWidth() {} setPage() {}
    getNumberOfPages() { return 3; }
    getTextWidth(value: string) { return value.length * 2; }
    text(value: string, x: number) { captured.pdfText.push(value); captured.pdfPositions.push({ text: value, x }); }
  },
}));
const input = defaultFinancialInput;
const output = calculateFinancials(input);
const record = (extra: Partial<DailyRecord> = {}): DailyRecord => ({ date: '2026-08-14', completedShipments: 2, failedShipments: 0, driversPresent: 1, fuelCost: 0, notes: '', updatedAt: '2026-08-14T20:00:00Z', ...extra });
beforeEach(() => {
  captured.sheets.clear(); captured.pdfText.length = 0; captured.pdfPositions.length = 0;
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

describe('report cash exports', () => {
  it('XLSX cash cells are explicit unknown with missing legacy fields', async () => {
    await exportBusinessModelExcel(record(), input, output);
    const rows = captured.sheets.get('Daily report')!;
    for (const label of ['Cash collected (SAR)', 'Cash remitted (SAR)', 'Outstanding cash (SAR)']) {
      expect(rows.find(row => row[0] === label)?.[1]).toBe('Unknown (missing cash evidence)');
    }
  });
  it('XLSX known zeros remain numeric and missing remittance stays unknown', async () => {
    await exportBusinessModelExcel(record({ cashCollectedSar: 0, cashRemittedSar: 0 }), input, output);
    expect(captured.sheets.get('Daily report')!.find(row => row[0] === 'Outstanding cash (SAR)')?.[1]).toBe(0);
    await exportBusinessModelExcel(record({ cashCollectedSar: 500 }), input, output, { locale: 'ar' });
    const rows = captured.sheets.get('Daily report')!;
    expect(rows.find(row => row[0] === 'Cash collected (SAR)')?.[1]).toBe(500);
    expect(rows.find(row => row[0] === 'Outstanding cash (SAR)')?.[1]).toBe('غير معروف (بيانات النقد غير مكتملة)');
  });
  it('pro PDF displays missing window evidence even when focus collection is known', async () => {
    const prior = record();
    const focus = record({ date: '2026-08-15', cashCollectedSar: 100, cashRemittedSar: 0 });
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: focus, records: { [prior.date]: prior, [focus.date]: focus }, input, output, focusDate: new Date('2026-08-15T12:00:00') });
    await exportProReportPdf(model, buildReportLabels(key => key));
    expect(captured.pdfText).toContain('Unknown (missing cash evidence)');
    expect(captured.pdfText).toContain('businessModel.report.cashOutstanding (businessModel.report.windowTotals)');
    expect(captured.pdfPositions.every(point => Number.isFinite(point.x) && point.x >= 18 && point.x <= 192)).toBe(true);
    const month = captured.pdfPositions.find(point => point.text === '2026-08');
    expect(month?.x).toBeCloseTo(18 + 174 / 8 / 2);
    expect(captured.pdfPositions.find(point => point.text === '2026-08-15')?.x).toBeCloseTo(18 + 174 / 6 / 2);
  });
  it('daily PDF shows unknown cash rows rather than omitting cash evidence', async () => {
    await exportDailyReportPdf(record(), input, output);
    expect(captured.pdfText.filter(text => text === 'Unknown (missing cash evidence)')).toHaveLength(3);
    expect(captured.pdfText).toContain('Outstanding cash');
    expect(captured.pdfPositions.every(point => point.x >= 18 && point.x <= 192)).toBe(true);
    expect(captured.pdfPositions.find(point => point.text === 'Cash collected')?.x).toBe(21);
    expect(captured.pdfPositions.find(point => point.text === 'Unknown (missing cash evidence)')?.x).toBe(191);
  });
});
