// VEGA — Guided evening close (Release R4-B).
// One screen: stop outcomes → shipment reconciliation → failure reasons →
// COD close → draft/reconciled/reopen. Transactional across daily+stops+
// recovery keys; React state moves only after storage success.

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { commitBundle } from '@/lib/backup';
import {
  applyCloseToDailyRecord, applyStopOutcome, buildCloseDraft,
  buildRecoveryEntriesForStops, calculateCodClose, isDefinitiveDailyRecord,
  reconcileShipmentTotals, summarizeStopOutcomes, validateCloseDraft,
} from '@/lib/eveningClose';
import { FAILURE_REASON_KEYS, toDateString, type DailyRecord } from '@/lib/operationsReporting';
import type { RecoveryEntry } from '@/lib/recoveryBoard';
import { normalizeDigits } from '@/lib/providerMessageParser';
import type { StopRecord } from '@/lib/stops';
import type { FailureReasonKey } from '@/lib/operationsReporting';

type Outcome = 'delivered' | 'returned' | 'pending' | 'failed';

export function EveningCloseView({ stops, setStops, dailyRecords, setDailyRecords, recoveryEntries, setRecoveryEntries }: {
  date?: string;
  stops: StopRecord[];
  setStops: (value: StopRecord[] | ((prev: StopRecord[]) => StopRecord[])) => void;
  dailyRecords: Record<string, DailyRecord>;
  setDailyRecords: (value: Record<string, DailyRecord> | ((prev: Record<string, DailyRecord>) => Record<string, DailyRecord>)) => void;
  recoveryEntries: RecoveryEntry[];
  setRecoveryEntries: (value: RecoveryEntry[] | ((prev: RecoveryEntry[]) => RecoveryEntry[])) => void;
}) {
  const { t, i18n } = useTranslation();
  const S = 'businessModel.close.';
  const ar = i18n.language === 'ar';
  const fmt = (value: number) => new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US').format(value);

  const [date, setDate] = useState(() => toDateString(new Date()));
  const dayStops = useMemo(() => stops.filter(stop => stop.operationDate === date), [stops, date]);
  const existing = dailyRecords[date];
  // Form state RESETS from the selected date's record — switching dates must
  // never leak numbers across operation days.
  const [loaded, setLoaded] = useState(String(existing?.loadedShipments ?? ''));
  const [codCollected, setCodCollected] = useState(existing?.cashCollectedSar === undefined ? '' : String(existing.cashCollectedSar));
  const [codRemitted, setCodRemitted] = useState(existing?.cashRemittedSar === undefined ? '' : String(existing.cashRemittedSar));
  const [codRemittedOn, setCodRemittedOn] = useState(existing?.codRemittedOn ?? '');
  const [codAdjustNote, setCodAdjustNote] = useState(existing?.codAdjustmentNote ?? '');
  const [codExpectedManual, setCodExpectedManual] = useState(existing?.codExpectedSar === undefined || existing?.codExpectedSar === codDefaultFor(dayStops) ? '' : String(existing.codExpectedSar));
  const [fuel, setFuel] = useState(existing?.fuelCost === undefined ? '' : String(existing.fuelCost));
  const [drivers, setDrivers] = useState(existing?.driversPresent === undefined ? '' : String(existing.driversPresent));
  const changeDate = (next: string) => {
    setDate(next);
    const rec = dailyRecords[next];
    setLoaded(String(rec?.loadedShipments ?? ''));
    setCodCollected(rec?.cashCollectedSar === undefined ? '' : String(rec.cashCollectedSar));
    setCodRemitted(rec?.cashRemittedSar === undefined ? '' : String(rec.cashRemittedSar));
    setCodRemittedOn(rec?.codRemittedOn ?? '');
    setCodAdjustNote(rec?.codAdjustmentNote ?? '');
    setFuel(rec?.fuelCost === undefined ? '' : String(rec.fuelCost));
    setDrivers(rec?.driversPresent === undefined ? '' : String(rec.driversPresent));
    setMessage(''); setReopenAsk(false); setPendingOutcome(null);
  };
  const [message, setMessage] = useState('');
  const [reopenAsk, setReopenAsk] = useState(false);
  const [pendingOutcome, setPendingOutcome] = useState<{ stop: StopRecord; outcome: Outcome } | null>(null);
  const [reasonFor, setReasonFor] = useState<string>('');

  const summary = useMemo(() => summarizeStopOutcomes(dayStops), [dayStops]);
  const loadedNum = loaded.trim() === '' ? Number.NaN : Number(normalizeDigits(loaded));
  const recon = reconcileShipmentTotals(
    Number.isFinite(loadedNum) ? loadedNum : 0,
    summary.delivered, summary.returned, summary.pending,
  );
  const collectedNum = codCollected.trim() === '' ? 0 : Number(normalizeDigits(codCollected));
  const remittedNum = codRemitted.trim() === '' ? 0 : Number(normalizeDigits(codRemitted));
  const manualExpected = codExpectedManual.trim() === '' ? undefined : Number(normalizeDigits(codExpectedManual));
  let cod: ReturnType<typeof calculateCodClose> | null = null;
  let codInvalid = (codCollected.trim() !== '' && !Number.isFinite(collectedNum)) || (codRemitted.trim() !== '' && !Number.isFinite(remittedNum)) || collectedNum < 0 || remittedNum < 0
    || (manualExpected !== undefined && (!Number.isFinite(manualExpected) || manualExpected < 0));
  if (!codInvalid) {
    try {
      cod = calculateCodClose({
        deliveredStops: dayStops.filter(stop => stop.status === 'delivered'),
        collectedSar: collectedNum, remittedSar: remittedNum,
        manualExpectedSar: manualExpected, adjustmentNote: codAdjustNote,
      });
    } catch {
      codInvalid = true; // manual adjustment without note
    }
  }

  const fuelNum = fuel.trim() === '' ? 0 : Number(normalizeDigits(fuel));
  const driversNum = drivers.trim() === '' ? 0 : Number(normalizeDigits(drivers));
  const validation = validateCloseDraft(
    { ...(existing ?? recordSkeleton(date)), loadedShipments: recon.loaded, completedShipments: summary.delivered, returnedShipments: summary.returned, pendingShipments: summary.pending, cashCollectedSar: collectedNum, cashRemittedSar: remittedNum, codExpectedSar: cod?.expectedSar ?? 0, date },
    dayStops,
  );
  const codWarnings = cod && cod.uncollectedSar > 0 ? ['cod-uncollected'] : [];
  const canReconcile = validation.ok && !codInvalid && Number.isFinite(loadedNum);
  const isDraft = existing?.closeStatus === 'draft';
  const isReconciled = existing?.closeStatus === 'reconciled';

  function persist(next: { daily?: DailyRecord; stops?: StopRecord[]; recovery?: RecoveryEntry[] }, successMessage: string): boolean {
    const bundle: Record<string, unknown> = {};
    const keys: Array<'dailyRecords' | 'stops' | 'recoveryEntries'> = [];
    if (next.daily) { bundle.dailyRecords = { ...dailyRecords, [date]: next.daily }; keys.push('dailyRecords'); }
    if (next.stops) { bundle.stops = next.stops; keys.push('stops'); }
    if (next.recovery) { bundle.recoveryEntries = next.recovery; keys.push('recoveryEntries'); }
    const result = commitBundle(bundle, undefined, { keys });
    if (!result.persistedOk) {
      setMessage(t(S + (result.rollbackOk ? 'persistFailed' : 'rollbackCritical'), { keys: result.failedKeys.join(', ') }));
      return false;
    }
    if (next.daily) setDailyRecords(bundle.dailyRecords as Record<string, DailyRecord>);
    if (next.stops) setStops(next.stops);
    if (next.recovery) setRecoveryEntries(next.recovery);
    setMessage(successMessage);
    return true;
  }

  function setOutcome(stop: StopRecord, outcome: Outcome) {
    if (isReconciled) { setMessage(t(S + 'reopenFirst')); return; }
    if ((outcome === 'returned' || outcome === 'failed') && !reasonFor) {
      setPendingOutcome({ stop, outcome });
      setMessage(t(S + 'pickReason'));
      return;
    }
    applyIt(stop, outcome, (reasonFor || undefined) as FailureReasonKey | undefined);
  }
  function applyIt(stop: StopRecord, outcome: Outcome, reason: FailureReasonKey | undefined) {
    try {
      const next = applyStopOutcome(stop, outcome, reason, new Date().toISOString());
      persist({ stops: stops.map(candidate => candidate.id === next.id ? next : candidate) }, '');
      setReasonFor(''); setPendingOutcome(null); setMessage('');
    } catch { setMessage(t(S + 'pickReason')); }
  }

  const saveDraft = () => {
    if (!Number.isFinite(loadedNum) || codInvalid) { setMessage(t(S + 'fixNumbers')); return; }
    const draft = buildCloseDraft(existing ?? recordSkeleton(date), dayStops, {
      loadedShipments: loadedNum, deliveredShipments: summary.delivered, returnedShipments: summary.returned,
      pendingShipments: summary.pending, codCollectedSar: collectedNum, codRemittedSar: remittedNum,
      codExpectedManualSar: manualExpected, codAdjustmentNote: codAdjustNote || undefined, remittedOn: codRemittedOn || undefined,
    }, new Date().toISOString());
    const daily = { ...draft, fuelCost: fuelNum, driversPresent: driversNum };
    persist({ daily, stops: dayStops.length > 0 ? stops : undefined }, t(S + 'draftSaved'));
  };

  const confirmReconciled = () => {
    if (!canReconcile) return;
    const nowIso = new Date().toISOString();
    const draft = buildCloseDraft(existing ?? recordSkeleton(date), dayStops, {
      loadedShipments: loadedNum, deliveredShipments: summary.delivered, returnedShipments: summary.returned,
      pendingShipments: summary.pending, codCollectedSar: collectedNum, codRemittedSar: remittedNum,
      codExpectedManualSar: manualExpected, codAdjustmentNote: codAdjustNote || undefined, remittedOn: codRemittedOn || undefined,
    }, nowIso);
    const closed = applyCloseToDailyRecord({ ...draft, fuelCost: fuelNum, driversPresent: driversNum }, nowIso);
    const newRecovery = buildRecoveryEntriesForStops(dayStops, recoveryEntries, '', nowIso);
    const ok = persist(
      { daily: closed, stops, recovery: newRecovery.length > 0 ? [...recoveryEntries, ...newRecovery] : undefined },
      t(S + 'reconciledSaved'),
    );
    if (ok && newRecovery.length > 0) setMessage(t(S + 'reconciledWithRecovery', { count: fmt(newRecovery.length) }));
  };

  const reopen = () => {
    if (!isReconciled) return;
    const nowIso = new Date().toISOString();
    persist({ daily: { ...existing, closeStatus: 'draft', closedAt: undefined, updatedAt: nowIso } as DailyRecord, recovery: recoveryEntries }, t(S + 'reopened'));
    setReopenAsk(false);
  };

  const blockerTexts = validation.blockers.map(code => t(S + 'blockers.' + code));

  return (
    <section className="bm-panel bm-close" data-testid="evening-close">
      <div className="bm-provider-row">
        <label className="bm-field"><span>{t(S + 'dateLabel')}</span>
          <input name="close-date" type="date" value={date} onChange={event => changeDate(event.target.value)} data-testid="close-date" />
        </label>
      </div>
      <div className="bm-panel-head"><div>
        <span>{t(S + 'tag')}</span><h2>{t(S + 'title')} — {date}</h2>
        <p>
          {isReconciled ? t(S + 'status.reconciled') : isDraft ? t(S + 'status.draft') : t(S + 'status.open')}
          {!isDefinitiveDailyRecord(existing ?? { ...(recordSkeleton(date)), closeStatus: 'draft' }) && ` · ${t(S + 'draftExcluded')}`}
        </p>
      </div></div>

      {/* stop outcomes */}
      <h3>{t(S + 'outcomesTitle')} ({fmt(dayStops.length)})</h3>
      {dayStops.length === 0
        ? <p className="bm-import-note">{t(S + 'noStops')}</p>
        : (
          <ul className="bm-stops-list" data-testid="close-stop-list">
            {dayStops.map(stop => (
              <li key={stop.id} className="bm-stop-row" data-testid={`closerow-${stop.reference ?? stop.id}`}>
                <span className="bm-stop-main">
                  <strong>{stop.reference ? `${stop.reference} · ` : ''}{stop.customerName}</strong>
                  <span> — {stop.stopLabel}</span>
                  {stop.codAmountSar !== undefined && <small> · COD {fmt(stop.codAmountSar)}</small>}
                </span>
                <span className="bm-stop-actions" role="group" aria-label={t(S + 'outcomeAria', { label: stop.reference ?? stop.stopLabel })}>
                  {(['delivered', 'returned', 'pending', 'failed'] as Outcome[]).map(outcome => (
                    <button
                      key={outcome}
                      data-testid={`${outcome}-${stop.reference ?? stop.id}`}
                      aria-pressed={
                        outcome === 'delivered' ? stop.status === 'delivered'
                        : outcome === 'returned' ? stop.status === 'returned'
                        : outcome === 'pending' ? (stop.status === 'pending' || stop.status === 'planned') && !stop.failureReasonKey
                        : (stop.status === 'pending' || stop.status === 'failed') && stop.failureReasonKey !== undefined
                      }
                      onClick={() => setOutcome(stop, outcome)}
                    >
                      {t(S + 'outcomes.' + outcome)}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      {pendingOutcome && (
        <div className="bm-provider-row" data-testid="reason-picker">
          <label className="bm-field"><span>{t(S + 'reasonFor', { label: pendingOutcome.stop.reference ?? pendingOutcome.stop.stopLabel })}</span>
            <select value={reasonFor} onChange={event => setReasonFor(event.target.value)}>
              <option value="">—</option>
              {FAILURE_REASON_KEYS.map(key => <option key={key} value={key}>{t(S + 'reasons.' + key)}</option>)}
            </select>
          </label>
          <button onClick={() => applyIt(pendingOutcome.stop, pendingOutcome.outcome, (reasonFor || undefined) as FailureReasonKey | undefined)}>{t(S + 'applyReason')}</button>
        </div>
      )}

      {/* shipment reconciliation */}
      <h3>{t(S + 'reconTitle')}</h3>
      <dl className="bm-import-counts" data-testid="close-recon">
        <div><dt>{t(S + 'loaded')} <small>({t(S + 'manual')})</small></dt>
          <dd><input name="loaded-shipments" aria-label={t(S + 'loaded')} inputMode="numeric" value={loaded} onChange={event => setLoaded(event.target.value)} /></dd></div>
        <div><dt>{t(S + 'outcomes.delivered')} <small>({t(S + 'derived')})</small></dt><dd>{fmt(summary.delivered)}</dd></div>
        <div><dt>{t(S + 'outcomes.returned')} <small>({t(S + 'derived')})</small></dt><dd>{fmt(summary.returned)}</dd></div>
        <div><dt>{t(S + 'outcomes.pending')} <small>({t(S + 'derived')})</small></dt><dd>{fmt(summary.pending)}</dd></div>
        <div><dt>{t(S + 'difference')}</dt>
          <dd data-testid="close-difference" className={recon.balanced ? '' : 'bm-import-warning'}>
            {recon.difference > 0 ? `+${fmt(recon.difference)}` : fmt(recon.difference)}
          </dd></div>
      </dl>
      {!recon.balanced && (
        <p className="bm-import-warning" role="alert" data-testid="mismatch-note">
          {t(S + (recon.difference > 0 ? 'positiveDiff' : 'negativeDiff'), { difference: fmt(Math.abs(recon.difference)) })}
        </p>
      )}

      {/* failure reasons */}
      <h3>{t(S + 'reasonsTitle')}</h3>
      <p className="bm-import-note" data-testid="reason-summary">
        {t(S + 'failedCount', { count: fmt(summary.failedAttempts) })} · {t(S + 'missingReasonCount', { count: fmt(summary.missingReason.length) })}
      </p>

      {/* COD */}
      <h3>{t(S + 'codTitle')}</h3>
      <div className="bm-provider-row">
        <label className="bm-field"><span>{t(S + 'codExpected')} <small>({t(S + 'derived')})</small></span>
          <output data-testid="cod-expected">{fmt(cod?.expectedSar ?? 0)}</output>
        </label>
        <label className="bm-field"><span>{t(S + 'codCollected')} <small>({t(S + 'manual')})</small></span>
          <input name="cod-collected" inputMode="decimal" value={codCollected} onChange={event => setCodCollected(event.target.value)} />
        </label>
        <label className="bm-field"><span>{t(S + 'codRemitted')} <small>({t(S + 'manual')})</small></span>
          <input name="cod-remitted" inputMode="decimal" value={codRemitted} onChange={event => setCodRemitted(event.target.value)} />
        </label>
        <label className="bm-field"><span>{t(S + 'codRemittedOn')}</span>
          <input name="cod-remitted-on" type="date" value={codRemittedOn} onChange={event => setCodRemittedOn(event.target.value)} />
        </label>
      </div>
      <div className="bm-provider-row">
        <label className="bm-field"><span>{t(S + 'codAdjust')} <small>({t(S + 'manual')})</small></span>
          <input name="cod-expected-manual" inputMode="decimal" value={codExpectedManual} onChange={event => setCodExpectedManual(event.target.value)} />
        </label>
        <label className="bm-field bm-grow"><span>{t(S + 'codAdjustNote')}</span>
          <input name="cod-adjust-note" value={codAdjustNote} onChange={event => setCodAdjustNote(event.target.value)} />
        </label>
      </div>
      <div className="bm-provider-row">
        <label className="bm-field"><span>{t(S + 'fuel')} <small>({t(S + 'manual')})</small></span>
          <input name="close-fuel" inputMode="decimal" value={fuel} onChange={event => setFuel(event.target.value)} />
        </label>
        <label className="bm-field"><span>{t(S + 'driversPresent')} <small>({t(S + 'manual')})</small></span>
          <input name="close-drivers" inputMode="numeric" value={drivers} onChange={event => setDrivers(event.target.value)} />
        </label>
      </div>
      {cod && (
        <dl className="bm-import-counts" data-testid="cod-results">
          <div><dt>{t(S + 'codExpected')}</dt><dd>{fmt(cod.expectedSar)} <small>{t(S + cod.expectedSource === 'stop-derived' ? 'derived' : 'manual')}</small></dd></div>
          <div><dt>{t(S + 'codCollected')}</dt><dd>{fmt(cod.collectedSar)}</dd></div>
          <div><dt>{t(S + 'codRemitted')}</dt><dd>{fmt(cod.remittedSar)}</dd></div>
          <div><dt>{t(S + 'codOutstanding')}</dt><dd data-testid="cod-outstanding">{fmt(cod.outstandingSar)}</dd></div>
          <div><dt>{t(S + 'codUncollected')}</dt><dd data-testid="cod-uncollected">{fmt(cod.uncollectedSar)}</dd></div>
          <div><dt>{t(S + 'codOverRemitted')}</dt><dd data-testid="cod-over">{fmt(cod.overRemittedSar)}</dd></div>
        </dl>
      )}
      {codInvalid && <p className="bm-import-warning" role="alert">{t(S + 'invalidMoney')}</p>}
      {codWarnings.length > 0 && <p className="bm-import-note">{t(S + 'codUncollectedWarning', { amount: fmt((cod?.uncollectedSar ?? 0)) })}</p>}

      {/* validation summary + actions */}
      {!validation.ok && (
        <ul className="bm-import-warning" role="alert" data-testid="close-blockers">
          {blockerTexts.map(text => <li key={text}>{text}</li>)}
        </ul>
      )}
      {codInvalid && <ul className="bm-import-warning" role="alert"><li>{t(S + 'invalidMoney')}</li></ul>}
      <div className="bm-import-choices">
        <button data-testid="save-draft" onClick={saveDraft}>{t(S + 'saveDraft')}</button>
        <button className="bm-primary" data-testid="confirm-close" onClick={confirmReconciled} disabled={!canReconcile}>{t(S + 'confirmClose')}</button>
        {isReconciled && !reopenAsk && <button data-testid="reopen-ask" onClick={() => setReopenAsk(true)}>{t(S + 'reopen')}</button>}
      </div>
      {reopenAsk && (
        <p className="bm-delete-confirm" data-testid="reopen-confirm">
          {t(S + 'reopenQuestion')}
          <button onClick={reopen}>{t(S + 'reopenYes')}</button>
          <button onClick={() => setReopenAsk(false)}>{t(S + 'reopenNo')}</button>
        </p>
      )}
      {message !== '' && <p className="bm-import-note" role="status" data-testid="close-message">{message}</p>}
    </section>
  );
}

function recordSkeleton(date: string): DailyRecord {
  // NO fabricated operational data: fuel/attendance are operator-entered on
  // the close form (blank ⇒ 0, visibly labelled entered) — never invented.
  return { date, completedShipments: 0, failedShipments: 0, fuelCost: 0, driversPresent: 0, notes: '', updatedAt: '' };
}

function codDefaultFor(stops: StopRecord[]): number {
  return stops.filter(stop => stop.status === 'delivered').reduce((sum, stop) => sum + (stop.codAmountSar ?? 0), 0);
}
