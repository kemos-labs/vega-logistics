// Arabic WhatsApp provider parser — deterministic engine tests (contract H).
import { describe, expect, it } from 'vitest';

import { normalizeDigits, parseProviderMessage, reconcile } from '@/lib/providerMessageParser';

function expectParsed(text: string) {
  const result = parseProviderMessage(text);
  expect(result.ok, `should parse: ${text}`).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.preview;
}

describe('digit normalization', () => {
  it('maps Arabic-Indic and Persian digits to Latin', () => {
    expect(normalizeDigits('تحميل ٢٥ توصيل ١٨')).toBe('تحميل 25 توصيل 18');
    expect(normalizeDigits('راجع ۲')).toBe('راجع 2');
    expect(normalizeDigits('4684')).toBe('4684');
  });
});

describe('ten accepted real-world variants', () => {
  const cases: Array<{ label: string; text: string; car: string; plate: string; loaded: number; delivered: number; returned: number }> = [
    { label: 'canonical spaced', text: 'يعقوب عبدالقادر سيارة 10 لوحة 4684 تحميل 25 توصيل 18 راجع 7', car: '10', plate: '4684', loaded: 25, delivered: 18, returned: 7 },
    { label: 'attached numbers + hamza-less spellings', text: 'يعقوب سياره10 لوحه4684 تحميل25 توصيل18 راجع7', car: '10', plate: '4684', loaded: 25, delivered: 18, returned: 7 },
    { label: 'محمل variant', text: 'يعقوب عبدالقادر سيارة 12 لوحة 5521 محمل 20 توصيل 15 راجع 5', car: '12', plate: '5521', loaded: 20, delivered: 15, returned: 5 },
    { label: 'تم التوصيل phrase', text: 'يعقوب عبدالقادر سيارة 3 لوحة 7788 تحميل 22 تم التوصيل 19 راجع 3', car: '3', plate: '7788', loaded: 22, delivered: 19, returned: 3 },
    { label: 'تمت التوصيل phrase', text: 'يعقوب سيارة 3 لوحه 7788 تحميل 22 تمت التوصيل 20 راجع 2', car: '3', plate: '7788', loaded: 22, delivered: 20, returned: 2 },
    { label: 'مرتجع variant', text: 'يعقوب عبدالقادر سياره 5 لوحه 9034 تحميل 18 توصيل 14 مرتجع 4', car: '5', plate: '9034', loaded: 18, delivered: 14, returned: 4 },
    { label: 'Arabic-Indic digits', text: 'يعقوب عبدالقادر سيارة ١٠ لوحة ٤٦٨٤ تحميل ٢٥ توصيل ١٨ راجع ٧', car: '10', plate: '4684', loaded: 25, delivered: 18, returned: 7 },
    { label: 'punctuation heavy', text: 'يعقوب عبدالقادر، سيارة: 10؛ لوحة - 4684. تحميل = 25 ، توصيل ، 18 راجع 7', car: '10', plate: '4684', loaded: 25, delivered: 18, returned: 7 },
    { label: 'multiline whatsapp dump', text: 'صباح الخير\nيعقوب عبدالقادر\nسيارة 10\nلوحة 4684\nتحميل 25\nتوصيل 18\nراجع 7', car: '10', plate: '4684', loaded: 25, delivered: 18, returned: 7 },
    { label: 'chatter around fields', text: 'السلام عليكم يعقوب عبدالقادر اليوم سيارة 10 واللوحة 4684 تحميل 25 والحمد لله توصيل 18 وراجع 7 باقي التقرير بكرة', car: '10', plate: '4684', loaded: 25, delivered: 18, returned: 7 },
  ];

  for (const testCase of cases) {
    it(`parses: ${testCase.label}`, () => {
      const preview = expectParsed(testCase.text);
      expect(preview.carNumber).toBe(testCase.car);
      expect(preview.plateNumber).toBe(testCase.plate);
      expect(preview.loaded).toBe(testCase.loaded);
      expect(preview.delivered).toBe(testCase.delivered);
      expect(preview.returned).toBe(testCase.returned);
      expect(preview.providerName).toContain('يعقوب');
      expect(reconcile(preview)).toEqual({ balanced: true, difference: 0 });
      expect(preview.sourceText).toBe(testCase.text);
    });
  }
});

describe('R0 fixes — greetings, conflicts, chatter', () => {
  it('strips greetings from the name run: «السلام عليكم يعقوب…» yields يعقوب only', () => {
    const preview = expectParsed('السلام عليكم صباح الخير يعقوب عبدالقادر سيارة 10 لوحة 4684 تحميل 25 توصيل 18 راجع 7');
    expect(preview.providerName).toBe('يعقوب عبدالقادر');
    expect(preview.providerName).not.toContain('السلام');
    expect(preview.warnings).not.toContain('ambiguous-name');
  });

  it('greeting-only preamble degrades to name-missing, numbers still parsed', () => {
    const preview = expectParsed('السلام عليكم كيف الحال الحمد لله سيارة 10 لوحة 4684 تحميل 9 توصيل 7 راجع 2');
    expect(preview.warnings).toContain('name-missing');
    expect(preview.providerName).toBeUndefined();
    expect(preview.loaded).toBe(9);
  });

  it('conflicting duplicate تحميل values warn conflict:loaded and keep the first', () => {
    const preview = expectParsed('يعقوب سياره10 لوحه4684 تحميل25 توصيل18 راجع7 تحميل30');
    expect(preview.loaded).toBe(25);
    expect(preview.warnings).toContain('conflict:loaded');
  });

  it('identical repeated values are NOT conflicts', () => {
    const preview = expectParsed('يعقوب سياره10 لوحه4684 تحميل25 توصيل18 راجع7 وتحميل 25 ايضا');
    expect(preview.loaded).toBe(25);
    expect(preview.warnings.filter(w => w.startsWith('conflict:'))).toEqual([]);
  });
});

describe('the operator\'s literal unreconciled message stays blocked', () => {
  it('parses fine but reconcile() exposes difference +5 — confirmation must be blocked upstream', () => {
    const preview = expectParsed('يعقوب عبدالقادر سياره 10 لوحه4684 تحميل 25 توصيل 18 راجع 2');
    expect(preview.loaded).toBe(25);
    expect(reconcile(preview)).toEqual({ balanced: false, difference: 5 });
  });
});

describe('ambiguity and rejection safety (contract H-7)', () => {
  it('numeric-only name run is ambiguous → dropped with warning, numbers still parsed', () => {
    const preview = expectParsed('12345 سيارة 10 لوحة 4684 تحميل 9 توصيل 7 راجع 2');
    expect(preview.providerName).toBeUndefined();
    expect(preview.warnings).toContain('ambiguous-name');
    expect(preview.loaded).toBe(9);
  });

  it('missing name warns but still parses the totals', () => {
    const preview = expectParsed('سيارة 10 لوحة 4684 تحميل 9 توصيل 7 راجع 2');
    expect(preview.warnings).toContain('name-missing');
    expect(preview.delivered).toBe(7);
  });

  it('missing a required term rejects instead of inventing zeros', () => {
    const result = parseProviderMessage('يعقوب عبدالقادر سيارة 10 لوحة 4684 تحميل 25 توصيل 18');
    expect(result).toMatchObject({ ok: false, error: 'missing-required' });
  });

  it('junk input changes nothing: empty and unrelated Arabic text reject cleanly', () => {
    expect(parseProviderMessage('')).toMatchObject({ ok: false, error: 'empty' });
    expect(parseProviderMessage('   \n  ')).toMatchObject({ ok: false, error: 'empty' });
    const junk = parseProviderMessage('كيف الحال ان شاء الله بخير');
    expect(junk).toMatchObject({ ok: false, error: 'missing-required' });
  });

  it('term without a following number does not fabricate values', () => {
    const result = parseProviderMessage('يعقوب سيارة لوحة تحميل توصيل راجع');
    expect(result).toMatchObject({ ok: false, error: 'missing-required' });
  });
});

describe('reconciliation rules (contract H-5)', () => {
  it('balanced when loaded = delivered + returned', () => {
    expect(reconcile({ loaded: 25, delivered: 18, returned: 7 })).toEqual({ balanced: true, difference: 0 });
  });

  it('reports the unexplained difference verbatim when totals disagree', () => {
    expect(reconcile({ loaded: 30, delivered: 18, returned: 2 })).toEqual({ balanced: false, difference: 10 });
    expect(reconcile({ loaded: 10, delivered: 12, returned: 2 })).toEqual({ balanced: false, difference: -4 });
  });

  it('never treats returned as all failed shipments on mismatch — no auto-balancing exists', async () => {
    // the API surface intentionally exposes no balancing helper anywhere
    const exportedNames = Object.keys(await import('@/lib/providerMessageParser'));
    expect(exportedNames.filter(name => /balance/i.test(name))).toEqual([]);
  });
});
