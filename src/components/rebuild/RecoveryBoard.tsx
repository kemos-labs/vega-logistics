'use client';

import { useMemo, useState } from 'react';
import { Check, Plus, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  createRecoveryEntry,
  entryAgeDays,
  RECOVERY_TARGETS,
  sortForAction,
  summarizeRecoveryBoard,
  type RecoveryEntry,
  type RecoveryStatus,
} from '@/lib/recoveryBoard';
import { FAILURE_REASON_KEYS } from '@/lib/operationsReporting';

const localeTag = (language?: string) => (language?.startsWith('ar') ? 'ar-SA-u-nu-latn' : 'en-SA');
const fmtDateMedium = (language: string, iso: string) => new Intl.DateTimeFormat(localeTag(language), { dateStyle: 'medium' }).format(new Date(`${iso}T12:00:00`));

interface Props {
  entries: RecoveryEntry[];
  setEntries: (value: RecoveryEntry[] | ((previous: RecoveryEntry[]) => RecoveryEntry[])) => void;
}

export default function RecoveryBoard({ entries, setEntries }: Props) {
  const { t, i18n } = useTranslation();
  const locale = localeTag(i18n.language);
  const summary = useMemo(() => summarizeRecoveryBoard(entries), [entries]);
  const sorted = useMemo(() => sortForAction(entries), [entries]);

  const today = new Date();
  const dateStamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [shipments, setShipments] = useState('1');
  const [reasonKey, setReasonKey] = useState<string>('');
  const [customer, setCustomer] = useState('');
  const [owner, setOwner] = useState('');

  const addEntry = () => {
    const count = Math.max(1, Math.round(Number(shipments) || 0));
    if (count <= 0) return;
    const entry = createRecoveryEntry({
      createdAt: dateStamp,
      shipments: count,
      reasonKey: reasonKey ? reasonKey as RecoveryEntry['reasonKey'] : undefined,
      customer: customer.trim() || undefined,
      owner: owner.trim(),
    });
    setEntries(rows => [entry, ...rows]);
    setShipments('1');
    setCustomer('');
  };

  const setStatus = (id: string, status: RecoveryStatus) => {
    setEntries(rows => rows.map(row => row.id === id
      ? { ...row, status, resolvedAt: status === 'pending' ? undefined : new Date().toISOString() }
      : row));
  };
  const removeRow = (id: string) => setEntries(rows => rows.filter(row => row.id !== id));

  const statusChip = (status: RecoveryStatus) => (
    <span className={`bm-recovery-status is-${status}`}>{t(`businessModel.recovery.status${status === 'written_off' ? 'WrittenOff' : status.charAt(0).toUpperCase() + status.slice(1)}`)}</span>
  );

  return <>
    <div className="bm-page-head bm-summary-head">
      <div>
        <h1>{t('businessModel.recovery.recovery')}</h1>
        <p>{t('businessModel.recovery.recoveryDesc')}</p>
      </div>
      <div className="bm-recovery-chips" aria-live="polite">
        <span className="bm-rag bm-rag--amber">{t('businessModel.recovery.chipPending', { entries: summary.pendingEntries, shipments: summary.pendingShipments })}</span>
        <span className="bm-rag bm-rag--green">{t('businessModel.recovery.chipCloseRate', { rate: summary.closeRatePercent })}</span>
        {summary.oldestPendingDays > 0 && <span className="bm-rag bm-rag--red">{t('businessModel.recovery.chipOldest', { days: summary.oldestPendingDays })}</span>}
        {summary.overdueSharePercent > 0 && <span className="bm-rag bm-rag--amber">{t('businessModel.report.chipOverdue', { percent: summary.overdueSharePercent, days: RECOVERY_TARGETS.overdueDays })}</span>}
        <small className="bm-target-hint">{t('businessModel.report.targetLine', { rate: RECOVERY_TARGETS.closeRatePercent })}</small>
      </div>
    </div>

    <section className="bm-panel bm-form-card bm-recovery-add">
      <h2>{t('businessModel.recovery.addEntry')}</h2>
      <div className="bm-form-grid">
        <label className="bm-field"><span>{t('businessModel.recovery.shipmentsCount')}</span><div><input aria-label={t('businessModel.recovery.shipmentsCount')} type="number" min="1" inputMode="numeric" value={shipments} onChange={event => setShipments(event.target.value)} /><em>📦</em></div></label>
        <label className="bm-field"><span>{t('businessModel.recovery.reason')}</span><select aria-label={t('businessModel.recovery.reason')} value={reasonKey} onChange={event => setReasonKey(event.target.value)}>
          <option value="">—</option>
          {FAILURE_REASON_KEYS.map(key => <option key={key} value={key}>{t(`businessModel.report.${key}`)}</option>)}
        </select></label>
        <label className="bm-field"><span>{t('businessModel.recovery.customerName')}</span><div><input aria-label={t('businessModel.recovery.customerName')} value={customer} onChange={event => setCustomer(event.target.value)} /></div></label>
        <label className="bm-field"><span>{t('businessModel.recovery.ownerName')}</span><div><input aria-label={t('businessModel.recovery.ownerName')} value={owner} onChange={event => setOwner(event.target.value)} /></div></label>
      </div>
      <button className="bm-primary" onClick={addEntry}><Plus size={15} /> {t('businessModel.recovery.addEntry')}</button>
    </section>

    {sorted.length === 0
      ? <p className="bm-empty-note">{t('businessModel.recovery.emptyBoard')}</p>
      : <div className="bm-table-wrap">
          <div className="bm-table bm-recovery-table">
            <div className="bm-table-head">
              <span>{t('businessModel.recovery.thCreated')}</span>
              <span>{t('businessModel.recovery.thShipments')}</span>
              <span>{t('businessModel.recovery.thReason')}</span>
              <span>{t('businessModel.recovery.thCustomer')}</span>
              <span>{t('businessModel.recovery.thOwner')}</span>
              <span>{t('businessModel.recovery.thStatus')}</span>
              <span />
            </div>
            {sorted.map(entry => {
              const ageDays = entry.status === 'pending' ? entryAgeDays(entry) : 0;
              return (
              <div className={`bm-table-row bm-recovery-row ${entry.status !== 'pending' ? 'is-closed' : ''} ${ageDays > RECOVERY_TARGETS.overdueDays ? 'is-hot' : ''}`} key={entry.id}>
                <strong>{fmtDateMedium(locale, entry.createdAt)}{ageDays > 0 && entry.status === 'pending' && <em className="bm-age">{ageDays}d</em>}</strong>
                <span className="num">{entry.shipments}</span>
                <span>{entry.reasonKey ? t(`businessModel.report.${entry.reasonKey}`) : '—'}</span>
                <span>{entry.customer ?? '—'}</span>
                <span>{entry.owner || '—'}</span>
                <span>{statusChip(entry.status)}</span>
                <div className="bm-recovery-actions">
                  {entry.status === 'pending'
                    ? <><button title={t('businessModel.recovery.markRecovered')} aria-label={t('businessModel.recovery.markRecovered')} onClick={() => setStatus(entry.id, 'recovered')}><Check size={14} /></button>
                       <button title={t('businessModel.recovery.writeOff')} aria-label={t('businessModel.recovery.writeOff')} onClick={() => setStatus(entry.id, 'written_off')}><Undo2 size={14} /></button></>
                    : <button title={t('businessModel.recovery.reopen')} aria-label={t('businessModel.recovery.reopen')} onClick={() => setStatus(entry.id, 'pending')}><RotateCcw size={14} /></button>}
                  <button className="danger" title={t('businessModel.recovery.removeRow')} aria-label={t('businessModel.recovery.removeRow')} onClick={() => removeRow(entry.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              );})}
          </div>
        </div>}
  </>;
}
