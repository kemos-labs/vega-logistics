// VEGA — Morning dispatch board + internal driver sheet (Release R3).
// Print-first manifest; zero network calls; assignment writes through the
// same transactional stops seam. The manifest is an INTERNAL OPERATIONAL
// DOCUMENT — the bilingual disclaimer is mandatory on every printed page.

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { commitBundle } from '@/lib/backup';
import {
  assignStop, buildDispatchBoard, assignableDrivers, moveStop, runWorkload, runKey, unassignStop,
  type DriverRun, type RunWorkload as Workload,
} from '@/lib/dispatch';
import { suggestStopOrder, type RouteSuggestion } from '@/lib/routeLite';
import { updateStopRecord } from '@/lib/stops';
import { toDateString } from '@/lib/operationsReporting';
import type { StopRecord } from '@/lib/stops';
import type { DriverRecord } from '@/lib/types';

export function DispatchBoardView({ stops, setStops, drivers, operationDate: controlledDate, onOperationDateChange }: {
  stops: StopRecord[];
  setStops: (value: StopRecord[] | ((prev: StopRecord[]) => StopRecord[])) => void;
  drivers: DriverRecord[];
  operationDate?: string;
  onOperationDateChange?: (d:string)=>void;
}) {
  const { t, i18n } = useTranslation();
  const S = 'businessModel.dispatch.';
  const ar = i18n.language === 'ar';
  const fmt = (value: number) => new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US').format(value);

  const [internalDate, setInternalDate] = useState(() => toDateString(new Date()));
  const date = controlledDate ?? internalDate;
  const setDate = (d:string) => { if (onOperationDateChange) onOperationDateChange(d); else setInternalDate(d); };
  const [message, setMessage] = useState('');
  const [printRun, setPrintRun] = useState<string | null>(null);
  // Route-lite (R7 Phase 1): suggestion previews per run + one-step undo of
  // the last accepted suggestion. Manual order is always recoverable.
  const [suggestions, setSuggestions] = useState<Record<string, RouteSuggestion>>({});
  const [lastApplied, setLastApplied] = useState<{ runId: string; prev: Record<string, number | undefined> } | null>(null);

  const dayStops = useMemo(() => stops.filter(stop => stop.operationDate === date), [stops, date]);
  const board = useMemo(() => buildDispatchBoard(dayStops), [dayStops]);
  const driverOptions = useMemo(() => assignableDrivers(drivers), [drivers]);

  function persist(next: StopRecord[], successMessage?: string): boolean {
    const result = commitBundle({ stops: next }, undefined, { keys: ['stops'] });
    if (result.persistedOk) { setStops(next); if (successMessage) setMessage(successMessage); return true; }
    setMessage(t(S + (result.rollbackOk ? 'persistFailed' : 'rollbackCritical'), { keys: result.failedKeys.join(', ') }));
    return false;
  }

  const doAssign = (stopId: string, driverId: string) => {
    const driver = driverOptions.find(option => option.id === driverId);
    if (!driver) return;
    persist(assignStop(stops, stopId, { fullName: driver.fullName, vehicle: driver.vehicle, carNumber: driver.carNumber, plateNumber: driver.plateNumber }, new Date().toISOString()));
  };
  const doUnassign = (stopId: string) => persist(unassignStop(stops, stopId, new Date().toISOString()));
  const doMove = (stopId: string, direction: 'up' | 'down') => persist(moveStop(stops, stopId, direction, new Date().toISOString()));

  const doSuggest = (run: DriverRun) => {
    if (run.stops.length < 2) { setMessage(t(S + 'routelite.emptyNote')); return; }
    setSuggestions(prev => ({ ...prev, [runKey(run)]: suggestStopOrder(run.stops) }));
  };
  const doDiscardSuggest = (run: DriverRun) => setSuggestions(prev => {
    const next = { ...prev };
    delete next[runKey(run)];
    return next;
  });
  const doAcceptSuggest = (run: DriverRun) => {
    const runId = runKey(run);
    const suggestion = suggestions[runId];
    if (!suggestion) return;
    const nowIso = new Date().toISOString();
    const prev: Record<string, number | undefined> = {};
    for (const stop of run.stops) prev[stop.id] = stop.sequence;
    const rank = new Map(suggestion.order.map((id, index) => [id, index + 1]));
    const next = stops.map(stop => rank.has(stop.id)
      ? updateStopRecord(stop, { sequence: rank.get(stop.id) as number }, nowIso)
      : stop);
    if (persist(next, t(S + 'routelite.acceptedMsg'))) {
      setLastApplied({ runId, prev });
      doDiscardSuggest(run);
    }
  };
  const doUndoSuggest = () => {
    if (!lastApplied) return;
    const nowIso = new Date().toISOString();
    const next = stops.map(stop => stop.id in lastApplied.prev
      ? updateStopRecord(stop, { sequence: lastApplied.prev[stop.id] }, nowIso)
      : stop);
    if (persist(next)) setLastApplied(null);
  };

  const doPrint = (run: DriverRun) => {
    setPrintRun(runKey(run)); // stable operational identity, NOT display name
    // next frame so the print-only section mounts before the dialog
    requestAnimationFrame(() => { window.print(); });
  };

  const workloadLine = (workload: Workload) =>
    `${t(S + 'workload.count')}: ${fmt(workload.stopCount)} · ${t(S + 'workload.cod')}: ${fmt(workload.codTotalSar)} · ${t(S + 'workload.morning')}/${t(S + 'workload.afternoon')}/${t(S + 'workload.evening')}: ${fmt(workload.windows.morning)}/${fmt(workload.windows.afternoon)}/${fmt(workload.windows.evening)} · ${t(S + 'workload.missingAddress')}: ${fmt(workload.missingAddress)} · ${t(S + 'workload.missingPhone')}: ${fmt(workload.missingPhone)} · ${t(S + 'workload.missingShortAddress')}: ${fmt(workload.missingShortAddress)}${workload.missingReference > 0 ? ` · ${t(S + 'workload.missingReference')}: ${fmt(workload.missingReference)}` : ''}`;

  const manifestRun = board.runs.find(run => runKey(run) === printRun);

  return (
    <section className="bm-panel bm-dispatch" data-testid="dispatch-board">
      <div className="bm-panel-head"><div>
        <span>{t(S + 'tag')}</span><h2>{t(S + 'title')}</h2><p>{t(S + 'desc')}</p>
      </div></div>

      <div className="bm-provider-row">
        <label className="bm-field"><span>{t(S + 'dateLabel')}</span>
          <input name="dispatch-date" type="date" value={date} onChange={event => setDate(event.target.value)} />
        </label>
        <output className="bm-stops-totals" data-testid="dispatch-unassigned-count">
          {t(S + 'unassignedCount', { count: fmt(board.unassigned.length) })}
        </output>
      </div>

      {/* Unassigned queue */}
      <h3>{t(S + 'unassignedTitle')}</h3>
      {board.unassigned.length === 0
        ? <p className="bm-import-note" data-testid="unassigned-empty">{t(S + 'unassignedEmpty')}</p>
        : (
          <ul className="bm-stops-list" data-testid="unassigned-list">
            {board.unassigned.map(stop => (
              <li key={stop.id} className="bm-stop-row" data-testid={`unassigned-${stop.reference ?? stop.id}`}>
                <span className="bm-stop-main">
                  <strong>{stop.reference ? `${stop.reference} · ` : ''}{stop.customerName}</strong>
                  <span> — {stop.stopLabel}</span>
                  {stop.driverName && <small> · {t(S + 'providerReported')}: {stop.driverName}</small>}
                </span>
                <label className="bm-assign-label">
                  <span className="bm-visually-hidden">{t(S + 'assignAria', { label: stop.reference ?? stop.stopLabel })}</span>
                  <select
                    aria-label={t(S + 'assignAria', { label: stop.reference ?? stop.stopLabel })}
                    defaultValue=""
                    onChange={event => { if (event.target.value !== '') doAssign(stop.id, event.target.value); }}
                    data-testid={`assign-${stop.reference ?? stop.id}`}
                  >
                    <option value="">{t(S + 'assignPlaceholder')}</option>
                    {driverOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
              </li>
            ))}
          </ul>
        )}

      {/* Per-driver runs */}
      {board.runs.map(run => {
        const workload = runWorkload(run.stops);
        const runId = runKey(run);
        return (
          <div key={runId} className="bm-run" data-testid={`run-${runId}`}>
            <div className="bm-run-head">
              <h3>{run.driverName}{run.carNumber ? ` · ${run.carNumber}` : ''}</h3>
              <div className="bm-stop-actions">
                <button data-testid={`suggest-${runId}`} onClick={() => doSuggest(run)}>{t(S + 'routelite.suggestBtn')}</button>
                <button data-testid={`print-${runId}`} onClick={() => doPrint(run)}>{t(S + 'printBtn')}</button>
              </div>
            </div>
            <p className="bm-import-note" data-testid={`workload-${run.driverName}`}>{workloadLine(workload)}</p>
            {lastApplied?.runId === runId && (
              <p className="bm-import-note" data-testid={`undo-row-${runId}`}>
                <button data-testid={`undo-${runId}`} onClick={doUndoSuggest}>{t(S + 'routelite.undoBtn')}</button>
              </p>
            )}
            {suggestions[runId] && (
              <div className="bm-suggest" data-testid={`suggest-preview-${runId}`}>
                <h4>{t(S + 'routelite.previewTitle')}</h4>
                <p className="bm-import-note">{suggestions[runId].rationale.map(code => t(S + 'routelite.' + code)).join(' · ')}</p>
                {suggestions[runId].usedCoords && <p className="bm-import-note">{t(S + 'routelite.coordsNote')}</p>}
                <div className="bm-suggest-cols">
                  <div>
                    <h5>{t(S + 'routelite.currentList')}</h5>
                    <ol>{run.stops.map(stop => <li key={stop.id}>{stop.reference ? `${stop.reference} · ` : ''}{stop.stopLabel}</li>)}</ol>
                  </div>
                  <div>
                    <h5>{t(S + 'routelite.suggestedList')}</h5>
                    <ol>{suggestions[runId].order.map(id => {
                      const stop = run.stops.find(s => s.id === id);
                      return <li key={id}>{stop?.reference ? `${stop.reference} · ` : ''}{stop?.stopLabel ?? id}</li>;
                    })}</ol>
                  </div>
                </div>
                <div className="bm-stop-actions">
                  <button className="bm-primary" data-testid={`accept-${runId}`} onClick={() => doAcceptSuggest(run)}>{t(S + 'routelite.acceptBtn')}</button>
                  <button data-testid={`discard-${runId}`} onClick={() => doDiscardSuggest(run)}>{t(S + 'routelite.discardBtn')}</button>
                </div>
              </div>
            )}
            <ul className="bm-stops-list">
              {run.stops.map((stop, index) => (
                <li key={stop.id} className="bm-stop-row" data-testid={`runstop-${stop.reference ?? stop.id}`}>
                  <span className="bm-stop-main">
                    <strong>{index + 1}. {stop.reference ? `${stop.reference} · ` : ''}{stop.customerName}</strong>
                    <span> — {stop.stopLabel}</span>
                  </span>
                  <span className="bm-stop-actions">
                    <button aria-label={t(S + 'moveUpAria', { label: stop.reference ?? stop.stopLabel })} data-testid={`up-${stop.reference ?? stop.id}`} disabled={index === 0} onClick={() => doMove(stop.id, 'up')}>▲</button>
                    <button aria-label={t(S + 'moveDownAria', { label: stop.reference ?? stop.stopLabel })} data-testid={`down-${stop.reference ?? stop.id}`} disabled={index === run.stops.length - 1} onClick={() => doMove(stop.id, 'down')}>▼</button>
                    <button onClick={() => doUnassign(stop.id)}>{t(S + 'unassignBtn')}</button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {message !== '' && <p className="bm-import-note" role="status" data-testid="dispatch-message">{message}</p>}

      {/* ── print-only driver sheet ── */}
      {manifestRun && (
        <div className="bm-manifest-print" data-testid="driver-sheet">
          <header>
            <h1>{t(S + 'manifest.title')}</h1>
            <p>{t(S + 'manifest.date')}: {manifestRun.stops[0]?.operationDate ?? date} · {t(S + 'manifest.generatedAt')}: {new Date().toLocaleString(ar ? 'ar-SA-u-nu-latn' : 'en-US')}</p>
            <p className="bm-manifest-driver">{t(S + 'manifest.driver')}: {manifestRun.driverName}{manifestRun.carNumber ? ` · ${t(S + 'manifest.car')}: ${manifestRun.carNumber}` : ''}{manifestRun.plateNumber ? ` · ${t(S + 'manifest.plate')}: ${manifestRun.plateNumber}` : ''}</p>
          </header>
          <table>
            <thead>
              <tr>
                <th>#</th><th>{t(S + 'manifest.reference')}</th><th>{t(S + 'manifest.customer')}</th>
                <th>{t(S + 'manifest.stop')}</th><th>{t(S + 'manifest.address')}</th>
                <th>{t(S + 'manifest.phone')}</th><th>{t(S + 'manifest.cod')}</th><th>{t(S + 'manifest.window')}</th>
              </tr>
            </thead>
            <tbody>
              {manifestRun.stops.map((stop, index) => (
                <tr key={stop.id}>
                  <td>{fmt(index + 1)}</td>
                  <td>{stop.reference ?? '—'}</td>
                  <td>{stop.customerName}</td>
                  <td>{stop.stopLabel}</td>
                  <td>{stop.addressNotes ?? '—'}{stop.shortAddress ? ` · ${stop.shortAddress}` : ''}</td>
                  <td>{stop.phone ?? '—'}</td>
                  <td>{stop.codAmountSar === undefined ? '—' : fmt(stop.codAmountSar)}</td>
                  <td>{stop.serviceWindow ? t(S + 'windows.' + stop.serviceWindow) : '—'}</td>
                </tr>
              ))}
            </tbody>
          <tfoot className="bm-manifest-disclaimer">
            <tr><td colSpan={8}>
              «مستند تشغيلي داخلي — ليس مستند نقل نظامياً ولا يثبت صحة العنوان الوطني»<br />
              Internal operational document — not an official transport document and not proof of National Address validity.
            </td></tr>
          </tfoot>
          </table>
          <p className="bm-manifest-totals">{workloadLine(runWorkload(manifestRun.stops))}</p>
          <p className="bm-manifest-sign">{t(S + 'manifest.signature')}</p>
        </div>
      )}
    </section>
  );
}
