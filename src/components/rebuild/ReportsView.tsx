// VEGA — Read-only Reports (repair). Date-scoped derived from DailyRecord + stops.
// No mutations. Company + per-driver runs with stable runKey. Honest exports.
import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { DailyRecord } from '@/lib/operationsReporting';
import { runWorkload } from '@/lib/dispatch';
import type { StopRecord } from '@/lib/stops';
import { exportOperationalExcel } from '@/lib/operationsReportExport';

function runKey(run: { driverName: string; carNumber?: string; plateNumber?: string }): string {
  return [run.driverName, run.carNumber ?? '—', run.plateNumber ?? '—'].join('|');
}

type PrintTarget = null | { kind: 'company' } | { kind: 'run'; key: string };

export function ReportsView({
  operationDate,
  onOperationDateChange,
  stops,
  dailyRecords,
  onGotoClose,
}: {
  operationDate: string;
  onOperationDateChange: (d: string) => void;
  stops: StopRecord[];
  dailyRecords: Record<string, DailyRecord>;
  onGotoClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const fmt = (n: number) => new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US').format(n);
  const [printTarget, setPrintTarget] = useState<PrintTarget>(null);
  const [exportMsg, setExportMsg] = useState('');

  const record = dailyRecords[operationDate];
  const dayStops = useMemo(() => stops.filter(s => s.operationDate === operationDate), [stops, operationDate]);

  const board = useMemo(() => {
    const map = new Map<string, { driverName: string; carNumber?: string; plateNumber?: string; stops: StopRecord[] }>();
    const unassigned: StopRecord[] = [];
    for (const stop of dayStops) {
      if (!stop.driverName) { unassigned.push(stop); continue; }
      const key = runKey({ driverName: stop.driverName, carNumber: stop.carNumber, plateNumber: stop.plateNumber });
      const entry = map.get(key) ?? { driverName: stop.driverName, carNumber: stop.carNumber, plateNumber: stop.plateNumber, stops: [] };
      entry.stops.push(stop);
      map.set(key, entry);
    }
    const runs = [...map.values()].map(r => ({ ...r, stops: [...r.stops].sort((a,b)=> (a.sequence ?? 999)-(b.sequence ?? 999) || a.stopLabel.localeCompare(b.stopLabel)) })).sort((a,b)=>a.driverName.localeCompare(b.driverName));
    return { runs, unassigned };
  }, [dayStops]);

  const isDraft = record?.closeStatus === 'draft';
  const isLegacy = !!record && !record.closeStatus;

  // Per-driver run cards, shared by both render paths. `allowPrint=false`
  // serves the pre-close view: print/export stay gated on a recorded close.
  const renderRuns = (allowPrint: boolean) => board.runs.map(run => {
    const key = runKey(run);
    const stopsForRun = run.stops;
    const del = stopsForRun.filter(s => s.status === 'delivered').length;
    const ret = stopsForRun.filter(s => s.status === 'returned').length;
    const pend = stopsForRun.filter(s => s.status === 'pending' || s.status === 'planned' || s.status === 'failed').length;
    const codExp = stopsForRun.filter(s => s.status === 'delivered').reduce((sum, s) => sum + (s.codAmountSar ?? 0), 0);
    const podGaps = stopsForRun.filter(s => s.status === 'delivered' && s.podStatus !== 'complete').length;
    return (
      <div key={key} className="bm-run" data-testid={`reports-run-${key}`}>
        <div className="bm-run-head"><h4>{run.driverName}{run.carNumber ? ` · ${run.carNumber}` : ''}</h4>
          {allowPrint && <button data-testid={`reports-print-${key}`} disabled={isDraft} onClick={() => doPrintRun(key)}>{t('businessModel.dispatch.printBtn', { defaultValue: 'Print sheet' })}</button>}
        </div>
        <dl className="bm-import-counts">
          <div><dt>{t('businessModel.reports.assigned', { defaultValue: 'Stops' })}</dt><dd>{fmt(stopsForRun.length)}</dd></div>
          <div><dt>{t('businessModel.reports.delivered', { defaultValue: 'Delivered' })}</dt><dd>{fmt(del)}</dd></div>
          <div><dt>{t('businessModel.reports.returned', { defaultValue: 'Returned' })}</dt><dd>{fmt(ret)}</dd></div>
          <div><dt>{t('businessModel.reports.pending', { defaultValue: 'Pending' })}</dt><dd>{fmt(pend)}</dd></div>
          <div><dt>{t('businessModel.reports.podGaps', { defaultValue: 'POD gaps' })}</dt><dd data-testid={`reports-pod-${key}`}>{fmt(podGaps)}</dd></div>
          <div><dt>{t('businessModel.reports.codExpected', { defaultValue: 'COD expected' })}</dt><dd data-testid={`reports-cod-${key}`}>{fmt(codExp)} SAR</dd></div>
        </dl>
      </div>
    );
  });

  const delivered = dayStops.filter(s => s.status === 'delivered').length;
  const returned = dayStops.filter(s => s.status === 'returned').length;
  const pending = dayStops.filter(s => s.status === 'pending' || s.status === 'planned' || s.status === 'failed').length;
  const codExpected = dayStops.filter(s => s.status === 'delivered').reduce((sum, s) => sum + (s.codAmountSar ?? 0), 0);
  const companyPodGaps = dayStops.filter(s => s.status === 'delivered' && s.podStatus !== 'complete').length;
  const collected = record?.cashCollectedSar ?? 0;
  const remitted = record?.cashRemittedSar ?? 0;
  const outstanding = Math.max(0, collected - remitted);
  const uncollected = Math.max(0, codExpected - collected);
  const overRemitted = Math.max(0, remitted - collected);

  const requestPrint = (target: PrintTarget) => {
    if (!target) return;
    if (isDraft) return;
    if (!record) return;
    setPrintTarget(target);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  };

  const doPrintCompany = () => requestPrint({ kind: 'company' });
  const doPrintRun = (key: string) => requestPrint({ kind: 'run', key });

  useEffect(() => {
    const handler = () => setPrintTarget(null);
    window.addEventListener('afterprint', handler);
    return () => window.removeEventListener('afterprint', handler);
  }, []);

  const doExcel = async () => {
    if (!record || isDraft) return;
    setExportMsg(t('businessModel.reports.exporting', { defaultValue: 'Preparing Excel…' }));
    try {
      await exportOperationalExcel({ date: operationDate, record, stops: dayStops, runs: board.runs.map(r => ({ key: runKey(r), driverName: r.driverName, carNumber: r.carNumber, plateNumber: r.plateNumber, stops: r.stops })), lang: ar ? 'ar' : 'en' });
      setExportMsg(t('businessModel.reports.exported', { defaultValue: 'Excel downloaded.' }));
    } catch {
      setExportMsg(t('businessModel.reports.exportFailed', { defaultValue: 'Export failed' }));
    }
  };

  const manifestRun = printTarget?.kind === 'run' ? (board.runs.find(r => runKey(r) === printTarget.key) ?? null) : null;

  // print portal content — clean, no hardcoded fixture names
  const printPortal = printTarget && typeof document !== 'undefined' ? createPortal(
    <div className="vega-print-portal" data-testid="vega-print-portal" dir={ar ? 'rtl' : 'ltr'}>
      {printTarget.kind === 'company' ? (
        <div data-testid="print-company-sheet" className="vega-print-sheet">
          <h1>{t('businessModel.reports.companyTitle', { defaultValue: 'Company report' })} — {operationDate}</h1>
          <p>{t('businessModel.reports.status', { defaultValue: 'Status' })}: {isLegacy ? t('businessModel.reports.legacy', { defaultValue: 'Recorded (legacy)' }) : t('businessModel.reports.reconciled', { defaultValue: 'Reconciled' })}</p>
          <table>
            <thead><tr><th>{t('businessModel.reports.assigned', { defaultValue: 'Stops' })}</th><th>{t('businessModel.reports.delivered', { defaultValue: 'Delivered' })}</th><th>{t('businessModel.reports.returned', { defaultValue: 'Returned' })}</th><th>{t('businessModel.reports.pending', { defaultValue: 'Pending' })}</th><th>{t('businessModel.reports.codExpected', { defaultValue: 'COD expected' })}</th><th>{t('businessModel.reports.collected', { defaultValue: 'Collected' })}</th><th>{t('businessModel.reports.remitted', { defaultValue: 'Remitted' })}</th><th>{t('businessModel.reports.outstanding', { defaultValue: 'Outstanding' })}</th><th>{t('businessModel.reports.podGaps', { defaultValue: 'POD gaps' })}</th></tr></thead>
            <tbody><tr><td>{dayStops.length}</td><td>{delivered}</td><td>{returned}</td><td>{pending}</td><td>{codExpected}</td><td>{collected}</td><td>{remitted}</td><td>{outstanding}</td><td>{companyPodGaps}</td></tr></tbody>
          </table>
          <h2>{t('businessModel.reports.perDriverTitle', { defaultValue: 'Per-driver runs' })}</h2>
          <table>
            <thead><tr><th>{t('businessModel.dispatch.manifest.driver', { defaultValue: 'Driver' })}</th><th>{t('businessModel.dispatch.manifest.car', { defaultValue: 'Car' })}</th><th>{t('businessModel.dispatch.manifest.plate', { defaultValue: 'Plate' })}</th><th>{t('businessModel.reports.assigned', { defaultValue: 'Stops' })}</th><th>{t('businessModel.reports.delivered', { defaultValue: 'Delivered' })}</th><th>{t('businessModel.reports.returned', { defaultValue: 'Returned' })}</th><th>{t('businessModel.reports.pending', { defaultValue: 'Pending' })}</th><th>{t('businessModel.reports.podGaps', { defaultValue: 'POD gaps' })}</th><th>{t('businessModel.reports.codExpected', { defaultValue: 'COD expected' })}</th></tr></thead>
            <tbody>
              {board.runs.map(r => {
                const k = runKey(r);
                const del = r.stops.filter(s => s.status === 'delivered').length;
                const ret = r.stops.filter(s => s.status === 'returned').length;
                const pend = r.stops.filter(s => s.status === 'pending' || s.status === 'planned' || s.status === 'failed').length;
                const codExp = r.stops.filter(s => s.status === 'delivered').reduce((sum, s) => sum + (s.codAmountSar ?? 0), 0);
                const gaps = r.stops.filter(s => s.status === 'delivered' && s.podStatus !== 'complete').length;
                return <tr key={k} data-testid={`print-company-run-${k}`}><td>{r.driverName}</td><td>{r.carNumber ?? '—'}</td><td>{r.plateNumber ?? '—'}</td><td>{r.stops.length}</td><td>{del}</td><td>{ret}</td><td>{pend}</td><td>{gaps}</td><td>{codExp}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      ) : manifestRun ? (
        <div data-testid="print-run-sheet" className="vega-print-sheet">
          <h1>{t('businessModel.dispatch.manifest.title', { defaultValue: 'Driver sheet — internal run plan' })}</h1>
          <p>{t('businessModel.dispatch.manifest.date', { defaultValue: 'Date' })}: {manifestRun.stops[0]?.operationDate ?? operationDate}</p>
          <p>{t('businessModel.dispatch.manifest.driver', { defaultValue: 'Driver' })}: {manifestRun.driverName}{manifestRun.carNumber ? ` · ${t('businessModel.dispatch.manifest.car', { defaultValue: 'Car' })}: ${manifestRun.carNumber}` : ''}{manifestRun.plateNumber ? ` · ${t('businessModel.dispatch.manifest.plate', { defaultValue: 'Plate' })}: ${manifestRun.plateNumber}` : ''}</p>
          <table>
            <thead><tr><th>#</th><th>{t('businessModel.dispatch.manifest.reference', { defaultValue: 'Reference' })}</th><th>{t('businessModel.dispatch.manifest.customer', { defaultValue: 'Customer' })}</th><th>{t('businessModel.dispatch.manifest.stop', { defaultValue: 'Stop' })}</th><th>{t('businessModel.dispatch.manifest.address', { defaultValue: 'Address notes' })}</th><th>{t('businessModel.dispatch.manifest.phone', { defaultValue: 'Phone' })}</th><th>{t('businessModel.dispatch.manifest.cod', { defaultValue: 'COD' })}</th><th>{t('businessModel.dispatch.manifest.window', { defaultValue: 'Window' })}</th><th>{t('businessModel.reports.statusHeader', { defaultValue: 'Status' })}</th></tr></thead>
            <tbody>
              {manifestRun.stops.map((s, idx) => (
                <tr key={s.id}><td>{fmt(idx+1)}</td><td>{s.reference ?? '—'}</td><td>{s.customerName}</td><td>{s.stopLabel}</td><td>{s.addressNotes ?? '—'}</td><td>{s.phone ?? '—'}</td><td>{s.codAmountSar ?? '—'}</td><td>{s.serviceWindow ? t(`businessModel.stops.windows.${s.serviceWindow}` as never, { defaultValue: s.serviceWindow }) : '—'}</td><td>{t(`businessModel.stops.statuses.${s.status}` as never, { defaultValue: s.status })}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="bm-manifest-totals">{runWorkload(manifestRun.stops).codTotalSar} SAR</p>
          <p className="vega-print-disclaimer">مستند تشغيلي داخلي — ليس مستند نقل نظامياً ولا يثبت صحة العنوان الوطني<br/>Internal operational document — not an official transport document and not proof of National Address validity.</p>
        </div>
      ) : null}
    </div>,
    document.body
  ) : null;

  if (!record) {
    // Stop-level delivery truth exists independently of the financial close.
    // Show it honestly: collected/remitted stay ABSENT here (never zero-filled)
    // until Evening Close records them. Print/export remain gated on a close.
    return (
      <>
        <section className="bm-panel" data-testid="reports-view">
          <div className="bm-panel-head"><div><span>{t('businessModel.reports.tag', { defaultValue: 'REPORTS' })}</span><h2>{t('businessModel.reports.title', { defaultValue: 'Reports' })} — {operationDate}</h2><p>{t('businessModel.reports.desc', { defaultValue: 'Company and per-driver reports derived from the close.' })}</p></div></div>
          <div className="bm-provider-row">
            <label className="bm-field"><span>{t('businessModel.close.dateLabel')}</span><input type="date" value={operationDate} onChange={e => onOperationDateChange(e.target.value)} data-testid="reports-date" /></label>
          </div>
          {dayStops.length === 0 ? (
            <div data-testid="reports-empty" className="bm-import-note" style={{ padding: 18, border: '1px dashed var(--line)', borderRadius: 8, background: 'var(--paper-2)', textAlign: 'center' }}>
              <p>{t('businessModel.reports.empty', { defaultValue: 'Close this date to create a report' })}</p>
              <button className="bm-primary" onClick={onGotoClose} data-testid="reports-cta-close">{t('businessModel.reports.goClose', { defaultValue: 'Go to Evening Close' })}</button>
            </div>
          ) : (
            <>
              <p data-testid="reports-no-close-note" role="note" className="bm-import-warning" style={{ padding: 10, background: 'var(--brass-soft)', borderRadius: 6 }}>
                {t('businessModel.reports.noCloseNote')}
              </p>
              <dl className="bm-import-counts" data-testid="reports-company-stops-only">
                <div><dt>{t('businessModel.reports.assigned', { defaultValue: 'Stops' })}</dt><dd>{fmt(dayStops.length)}</dd></div>
                <div><dt>{t('businessModel.reports.delivered', { defaultValue: 'Delivered' })}</dt><dd>{fmt(delivered)}</dd></div>
                <div><dt>{t('businessModel.reports.returned', { defaultValue: 'Returned' })}</dt><dd>{fmt(returned)}</dd></div>
                <div><dt>{t('businessModel.reports.pending', { defaultValue: 'Pending' })}</dt><dd>{fmt(pending)}</dd></div>
                <div><dt>{t('businessModel.reports.codExpected', { defaultValue: 'COD expected (delivered stops)' })}</dt><dd data-testid="reports-cod-expected-stops-only">{fmt(codExpected)} SAR</dd></div>
              </dl>
              <h3>{t('businessModel.reports.perDriverTitle', { defaultValue: 'Per-driver runs' })}</h3>
              {board.runs.length === 0 && <p className="bm-import-note">{t('businessModel.reports.unassignedOnly', { defaultValue: 'All stops unassigned — assign in Dispatch.' })}</p>}
              {renderRuns(false)}
              {board.unassigned.length > 0 && (
                <div data-testid="reports-unassigned"><h4>{t('businessModel.dispatch.unassignedTitle', { defaultValue: 'Unassigned' })}</h4><p>{fmt(board.unassigned.length)} {t('businessModel.reports.stops', { defaultValue: 'stops' })}</p></div>
              )}
              <button className="bm-primary" onClick={onGotoClose} data-testid="reports-cta-close">{t('businessModel.reports.goClose', { defaultValue: 'Go to Evening Close' })}</button>
            </>
          )}
        </section>
        {printPortal}
      </>
    );
  }

  return (
    <>
      <section className="bm-panel" data-testid="reports-view">
        <div className="bm-panel-head"><div><span>{t('businessModel.reports.tag', { defaultValue: 'REPORTS' })}</span><h2>{t('businessModel.reports.title', { defaultValue: 'Reports' })} — {operationDate}</h2></div>
          <span data-testid="reports-status" className={`bm-report-status ${isDraft ? 'draft' : 'saved'}`} style={{ padding:'4px 8px', borderRadius:4, background: isDraft ? 'var(--brass-soft)' : 'var(--green-soft)', color: isDraft ? '#7c5a17' : 'var(--pine)', font: '600 10px var(--font-ibm-plex-mono)' }}>
            {isDraft ? t('businessModel.reports.draft', { defaultValue: 'DRAFT / غير مطابق' }) : isLegacy ? t('businessModel.reports.legacy', { defaultValue: 'Recorded (legacy)' }) : t('businessModel.reports.reconciled', { defaultValue: 'Reconciled ✓' })}
          </span>
        </div>

        <div className="bm-provider-row">
          <label className="bm-field"><span>{t('businessModel.close.dateLabel')}</span><input type="date" value={operationDate} onChange={e => onOperationDateChange(e.target.value)} data-testid="reports-date" /></label>
        </div>

        {isDraft && (
          <p data-testid="reports-draft-guard" role="alert" className="bm-import-warning" style={{ padding: 10, background: 'var(--brass-soft)', borderRadius: 6 }}>{t('businessModel.reports.draftGuard', { defaultValue: 'DRAFT — not definitive. No export. Reconcile in Evening Close.' })} DRAFT / غير مطابق</p>
        )}

        <h3>{t('businessModel.reports.companyTitle', { defaultValue: 'Company report' })}</h3>
        <dl className="bm-import-counts" data-testid="reports-company">
          <div><dt>{t('businessModel.reports.assigned', { defaultValue: 'Stops' })}</dt><dd>{fmt(dayStops.length)}</dd></div>
          <div><dt>{t('businessModel.reports.delivered', { defaultValue: 'Delivered' })}</dt><dd>{fmt(delivered)}</dd></div>
          <div><dt>{t('businessModel.reports.returned', { defaultValue: 'Returned' })}</dt><dd>{fmt(returned)}</dd></div>
          <div><dt>{t('businessModel.reports.pending', { defaultValue: 'Pending' })}</dt><dd>{fmt(pending)}</dd></div>
          <div><dt>{t('businessModel.reports.codExpected', { defaultValue: 'COD expected (delivered stops)' })}</dt><dd data-testid="reports-cod-expected">{fmt(codExpected)} SAR</dd></div>
          <div><dt>{t('businessModel.reports.collected', { defaultValue: 'Collected' })}</dt><dd>{fmt(collected)} SAR</dd></div>
          <div><dt>{t('businessModel.reports.remitted', { defaultValue: 'Remitted' })}</dt><dd>{fmt(remitted)} SAR</dd></div>
          <div><dt>{t('businessModel.reports.outstanding', { defaultValue: 'Outstanding' })}</dt><dd data-testid="reports-outstanding">{fmt(outstanding)} SAR</dd></div>
          {uncollected > 0 && <div><dt>{t('businessModel.reports.uncollected', { defaultValue: 'Not yet collected' })}</dt><dd data-testid="reports-uncollected">{fmt(uncollected)} SAR</dd></div>}
          {overRemitted > 0 && <div><dt>{t('businessModel.reports.overRemitted', { defaultValue: 'Over-remitted credit' })}</dt><dd data-testid="reports-over">{fmt(overRemitted)} SAR</dd></div>}
          <div><dt>{t('businessModel.reports.podGaps', { defaultValue: 'POD gaps' })}</dt><dd data-testid="reports-pod-gaps">{fmt(companyPodGaps)}</dd></div>
        </dl>
        <p className="bm-import-note">{t('businessModel.reports.cashNote', { defaultValue: 'Collected / remitted are recorded values; COD expected derives from delivered stops.' })}</p>
        <p className="bm-import-note" data-testid="reports-cash-attribution">{t('businessModel.reports.notAttributable', { defaultValue: 'Cash not attributable per driver from recorded data' })}</p>

        <h3>{t('businessModel.reports.perDriverTitle', { defaultValue: 'Per-driver runs' })}</h3>
        {board.runs.length === 0 && dayStops.length === 0 && <p className="bm-import-note">{t('businessModel.reports.noStops', { defaultValue: 'No stops for this date' })}</p>}
        {board.runs.length === 0 && dayStops.length > 0 && <p className="bm-import-note">{t('businessModel.reports.unassignedOnly', { defaultValue: 'All stops unassigned — assign in Dispatch.' })}</p>}
        {renderRuns(true)}
        {board.unassigned.length > 0 && (
          <div data-testid="reports-unassigned"><h4>{t('businessModel.dispatch.unassignedTitle', { defaultValue: 'Unassigned' })}</h4><p>{fmt(board.unassigned.length)} {t('businessModel.reports.stops', { defaultValue: 'stops' })}</p></div>
        )}

        <div className="bm-import-choices">
          <button className="bm-primary" data-testid="reports-print-company" disabled={isDraft} onClick={doPrintCompany}>{t('businessModel.reports.printPdf', { defaultValue: 'Print / Save PDF' })}</button>
          <button className="bm-primary" data-testid="reports-export-excel" disabled={isDraft} onClick={doExcel}>{t('businessModel.reports.exportExcel', { defaultValue: 'Export Excel' })}</button>
        </div>
        {exportMsg && <p className="bm-import-note" data-testid="reports-export-msg">{exportMsg}</p>}
        {isDraft && <p className="bm-import-note">{t('businessModel.reports.noExportDraft', { defaultValue: 'No definitive export while draft.' })}</p>}
      </section>
      {printPortal}
    </>
  );
}
