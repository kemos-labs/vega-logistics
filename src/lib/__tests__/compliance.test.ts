// VEGA — Compliance-lite domain tests (Release R5).
// Fixtures sourced from PRIMARY documents (see RESEARCH_DOSSIER.md):
//  * ZATCA "Guide to Developed FATOORA Compliant QR Code" (QRCodeCreation.pdf):
//    worked example AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQx
//    NTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA==
//  * SPL national address portal: short address = 4 letters + 4 numbers.
import { describe, expect, it } from 'vitest';
import {
  buildQrPayloadBase64,
  buildReceiptDraft,
  checkShortAddressFormat,
  DEFAULT_VAT_RATE_PERCENT,
  evaluateNationalAddress,
} from '@/lib/compliance';

describe('checkShortAddressFormat (format-only, SPL [PRIMARY])', () => {
  it('accepts 4 letters followed by 4 digits', () => {
    expect(checkShortAddressFormat('RDKA2431')).toEqual({ ok: true, kind: 'format-valid' });
    expect(checkShortAddressFormat(' rdka2431 ')).toEqual({ ok: true, kind: 'format-valid' });
  });

  it('rejects wrong length', () => {
    expect(checkShortAddressFormat('RDKA243')).toMatchObject({ ok: false, kind: 'wrong-length' });
    expect(checkShortAddressFormat('RDKA24311')).toMatchObject({ ok: false, kind: 'wrong-length' });
    expect(checkShortAddressFormat('')).toMatchObject({ ok: false, kind: 'wrong-length' });
  });

  it('rejects wrong charset order', () => {
    expect(checkShortAddressFormat('2431RDKA')).toMatchObject({ ok: false, kind: 'wrong-charset' });
    expect(checkShortAddressFormat('RD-K2431')).toMatchObject({ ok: false, kind: 'wrong-length' });
    expect(checkShortAddressFormat('RDKA243A')).toMatchObject({ ok: false, kind: 'wrong-charset' });
  });

  it('rejects non-string input', () => {
    expect(checkShortAddressFormat(12345678)).toMatchObject({ ok: false, kind: 'not-a-string' });
    expect(checkShortAddressFormat(undefined)).toMatchObject({ ok: false, kind: 'not-a-string' });
  });
});

describe('evaluateNationalAddress (completeness flag only)', () => {
  const full = {
    buildingNumber: '8227', street: 'King Fahd Rd', district: 'Al Olaya',
    city: 'Riyadh', postalCode: '12212',
  };

  it('is complete when all fields present and short address format valid', () => {
    expect(evaluateNationalAddress({ ...full, shortAddress: 'RDKA2431' }).complete).toBe(true);
  });

  it('lists missing fields honestly', () => {
    const result = evaluateNationalAddress({ buildingNumber: '8227', city: 'Riyadh' });
    expect(result.complete).toBe(false);
    expect(result.missingFields).toEqual(['street', 'district', 'postalCode']);
  });

  it('incomplete when short address fails format even with all fields present', () => {
    const result = evaluateNationalAddress({ ...full, shortAddress: 'BAD' });
    expect(result.complete).toBe(false);
    expect(result.shortAddressFormatOk).toBe(false);
  });
});

describe('buildReceiptDraft (draft invoice data only)', () => {
  const valid = {
    issueDate: '2026-03-01', supplierName: 'مؤسسة النقل السريع',
    supplierAddress: 'الرياض - حي العليا', description: 'خدمة توصيل طلبات',
    totalWithVatSar: 115,
  };

  it('derives VAT breakdown from VAT-inclusive total at default 15%', () => {
    const draft = buildReceiptDraft(valid);
    expect(draft.ok).toBe(true);
    expect(draft.vatRatePercent).toBe(DEFAULT_VAT_RATE_PERCENT);
    expect(draft.netAmountSar).toBeCloseTo(100, 2);
    expect(draft.vatValueSar).toBeCloseTo(15, 2);
    expect(draft.totalWithVatSar).toBe(115);
  });

  it('honours configurable vatRate', () => {
    const draft = buildReceiptDraft({ ...valid, vatRatePercent: 0 });
    expect(draft.vatValueSar).toBe(0);
    expect(draft.netAmountSar).toBe(115);
  });

  it('requires every simplified-invoice content field', () => {
    const draft = buildReceiptDraft({});
    expect(draft.ok).toBe(false);
    const fields = draft.errors.map(e => e.field).sort();
    expect(fields).toEqual(['description', 'issueDate', 'supplierAddress', 'supplierName', 'totalWithVatSar']);
  });

  it('rejects impossible dates and negative amounts', () => {
    expect(buildReceiptDraft({ ...valid, issueDate: '2026-02-30' }).errors[0]).toMatchObject({ code: 'impossible-date' });
    expect(buildReceiptDraft({ ...valid, totalWithVatSar: -1 }).errors[0]).toMatchObject({ code: 'negative' });
  });
});

describe('buildQrPayloadBase64 (Phase-1-shaped TLV, ZATCA guide fixture)', () => {
  // Exact worked example from the ZATCA QR guide PDF [PRIMARY].
  const ZATCA_EXAMPLE_BASE64 =
    'AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA==';

  it('reproduces the official ZATCA worked example byte-for-byte', () => {
    const result = buildQrPayloadBase64({
      sellerName: 'Bobs Records',
      vatRegistrationNumber: '310122393500003',
      timestampIsoUtc: '2022-04-25T15:30:00Z',
      invoiceTotalWithVat: '1000.00',
      vatTotal: '150.00',
    });
    expect(result).toEqual({ ok: true, base64: ZATCA_EXAMPLE_BASE64 });
  });

  it('encodes Arabic seller names as UTF-8 (guide requirement)', () => {
    const result = buildQrPayloadBase64({
      sellerName: 'شركة التوصيل',
      vatRegistrationNumber: '310122393500003',
      timestampIsoUtc: '2026-03-01T10:00:00Z',
      invoiceTotalWithVat: 115,
      vatTotal: 15,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const binary = atob(result.base64);
      expect(binary.charCodeAt(0)).toBe(1); // tag 1 first — seller name
      const bytes = [...binary].slice(2, 2 + binary.charCodeAt(1)).map(ch => ch.charCodeAt(0));
      expect(new TextDecoder().decode(new Uint8Array(bytes)))
        .toBe('شركة التوصيل');
    }
  });

  it('formats numeric amounts with two decimals like the guide examples', () => {
    const result = buildQrPayloadBase64({
      sellerName: 'Bobs Records', vatRegistrationNumber: '310122393500003',
      timestampIsoUtc: '2022-04-25T15:30:00Z', invoiceTotalWithVat: 1000, vatTotal: 150,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(atob(result.base64)).toContain('1000.00');
  });

  it('rejects missing fields, bad timestamps and bad amounts', () => {
    const base = {
      sellerName: 'X', vatRegistrationNumber: '300000000000003',
      timestampIsoUtc: '2022-04-25T15:30:00Z', invoiceTotalWithVat: 100, vatTotal: 15,
    };
    expect(buildQrPayloadBase64({ ...base, sellerName: ' ' })).toMatchObject({ ok: false, reason: 'missing-field' });
    expect(buildQrPayloadBase64({ ...base, timestampIsoUtc: '2022-04-25 15:30' })).toMatchObject({ ok: false, reason: 'bad-timestamp' });
    expect(buildQrPayloadBase64({ ...base, invoiceTotalWithVat: -5 })).toMatchObject({ ok: false, reason: 'bad-amount' });
    expect(buildQrPayloadBase64({ ...base, invoiceTotalWithVat: Number.NaN })).toMatchObject({ ok: false, reason: 'bad-amount' });
  });
});
