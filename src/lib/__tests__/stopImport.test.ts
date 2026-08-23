// Stop import pipeline tests (Release R2-B).
import { describe, expect, it } from 'vitest';

import { createStopRecord, type StopRecord } from '@/lib/stops';
import { mapHeaders, previewStopImport, splitDelimited } from '@/lib/stopImport';

const NOW = '2026-08-24T08:00:00.000Z';
const DATE = '2026-08-25';

function existing(over: Partial<StopRecord> = {}): StopRecord {
  return createStopRecord({
    operationDate: DATE, customerName: 'نور ماركت', stopLabel: 'حي الملقا بوابة 3',
    reference: 'SH-100', codAmountSar: 25, ...over,
  }, NOW);
}

describe('splitDelimited (CSV grammar)', () => {
  it('quoted fields keep commas; "" escapes a literal quote', () => {
    const rows = splitDelimited('a,"b,c","d""e"', ',');
    expect(rows).toEqual([['a', 'b,c', 'd"e']]);
  });

  it('CRLF and LF both terminate rows; blank lines are skipped', () => {
    const rows = splitDelimited('h1,h2\r\n1,2\n\n3,4\r\n', ',');
    expect(rows).toHaveLength(3);
  });
});

describe('mapHeaders — bilingual aliases, no guessing', () => {
  it('maps English and Arabic aliases to canonical fields', () => {
    const { mapping } = mapHeaders(['tracking', 'العميل', 'المستلم', 'العنوان', 'الجوال', 'cod', 'الفترة']);
    expect(mapping).toMatchObject({ reference: 0, customer: 1, label: 2, addressNotes: 3, phone: 4, cod: 5, window: 6 });
  });

  it('reports unknown columns instead of guessing', () => {
    const { mapping, unknown } = mapHeaders(['customer', 'label', 'favorite color']);
    expect(mapping.customer).toBe(0);
    expect(unknown).toEqual(['favorite color']);
  });
});

describe('previewStopImport', () => {
  it('parses an English CSV into normalized drafts with COD total', () => {
    const csv = 'reference,customer,label,address,phone,cod,window\nR1,Ninja,Gate 4,Riyadh north,0551234567,45,morning';
    const result = previewStopImport(csv, [], DATE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.totalRows).toBe(1);
    expect(result.preview.valid[0]?.draft.reference).toBe('R1');
    expect(result.preview.codTotal).toBe(45);
    expect(result.preview.blockingConflicts).toBe(false);
  });

  it('parses an Arabic-header CSV preserving Arabic values', () => {
    const csv = 'رقم الشحنة,العميل,المستلم,وصف العنوان\nش-٩,مطاعم الظاهر,فرع العليا,بجاب الجامع';
    const result = previewStopImport(csv, [], DATE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.valid[0]?.draft.customerName).toBe('مطاعم الظاهر');
    expect(result.preview.unknownHeaders).toEqual([]);
  });

  it('strips a UTF-8 BOM before header mapping', () => {
    const result = previewStopImport('\uFEFFcustomer,label\nA,B', [], DATE);
    expect(result.ok).toBe(true);
  });

  it('accepts tab-separated clipboard paste', () => {
    const tsv = 'customer\tlabel\tcod\nFifth Coffee\tMain branch\t12';
    const result = previewStopImport(tsv, [], DATE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.codTotal).toBe(12);
  });

  it('normalizes Arabic-Indic digits in COD cells', () => {
    const result = previewStopImport('customer,label,cod\nX,Y,٤٥', [], DATE);
    expect(result.ok && result.preview.codTotal === 45).toBe(true);
  });

  it('rejects binary content and oversized input deterministically', () => {
    expect(previewStopImport('a,b\n\x00\x01', [], DATE)).toMatchObject({ ok: false, error: 'binary' });
    const big = `customer,label\n${'x'.repeat(500_000)},y`;
    expect(previewStopImport(big, [], DATE)).toMatchObject({ ok: false, error: 'too-large' });
  });

  it('row-count cap rejects batches above IMPORT_MAX_ROWS', async () => {
    const { IMPORT_MAX_ROWS } = await import('@/lib/stopImport');
    const csv = ['customer,label', ...Array.from({ length: IMPORT_MAX_ROWS + 5 }, (_, i) => `c${i},l${i}`)].join('\n');
    expect(previewStopImport(csv, [], DATE)).toMatchObject({ ok: false, error: 'too-large' });
  });

  it('missing required headers report which ones instead of guessing', () => {
    const result = previewStopImport('customer,phone\nA,055', [], DATE);
    expect(result).toMatchObject({ ok: false, error: 'missing-headers', missingFields: ['label'] });
  });

  it('invalid rows carry field-level errors; valid siblings survive', () => {
    const csv = 'reference,customer,label,cod\nOK-1,Ninja,Gate,10\nBAD-1,,Gate 9,-5';
    const result = previewStopImport(csv, [], DATE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.valid).toHaveLength(1);
    expect(result.preview.invalid[0]?.errors.some(e => e.field === 'codAmountSar')).toBe(true);
  });

  it('same-reference same-date row vs existing identical ⇒ exact duplicate (skipped at confirm)', () => {
    const csv = 'reference,customer,label\nSH-100,نور ماركت,حي الملقا بوابة 3';
    const result = previewStopImport(csv, [existing()], DATE);
    expect(result.ok && result.preview.duplicates[0]?.kind === 'exact').toBe(true);
  });

  it('same reference different COD ⇒ conflict that blocks confirmation', () => {
    const csv = 'reference,customer,label,cod\nSH-100,نور ماركت,حي الملقا بوابة 3,99';
    const result = previewStopImport(csv, [existing()], DATE);
    expect(result.ok && result.preview.blockingConflicts).toBe(true);
  });

  it('duplicate inside one batch is detected pairwise regardless of order', () => {
    const csv = 'reference,customer,label\nB-1,Ninja,A\nB-1,Ninja,A';
    const first = previewStopImport(csv, [], DATE);
    const flipped = previewStopImport('reference,customer,label\nB-1,Ninja,A\nB-1,Ninja,A'.split('\n').reverse().join('|'), [], DATE);
    expect(first.ok && first.preview.duplicates[0]?.kind === 'exact').toBe(true);
    // reversed via '|' join would break CSV — rebuild properly:
    const lines = 'reference,customer,label\nB-1,Ninja,A\nB-1,Ninja,A'.split('\n');
    const reordered = [lines[0], lines[2], lines[1]].join('\n');
    const second = previewStopImport(reordered, [], DATE);
    void flipped;
    expect(second.ok && second.preview.duplicates[0]?.kind === 'exact').toBe(true);
  });

  it('unterminated quote still parses to EOF without throwing (row judged like any other)', () => {
    const result = previewStopImport('customer,label\n"Ninja,Gate', [], DATE);
    // the quoted cell swallows the separator: label missing ⇒ invalid row, not crash
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.invalid).toHaveLength(1);
  });

  it('rows for a DIFFERENT operation date never conflict with today’s existing stops', () => {
    const otherDay = createStopRecord({ operationDate: '2026-08-26', customerName: 'نور ماركت', stopLabel: 'حي الملقا بوابة 3', reference: 'SH-100' }, NOW);
    const csv = 'reference,customer,label\nSH-100,نور ماركت,حي الملقا بوابة 3';
    const result = previewStopImport(csv, [otherDay], DATE);
    expect(result.ok && result.preview.duplicates).toHaveLength(0);
  });
});
