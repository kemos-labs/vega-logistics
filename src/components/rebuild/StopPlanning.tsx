// VEGA — Stop Planning workspace (Release R2-B).
// Focused, local-first: create / paste / CSV-import / review / edit / retain
// shipment stops for an operation date. Dispatch/sequencing is R3; compliance
// validation is R5. Persistence goes through the transactional storage seam
// (commitBundle) — React state moves only after a successful write, and the
// import preview stays open if persistence fails.

import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { commitBundle, STORAGE_KEYS, type PersistResult } from '@/lib/backup';
import { normalizeDigits } from '@/lib/providerMessageParser';
import {
  createStopRecord, identifyStopDuplicates, sortStopsForDate, updateStopRecord,
  validateStopRecord, type StopFieldError, type StopRecord, type StopStatus,
} from '@/lib/stops';
import { IMPORT_MAX_FILE_BYTES, IMPORT_MAX_ROWS, previewStopImport, type ImportParseResult } from '@/lib/stopImport';
import { toDateString } from '@/lib/operationsReporting';

type Draft = Record<string, string>;

const EMPTY_DRAFT: Draft = { customerName: '', reference: '', stopLabel: '', addressNotes: '', phone: '', codAmountSar: '', serviceWindow: '' };

export function StopPlanning({ stops, setStops }: {
  stops: StopRecord[];
  setStops: (value: StopRecord[] | ((prev: StopRecord[]) => StopRecord[])) => void;
}) {
  const { t, i18n } = useTranslation();
  const S = 'businessModel.stops.';
  const ar = i18n.language === 'ar';
  const fmt = (value: number) => new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US').format(value);

  const [date, setDate] = useState(() => toDateString(new Date()));
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<StopFieldError[]>([]);
  const [message, setMessage] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ImportParseResult | null>(null);
  const [warningsAcked, setWarningsAcked] = useState(false);
  const [fileError, setFileError] = useState('');
  const [dupAck, setDupAck] = useState(false);
  const [dupNeedsAck, setDupNeedsAck] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Storage seam: transactional write; React state moves only on success. */
  function persist(next: StopRecord[], successMessage?: string): boolean {
    const result: PersistResult = commitBundle({ stops: next }, undefined, { keys: ['stops'] });
    if (result.persistedOk) {
      setStops(next);
      if (successMessage) setMessage(successMessage);
      return true;
    }
    setMessage(t(S + (result.rollbackOk ? 'persistFailed' : 'rollbackCritical'), { keys: result.failedKeys.join(', ') }));
    return false;
  }

  const dayStops = useMemo(
    () => sortStopsForDate(stops.filter(stop => stop.operationDate === date)),
    [stops, date],
  );
  const visibleStops = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === '') return dayStops;
    return dayStops.filter(stop =>
      stop.reference?.toLowerCase().includes(query)
      || stop.customerName.toLowerCase().includes(query)
      || stop.stopLabel.toLowerCase().includes(query));
  }, [dayStops, search]);
  const codTotal = dayStops.reduce((sum, stop) => sum + (stop.codAmountSar ?? 0), 0);

  function errorText(fieldErrorsList: StopFieldError[], field: string): string | undefined {
    const found = fieldErrorsList.find(error => error.field === field);
    return found ? t(S + 'errors.' + found.code) : undefined;
  }

  function saveStop(event: React.FormEvent) {
    event.preventDefault();
    // Non-empty input that fails numeric parsing stays NaN so validation
    // reports it (never silently saved as 'no COD'). Blank ⇒ no COD.
    const rawCod = normalizeDigits(draft.codAmountSar.trim());
    const numericCod = rawCod === '' ? undefined : (Number.isFinite(Number(rawCod)) ? Number(rawCod) : Number.NaN);
    const base = editingId ? stops.find(stop => stop.id === editingId) : undefined;
    const candidateInput = {
      ...(base ?? {}),
      operationDate: date,
      customerName: draft.customerName,
      reference: draft.reference || undefined,
      stopLabel: draft.stopLabel,
      addressNotes: draft.addressNotes || undefined,
      phone: draft.phone || undefined,
      codAmountSar: numericCod, // NaN survives for validation; undefined = blank
      serviceWindow: draft.serviceWindow === '' ? undefined : draft.serviceWindow,
      status: (base?.status ?? 'planned'),
    };
    // Dry-run validation for inline feedback (values preserved on failure).
    const validation = validateStopRecord({ ...candidateInput, createdAt: base?.createdAt ?? new Date().toISOString(), updatedAt: base?.updatedAt ?? new Date().toISOString() });
    if (!validation.ok) {
      setFieldErrors(validation.errors);
      const firstInvalid = formRef.current?.querySelector<HTMLElement>(`[name="${validation.errors[0].field}"]`);
      firstInvalid?.focus();
      return;
    }
    setFieldErrors([]);
    const nowIso = new Date().toISOString();
    try {
      const next = editingId
        ? updateStopRecord(base as StopRecord, candidateInput as Partial<StopRecord>, nowIso)
        : createStopRecord(candidateInput as never, nowIso);
      // Manual entries obey the SAME duplicate policy as imports (contract C):
      // the edited record excludes itself from the comparison.
      const othersForDup = stops.filter(stop => stop.id !== next.id);
      const dupFindings = identifyStopDuplicates([next], othersForDup.filter(stop => stop.operationDate === next.operationDate));
      const conflict = dupFindings.find(finding => finding.kind === 'conflict');
      const exact = dupFindings.find(finding => finding.kind === 'exact');
      if (exact) {
        setFieldErrors([]);
        setMessage(t(S + 'dupExactBlocked'));
        return;
      }
      if (conflict) {
        setFieldErrors([]);
        setMessage(t(S + 'dupConflictBlocked'));
        return;
      }
      if (dupFindings.some(finding => finding.kind === 'probable') && !dupAck) {
        setDupNeedsAck(true);
        setMessage(t(S + 'dupProbableAck'));
        return;
      }
      setDupNeedsAck(false);
      const others = stops.filter(stop => stop.id !== next.id);
      if (persist([...others, next], t(S + (editingId ? 'savedEdit' : 'savedOne')))) {
        setDraft(EMPTY_DRAFT);
        setEditingId(null);
      }
    } catch (error) {
      setMessage(String((error as Error).message));
    }
  }

  function startEdit(stop: StopRecord) {
    setEditingId(stop.id);
    setFieldErrors([]);
    setMessage('');
    setDraft({
      customerName: stop.customerName,
      reference: stop.reference ?? '',
      stopLabel: stop.stopLabel,
      addressNotes: stop.addressNotes ?? '',
      phone: stop.phone ?? '',
      codAmountSar: stop.codAmountSar === undefined ? '' : String(stop.codAmountSar),
      serviceWindow: stop.serviceWindow ?? '',
    });
    formRef.current?.scrollIntoView?.({ block: 'nearest' });
  }

  function cancelEdit() { setEditingId(null); setDraft(EMPTY_DRAFT); setFieldErrors([]); }

  function confirmDelete(id: string) {
    persist(stops.filter(stop => stop.id !== id), t(S + 'deleted'));
    setDeleteCandidate(null);
  }

  // ── bulk import ───────────────────────────────────────────────
  const preview = parsed && parsed.ok ? parsed.preview : null;
  const warningRowCount = preview
    ? preview.valid.filter(row => row.warnings.length > 0).length
      + preview.duplicates.filter(finding => finding.kind === 'probable').length
      + (preview.unknownHeaders.length > 0 ? 1 : 0) // ignored columns ⇒ values dropped ⇒ needs ack
    : 0;
  const exactDuplicateIndexes = new Set(preview ? preview.duplicates.filter(finding => finding.kind === 'exact').map(finding => finding.incomingIndex) : []);
  const confirmable = !!preview
    && !preview.blockingConflicts
    && preview.invalid.length === 0
    && (warningRowCount === 0 || warningsAcked);

  function doParse() { setParsed(rawText.trim() === '' ? null : previewStopImport(rawText, stops, date)); setWarningsAcked(false); }

  function confirmImport() {
    if (!preview || !confirmable) return;
    const nowIso = new Date().toISOString();
    const created: StopRecord[] = [];
    for (const row of preview.valid) {
      if (exactDuplicateIndexes.has(row.index)) continue; // identical ⇒ not inserted twice
      try { created.push(createStopRecord(row.draft as never, nowIso)); } catch { /* preview guarantees validity */ }
    }
    // Repeated confirm cannot duplicate the batch: source is cleared only
    // AFTER a persisted write; a failed write keeps everything open.
    if (!persist([...stops, ...created])) return;
    setRawText(''); setFileName(''); setParsed(null); setWarningsAcked(false);
    setMessage(t(S + 'import.importSuccess', { count: created.length }));
  }

  async function onFileChosen(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    if (file.size > IMPORT_MAX_FILE_BYTES) {
      setFileError(t(S + 'import.errTooLarge'));
      return;
    }
    try {
      const text = await file.text();
      setFileError('');
      setRawText(text);
    } catch {
      setFileError(t(S + 'import.errReadFailed'));
    }
  }

  const statusLabel = (status: StopStatus) => t(S + 'statuses.' + status);

  return (
    <section className="bm-panel bm-stops" data-testid="stop-planning">
      <div className="bm-panel-head"><div>
        <span>{t(S + 'tag')}</span><h2>{t(S + 'title')}</h2><p>{t(S + 'desc')}</p>
      </div></div>

      <p className="bm-import-note" data-testid="local-note">{t(S + 'localNote')}</p>

      {/* ── toolbar: date / search / totals ── */}
      <div className="bm-provider-row">
        <label className="bm-field"><span>{t(S + 'dateLabel')}</span>
          <input name="operation-date" type="date" value={date} onChange={event => { setDate(event.target.value); setParsed(null); }} />
        </label>
        <label className="bm-field bm-grow"><span>{t(S + 'searchLabel')}</span>
          <input name="stops-search" value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <output className="bm-stops-totals" data-testid="stops-totals">
          {t(S + 'totals', { count: fmt(dayStops.length), cod: fmt(codTotal) })}
        </output>
      </div>

      {/* ── manual add / edit form ── */}
      <form ref={formRef} className="bm-stops-form" onSubmit={saveStop} noValidate>
        <h3>{editingId ? t(S + 'editTitle') : t(S + 'addTitle')}</h3>
        <div className="bm-stops-grid">
          <label className="bm-field"><span>{t(S + 'fields.customerName')}</span>
            <input name="customerName" aria-describedby="err-customerName" value={draft.customerName} onChange={event => setDraft(prev => ({ ...prev, customerName: event.target.value }))} />
            {errorText(fieldErrors, 'customerName') && <em id="err-customerName" role="alert">{errorText(fieldErrors, 'customerName')}</em>}
          </label>
          <label className="bm-field"><span>{t(S + 'fields.reference')}</span>
            <input name="reference" value={draft.reference} onChange={event => setDraft(prev => ({ ...prev, reference: event.target.value }))} />
          </label>
          <label className="bm-field"><span>{t(S + 'fields.stopLabel')}</span>
            <input name="stopLabel" aria-describedby="err-stopLabel" value={draft.stopLabel} onChange={event => setDraft(prev => ({ ...prev, stopLabel: event.target.value }))} />
            {errorText(fieldErrors, 'stopLabel') && <em id="err-stopLabel" role="alert">{errorText(fieldErrors, 'stopLabel')}</em>}
          </label>
          <label className="bm-field"><span>{t(S + 'fields.addressNotes')}</span>
            <input name="addressNotes" value={draft.addressNotes} onChange={event => setDraft(prev => ({ ...prev, addressNotes: event.target.value }))} />
          </label>
          <label className="bm-field"><span>{t(S + 'fields.phone')}</span>
            <input name="phone" inputMode="tel" aria-describedby="phone-privacy err-phone" value={draft.phone} onChange={event => setDraft(prev => ({ ...prev, phone: event.target.value }))} />
            <small id="phone-privacy">{t(S + 'privacyNote')}</small>
            {errorText(fieldErrors, 'phone') && <em id="err-phone" role="alert">{errorText(fieldErrors, 'phone')}</em>}
          </label>
          <label className="bm-field"><span>{t(S + 'fields.codAmountSar')}</span>
            <input name="codAmountSar" inputMode="decimal" aria-describedby="err-cod" value={draft.codAmountSar} onChange={event => setDraft(prev => ({ ...prev, codAmountSar: event.target.value }))} />
            {errorText(fieldErrors, 'codAmountSar') && <em id="err-cod" role="alert">{errorText(fieldErrors, 'codAmountSar')}</em>}
          </label>
          <label className="bm-field"><span>{t(S + 'fields.serviceWindow')}</span>
            <select name="serviceWindow" value={draft.serviceWindow} onChange={event => setDraft(prev => ({ ...prev, serviceWindow: event.target.value }))}>
              <option value="">—</option>
              <option value="morning">{t(S + 'windows.morning')}</option>
              <option value="afternoon">{t(S + 'windows.afternoon')}</option>
              <option value="evening">{t(S + 'windows.evening')}</option>
            </select>
          </label>
        </div>
        {dupNeedsAck && (
          <label className="bm-ack" data-testid="dup-ack-row">
            <input type="checkbox" checked={dupAck} onChange={event => setDupAck(event.target.checked)} data-testid="dup-ack" />
            {t(S + 'dupProbableAckLabel')}
          </label>
        )}
        <div className="bm-import-choices">
          <button className="bm-primary" type="submit" data-testid="save-stop">{editingId ? t(S + 'updateBtn') : t(S + 'addBtn')}</button>
          {editingId && <button type="button" onClick={cancelEdit}>{t(S + 'cancelBtn')}</button>}
        </div>
      </form>

      {/* ── day list ── */}
      <h3>{t(S + 'listTitle', { date })}</h3>
      {visibleStops.length === 0
        ? <p className="bm-import-note" data-testid="empty-day">{t(S + 'emptyDay')}</p>
        : (
          <ul className="bm-stops-list" data-testid="stops-list">
            {visibleStops.map(stop => (
              <li key={stop.id} className={`bm-stop-row bm-stop-${stop.status}`} data-testid="stop-row">
                <span className="bm-stop-main">
                  <strong>{stop.reference ? `${stop.reference} · ` : ''}{stop.customerName}</strong>
                  <span> — {stop.stopLabel}</span>
                  {stop.codAmountSar !== undefined && <small> · COD {fmt(stop.codAmountSar)} SAR</small>}
                  <em className={`bm-chip bm-chip-${stop.status}`}>{statusLabel(stop.status)}</em>
                </span>
                {deleteCandidate === stop.id
                  ? (
                    <span className="bm-delete-confirm" data-testid="delete-confirm">
                      {t(S + 'deleteQuestion', { label: stop.reference ?? stop.stopLabel })}
                      <button data-testid="delete-yes" onClick={() => confirmDelete(stop.id)}>{t(S + 'confirmDelete')}</button>
                      <button onClick={() => setDeleteCandidate(null)}>{t(S + 'cancelBtn')}</button>
                    </span>
                  )
                  : (
                    <span className="bm-stop-actions">
                      <button onClick={() => startEdit(stop)}>{t(S + 'editBtn')}</button>
                      <button data-testid={`delete-${stop.reference ?? stop.id}`} onClick={() => setDeleteCandidate(stop.id)}>{t(S + 'deleteBtn')}</button>
                    </span>
                  )}
              </li>
            ))}
          </ul>
        )}

      {/* ── bulk paste / CSV import ── */}
      <div className="bm-provider-import">
        <div className="bm-panel-head"><div><span>{t(S + 'import.tag')}</span><h3>{t(S + 'import.title')}</h3><p>{t(S + 'import.desc')}</p></div></div>
        <textarea
          aria-label={t(S + 'import.pasteLabel')}
          placeholder={t(S + 'import.placeholder')}
          value={rawText}
          rows={4}
          onChange={event => { setRawText(event.target.value); if (parsed) setParsed(null); }}
        />
        <div className="bm-provider-row">
          <label className="bm-field"><span>{t(S + 'import.fileLabel')}</span>
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={event => void onFileChosen(event.target.files?.[0])} />
          </label>
          <button data-testid="parse-stops-btn" onClick={doParse}>{t(S + 'import.parseBtn')}</button>
          <button onClick={() => { setRawText(''); setFileName(''); setParsed(null); setWarningsAcked(false); }}>{t(S + 'import.clearBtn')}</button>
        </div>
        {fileName !== '' && <p className="bm-import-note">{t(S + 'import.fileName')}: {fileName}</p>}
        {fileError !== '' && <p className="bm-import-warning" role="alert" data-testid="file-error">{fileError}</p>}

        <div aria-live="polite">
          {parsed && !parsed.ok && (
            <p className="bm-import-warning" role="alert" data-testid="import-error">
              {parsed.error === 'empty' ? t(S + 'import.errEmpty')
                : parsed.error === 'binary' ? t(S + 'import.errBinary')
                : parsed.error === 'too-large' ? t(S + 'import.errTooLarge')
                : parsed.error === 'malformed-csv' ? t(S + 'import.errMalformed')
                : t(S + 'import.errMissingHeaders')}
            </p>
          )}
          {preview && (
            <div data-testid="import-preview">
              <dl className="bm-import-counts">
                <div><dt>{t(S + 'import.totalRows')}</dt><dd>{fmt(preview.totalRows)}</dd></div>
                <div><dt>{t(S + 'import.validRows')}</dt><dd>{fmt(preview.valid.length)}</dd></div>
                <div><dt>{t(S + 'import.invalidRows')}</dt><dd>{fmt(preview.invalid.length)}</dd></div>
                <div><dt>{t(S + 'import.duplicateRows')}</dt><dd>{fmt(preview.duplicates.length)}</dd></div>
                <div><dt>{t(S + 'import.codTotal')}</dt><dd>{fmt(preview.codTotal)}</dd></div>
              </dl>
              {preview.unknownHeaders.length > 0 && (
                <ul className="bm-import-note" data-testid="unknown-headers">
                  {preview.unknownHeaders.map(header => <li key={header}>{t(S + 'import.unknownHeader', { header })}</li>)}
                </ul>
              )}
              {preview.duplicates.length > 0 && (
                <ul data-testid="duplicate-findings">
                  {preview.duplicates.map((finding, index) => (
                    <li key={`${finding.incomingIndex}-${index}`} className={`bm-import-warning ${finding.kind === 'conflict' ? '' : 'bm-import-note'}`}>
                      {t(S + `import.dup_${finding.kind}`, { row: fmt(finding.incomingIndex + 1), against: fmt((finding.incomingAgainst ?? -1) + 1) })}
                    </li>
                  ))}
                </ul>
              )}
              {preview.invalid.length > 0 && (
                <ul data-testid="invalid-rows">
                  {preview.invalid.map(row => (
                    <li key={row.index}>
                      {t(S + 'import.rowN', { row: fmt(row.index + 1) })}: {row.errors.map(error => `${t(S + 'errors.' + error.code)} (${t(S + 'fields.' + (error.field in { codAmountSar: 'codAmountSar' } ? 'codAmountSar' : error.field))})`).join(' · ')}
                    </li>
                  ))}
                </ul>
              )}
              {preview.valid.length > 0 && (
                <table className="bm-stops-preview-table" data-testid="preview-table">
                  <thead><tr>
                    <th>#</th><th>{t(S + 'fields.reference')}</th><th>{t(S + 'fields.customerName')}</th>
                    <th>{t(S + 'fields.stopLabel')}</th><th>{t(S + 'fields.codAmountSar')}</th>
                  </tr></thead>
                  <tbody>
                    {preview.valid.map(row => (
                      <tr key={row.index} className={exactDuplicateIndexes.has(row.index) ? 'bm-row-exact-dup' : undefined}>
                        <td>{fmt(row.index + 1)}</td>
                        <td>{String(row.draft.reference ?? '—')}</td>
                        <td>{String(row.draft.customerName)}</td>
                        <td>{String(row.draft.stopLabel)}</td>
                        <td>{row.draft.codAmountSar === undefined ? '—' : fmt(Number(row.draft.codAmountSar))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {warningRowCount > 0 && (
                <label className="bm-ack">
                  <input type="checkbox" checked={warningsAcked} onChange={event => setWarningsAcked(event.target.checked)} data-testid="warn-ack" />
                  {t(S + 'import.ackWarnings')}
                </label>
              )}
              {!preview.blockingConflicts && preview.invalid.length === 0 && (
                <div className="bm-import-choices">
                  <button className="bm-primary" data-testid="confirm-import" onClick={confirmImport} disabled={!confirmable}>{t(S + 'import.confirmBtn')}</button>
                  <button data-testid="cancel-import" onClick={() => { setParsed(null); setRawText(''); setWarningsAcked(false); }}>{t(S + 'import.cancelBtn')}</button>
                </div>
              )}
              {(preview.blockingConflicts || preview.invalid.length > 0) && (
                <p className="bm-import-warning" role="alert" data-testid="blocked-note">
                  {preview.blockingConflicts ? t(S + 'import.conflictsBlocked') : t(S + 'import.invalidBlocked')}
                </p>
              )}
            </div>
          )}
          {message !== '' && <p className="bm-import-note" data-testid="stops-message" role="status">{message}</p>}
        </div>
      </div>
    </section>
  );
}
