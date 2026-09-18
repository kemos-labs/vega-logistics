// Client-side Nemow Excel adapter. It selects the best canonical worksheet,
// plain rows; the pure pull engine (nemowPull.ts) remains the single source of
// truth for header mapping and no row is persisted by this adapter.

import columnSpec from '@/lib/nemowContract.json';
const preferredSheets = (columnSpec as { sheets_preferred: string[] }).sheets_preferred;

/** Uploaded workbooks are bounded by BYTES before parsing — never silently sliced. */
export const NEMOW_MAX_FILE_BYTES = 5_000_000;

/** Pure worksheet choice, exported so the sheet priority is regression-tested. */
export function pickNemowSheetIndex(names: string[], scores: number[]): number {
  const preferred = preferredSheets
    .map(name => names.findIndex((sheet, index) => sheet === name && (scores[index] ?? 0) >= 8))
    .find(index => index >= 0);
  if (preferred !== undefined) return preferred;
  return scores.reduce((best, value, index) => value > (scores[best] ?? -1) ? index : best, 0);
}

export async function readNemowWorksheet(file: File): Promise<{ fileName: string; sheetName: string; aoa: unknown[][]; availableSheets: string[] }> {
  if (file.size > NEMOW_MAX_FILE_BYTES) {
    throw new Error(`file-too-large:${NEMOW_MAX_FILE_BYTES}`);
  }
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const availableSheets = workbook.worksheets.map(sheet => sheet.name);
  const aliases = Object.values(columnSpec.fields).flat() as string[];
  const normalized = (value: unknown) => String(value ?? '').replace(/\uFEFF/g, '').trim().replace(/\s+/g, ' ');
  const score = (sheet: typeof workbook.worksheets[number]) => {
    const first = sheet.getRow(1).values as unknown[];
    const headers = first.slice(1).map(normalized);
    const has = (field: 'barcode' | 'status') => (columnSpec.fields[field] as string[]).some(alias => headers.includes(alias));
    return (has('barcode') ? 4 : 0) + (has('status') ? 4 : 0) + headers.filter(header => aliases.includes(header)).length / 100;
  };
  const sheetIndex = pickNemowSheetIndex(availableSheets, workbook.worksheets.map(score));
  const sheet = workbook.worksheets[sheetIndex];
  if (!sheet || score(sheet) < 8) throw new Error('missing-canonical-sheet');
  const aoa: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, row => {
    const values = Array.isArray(row.values) ? (row.values as unknown[]).slice(1) : [];
    aoa.push(values.map(cell => {
      if (cell instanceof Date) return new Date(cell.getTime());
      if (cell !== null && typeof cell === 'object') {
        const maybe = cell as Record<string, unknown>;
        if (typeof maybe.text === 'string') return maybe.text;
        if (maybe.result !== undefined) return maybe.result as unknown;
      }
      return cell as unknown;
    }));
  });
  return { fileName: file.name, sheetName: sheet.name, aoa, availableSheets };
}
