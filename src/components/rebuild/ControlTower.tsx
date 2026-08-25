// VEGA — Control Tower view (Release R1).
// The owner's <30s morning answer: yesterday, cash, recovery, gaps, actions.
// Pure presentational — all numbers arrive via the pure snapshot builder.

import { useTranslation } from 'react-i18next';
import type { ControlTowerSnapshot } from '@/lib/controlTower';

export function ControlTowerView({ snapshot, onGoto }: { snapshot: ControlTowerSnapshot; onGoto: (view: 'stops' | 'dispatch' | 'close' | 'daily' | 'recovery' | 'scenarios') => void }) {
  const { t, i18n } = useTranslation();
  const S = 'businessModel.tower.';
  const ar = i18n.language === 'ar';
  const fmt = (n: number) => new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US').format(n);

  const y = snapshot.yesterday;
  const wf = snapshot.workflow;
  // Workflow step indicator: where is the operator in today's cycle?
  const stepDone = (step: number) => {
    if (step === 1) return wf.stopsPlanned > 0;
    if (step === 2) return wf.stopsAssigned > 0;
    if (step === 3) return wf.closeStatus === 'draft' || wf.closeStatus === 'reconciled';
    return false;
  };
  const stepCurrent = () => {
    if (wf.stopsPlanned === 0) return 1;
    if (wf.stopsAssigned < wf.stopsPlanned) return 2;
    if (wf.closeStatus === 'open' || wf.closeStatus === 'no-stops') return 3;
    return 4; // all done
  };
  const currentStep = stepCurrent();

  return (
    <section className="bm-tower" data-testid="control-tower">
      <div className="bm-panel-head"><div>
        <span>{t(S + 'tag')}</span><h2>{t(S + 'title')}</h2><p>{t(S + 'desc')}</p>
      </div></div>

      {/* Daily workflow progress — the operator always knows where he is */}
      <div className="bm-workflow" data-testid="workflow-progress">
        <div className={`bm-workflow-step ${stepDone(1) ? 'done' : ''} ${currentStep === 1 ? 'current' : ''}`} onClick={() => onGoto('stops')}>
          <span className="bm-workflow-num">1</span>
          <span>{t('businessModel.nav.workflow.plan', { defaultValue: 'Plan' })}</span>
          <small>{wf.stopsPlanned > 0 ? fmt(wf.stopsPlanned) : '—'}</small>
        </div>
        <div className="bm-workflow-connector" />
        <div className={`bm-workflow-step ${stepDone(2) ? 'done' : ''} ${currentStep === 2 ? 'current' : ''}`} onClick={() => onGoto('dispatch')}>
          <span className="bm-workflow-num">2</span>
          <span>{t('businessModel.nav.workflow.dispatch', { defaultValue: 'Assign' })}</span>
          <small>{wf.stopsAssigned > 0 ? `${fmt(wf.stopsAssigned)}/${fmt(wf.stopsPlanned)}` : '—'}</small>
        </div>
        <div className="bm-workflow-connector" />
        <div className={`bm-workflow-step ${stepDone(3) ? 'done' : ''} ${currentStep === 3 ? 'current' : ''}`} onClick={() => onGoto('close')}>
          <span className="bm-workflow-num">3</span>
          <span>{t('businessModel.nav.workflow.close', { defaultValue: 'Close' })}</span>
          <small>{wf.closeStatus === 'reconciled' ? '✓' : wf.closeStatus === 'draft' ? t('businessModel.daily.draft') : '—'}</small>
        </div>
        <div className="bm-workflow-connector" />
        <div className={`bm-workflow-step ${currentStep === 4 ? 'done' : ''} ${currentStep === 4 ? 'current' : ''}`} onClick={() => onGoto('daily')}>
          <span className="bm-workflow-num">4</span>
          <span>{t('businessModel.nav.workflow.report', { defaultValue: 'Report' })}</span>
          <small>{currentStep === 4 ? '✓' : '—'}</small>
        </div>
      </div>

      {/* Top actions first — the "what must happen today" answer */}
      {snapshot.actions.length > 0 && (
        <ul className="bm-tower-actions" data-testid="tower-actions">
          {snapshot.actions.map(a => (
            <li key={a.id} className={`bm-tower-action bm-sev-${a.severity}`} data-testid={`action-${a.id}`}>
              <span className="bm-sev-dot" aria-hidden="true" />
              {t(S + 'actions.' + a.labelKey, a.params ?? {})}
            </li>
          ))}
        </ul>
      )}
      {snapshot.actions.length === 0 && (
        <p className="bm-import-note" data-testid="tower-clear">{t(S + 'allClear')}</p>
      )}

      {/* Yesterday row */}
      <dl className="bm-tower-grid" data-testid="tower-yesterday">
        <div className={y ? '' : 'bm-tower-empty'}>
          <dt>{y ? t(S + 'yesterdayPlanned', { date: y.date }) : t(S + 'yesterdayMissing')}</dt>
          <dd>{y ? `${fmt(y.delivered)} / ${fmt(y.planned)}` : t(S + 'noData')}</dd>
          <dt className="bm-sub">{t(S + 'failed')}</dt>
          <dd>{y ? fmt(y.failed) : t(S + 'noData')}</dd>
          <dt className="bm-sub">{t(S + 'recovered')}</dt>
          <dd>{y ? fmt(y.recovered) : t(S + 'noData')}</dd>
        </div>
      </dl>

      {/* Cash / recovery / POD strip */}
      <dl className="bm-tower-grid" data-testid="tower-strip">
        <div>
          <dt>{t(S + 'codOutstanding')}</dt>
          <dd data-testid="tower-cod">{fmt(snapshot.codOutstandingSar)} <small>SAR</small></dd>
        </div>
        <div>
          <dt>{t(S + 'recoveryOpen')}</dt>
          <dd data-testid="tower-recovery">{fmt(snapshot.recoveryOpen)}{snapshot.recoveryOverdue > 0 ? ` · ${fmt(snapshot.recoveryOverdue)} ${t(S + 'overdue')}` : ''}</dd>
        </div>
        <div>
          <dt>{t(S + 'podGapsTitle')}</dt>
          <dd data-testid="tower-pod">{snapshot.podGapDates.length > 0 ? fmt(snapshot.podGapDates.length) : t(S + 'none')}</dd>
        </div>
      </dl>

      {/* Next step button — the single most important action */}
      <div className="bm-import-choices">
        {currentStep <= 3 && (
          <button className="bm-primary" onClick={() => onGoto(currentStep === 1 ? 'stops' : currentStep === 2 ? 'dispatch' : 'close')}>
            {currentStep === 1 ? t('businessModel.nav.workflow.plan') : currentStep === 2 ? t('businessModel.nav.workflow.dispatch') : t('businessModel.nav.workflow.close')}
          </button>
        )}
        {currentStep === 4 && <p className="bm-import-note" data-testid="tower-clear">{t(S + 'allClear')}</p>}
        <button onClick={() => onGoto('recovery')}>{t(S + 'goRecovery')}</button>
      </div>
    </section>
  );
}
