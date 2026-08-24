// VEGA — Compliance-lite data readiness domain (Release R5).
// Pure, React-free, offline. Sources (RESEARCH_DOSSIER.md):
//   * Short Address format: 4 letters + 4 digits — SPL national address portal,
//     https://splonline.com.sa/en/national-address-1/ [PRIMARY] (rechecked live this cycle).
//   * Simplified tax invoice required contents: date, supplier name/address,
//     description of goods/services, total amount, VAT value — ZATCA VAT portal [PRIMARY].
//   * QR payload: Base64 TLV, UTF-8 values, tags 1–5 (seller name, VAT reg no.,
//     timestamp ISO-8601 Z, invoice total with VAT, VAT total) — ZATCA
//     "Guide to Developed FATOORA Compliant QR Code" (QRCodeCreation.pdf) [PRIMARY].
//
// Claim discipline (AGENTS.md R8): everything here is FORMAT/DATA-SHAPED ONLY.
// Never claim "ZATCA compliant" or "verified National Address". The receipt is a
// DRAFT; the Short Address check is a format check only.

export const DEFAULT_VAT_RATE_PERCENT = 15 as const;

const SHORT_ADDRESS_RE = /^[A-Za-z]{4}\d{4}$/;

export type ShortAddressCheck =
  | { ok: true; kind: 'format-valid' }
  | { ok: false; kind: 'not-a-string' | 'wrong-length' | 'wrong-charset' };

/**
 * FORMAT-ONLY check against the SPL published pattern (4 letters then 4 digits).
 * A passing result says nothing about whether the address actually belongs to
 * the shipment or exists in SPL records.
 */
export function checkShortAddressFormat(value: unknown): ShortAddressCheck {
  if (typeof value !== 'string') return { ok: false, kind: 'not-a-string' };
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9]{8}$/.test(trimmed)) return { ok: false, kind: 'wrong-length' };
  if (!SHORT_ADDRESS_RE.test(trimmed)) return { ok: false, kind: 'wrong-charset' };
  return { ok: true, kind: 'format-valid' };
}

export interface NationalAddressInput {
  buildingNumber?: string;
  street?: string;
  district?: string;
  city?: string;
  postalCode?: string;
  shortAddress?: string;
}

export interface NationalAddressEvaluation {
  complete: boolean;
  missingFields: Array<keyof Required<Omit<NationalAddressInput, 'shortAddress'>>>;
  shortAddressFormatOk: boolean;
}

/** Completeness flag only — presence of data, never verification of truth. */
export function evaluateNationalAddress(input: NationalAddressInput): NationalAddressEvaluation {
  const required = ['buildingNumber', 'street', 'district', 'city', 'postalCode'] as const;
  const missingFields = required.filter(field => typeof input[field] !== 'string' || input[field]!.trim() === '');
  return {
    complete: missingFields.length === 0 && checkShortAddressFormat(input.shortAddress).ok,
    missingFields: [...missingFields],
    shortAddressFormatOk: checkShortAddressFormat(input.shortAddress).ok,
  };
}

// ---------------------------------------------------------------------------
// Receipt draft (simplified tax invoice SHAPE — drafts only)
// ---------------------------------------------------------------------------

export interface ReceiptDraftInput {
  /** Invoice/e-issue date, ISO yyyy-mm-dd, real calendar date. */
  issueDate?: string;
  supplierName?: string;
  supplierAddress?: string;
  description?: string;
  /** Total amount INCLUDING VAT, SAR. */
  totalWithVatSar?: number;
  vatRatePercent?: number;
}

export interface ReceiptDraftFieldError {
  field: keyof ReceiptDraftInput;
  code: 'required-missing' | 'invalid-date' | 'impossible-date' | 'invalid-number' | 'negative';
}

export interface ReceiptDraft {
  ok: boolean;
  errors: ReceiptDraftFieldError[];
  vatRatePercent: number;
  netAmountSar?: number;
  vatValueSar?: number;
  totalWithVatSar?: number;
  disclaimerKey: 'receipt.draftDisclaimer';
}

const RECEIPT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealIsoDate(value: string): boolean {
  if (!RECEIPT_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Build a draft with derived VAT breakdown from a VAT-INCLUSIVE total:
 *   net = total / (1 + rate/100);  vat = total − net.
 * The output is draft invoice DATA for the operator's own records — it is not
 * an issued tax document and makes no compliance representation.
 */
export function buildReceiptDraft(input: ReceiptDraftInput): ReceiptDraft {
  const errors: ReceiptDraftFieldError[] = [];
  const requireText = (field: 'issueDate' | 'supplierName' | 'supplierAddress' | 'description') => {
    if (typeof input[field] !== 'string' || input[field]!.trim() === '') {
      errors.push({ field, code: 'required-missing' });
      return;
    }
    if (field === 'issueDate') {
      if (!RECEIPT_DATE_RE.test(input.issueDate!)) errors.push({ field, code: 'invalid-date' });
      else if (!isRealIsoDate(input.issueDate!)) errors.push({ field, code: 'impossible-date' });
    }
  };
  requireText('issueDate');
  requireText('supplierName');
  requireText('supplierAddress');
  requireText('description');

  const vatRatePercent = typeof input.vatRatePercent === 'number'
    && Number.isFinite(input.vatRatePercent) && input.vatRatePercent >= 0
    ? round2(input.vatRatePercent)
    : DEFAULT_VAT_RATE_PERCENT;

  let totalWithVatSar: number | undefined;
  if (typeof input.totalWithVatSar !== 'number' || !Number.isFinite(input.totalWithVatSar)) {
    errors.push({ field: 'totalWithVatSar', code: 'invalid-number' });
  } else if (input.totalWithVatSar < 0) {
    errors.push({ field: 'totalWithVatSar', code: 'negative' });
  } else {
    totalWithVatSar = round2(input.totalWithVatSar);
  }

  if (errors.length > 0 || totalWithVatSar === undefined) {
    return { ok: false, errors, vatRatePercent, disclaimerKey: 'receipt.draftDisclaimer' };
  }
  const netAmountSar = round2(totalWithVatSar / (1 + vatRatePercent / 100));
  const vatValueSar = round2(totalWithVatSar - netAmountSar);
  return {
    ok: true,
    errors: [],
    vatRatePercent,
    netAmountSar,
    vatValueSar,
    totalWithVatSar,
    disclaimerKey: 'receipt.draftDisclaimer',
  };
}

// ---------------------------------------------------------------------------
// Phase-1-shaped QR payload — TLV base64 per ZATCA QR guide [PRIMARY]
// ---------------------------------------------------------------------------

const QR_TAG_SELLER_NAME = 1;
const QR_TAG_VAT_REGISTRATION_NUMBER = 2;
const QR_TAG_TIMESTAMP = 3;
const QR_TAG_INVOICE_TOTAL_WITH_VAT = 4;
const QR_TAG_VAT_TOTAL = 5;

const ISO_Z_STAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export interface QrPayloadInput {
  sellerName: string;
  vatRegistrationNumber: string;
  /** ISO-8601 instant ending in Z, e.g. 2022-04-25T15:30:00Z. */
  timestampIsoUtc: string;
  invoiceTotalWithVat: number | string;
  vatTotal: number | string;
}

function tlvEncode(tag: number, value: string): Uint8Array {
  // Tag and Length are exactly one byte each; value is UTF-8 bytes (per guide).
  const valueBytes = new TextEncoder().encode(value);
  if (tag < 0 || tag > 255) throw new RangeError(`QR tag out of range: ${tag}`);
  if (valueBytes.length > 255) throw new RangeError('TLV value exceeds one-byte length');
  const out = new Uint8Array(2 + valueBytes.length);
  out[0] = tag;
  out[1] = valueBytes.length;
  out.set(valueBytes, 2);
  return out;
}

function toAmountString(value: number | string): string | null {
  // Guide examples always use plain decimal strings ("1000.00", "150.00").
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return num.toFixed(2);
}

export type QrPayloadResult =
  | { ok: true; base64: string }
  | { ok: false; reason: 'missing-field' | 'bad-timestamp' | 'bad-amount' | 'value-too-long' };

/**
 * Phase-1-shaped QR payload: base64(TLV(tag1..tag5)). Data-shape readiness only —
 * producing it does not make any invoice issued, reported or compliant.
 */
export function buildQrPayloadBase64(input: QrPayloadInput): QrPayloadResult {
  const sellerName = input.sellerName?.trim() ?? '';
  const vatNumber = input.vatRegistrationNumber?.trim() ?? '';
  if (sellerName === '' || vatNumber === '') return { ok: false, reason: 'missing-field' };
  if (typeof input.timestampIsoUtc !== 'string' || !ISO_Z_STAMP_RE.test(input.timestampIsoUtc)) {
    return { ok: false, reason: 'bad-timestamp' };
  }
  const total = toAmountString(input.invoiceTotalWithVat);
  const vat = toAmountString(input.vatTotal);
  if (total === null || vat === null) return { ok: false, reason: 'bad-amount' };

  try {
    const bytes = [
      tlvEncode(QR_TAG_SELLER_NAME, sellerName),
      tlvEncode(QR_TAG_VAT_REGISTRATION_NUMBER, vatNumber),
      tlvEncode(QR_TAG_TIMESTAMP, input.timestampIsoUtc),
      tlvEncode(QR_TAG_INVOICE_TOTAL_WITH_VAT, total),
      tlvEncode(QR_TAG_VAT_TOTAL, vat),
    ].reduce((acc, cur) => {
      const merged = new Uint8Array(acc.length + cur.length);
      merged.set(acc, 0);
      merged.set(cur, acc.length);
      return merged;
    }, new Uint8Array(0));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return { ok: true, base64: btoa(binary) };
  } catch {
    return { ok: false, reason: 'value-too-long' };
  }
}
