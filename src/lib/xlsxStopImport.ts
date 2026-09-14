// Client-side Excel adapter for Stop Planning. It only converts the first
// worksheet to CSV text; the existing preview/validation engine remains the
// single source of truth and no row is persisted by this adapter.

export async function readFirstWorksheetAsCsv(file: File): Promise<string> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return '';
  const escape = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'object' && 'text' in (value as Record<string, unknown>)) value = (value as { text: unknown }).text;
    const text = value instanceof Date ? value.toISOString() : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines: string[] = [];
  sheet.eachRow({ includeEmpty: false }, row => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    lines.push(values.map(escape).join(','));
  });
  return lines.join('\n');
}
