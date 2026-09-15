// Client-side Nemow Excel adapter. It only converts the FIRST worksheet to
// plain rows; the pure pull engine (nemowPull.ts) remains the single source of
// truth for header mapping and no row is persisted by this adapter.

/** Uploaded workbooks are bounded by BYTES before parsing — never silently sliced. */
export const NEMOW_MAX_FILE_BYTES = 5_000_000;

export async function readNemowWorksheet(file: File): Promise<{ fileName: string; sheetName: string; aoa: unknown[][] }> {
  if (file.size > NEMOW_MAX_FILE_BYTES) {
    throw new Error(`file-too-large:${NEMOW_MAX_FILE_BYTES}`);
  }
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return { fileName: file.name, sheetName: '', aoa: [] };
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
  return { fileName: file.name, sheetName: sheet.name, aoa };
}
