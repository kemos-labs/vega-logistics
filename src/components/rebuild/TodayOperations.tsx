'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  buildTodayExceptionQueue,
  buildTodayWorkflowState,
  buildWorkflowStepStatuses,
  selectPrimaryNextAction,
  type TodayWorkspaceInput,
} from '@/lib/todayWorkspace';
import type { DailyRecord } from '@/lib/operationsReporting';
import type { RecoveryEntry } from '@/lib/recoveryBoard';
import type { StopRecord } from '@/lib/stops';

type TodayNavTarget = 'stops' | 'dispatch' | 'close' | 'daily' | 'recovery' | 'summary' | 'fleet' | 'customers' | 'costs' | 'scenarios' | 'risks' | 'actions';

export interface TodayOperationsProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  stops: StopRecord[];
  dailyRecords: Record<string, DailyRecord>;
  recoveryEntries: RecoveryEntry[];
  onNavigate: (view: TodayNavTarget, date?: string) => void;
}

export function TodayOperations({ selectedDate, onDateChange, stops, dailyRecords, recoveryEntries, onNavigate }: TodayOperationsProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const locale = isAr ? 'ar-SA-u-nu-latn' : 'en-SA';
  const fmtNum = (value: number) => new Intl.NumberFormat(locale).format(value);
  const fmtMoney = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(value);

  const state = useMemo(() => buildTodayWorkflowState({ selectedDate, stops, dailyRecords, recoveryEntries } as TodayWorkspaceInput), [selectedDate, stops, dailyRecords, recoveryEntries]);
  const primary = useMemo(() => selectPrimaryNextAction(state), [state]);
  const exceptions = useMemo(() => buildTodayExceptionQueue(state), [state]);
  const steps = useMemo(() => buildWorkflowStepStatuses(state), [state]);

  const lastSaved = state.closeRecord?.updatedAt ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(state.closeRecord.updatedAt)) : null;
  const closeProvenance =
    state.closeState === 'draft' ? t('businessModel.today.badges.draft') :
    state.closeState === 'reconciled' ? t('businessModel.today.badges.reconciled') :
    state.closeState === 'legacy-recorded' ? t('businessModel.today.badges.legacy') :
    t('businessModel.today.badges.open');

  const codProvenanceLabel = !state.closeRecord
    ? t('businessModel.today.provenance.notRecorded')
    : state.closeState === 'draft' ? t('businessModel.today.badges.draft')
    : state.closeState === 'legacy-recorded' ? t('businessModel.today.badges.legacy')
    : state.closeState === 'reconciled' ? t('businessModel.today.provenance.reconciled')
    : t('businessModel.today.provenance.recorded');

  const targetForStep = (id: string): TodayNavTarget => {
    if (id === 'plan') return 'stops';
    if (id === 'dispatch') return 'dispatch';
    if (id === 'close') return 'close';
    return 'daily';
  };

  const primaryParams = (() => {
    switch (primary.id) {
      case 'review-address': return { count: state.missingAddressCount };
      case 'dispatch': return { count: state.unassignedCount };
      case 'close-blockers': {
        if (state.shipmentDifference !== null && state.shipmentDifference !== 0) return { count: `${state.shipmentDifference > 0 ? '+' : '−'}${Math.abs(state.shipmentDifference)}` };
        if (state.missingReasonCount > 0) return { count: state.missingReasonCount };
        return {};
      }
      case 'close-cod': {
        const amt = state.cod.uncollectedSar > 0 ? state.cod.uncollectedSar : state.cod.overRemittedSar > 0 ? state.cod.overRemittedSar : state.cod.outstandingSar;
        return { count: amt, amount: amt };
      }
      default: return {};
    }
  })();

  const railCurrentIndex = (() => {
    if (steps.every(s => s.status === 'complete')) return steps.findIndex(s => s.id === 'report');
    return steps.findIndex(s => s.status !== 'complete');
  })();



  return (
    <section className="bm-today" data-testid="today-operations" aria-labelledby="bm-today-title">
      <div className="bm-today-masthead">
        <div className="bm-today-masthead-main">
          <h1 id="bm-today-title" className="bm-today-title">{t('businessModel.today.title')}</h1>
          <p className="bm-today-subtitle">{t('businessModel.today.subtitle')}</p>
        </div>
        <div className="bm-today-masthead-meta">
          <label className="bm-field bm-today-date">
            <span>{t('businessModel.today.selectedDate')}</span>
            <input type="date" value={selectedDate} onChange={event => onDateChange(event.target.value)} aria-label={t('businessModel.today.selectedDate')} data-testid="today-date-input" />
          </label>
          <div className="bm-today-badges">
            <span className="bm-today-badge bm-today-badge-local">{t('businessModel.today.badges.localOnly')}</span>
            <span className="bm-today-badge" data-testid="today-close-state">{closeProvenance}</span>
            {lastSaved && <span className="bm-today-saved"><bdi dir="ltr">{lastSaved}</bdi> — {t('businessModel.today.lastSaved')}</span>}
          </div>
        </div>
      </div>

      {state.yesterdayWarning.hasWarning && (
        <div className="bm-today-warning" role="status" data-testid="today-yesterday-warning">
          <span>
            {state.yesterdayWarning.status === 'missing'
              ? t('businessModel.today.yesterday.missing', { date: state.yesterdayWarning.yesterdayDate })
              : state.yesterdayWarning.status === 'draft'
                ? t('businessModel.today.yesterday.draft', { date: state.yesterdayWarning.yesterdayDate })
                : state.yesterdayWarning.status === 'legacy-recorded'
                  ? t('businessModel.today.yesterday.legacy', { date: state.yesterdayWarning.yesterdayDate })
                  : t('businessModel.today.yesterday.open', { date: state.yesterdayWarning.yesterdayDate })}
          </span>
          <button className="bm-link-button" onClick={() => onNavigate('close', state.yesterdayWarning.yesterdayDate)} data-testid="today-yesterday-link">
            {t('businessModel.today.yesterday.go')}
          </button>
        </div>
      )}

      <div className="bm-today-primary-row">
        <button
          className="bm-primary bm-today-primary"
          onClick={() => onNavigate(primary.targetView, selectedDate)}
          data-testid="today-primary-cta"
          aria-describedby="today-primary-desc"
        >
          {t(primary.labelKey, primaryParams as Record<string, unknown>)}
        </button>
        <p id="today-primary-desc" className="bm-today-primary-desc">{t(primary.descriptionKey)}</p>
      </div>

      <ol className="bm-today-rail" data-testid="today-rail" aria-label={t('businessModel.today.railAria')}>
        {steps.map((step, index) => (
          <li key={step.id} className={`bm-today-step bm-today-step-${step.status}`} data-testid={`today-step-${step.id}`}>
            <button
              onClick={() => onNavigate(targetForStep(step.id), selectedDate)}
              aria-current={index === railCurrentIndex ? 'step' : undefined}
              data-testid={`today-step-btn-${step.id}`}
            >
              <span className="bm-today-step-index" aria-hidden="true">{index + 1}</span>
              <span className="bm-today-step-label">{t(step.labelKey)}</span>
              <span className="bm-today-step-status">{t(`businessModel.today.stepStatus.${step.status}`)}</span>
              {step.detail && <small><bdi dir="ltr">{step.detail}</bdi></small>}
            </button>
          </li>
        ))}
      </ol>

      <div className="bm-today-pulse" data-testid="today-pulse">
        <article className="bm-today-tile" data-testid="today-tile-planned">
          <span>{t('businessModel.today.tiles.planned')}</span>
          <strong><bdi dir="ltr">{fmtNum(state.plannedCount)}</bdi></strong>
          <small>{t('businessModel.today.provenance.recorded')}</small>
        </article>
        <article className="bm-today-tile" data-testid="today-tile-assigned">
          <span>{t('businessModel.today.tiles.assigned')}</span>
          <strong><bdi dir="ltr">{fmtNum(state.assignedCount)}</bdi> / <bdi dir="ltr">{fmtNum(state.plannedCount)}</bdi></strong>
          <small>{t('businessModel.today.provenance.derived')}</small>
        </article>
        <article className="bm-today-tile" data-testid="today-tile-delivered">
          <span>{t('businessModel.today.tiles.delivered')}</span>
          <strong><bdi dir="ltr">{fmtNum(state.delivered)}</bdi></strong>
          <small>{state.isReconciled ? t('businessModel.today.provenance.reconciled') : state.closeRecord ? t('businessModel.today.provenance.recorded') : t('businessModel.today.provenance.notRecorded')}</small>
        </article>
        <article className="bm-today-tile" data-testid="today-tile-cod">
          <span>{t('businessModel.today.tiles.codOutstanding')}</span>
          <strong><bdi dir="ltr">{fmtMoney(state.cod.outstandingSar)}</bdi></strong>
          <small>{state.cod.expectedSource === 'manual-adjusted' ? t('businessModel.today.provenance.manual') : t('businessModel.today.provenance.derived')} · {codProvenanceLabel}</small>
        </article>
        <article className="bm-today-tile bm-today-tile-action" data-testid="today-tile-needs">
          <span>{t('businessModel.today.tiles.needsAction')}</span>
          <strong><bdi dir="ltr">{fmtNum(exceptions.length)}</bdi></strong>
          <small>{t('businessModel.today.provenance.derived')}</small>
        </article>
      </div>

      {state.loadedShipments !== undefined && (
        <p className="bm-today-loaded-strip" data-testid="today-loaded-strip">
          {t('businessModel.today.loadedStrip', { planned: fmtNum(state.plannedCount), loaded: fmtNum(state.loadedShipments) })}
          {state.shipmentDifference !== null && state.shipmentDifference !== 0 && (
            <span className="bad">
              {' '}· {t('businessModel.today.shipmentDiff', { diff: fmtNum(Math.abs(state.shipmentDifference)), sign: state.shipmentDifference > 0 ? '+' : '−' })}
            </span>
          )}
          <small> — {state.shipmentBalanced ? t('businessModel.today.balanced') : t('businessModel.today.unbalanced')}</small>
        </p>
      )}

      <section className="bm-today-exceptions" aria-labelledby="today-exceptions-title" data-testid="today-exceptions">
        <h2 id="today-exceptions-title">{t('businessModel.today.exceptions.title')}</h2>
        {exceptions.length === 0 ? (
          <p className="bm-import-note" data-testid="today-exceptions-empty">{state.isReconciled ? t('businessModel.today.exceptions.noneReconciled') : t('businessModel.today.exceptions.none')}</p>
        ) : (
          <ul>
            {exceptions.map(item => (
              <li key={item.id} data-testid={`today-exception-${item.kind}`}>
                <button onClick={() => onNavigate(item.targetView, selectedDate)} data-testid={`today-exception-go-${item.kind}`}>
                  <span>{t(`businessModel.today.exceptions.${item.kind}`, item.kind === 'shipment-gap' ? { count: item.detail ?? '' } : { count: item.count ?? item.detail ?? '' })}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bm-today-runs" aria-labelledby="today-runs-title" data-testid="today-runs">
        <div className="bm-panel-head">
          <h2 id="today-runs-title">{t('businessModel.today.runs.title')}</h2>
          <button onClick={() => onNavigate('dispatch', selectedDate)} data-testid="today-open-dispatch">{t('businessModel.today.runs.openDispatch')}</button>
        </div>
        {state.runPreviews.length === 0 ? (
          <p className="bm-import-note" data-testid="today-runs-empty">{t('businessModel.today.runs.empty')}</p>
        ) : (
          <ul>
            {state.runPreviews.map(preview => (
              <li key={preview.key} className="bm-today-run" data-testid={`today-run-${preview.key}`}>
                <strong><bdi dir="ltr">{preview.run.driverName}</bdi>{preview.run.carNumber ? <><span> · </span><bdi dir="ltr">{preview.run.carNumber}</bdi></> : null}{preview.run.plateNumber ? <><span> · </span><bdi dir="ltr">{preview.run.plateNumber}</bdi></> : null}</strong>
                <span>{t('businessModel.today.runs.stops', { count: preview.workload.stopCount })}</span>
                <small>{t('businessModel.today.runs.cod', { amount: fmtMoney(preview.workload.codTotalSar) })}</small>
                <small>{preview.workload.missingAddress > 0 ? t('businessModel.today.runs.missingAddress', { count: preview.workload.missingAddress }) : ''}</small>
              </li>
            ))}
          </ul>
        )}
      </section>

      {state.isEmptyDay && (
        <div className="bm-today-empty" data-testid="today-empty">
          <p>{t('businessModel.today.empty.title')}</p>
          <p>{t('businessModel.today.empty.desc')}</p>
        </div>
      )}
      {state.isReconciled && state.plannedCount > 0 && (
        <div className="bm-today-complete" data-testid="today-complete">
          <p>{t('businessModel.today.complete.title')}</p>
          <p>{exceptions.length > 0 ? t('businessModel.today.complete.withRemaining') : t('businessModel.today.complete.desc')}</p>
        </div>
      )}
    </section>
  );
}
