import { describe, expect, it } from 'vitest';

import { readFirstWorksheetAsCsv } from '@/lib/xlsxStopImport';

describe('xlsx stop import adapter', () => {
  it('converts the first worksheet to CSV without persisting anything', async () => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Packages');
    sheet.addRow(['reference', 'customer', 'stop']);
    sheet.addRow(['A-1', 'نور ماركت', 'حي العليا']);
    const buffer = await workbook.xlsx.writeBuffer();
    const csv = await readFirstWorksheetAsCsv(new File([buffer], 'orders.xlsx'));
    expect(csv).toContain('reference,customer,stop');
    expect(csv).toContain('A-1,نور ماركت,حي العليا');
  });
});
