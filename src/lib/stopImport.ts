// VEGA — Stop bulk import pipeline (Release R2-B).
// Pure, deterministic, offline. NOTHING here mutates app state or storage —
// it produces a PREVIEW the operator reviews before explicit confirmation.
//
// Supported input grammar:
//   * UTF-8 text with optional BOM;
//   * comma-separated (RFC4180-style quotes, "" escape) OR tab-separated
//     clipboard paste — delimiter auto-detected from the first non-empty line;
//   * CRLF and LF line endings; blank lines skipped;
//   * Arabic and English header aliases; unknown columns are REPORTED, never
//     guessed;
//   * Latin, Arabic-Indic (٠-٩) and Persian (۰-۹) digits in numeric cells.
// Safety limits: hard caps on characters and data rows; NUL byte ⇒ binary
// rejection. Imported text is never rendered as HTML upstream.

import { normalizeDigits } from '@/lib/providerMessageParser';
import {
  identifyStopDuplicates, validateStopRecord,
  type DuplicateFinding, type StopFieldError, type StopRecord,
} from '@/lib/stops';

export const IMPORT_MAX_CHARS = 400_000;
/** Uploaded files are bounded by BYTES before reading — never silently sliced. */
export const IMPORT_MAX_FILE_BYTES = 400_000;
export const IMPORT_MAX_ROWS = 500;

export type ImportHeaderField =
  | 'reference' | 'customer' | 'label' | 'addressNotes' | 'phone' | 'cod' | 'window';

/** Canonical field → accepted header aliases (normalized: trimmed, lowercased). */
const HEADER_ALIASES: Record<ImportHeaderField, string[]> = {
  reference: ['reference', 'shipment', 'tracking', 'ref', 'رقم الشحنة', 'الشحنة'],
  customer: ['customer', 'provider', 'client', 'العميل', 'المزود', 'المزوّد', 'الزبون'],
  label: ['stop', 'recipient', 'label', 'destination', 'المستلم', 'الوجهة', 'الوقفة', 'المحطة'],
  addressNotes: ['addressnotes', 'address', 'addressnote', 'notes', 'العنوان', 'وصف العنوان', 'ملاحظات العنوان', 'العنوان الوصفي'],
  phone: ['phone', 'mobile', 'tel', 'cell', 'الجوال', 'الهاتف', 'جوال'],
  cod: ['cod', 'cash', 'codamountsar', 'amount', 'الدفع عند الاستلام', 'المبلغ المستحق', 'المبلغ'],
  window: ['window', 'period', 'servicewindow', 'الفترة'],
};

function normalizeHeader(raw: string): string {
  return raw.replace(/\uFEFF/g, '').trim().toLowerCase();
}

/** Map a header row onto canonical fields; report unknowns instead of guessing. */
export function mapHeaders(headers: string[]): { mapping: Partial<Record<ImportHeaderField, number>>; unknown: string[] } {
  const mapping: Partial<Record<ImportHeaderField, number>> = {};
  const unknown: string[] = [];
  const claimed = new Set<number>();
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (normalized === '') return; // trailing separator column
    let matched = false;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<[ImportHeaderField, string[]]>) {
      if (mapping[field] !== undefined) continue;
      if (aliases.includes(normalized)) {
        mapping[field] = index;
        matched = true;
        break;
      }
    }
    if (!matched && !claimed.has(index)) unknown.push(header.trim());
    if (matched) claimed.add(index);
  });
  return { mapping, unknown };
}

/** Split delimited text into rows of cells (quotes + CRLF/LF aware). */
export function splitDelimited(text: string, delimiter: ',' | '\t'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let malformed = false;

  const pushCell = () => { row.push(cell); cell = ''; };
  const pushRow = () => { pushCell(); rows.push(row); row = []; };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; }
        else inQuotes = false;
      } else cell += char;
      continue;
    }
    // A quote may only OPEN a cell (start of field). A quote appearing after
    // cell content (like `ab"c`) is malformed — reported, never guessed.
    if (char === '"') {
      if (cell === '') { inQuotes = true; continue; }
      malformed = true;
      continue;
    }
    if (char === delimiter) { pushCell(); continue; }
    if (char === '\r') { if (text[i + 1] === '\n') i += 1; pushRow(); continue; }
    if (char === '\n') { pushRow(); continue; }
    cell += char;
  }
  // flush trailing content
  if (cell !== '' || row.length > 0) pushRow();
  // Unterminated quote: the remainder was consumed as one cell — that is a
  // MALFORMED file, not a giant valid cell.
  if (inQuotes) malformed = true;
  if (malformed) throw new StopCsvMalformedError();
  return rows.filter(row => row.some(cellValue => cellValue.trim() !== ''));
}

function detectDelimiter(text: string): ',' | '\t' {
  const firstLineEnd = text.search(/[\r\n]/);
  const head = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  // count outside-quote occurrences; tabs win ties because CSV headers rarely tab
  let commas = 0, tabs = 0, inQuotes = false;
  for (const char of head) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && char === ',') commas += 1;
    else if (!inQuotes && char === '\t') tabs += 1;
  }
  return tabs > commas ? '\t' : ',';
}

/** Typed signal for structurally broken CSV (unterminated/misplaced quotes). */
export class StopCsvMalformedError extends Error {
  constructor() { super('malformed-csv'); this.name = 'StopCsvMalformedError'; }
}

export interface PreviewRowValid {
  index: number;
  draft: Record<string, unknown>;
  warnings: string[];
}

export interface PreviewRowInvalid {
  index: number;
  rawCells: string[];
  errors: StopFieldError[];
}

export interface StopImportPreview {
  operationDate: string;
  mapping: Partial<Record<ImportHeaderField, number>>;
  unknownHeaders: string[];
  totalRows: number;
  valid: PreviewRowValid[];
  invalid: PreviewRowInvalid[];
  /** Exact duplicates are skipped at confirm; conflicts/probable gate it. */
  duplicates: DuplicateFinding[];
  codTotal: number;
  /** true ⇒ confirmation must stay disabled (invalid/conflict/unacked). */
  blockingConflicts: boolean;
}

export type ImportParseResult =
  | { ok: true; preview: StopImportPreview }
  | { ok: false; error: 'empty' | 'too-large' | 'binary' | 'missing-headers' | 'malformed-csv'; missingFields?: ImportHeaderField[] };

/**
 * Build the reviewable preview for a pasted/uploaded batch against the
 * operator's EXISTING planned stops for the chosen date. Pure: identical
 * inputs ⇒ identical outputs.
 */
export function previewStopImport(
  rawText: string,
  existing: StopRecord[],
  operationDate: string,
): ImportParseResult {
  const text = rawText.replace(/^\uFEFF/, ''); // strip BOM
  if (text.trim() === '') return { ok: false, error: 'empty' };
  if (text.includes('\u0000')) return { ok: false, error: 'binary' };
  if (text.length > IMPORT_MAX_CHARS) return { ok: false, error: 'too-large' };

  let rows: string[][];
  try {
    rows = splitDelimited(text, detectDelimiter(text));
  } catch (error) {
    if (error instanceof StopCsvMalformedError) return { ok: false, error: 'malformed-csv' };
    throw error;
  }
  if (rows.length < 1) return { ok: false, error: 'empty' };
  const dataRows = rows.slice(1);
  if (dataRows.length > IMPORT_MAX_ROWS) return { ok: false, error: 'too-large' };

  const { mapping, unknown } = mapHeaders(rows[0]);
  if (mapping.customer === undefined || mapping.label === undefined) {
    return { ok: false, error: 'missing-headers', missingFields: [ ...(mapping.customer === undefined ? ['customer' as const] : []), ...(mapping.label === undefined ? ['label' as const] : []) ] };
  }

  const valid: PreviewRowValid[] = [];
  const invalid: PreviewRowInvalid[] = [];
  let codTotal = 0;

  dataRows.forEach((cells, rowIndex) => {
    const pick = (field: ImportHeaderField): string => {
      const idx = mapping[field];
      return idx === undefined ? '' : normalizeDigits((cells[idx] ?? '').replace(/\s+/gu, ' ').trim());
    };
    const codText = pick('cod');
    const cod = codText === '' ? undefined : Number(codText);
    const windowRaw = pick('window').toLowerCase();
    const serviceWindow = windowRaw === ''
      ? undefined
      : ({ 'morning': 'morning', 'afternoon': 'afternoon', 'evening': 'evening', 'صباحا': 'morning', 'صباحاً': 'morning', 'ظهرا': 'afternoon', 'ظهراً': 'afternoon', 'مساء': 'evening', 'مساءً': 'evening' } as Record<string, string>)[windowRaw];

    const draft: Record<string, unknown> = {
      operationDate,
      customerName: pick('customer'),
      customerId: undefined,
      reference: pick('reference') || undefined,
      stopLabel: pick('label'),
      addressNotes: pick('addressNotes') || undefined,
      phone: pick('phone') || undefined,
      codAmountSar: cod,
      serviceWindow,
      status: 'planned',
    };

    const validation = validateStopRecord(draft);
    if (validation.ok) {
      valid.push({
        index: rowIndex,
        draft,
        warnings: [
          ...(!draft.reference ? ['no-reference'] : []),
          ...(cod !== undefined && Number.isFinite(cod) && Math.abs(cod - Math.trunc(cod)) > 0 ? ['fractional-cod'] : []),
          ...(serviceWindow === undefined && windowRaw !== '' ? ['unknown-window'] : []),
        ],
      });
      if (typeof draft.codAmountSar === 'number') codTotal += draft.codAmountSar;
    } else {
      invalid.push({ index: rowIndex, rawCells: cells, errors: validation.errors });
    }
  });

  // Assemble drafts into comparable shapes for duplicate classification.
  const draftStops = valid.map(({ draft }) => draft as unknown as StopRecord);
  const duplicates = identifyStopDuplicates(draftStops, existing.filter(s => s.operationDate === operationDate));
  const blockingConflicts = duplicates.some(f => f.kind === 'conflict');

  return {
    ok: true,
    preview: {
      operationDate,
      mapping,
      unknownHeaders: unknown,
      totalRows: dataRows.length,
      valid,
      invalid,
      duplicates,
      codTotal,
      blockingConflicts,
    },
  };
}
