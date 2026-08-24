// VEGA — Compliance-lite workspace (Release R5).
// Data readiness, not compliance representation: National Address completeness
// flag + Short Address FORMAT-ONLY check (SPL [PRIMARY]); draft receipt with
// configurable VAT (default 15%, VAT Law Art.2 [PRIMARY]) and a Phase-1-shaped
// QR TLV payload (ZATCA QR guide [PRIMARY]). Everything offline, local-only.
// Claim law (AGENTS.md R8): no "ZATCA compliant" / "verified" wording anywhere.

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildQrPayloadBase64,
  buildReceiptDraft,
  checkShortAddressFormat,
  evaluateNationalAddress,
  type ReceiptDraft,
} from '@/lib/compliance';

type AddrDraft = Record<'buildingNumber' | 'street' | 'district' | 'city' | 'postalCode' | 'shortAddress', string>;
const EMPTY_ADDR: AddrDraft = { buildingNumber: '', street: '', district: '', city: '', postalCode: '', shortAddress: '' };

type RecDraft = Record<'issueDate' | 'supplierName' | 'supplierAddress' | 'vatNumber' | 'description' | 'totalWithVatSar', string>;
const EMPTY_REC: RecDraft = { issueDate: '', supplierName: '', supplierAddress: '', vatNumber: '', description: '', totalWithVatSar: '' };

function fmtSar(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function ComplianceLiteView() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [addr, setAddr] = useState<AddrDraft>(EMPTY_ADDR);
  const [rec, setRec] = useState<RecDraft>(EMPTY_REC);

  const addrEval = useMemo(() => evaluateNationalAddress(addr), [addr]);
  const shortCheck = checkShortAddressFormat(addr.shortAddress);

  const recInput = {
    issueDate: rec.issueDate || undefined,
    supplierName: rec.supplierName || undefined,
    supplierAddress: rec.supplierAddress || undefined,
    description: rec.description || undefined,
    totalWithVatSar: rec.totalWithVatSar === '' ? undefined : Number(rec.totalWithVatSar),
  };
  const draft: ReceiptDraft | null = useMemo(
    () => (rec.issueDate || rec.supplierName || rec.description || rec.totalWithVatSar ? buildReceiptDraft(recInput) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rec],
  );

  const qr = useMemo(() => (draft?.ok && draft.totalWithVatSar !== undefined && rec.vatNumber.trim() !== '' ? buildQrPayloadBase64({
    sellerName: rec.supplierName,
    vatRegistrationNumber: rec.vatNumber.trim(),
    timestampIsoUtc: `${rec.issueDate}T00:00:00Z`,
    invoiceTotalWithVat: draft.totalWithVatSar,
    vatTotal: draft.vatValueSar ?? 0,
  }) : null), [draft, rec]);

  const field = (label: string, key: keyof AddrDraft | keyof RecDraft, setter: (fn: (prev: never) => never) => void, current: string) => (
    <input
      className="bm-input"
      aria-label={label}
      placeholder={label}
      value={current}
      onChange={e => setter((prev: never) => ({ ...(prev as object), [key]: e.target.value }) as never)}
    />
  );

  return (
    <section className="bm-panel" data-testid="compliance-lite">
      <div className="bm-panel-head">
        <div>
          <span>{t('businessModel.compliance.tag')}</span>
          <h2>{t('businessModel.compliance.title')}</h2>
          <p>{t('businessModel.compliance.desc')}</p>
        </div>
      </div>

      <div className="bm-import-note" role="note">{t('businessModel.compliance.disclaimer')}</div>

      <h3>{t('businessModel.compliance.addressTitle')}</h3>
      <div className="bm-kpis">
        {(['buildingNumber', 'street', 'district', 'city', 'postalCode', 'shortAddress'] as const).map(key =>
          field(t(`businessModel.compliance.fields.${key}`), key, setAddr as never, addr[key]),
        )}
      </div>
      <p className="bm-inline-total" data-testid="address-status">
        {addrEval.complete
          ? <span className="ok">{t('businessModel.compliance.addressComplete')}</span>
          : <span className="text-bad">{t('businessModel.compliance.addressIncomplete', { fields: addrEval.missingFields.map(f => t(`businessModel.compliance.fields.${f}`)).join(' · ') })}</span>}
        {' · '}
        {shortCheck.ok
          ? t('businessModel.compliance.shortOk')
          : t('businessModel.compliance.shortBad')}
        <small> · {t('businessModel.compliance.formatOnly')}</small>
      </p>

      <h3>{t('businessModel.compliance.receiptTitle')}</h3>
      <div className="bm-kpis">
        {(['issueDate', 'supplierName', 'supplierAddress', 'vatNumber', 'description'] as const).map(key =>
          field(t(`businessModel.compliance.fields.${key}`), key, setRec as never, rec[key]),
        )}
        <input
          className="bm-input"
          aria-label={t('businessModel.compliance.fields.totalWithVatSar')}
          placeholder={t('businessModel.compliance.fields.totalWithVatSar')}
          inputMode="decimal"
          value={rec.totalWithVatSar}
          onChange={e => setRec(prev => ({ ...prev, totalWithVatSar: e.target.value }))}
        />
      </div>

      {draft && !draft.ok && (
        <ul className="bm-import-warning" role="alert">
          {draft.errors.map((err, idx) => <li key={idx}>{t('businessModel.compliance.fieldError', { field: t(`businessModel.compliance.fields.${err.field}`) })}</li>)}
        </ul>
      )}

      {draft?.ok && (
        <div className="bm-panel" style={{ marginTop: 12 }} data-testid="receipt-draft">
          <div className="bm-table bm-table-head">
            <span>{t('businessModel.compliance.rIssueDate')}</span>
            <span>{t('businessModel.compliance.rNet')}</span>
            <span>{t('businessModel.compliance.rVat', { rate: draft.vatRatePercent })}</span>
            <span>{t('businessModel.compliance.rTotal')}</span>
          </div>
          <div className="bm-table-row">
            <strong>{rec.issueDate}</strong>
            <span>{fmtSar(draft.netAmountSar!, locale)}</span>
            <span>{fmtSar(draft.vatValueSar!, locale)}</span>
            <strong>{fmtSar(draft.totalWithVatSar!, locale)}</strong>
          </div>
          {qr?.ok && (
            <p style={{ marginTop: 8 }}>
              <small>{t('businessModel.compliance.qrLabel')}:</small><br />
              <code data-testid="qr-payload">{qr.base64}</code>
            </p>
          )}
          <p className="bm-import-note">{t('businessModel.receipt.draftDisclaimer')}</p>
        </div>
      )}
    </section>
  );
}
