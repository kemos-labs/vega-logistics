// Stop domain tests (Release R2-A).
import { describe, expect, it } from 'vitest';

import {
  createStopRecord, identifyStopDuplicates, isValidStopDate,
  normalizeStopRecord, readStoredStops, sortStopsForDate,
  updateStopRecord, validateStopRecord, type StopRecord,
} from '@/lib/stops';

const NOW_ISO = '2026-08-24T06:00:00.000Z';

function validDraft(over: Partial<StopRecord> = {}): Record<string, unknown> {
  return {
    operationDate: '2026-08-25', customerName: 'نور ماركت', stopLabel: 'حي الملقا - بوابة 3',
    status: 'planned', createdAt: NOW_ISO, updatedAt: NOW_ISO, ...over,
  };
}

describe('isValidStopDate', () => {
  it('accepts real dates and rejects shape-valid impossible ones', () => {
    expect(isValidStopDate('2026-02-28')).toBe(true);
    expect(isValidStopDate('2026-02-30')).toBe(false);
    expect(isValidStopDate('26-02-01')).toBe(false);
  });
});

describe('createStopRecord', () => {
  it('creates a planned stop with generated id and matching stamps', () => {
    const stop = createStopRecord({ operationDate: '2026-08-25', customerName: 'Ninja', stopLabel: 'Gate 4' }, NOW_ISO);
    expect(stop.id).toBeTruthy();
    expect(stop.status).toBe('planned');
    expect(stop.createdAt).toBe(NOW_ISO);
    expect(stop.updatedAt).toBe(NOW_ISO);
  });

  it('throws structured error on missing required field', () => {
    expect(() => createStopRecord({ operationDate: '2026-08-25', customerName: '', stopLabel: 'x' }, NOW_ISO))
      .toThrow(/customerName:required-missing/);
  });
});

describe('validateStopRecord', () => {
  it('impossible calendar date is a distinct error', () => {
    const v = validateStopRecord(validDraft({ operationDate: '2026-04-31' }));
    expect(v.ok).toBe(false);
    expect(v.errors).toContainEqual({ field: 'operationDate', code: 'impossible-date' });
  });

  it('string limits produce too-long without corrupting data', () => {
    const v = validateStopRecord(validDraft({ phone: '0'.repeat(31) }));
    expect(v.errors).toContainEqual({ field: 'phone', code: 'too-long' });
  });

  it('failure reason required for failed/returned, optional otherwise', () => {
    expect(validateStopRecord(validDraft({ status: 'failed' })).errors)
      .toContainEqual({ field: 'failureReasonKey', code: 'failure-reason-required' });
    expect(validateStopRecord(validDraft({ status: 'returned' })).errors)
      .toContainEqual({ field: 'failureReasonKey', code: 'failure-reason-required' });
    expect(validateStopRecord(validDraft({ status: 'failed', failureReasonKey: 'addressIssue' })).ok).toBe(true);
    expect(validateStopRecord(validDraft()).ok).toBe(true);
  });

  it('COD must be finite and non-negative', () => {
    expect(validateStopRecord(validDraft({ codAmountSar: -5 })).errors).toContainEqual({ field: 'codAmountSar', code: 'negative' });
    expect(validateStopRecord(validDraft({ codAmountSar: Number.NaN })).errors).toContainEqual({ field: 'codAmountSar', code: 'invalid-number' });
    expect(validateStopRecord(validDraft({ codAmountSar: Number.POSITIVE_INFINITY })).errors).toContainEqual({ field: 'codAmountSar', code: 'invalid-number' });
    expect(validateStopRecord(validDraft({ codAmountSar: 45.5 })).ok).toBe(true);
  });

  it('non-string optional fields are rejected, never coerced', () => {
    const draft = validDraft();
    draft.phone = { number: '123' } as unknown as string;
    const v = validateStopRecord(draft);
    expect(v.errors).toContainEqual({ field: 'phone', code: 'not-a-string' });
  });
});

describe('normalizeStopRecord', () => {
  it('preserves meaningful Arabic while collapsing whitespace runs', () => {
    const n = normalizeStopRecord(validDraft({ stopLabel: '  حي   النرجس — بوابة   ٢  ' }) as Record<string, unknown>);
    expect(n.stopLabel).toBe('حي النرجس — بوابة ٢');
  });

  it('keeps optional fields only when present and drops reason on success statuses', () => {
    const n = normalizeStopRecord(validDraft({ status: 'delivered', failureReasonKey: 'noDriver', codAmountSar: undefined }));
    expect(n.failureReasonKey).toBeUndefined();
    expect(n.codAmountSar).toBeUndefined();
  });
});

describe('updateStopRecord', () => {
  it('createdAt never changes; updatedAt advances on material edits', () => {
    const created = createStopRecord(validDraft() as never, NOW_ISO);
    const later = updateStopRecord(created, { codAmountSar: 30 }, '2026-08-24T09:00:00.000Z');
    expect(later.createdAt).toBe(created.createdAt);
    expect(later.updatedAt).toBe('2026-08-24T09:00:00.000Z');
    expect(later.codAmountSar).toBe(30);
  });

  it('rejects patches that would make the record invalid', () => {
    const created = createStopRecord(validDraft() as never, NOW_ISO);
    expect(() => updateStopRecord(created, { status: 'failed' }, NOW_ISO)).toThrow(/failure-reason-required/);
  });
});

describe('sortStopsForDate', () => {
  it('stable: explicit sequence first, then creation order, then id tiebreak', () => {
    const a = { ...validDraft(), id: 'a', sequence: 2 } as StopRecord;
    const b = { ...validDraft(), id: 'b', sequence: 1 } as StopRecord;
    const c = { ...validDraft(), id: 'c' } as StopRecord; // no sequence ⇒ last
    const d = { ...validDraft(), id: 'd', createdAt: '2026-08-23T00:00:00.000Z', sequence: 1 } as StopRecord;
    expect(sortStopsForDate([c, a, b, d]).map(s => s.id)).toEqual(['d', 'b', 'a', 'c']);
  });
});

describe('identifyStopDuplicates — identity hierarchy', () => {
  const existing = [createStopRecord(validDraft({ reference: 'SH-100', phone: '0555' }) as never, NOW_ISO)];

  it('same reference same date: identical content ⇒ exact', () => {
    const incoming = [createStopRecord(validDraft({ reference: 'sh-100', phone: '0555' }) as never, NOW_ISO)];
    expect(identifyStopDuplicates(incoming, existing)[0]).toMatchObject({ kind: 'exact', basis: 'reference' });
  });

  it('same reference materially different COD ⇒ conflict (blocks confirmation upstream)', () => {
    const incoming = [createStopRecord(validDraft({ reference: 'SH-100', codAmountSar: 99 }) as never, NOW_ISO)];
    expect(identifyStopDuplicates(incoming, existing)[0]?.kind).toBe('conflict');
  });

  it('same reference DIFFERENT date is not a duplicate', () => {
    const incoming = [createStopRecord(validDraft({ operationDate: '2026-08-26', reference: 'SH-100' }) as never, NOW_ISO)];
    expect(identifyStopDuplicates(incoming, existing)).toEqual([]);
  });

  it('no reference: matching composite fingerprint ⇒ probable warning, not silent insert', () => {
    const anchor = createStopRecord(validDraft({ addressNotes: 'بجاب الجامع', phone: '0555' }) as never, NOW_ISO);
    const incoming = [createStopRecord(validDraft({ addressNotes: 'بجاب الجامع', phone: '0555' }) as never, NOW_ISO)];
    const findings = identifyStopDuplicates(incoming, [anchor]);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: 'exact', basis: 'fingerprint', existingId: anchor.id });
    // weak evidence: same fingerprint but different COD ⇒ probable (ack required)
    const codConflict = [createStopRecord(validDraft({ addressNotes: 'بجاب الجامع', phone: '0555', codAmountSar: 77 }) as never, NOW_ISO)];
    expect(identifyStopDuplicates(codConflict, [anchor])[0]?.kind).toBe('probable');
    // a phone/address change alone breaks the fingerprint entirely — never
    // deduplicated by name or phone alone (documented rule)
  });

  it('recipient name or phone ALONE never triggers duplication', () => {
    const incoming = [createStopRecord(validDraft({ stopLabel: 'موقع آخر تماماً' }) as never, NOW_ISO)];
    expect(identifyStopDuplicates(incoming, existing)).toEqual([]);
  });

  it('batch-internal duplicates detected pairwise regardless of row order', () => {
    const rowA = createStopRecord(validDraft({ reference: 'B-1' }) as never, NOW_ISO);
    const rowB = createStopRecord(validDraft({ reference: 'B-1' }) as never, NOW_ISO);
    expect(identifyStopDuplicates([rowA, rowB], [])[0]?.kind).toBe('exact');
    expect(identifyStopDuplicates([rowB, rowA], [])[0]?.kind).toBe('exact');
  });
});

describe('readStoredStops', () => {
  it('drops corrupt rows with count, keeps valid ones', () => {
    const raw = JSON.stringify([
      validDraft(),
      { broken: true },
      validDraft({ operationDate: '2026-02-30' }),
    ]);
    const { stops, dropped } = readStoredStops(raw);
    expect(stops).toHaveLength(1);
    expect(dropped).toBe(2);
  });

  it('null/absent/non-array storage yields empty collection', () => {
    expect(readStoredStops(null).stops).toEqual([]);
    expect(readStoredStops('"text"').dropped).toBe(0);
  });
});
