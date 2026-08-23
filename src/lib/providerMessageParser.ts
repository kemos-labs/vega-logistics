// VEGA — Arabic WhatsApp provider-message parser (P1, contract H).
//
// Deterministic, pure, offline. No AI, no network. Input is the free-text
// daily summary a provider sends on WhatsApp; output is a PREVIEW model the
// operator reviews before anything touches a DailyRecord.
//
// Grammar (informal):
//   message   := greeting* field+ chatter*
//   field     := vehicleTerm NUM | plateTerm NUM | loadTerm NUM
//              | deliverTerm NUM | returnTerm NUM
//   name      := free text run before the FIRST field term (letters only,
//                else ambiguous → dropped with warning)
//   NUM       : Latin digits or Arabic-Indic (٠-٩ / ۰-۹) normalized first;
//               optional separators (= : - ، , .) and spaces around it.
//
// Term dictionary includes spelling variants operators actually send:
//   vehicle:  سيارة سياره            plate: لوحة لوحه
//   loaded : تحميل محمل              returned: راجع مرتجع
//   delivered: توصيل تم التوصيل تمت التوصيل
//
// Safety rules:
//   * parsing NEVER mutates any DailyRecord — it only produces a preview;
//   * missing ANY of loaded/delivered/returned ⇒ rejected (no phantom zeros);
//   * totals are NOT auto-balanced: reconcile() reports mismatch magnitude
//     and the UI blocks confirmation until the operator fixes the source.

export interface ProviderPreview {
  providerName?: string;
  carNumber?: string;
  plateNumber?: string;
  loaded: number;
  delivered: number;
  returned: number;
  sourceText: string;
  warnings: string[];
}

export type ParseResult =
  | { ok: true; preview: ProviderPreview }
  | { ok: false; error: 'empty' | 'missing-required'; warnings: string[] };

export interface Reconciliation {
  balanced: boolean;
  /** loaded − (delivered + returned); 0 when balanced. */
  difference: number;
}

const ARABIC_DIGITS = /[٠-٩]/g;
const PERSIAN_DIGITS = /[۰-۹]/g;

/** Latin-digit normalization across Arabic-Indic and Persian variants. */
export function normalizeDigits(text: string): string {
  return text
    .replace(ARABIC_DIGITS, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(PERSIAN_DIGITS, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

interface TermSpec {
  slot: 'car' | 'plate' | 'loaded' | 'delivered' | 'returned';
  pattern: RegExp;
}

const TERMS: TermSpec[] = [
  { slot: 'car', pattern: /سيارة|سياره/g },
  { slot: 'plate', pattern: /لوحة|لوحه/g },
  { slot: 'loaded', pattern: /محمل|تحميل/g },
  // longest variants first so 'تم التوصيل' is not eaten by bare 'توصيل'
  { slot: 'delivered', pattern: /تم\s*التوصيل|تمت\s*التوصيل|توصيل/g },
  { slot: 'returned', pattern: /مرتجع|راجع/g },
];

const SEP = '[\\s=:،,.;\\-]*';

function extractNumberAfter(text: string, from: number): number | null {
  const rest = text.slice(from);
  const match = new RegExp(`^${SEP}(\\d{1,5})`).exec(rest);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Parse a provider WhatsApp message into a reviewable preview.
 * Pure: identical input ⇒ identical output; no external effects.
 */
export function parseProviderMessage(input: string): ParseResult {
  const warnings: string[] = [];
  const original = input ?? '';
  if (!original.trim()) return { ok: false, error: 'empty', warnings };

  const text = normalizeDigits(original);

  // locate every term occurrence (first occurrence per slot wins)
  const hits = new Map<ProviderPreview extends never ? never : TermSpec['slot'], Array<{ index: number; term: string }>>();
  for (const spec of TERMS) {
    spec.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    const found: Array<{ index: number; term: string }> = [];
    while ((match = spec.pattern.exec(text)) !== null) {
      found.push({ index: match.index, term: match[0] });
      if (match.index === spec.pattern.lastIndex) spec.pattern.lastIndex += 1; // zero-length guard
    }
    if (found.length > 0) hits.set(spec.slot, found);
  }

  // A term MENTION without an adjacent number is ambiguous on its own —
  // values are validated after extraction below (no fabricated zeros).

  const numbers: Record<'car' | 'plate' | 'loaded' | 'delivered' | 'returned', number | undefined> = {
    car: undefined, plate: undefined, loaded: undefined, delivered: undefined, returned: undefined,
  };

  let firstFieldIndex = Number.MAX_SAFE_INTEGER;
  for (const [slot, occurrences] of hits) {
    let assigned = false;
    for (const occurrence of occurrences) {
      firstFieldIndex = Math.min(firstFieldIndex, occurrence.index);
      if (assigned) continue;
      const num = extractNumberAfter(text, occurrence.index + occurrence.term.length);
      const specSlot = slot as 'car' | 'plate';
      if (num !== null && (slot === 'loaded' || slot === 'delivered' || slot === 'returned')) {
        numbers[slot] = num;
        assigned = true;
      } else if (num !== null && (slot === 'car' || slot === 'plate')) {
        numbers[specSlot] = num;
        assigned = true;
      }
    }
    if (!assigned && (slot === 'car' || slot === 'plate')) {
      warnings.push(`unparsed:${slot}`);
    }
  }

  const loaded = numbers.loaded;
  const delivered = numbers.delivered;
  const returned = numbers.returned;
  if (loaded === undefined || delivered === undefined || returned === undefined) {
    return { ok: false, error: 'missing-required', warnings };
  }

  // provider/driver name: free-text run BEFORE the first field term
  let providerName: string | undefined;
  if (firstFieldIndex > 0) {
    const candidate = normalizeDigits(original).slice(0, firstFieldIndex).replace(/[\s=:،,.;\-]+$/u, '').trim();
    if (candidate.length >= 2 && candidate.length <= 60) {
      if (/[\u0600-\u06FFa-zA-Z]/.test(candidate)) {
        providerName = candidate.replace(/\s+/g, ' ');
      } else {
        warnings.push('ambiguous-name');
      }
    } else if (candidate.length > 0) {
      warnings.push('ambiguous-name');
    }
  } else {
    warnings.push('name-missing');
  }
  if (!providerName) providerName = undefined;

  const preview: ProviderPreview = {
    ...(providerName ? { providerName } : {}),
    ...(numbers.car !== undefined ? { carNumber: String(numbers.car) } : {}),
    ...(numbers.plate !== undefined ? { plateNumber: String(numbers.plate) } : {}),
    loaded,
    delivered,
    returned,
    sourceText: original.trim(),
    warnings,
  };
  return { ok: true, preview };
}

/**
 * Totals reconciliation. The parser never assumes returned ≈ all failures —
 * when loaded ≠ delivered + returned the gap is surfaced verbatim and the
 * caller must block confirmation until the operator resolves it.
 */
export function reconcile(preview: Pick<ProviderPreview, 'loaded' | 'delivered' | 'returned'>): Reconciliation {
  const difference = preview.loaded - (preview.delivered + preview.returned);
  return { balanced: difference === 0, difference };
}

// ══════════ Confirmation mapping (contract H-6) ══════════

import type { DailyRecord } from '@/lib/operationsReporting';

/**
 * Build the reviewed DailyRecord from a reconciled preview. Only the
 * reviewed/reconciled fields are written — every unrelated field already on
 * the existing record (fuel cash, notes, POD, payments…) is preserved
 * byte-for-byte. Pure; caller decides persistence.
 */
export function applyPreviewToRecord(
  existing: DailyRecord | undefined,
  preview: ProviderPreview,
  date: string,
  nowIso: string,
): DailyRecord {
  const carried = isPlainObject(existing) ? { ...existing } : {};
  const next = {
    ...carried,
    date,
    completedShipments: preview.delivered, // توصيل only
    failedShipments: preview.returned,     // راجع only — never auto-balanced
    updatedAt: nowIso,
  } as DailyRecord;
  if (preview.providerName) next.driverName = preview.providerName;
  if (preview.carNumber) next.carNumber = preview.carNumber;
  if (preview.plateNumber) next.plateNumber = preview.plateNumber;
  return pruneUndefinedLike(next);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pruneUndefinedLike<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => pruneUndefinedLike(item)) as T;
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = v;
    return out as T;
  }
  return value;
}
