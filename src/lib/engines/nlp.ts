// VEGA Logistics OS — NLP & Document Intelligence Engine
// Multilingual (EN/AR), ZATCA-aware invoice extraction, semantic search, RAG chat.

import { DocumentType,
  NLPDocument,
  NLPDocumentField,
  NLPDocumentEntity,
  NLPSentiment,
  NLPChatMessage } from '../types2026';

const SAUDI_CITIES = ['الرياض', 'جدة', 'الدمام', 'مكة', 'المدينة', 'الطائف', 'الخبر', 'تبوك'];

const ZATCA_VAT_RATE = 0.15; // 15%

interface ExtractionPattern {
  type: 'amount' | 'date' | 'vat_number' | 'cr_number' | 'phone' | 'email' | 'address';
  regex: RegExp;
  confidence: number;
  normalizer?: (m: string) => string;
}

const PATTERNS: ExtractionPattern[] = [
  {
    type: 'amount',
    regex: /(?:SAR|ر\.س|ر.س|Total|المجموع)\s*([0-9][0-9,]*\.?\d{0,2})/gi,
    confidence: 0.92,
    normalizer: (m) => m.replace(/,/g, ''),
  },
  {
    type: 'vat_number',
    regex: /\b3\d{14}\b/g,
    confidence: 0.97,
  },
  {
    type: 'cr_number',
    regex: /\b1\d{9}\b/g,
    confidence: 0.85,
  },
  {
    type: 'phone',
    regex: /\+?966?\s?5\d{8}|\b05\d{8}\b/g,
    confidence: 0.9,
  },
  {
    type: 'email',
    regex: /[\w.+-]+@[\w-]+\.[\w.-]+/g,
    confidence: 0.98,
  },
  {
    type: 'date',
    regex: /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    confidence: 0.88,
  },
];

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function detectDocumentType(text: string, filename: string): DocumentType {
  const lower = text.toLowerCase() + ' ' + filename.toLowerCase();
  if (lower.includes('bol') || lower.includes('bill of lading') || lower.includes('بوليصة')) return 'bol';
  if (lower.includes('invoice') || lower.includes('فاتورة')) return 'invoice';
  if (lower.includes('customs') || lower.includes('جمارك')) return 'customs_declaration';
  if (lower.includes('pod') || lower.includes('proof of delivery') || lower.includes('إثبات')) return 'pod';
  if (lower.includes('zatca') || lower.includes('ضريبة') || lower.includes('vat')) return 'zatca_tax_invoice';
  if (lower.includes('delivery note') || lower.includes('سلمت')) return 'delivery_note';
  if (lower.includes('purchase order') || lower.includes('po') || lower.includes('طلب شراء')) return 'purchase_order';
  return 'invoice';
}

export function detectLanguage(text: string): 'en' | 'ar' | 'mixed' {
  const arCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const enCount = (text.match(/[a-zA-Z]/g) || []).length;
  if (arCount === 0) return 'en';
  if (enCount === 0) return 'ar';
  return arCount > enCount ? 'ar' : 'mixed';
}

export function extractFields(text: string): NLPDocumentField[] {
  const fields: NLPDocumentField[] = [];
  PATTERNS.forEach((p) => {
    const matches = text.matchAll(p.regex);
    for (const m of matches) {
      fields.push({
        name: p.type,
        value: p.normalizer ? p.normalizer(m[0]) : m[0],
        confidence: p.confidence,
      });
    }
  });
  return fields;
}

export function extractEntities(text: string): NLPDocumentEntity[] {
  const out: NLPDocumentEntity[] = [];

  PATTERNS.forEach((p) => {
    const matches = text.matchAll(p.regex);
    for (const m of matches) {
      out.push({
        type: p.type,
        text: m[0],
        normalized: p.normalizer ? p.normalizer(m[0]) : m[0],
        confidence: p.confidence,
      });
    }
  });

  SAUDI_CITIES.forEach((c) => {
    if (text.includes(c)) {
      out.push({ type: 'address', text: c, confidence: 0.95 });
    }
  });

  return out;
}

export function validateZATCAInvoice(doc: NLPDocument): { ok: boolean; issues: string[]; vatAmount: number } {
  const issues: string[] = [];
  const subtotal = doc.fields.find((f) => f.name === 'amount');
  const vat = doc.fields.find((f) => f.name === 'vat_number');
  const subtotalVal = subtotal ? parseFloat(subtotal.value) : 0;
  const vatAmount = subtotalVal * ZATCA_VAT_RATE;

  if (!vat) issues.push('Missing ZATCA VAT registration number (15-digit, starts with 3).');
  if (!subtotal) issues.push('Missing subtotal amount.');
  if (doc.type !== 'zatca_tax_invoice' && doc.type !== 'invoice') {
    issues.push(`Document type ${doc.type} should be ZATCA tax invoice.`);
  }
  if (doc.language === 'en' && !doc.fields.find((f) => f.name === 'vat_number')) {
    issues.push('English invoice missing mandatory VAT number.');
  }

  return { ok: issues.length === 0, issues, vatAmount: Math.round(vatAmount * 100) / 100 };
}

export function extractDocument(
  id: string,
  filename: string,
  text: string,
  seed: number = Date.now()
): NLPDocument {
  const r = rng(seed);
  const type = detectDocumentType(text, filename);
  const language = detectLanguage(text);
  const fields = extractFields(text);
  const entities = extractEntities(text);
  const status = r() > 0.1 ? 'extracted' : 'processing';
  const subtotalField = fields.find((f) => f.name === 'amount');
  const extractedAmount = subtotalField ? parseFloat(subtotalField.value) : 0;
  const vatAmount = extractedAmount * ZATCA_VAT_RATE;

  const tempDoc: NLPDocument = {
    id,
    type,
    filename,
    language,
    uploadedAt: new Date().toISOString(),
    pages: Math.max(1, Math.floor(text.length / 1500)),
    status,
    fields,
    entities,
    validationIssues: [],
    extractedAmount,
    vatAmount: Math.round(vatAmount * 100) / 100,
  };
  if (type === 'zatca_tax_invoice' || type === 'invoice') {
    const validation = validateZATCAInvoice(tempDoc);
    tempDoc.validationIssues = validation.issues;
    tempDoc.vatAmount = validation.vatAmount;
    tempDoc.status = validation.ok ? 'validated' : status;
  }

  return tempDoc;
}

export function analyzeSentiment(text: string, language: 'en' | 'ar' = 'en'): NLPSentiment {
  const positiveEn = ['great', 'excellent', 'good', 'amazing', 'fast', 'reliable', 'happy', 'perfect'];
  const negativeEn = ['bad', 'slow', 'late', 'broken', 'lost', 'damaged', 'angry', 'worst', 'never'];
  const positiveAr = ['ممتاز', 'جيد', 'سريع', 'رائع', 'سعيد'];
  const negativeAr = ['سيء', 'بطيء', 'متأخر', 'مكسور', 'فقدت', 'غاضب', 'أسوأ'];

  const lower = text.toLowerCase();
  let score = 0;
  let count = 0;
  (language === 'en' ? positiveEn : positiveAr).forEach((w) => {
    if (lower.includes(w)) {
      score += 1;
      count++;
    }
  });
  (language === 'en' ? negativeEn : negativeAr).forEach((w) => {
    if (lower.includes(w)) {
      score -= 1;
      count++;
    }
  });

  const norm = count === 0 ? 0 : score / count;
  return {
    text,
    score: Math.max(-1, Math.min(1, norm)),
    magnitude: count,
    language,
    intent: count > 0 ? (norm > 0.2 ? 'positive_feedback' : norm < -0.2 ? 'complaint' : 'neutral') : 'unknown',
  };
}

// Knowledge base for RAG-style answers
const KB: { q: string[]; a: string; source: string }[] = [
  {
    q: ['otif', 'on time', 'delivery rate', 'معدل التسليم'],
    a: 'OTIF (On-Time In-Full) is the percentage of orders delivered complete and on time. Industry benchmark is 92%.',
    source: 'kpi_definitions.md',
  },
  {
    q: ['ghost growth', 'نمو شبحي'],
    a: 'Ghost Growth = revenue grows but operational health declines. We track this via revenue-vs-margin divergence, fleet-vs-density imbalance, fuel cost growth, and failure rates.',
    source: 'ghost_growth_engine.md',
  },
  {
    q: ['zatca', 'vat', 'ضريبة', 'فواتير'],
    a: 'ZATCA requires a 15% VAT line on every B2B/B2C invoice plus a 15-digit VAT number starting with "3". Our NLP engine validates this on upload.',
    source: 'zatca_compliance.md',
  },
  {
    q: ['fleet utilization', 'استغلال الأسطول'],
    a: 'Fleet utilization = (deliveries per vehicle) / (theoretical max deliveries). Healthy range is 65-85%.',
    source: 'kpi_definitions.md',
  },
  {
    q: ['saudi', 'aramco', 'السعودية', 'أرامكو'],
    a: 'Saudi logistics is dominated by Jeddah Islamic Port (60% of imports) and Dammam. Fuel is subsidized (0.67 SAR/L for 91 octane). The Saudi Vision 2030 logistics target is 4.5% of GDP.',
    source: 'saudi_logistics_overview.md',
  },
];

export function ragAnswer(question: string): NLPChatMessage {
  const lower = question.toLowerCase();
  let best = { idx: -1, score: 0 };
  KB.forEach((entry, i) => {
    entry.q.forEach((k) => {
      if (lower.includes(k)) {
        const s = k.length;
        if (s > best.score) best = { idx: i, score: s };
      }
    });
  });

  if (best.idx === -1) {
    return {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: 'I do not have a specific answer for that. Try asking about OTIF, Ghost Growth, ZATCA, or fleet utilization.',
      timestamp: new Date().toISOString(),
      intent: 'fallback',
      confidence: 0.3,
    };
  }

  const entry = KB[best.idx];
  return {
    id: `msg_${Date.now()}`,
    role: 'assistant',
    content: entry.a,
    timestamp: new Date().toISOString(),
    citations: [{ source: entry.source, snippet: entry.a.slice(0, 100) + '…' }],
    intent: 'qa',
    confidence: Math.min(0.99, 0.5 + best.score / 20),
  };
}

export interface NLPOverview {
  documentsProcessed: number;
  totalAmount: number;
  totalVAT: number;
  validationPassRate: number;
  topIntents: { intent: string; count: number }[];
  languages: { en: number; ar: number; mixed: number };
}

export function generateNLPOverview(seed: number = Date.now()): NLPOverview {
  const r = rng(seed);
  const docs = Math.floor(r() * 50) + 30;
  const totalAmount = Math.round(r() * 500000 + 100000);
  const totalVAT = Math.round(totalAmount * ZATCA_VAT_RATE);
  const passRate = 0.7 + r() * 0.28;
  return {
    documentsProcessed: docs,
    totalAmount,
    totalVAT,
    validationPassRate: Math.round(passRate * 1000) / 1000,
    topIntents: [
      { intent: 'invoice_extraction', count: Math.floor(docs * 0.45) },
      { intent: 'bol_extraction', count: Math.floor(docs * 0.20) },
      { intent: 'complaint', count: Math.floor(docs * 0.10) },
      { intent: 'feedback', count: Math.floor(docs * 0.15) },
      { intent: 'qa', count: Math.floor(docs * 0.10) },
    ],
    languages: { en: Math.floor(docs * 0.55), ar: Math.floor(docs * 0.30), mixed: Math.floor(docs * 0.15) },
  };
}
