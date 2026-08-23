// VEGA — Control Tower view (Release R1).
// The owner's <30s morning answer: yesterday, cash, recovery, gaps, actions.
// Pure presentational — all numbers arrive via the pure snapshot builder.

import { useTranslation } from 'react-i18next';
import type { ControlTowerSnapshot } from '@/lib/controlTower';

export function ControlTowerView({ snapshot, onGoto }: { snapshot: ControlTowerSnapshot; onGoto: (view: 'daily' | 'recovery' | 'scenarios') => void }) {
  const { t, i18n } = useTranslation();
  const S = 'businessModel.tower.';
  const ar = i18n.language === 'ar';
  const fmt = (n: number) => new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US').format(n);

  const y = snapshot.yesterday;

  return (
    <section className="bm-tower" data-testid="control-tower">
      <div className="bm-panel-head"><div>
        <span>{t(S + 'tag')}</span><h2>{t(S + 'title')}</h2><p>{t(S + 'desc')}</p>
      </div></div>

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

      {/* Direct links into the corrective workflows */}
      <div className="bm-import-choices">
        <button onClick={() => onGoto('daily')}>{t(S + 'goDaily')}</button>
        <button onClick={() => onGoto('recovery')}>{t(S + 'goRecovery')}</button>
        <button onClick={() => onGoto('scenarios')}>{t(S + 'goBackup')}</button>
      </div>
    </section>
  );
}
