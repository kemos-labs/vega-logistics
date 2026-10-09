'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { emptyMaintenanceState, deriveInspectionOutcome, INSPECTION_COMPONENTS, getMaintenanceDueStatus, readMaintenanceState, validateMaintenanceState, VEHICLE_MAINTENANCE_STORAGE_KEY, type InspectionChecks, deriveMaintenanceOverview, type MaintenanceIncident, type MaintenanceVehicle, type MaintenanceState, type MaintenanceRecord } from '@/lib/vehicleMaintenance';
import { toDateString } from '@/lib/operationsReporting';
import { buildMaintenanceHistoryCsv } from '@/lib/vehicleMaintenanceExport';

/** Save before updating the view: failed storage must not look like a successful save. */
export function useVehicleMaintenance() {
  const [state, setState] = useState<MaintenanceState>(emptyMaintenanceState);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const parsed = readMaintenanceState(localStorage.getItem(VEHICLE_MAINTENANCE_STORAGE_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate validated external storage after the server render
      if (parsed.ok) setState(parsed.state); else setError('storedDataError');
    } catch { setError('storedDataError'); }
    setLoaded(true);
  }, []);
  const commit = (next: MaintenanceState) => {
    if (!loaded || !validateMaintenanceState(next) || error === 'storedDataError') return false;
    try { localStorage.setItem(VEHICLE_MAINTENANCE_STORAGE_KEY, JSON.stringify(next)); }
    catch { setError('storageError'); return false; }
    setState(next); setError(''); return true;
  };
  // Backup has already persisted transactionally before this setter is called.
  const acceptRestored = (next: MaintenanceState) => { setState(next); setError(''); };
  return { state, commit, acceptRestored, error, loaded };
}

type MaintenanceTab = 'overview' | 'vehicles' | 'repair' | 'oil' | 'inspection' | 'incidents' | 'history';
const MAINTENANCE_TABS: MaintenanceTab[] = ['overview', 'vehicles', 'repair', 'oil', 'inspection', 'incidents', 'history'];
const optionalNumber = (value: string) => value.trim() ? Number(value) : undefined;
const identity = (vehicle: MaintenanceVehicle) => [vehicle.carNumber, vehicle.plate].filter(Boolean).join(' · ');
const latestRecords = (state: MaintenanceState, id: string) => {
  const history = state.records.filter(record => record.vehicleId === id).sort((a, b) => b.date.localeCompare(a.date) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return history.filter((record, i) => history.findIndex(other => other.kind === record.kind) === i);
};

export function VehicleMaintenanceView({ state, commit, error, loaded }: {
  state: MaintenanceState; commit: (next: MaintenanceState) => boolean; error: string; loaded: boolean;
}) {
  const { t, i18n } = useTranslation();
  const text = (key: string) => t('businessModel.maintenanceWorkspace.' + key);
  const today = toDateString(new Date());
  const [tab, setTab] = useState<MaintenanceTab>('overview');
  const [carNumber, setCarNumber] = useState('');
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [city, setCity] = useState('');
  const [insurance, setInsurance] = useState('');
  const [vehicleKm, setVehicleKm] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [kind, setKind] = useState<MaintenanceRecord['kind']>('oil');
  const [date, setDate] = useState(today);
  const [cost, setCost] = useState('');
  const [km, setKm] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueKm, setDueKm] = useState('');
  const [checks, setChecks] = useState<Partial<InspectionChecks>>({});
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [incidentType, setIncidentType] = useState<MaintenanceIncident['type']>('breakdown');
  const [incidentDate, setIncidentDate] = useState(today);
  const [incidentDescription, setIncidentDescription] = useState('');
  const [incidentCost, setIncidentCost] = useState('');
  const [historyVehicle, setHistoryVehicle] = useState('');
  const [historyKind, setHistoryKind] = useState('');
  const disabled = !loaded || error === 'storedDataError';
  const money = (n: number) => new Intl.NumberFormat(i18n.language?.startsWith('ar') ? 'ar-SA-u-nu-latn' : 'en', { maximumFractionDigits: 2 }).format(n);
  const overview = deriveMaintenanceOverview(state, today);
  const selectTab = (next: MaintenanceTab) => {
    setTab(next); setMessage('');
    if (next === 'oil' || next === 'repair' || next === 'inspection') setKind(next);
  };
  const save = (next: MaintenanceState) => {
    if (!validateMaintenanceState(next)) { setMessage('invalid'); return false; }
    if (!commit(next)) { setMessage(''); return false; }
    setMessage('saved'); return true;
  };
  const addVehicle = (event: FormEvent) => {
    event.preventDefault();
    const fold = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
    if (state.vehicles.some(v => (plate.trim() && fold(v.plate) === fold(plate)) || (carNumber.trim() && fold(v.carNumber) === fold(carNumber)))) { setMessage('duplicateVehicle'); return; }
    const id = crypto.randomUUID();
    const vehicle: MaintenanceVehicle = { id, carNumber: carNumber.trim(), plate: plate.trim(), odometerKm: optionalNumber(vehicleKm), availability: 'available', model: model.trim() || undefined, city: city.trim() || undefined, insuranceExpiryDate: insurance || undefined, updatedAt: new Date().toISOString() };
    if (save({ ...state, vehicles: [...state.vehicles, vehicle] })) {
      setCarNumber(''); setPlate(''); setVehicleKm(''); setModel(''); setCity(''); setInsurance(''); setVehicleId(id);
    }
  };
  const addRecord = (event: FormEvent) => {
    event.preventDefault();
    const odometerKm = optionalNumber(km);
    if (date > today || (dueDate && dueDate < date) || (dueKm && odometerKm !== undefined && Number(dueKm) < odometerKm)) { setMessage('invalid'); return; }
    if (kind === 'inspection' && INSPECTION_COMPONENTS.some(key => !checks[key])) { setMessage('invalid'); return; }
    const inspectionChecks = kind === 'inspection' ? checks as InspectionChecks : undefined;
    const outcome = inspectionChecks ? deriveInspectionOutcome(inspectionChecks) : undefined;
    const record: MaintenanceRecord = { id: crypto.randomUUID(), vehicleId, kind, date, costSar: cost.trim() ? Number(cost) : null, description: description.trim(), odometerKm, nextDueDate: dueDate || undefined, nextDueKm: optionalNumber(dueKm), inspectionOutcome: outcome, inspectionChecks, updatedAt: new Date().toISOString() };
    const next: MaintenanceState = { ...state, records: [...state.records, record], vehicles: state.vehicles.map(v => v.id === vehicleId ? { ...v, odometerKm: odometerKm === undefined ? v.odometerKm : Math.max(v.odometerKm ?? 0, odometerKm), availability: kind === 'inspection' && outcome === 'repair-needed' ? 'workshop' : v.availability, updatedAt: record.updatedAt } : v) };
    if (save(next)) { setCost(''); setKm(''); setDueDate(''); setDueKm(''); setDescription(''); setChecks({}); setTab('history'); setHistoryVehicle(vehicleId); setHistoryKind(kind); }
  };
  const addIncident = (event: FormEvent) => {
    event.preventDefault();
    if (incidentDate > today) { setMessage('invalid'); return; }
    const incident: MaintenanceIncident = { id: crypto.randomUUID(), vehicleId, type: incidentType, date: incidentDate, description: incidentDescription.trim(), estimatedCostSar: incidentCost.trim() ? Number(incidentCost) : null, status: 'open', updatedAt: new Date().toISOString() };
    if (save({ ...state, incidents: [...state.incidents, incident], vehicles: state.vehicles.map(v => v.id === vehicleId ? { ...v, availability: 'workshop', updatedAt: incident.updatedAt } : v) })) { setIncidentDescription(''); setIncidentCost(''); }
  };
  const field = (label: string, value: string, change: (v: string) => void, type = 'text') => <label className="bm-field"><span>{text(label)}</span><input type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined} value={value} onChange={e => change(e.target.value)} /></label>;
  const vehicleSelect = <label className="bm-field"><span>{text('vehicle')}</span><select value={vehicleId} onChange={e => setVehicleId(e.target.value)} required><option value="">{text('selectVehicle')}</option>{state.vehicles.map(v => <option key={v.id} value={v.id}>{identity(v)}</option>)}</select></label>;
  const filteredHistory = [...state.records].filter(record => (!historyVehicle || record.vehicleId === historyVehicle) && (!historyKind || record.kind === historyKind)).sort((a, b) => b.date.localeCompare(a.date) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const exportHistory = () => {
    const url = URL.createObjectURL(new Blob([buildMaintenanceHistoryCsv(state, filteredHistory, text)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `vega-maintenance-history-${today}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  return <div className="bm-maintenance-workspace" data-testid="maintenance-workspace">
    <section className="bm-panel">
      <div className="bm-panel-head"><h2>{text('title')}</h2><a href="https://car-maintenance-system-one.vercel.app" target="_blank" rel="noopener noreferrer">{text('openOriginal')}</a></div>
      <p className="bm-import-note">{text('boundary')}</p><p>{text('intervalNote')}</p>
      <nav className="bm-maintenance-tabs" aria-label={text('sections')}>{MAINTENANCE_TABS.map(key => <button key={key} type="button" aria-pressed={tab === key} onClick={() => selectTab(key)}>{text('tabs.' + key)}</button>)}</nav>
      {error && <p role="alert">{text(error)}</p>}{message && <p role={message === 'saved' ? 'status' : 'alert'}>{text(message)}</p>}
    </section>
    {tab === 'overview' && loaded && error !== 'storedDataError' && <>
      <div className="bm-kpis" data-testid="maintenance-overview">{(['vehicleCount', 'workshopCount', 'attentionVehicleCount', 'openIncidentCount'] as const).map(key => <article key={key}><span>{text(key)}</span><strong>{overview[key]}</strong></article>)}</div>
      <section className="bm-panel"><h2>{text('scheduleCoverage')}</h2><p>{text('unknownScheduleVehicleCount')}: {overview.unknownScheduleVehicleCount}</p><p>{text('insuranceDueCount')}: {overview.insuranceDueCount} · {text('insuranceUnknownCount')}: {overview.insuranceUnknownCount}</p><p>{text('knownServiceCostSar')}: {money(overview.knownServiceCostSar)} SAR · {text('unknownServiceCostCount')}: {overview.unknownServiceCostCount}</p><p>{text('costNote')}</p><button className="bm-primary" onClick={() => selectTab('vehicles')}>{text('manageVehicles')}</button></section>
      {state.vehicles.map(vehicle => <section className="bm-panel" key={vehicle.id}><div className="bm-panel-head"><h3>{identity(vehicle)}</h3><strong>{text(vehicle.availability)}</strong></div>
        {!latestRecords(state, vehicle.id).length && <p>{text('noHistory')}</p>}
        {latestRecords(state, vehicle.id).map(record => { const due = getMaintenanceDueStatus(record, vehicle, today); return <p key={record.id}>{text(record.kind)} · {text('dateDue')}: {text(due.date)} · {text('kmDue')}: {text(due.km)}{record.inspectionOutcome && <> · {text(record.inspectionOutcome)}</>}</p>; })}
      </section>)}
    </>}
    {tab === 'vehicles' && <>
      <section className="bm-panel"><form onSubmit={addVehicle}><h2>{text('register')}</h2><fieldset disabled={disabled} className="bm-form-grid">
        {field('carNumber', carNumber, setCarNumber)}{field('plate', plate, setPlate)}{field('model', model, setModel)}{field('city', city, setCity)}{field('odometer', vehicleKm, setVehicleKm, 'number')}{field('insuranceExpiry', insurance, setInsurance, 'date')}
        <button className="bm-primary" type="submit">{text('addVehicle')}</button>
      </fieldset></form></section>
      <section className="bm-panel"><h2>{text('vehicles')}</h2>{!state.vehicles.length && <p>{text('empty')}</p>}
        {state.vehicles.map(vehicle => <MaintenanceVehicleCard key={`${vehicle.id}-${vehicle.updatedAt}`} vehicle={vehicle} disabled={disabled} text={text} save={next => save({ ...state, vehicles: state.vehicles.map(v => v.id === vehicle.id ? next : v) })} />)}
      </section>
    </>}
    {(tab === 'oil' || tab === 'repair' || tab === 'inspection') && <section className="bm-panel"><form onSubmit={addRecord}><h2>{text('tabs.' + tab)}</h2><fieldset disabled={disabled || !state.vehicles.length} className="bm-form-grid">
      {vehicleSelect}
      <label className="bm-field"><span>{text('kind')}</span><select value={kind} onChange={e => { const next = e.target.value as MaintenanceRecord['kind']; setKind(next); setTab(next); }}>{(['oil','repair','inspection'] as const).map(k => <option key={k} value={k}>{text(k)}</option>)}</select></label>
      {field('date', date, setDate, 'date')}{field('cost', cost, setCost, 'number')}{field('odometer', km, setKm, 'number')}{field('nextDate', dueDate, setDueDate, 'date')}{field('nextKm', dueKm, setDueKm, 'number')}{field('description', description, setDescription)}
      {kind === 'inspection' && INSPECTION_COMPONENTS.map(component => <label className="bm-field" key={component}><span>{text('check.' + component)}</span><select value={checks[component] ?? ''} required onChange={event => setChecks(previous => { const next = { ...previous }; if (event.target.value) next[component] = event.target.value as InspectionChecks[typeof component]; else delete next[component]; return next; })}><option value="">{text('selectOutcome')}</option>{(['good','follow-up','repair-needed'] as const).map(k => <option key={k} value={k}>{text(k)}</option>)}</select></label>)}
      <button className="bm-primary" type="submit">{text('saveService')}</button>
    </fieldset></form></section>}
    {tab === 'incidents' && <>
      <section className="bm-panel"><h2>{text('tabs.incidents')}</h2><p>{text('incidentBoundary')}</p><form onSubmit={addIncident}><fieldset disabled={disabled || !state.vehicles.length} className="bm-form-grid">{vehicleSelect}
        <label className="bm-field"><span>{text('incidentType')}</span><select value={incidentType} onChange={e => setIncidentType(e.target.value as MaintenanceIncident['type'])}>{(['accident', 'breakdown', 'other'] as const).map(k => <option key={k} value={k}>{text(k)}</option>)}</select></label>
        {field('incidentDate', incidentDate, setIncidentDate, 'date')}{field('estimatedCost', incidentCost, setIncidentCost, 'number')}{field('incidentDetails', incidentDescription, setIncidentDescription)}<button className="bm-primary" type="submit">{text('saveIncident')}</button>
      </fieldset></form></section>
      <section className="bm-panel"><h2>{text('incidentHistory')}</h2>{!state.incidents.length && <p>{text('noIncidents')}</p>}{[...state.incidents].sort((a, b) => b.date.localeCompare(a.date)).map(incident => <section className="bm-panel" key={incident.id}>
        <h3>{identity(state.vehicles.find(v => v.id === incident.vehicleId)!)} · {text(incident.type)}</h3><p>{incident.date} · {text(incident.status)} · {incident.estimatedCostSar === null ? text('unknown') : `${money(incident.estimatedCostSar)} SAR`}</p><p>{incident.description}</p>
        <button disabled={disabled} onClick={() => save({ ...state, incidents: state.incidents.map(row => row.id === incident.id ? { ...row, status: row.status === 'open' ? 'resolved' : 'open', updatedAt: new Date().toISOString() } : row) })}>{text(incident.status === 'open' ? 'resolveIncident' : 'reopenIncident')}</button>
      </section>)}</section>
    </>}
    {tab === 'history' && <section className="bm-panel"><div className="bm-panel-head"><h2>{text('history')}</h2><button onClick={exportHistory} disabled={!loaded || !!error || !filteredHistory.length}>{text('exportHistory')}</button></div><p>{text('costNote')}</p>
      <div className="bm-form-grid"><label className="bm-field"><span>{text('filterVehicle')}</span><select value={historyVehicle} onChange={e => setHistoryVehicle(e.target.value)}><option value="">{text('all')}</option>{state.vehicles.map(v => <option key={v.id} value={v.id}>{identity(v)}</option>)}</select></label><label className="bm-field"><span>{text('filterKind')}</span><select value={historyKind} onChange={e => setHistoryKind(e.target.value)}><option value="">{text('all')}</option>{(['oil', 'repair', 'inspection'] as const).map(k => <option key={k} value={k}>{text(k)}</option>)}</select></label></div>
      {!filteredHistory.length && <p>{text('noHistory')}</p>}
      <div style={{ overflowX: 'auto' }}><table className="bm-maintenance-table"><thead><tr>{['vehicle','kind','date','costShort','descriptionShort'].map(k => <th key={k}>{text(k)}</th>)}</tr></thead><tbody>{filteredHistory.map(r => <tr key={r.id}><td>{identity(state.vehicles.find(v => v.id === r.vehicleId)!)}</td><td>{text(r.kind)}</td><td>{r.date}</td><td>{r.costSar === null ? text('unknown') : `${money(r.costSar)} SAR`}</td><td>{r.description}{r.inspectionOutcome && <p>{text(r.inspectionOutcome)}</p>}{r.inspectionChecks && <details><summary>{text('inspectionDetails')}</summary>{INSPECTION_COMPONENTS.map(key => <p key={key}>{text('check.' + key)}: {text(r.inspectionChecks![key])}</p>)}</details>}</td></tr>)}</tbody></table></div>
    </section>}
  </div>;
}

function MaintenanceVehicleCard({ vehicle, disabled, text, save }: {
  vehicle: MaintenanceVehicle; disabled: boolean; text: (key: string) => string; save: (next: MaintenanceVehicle) => boolean;
}) {
  const [model, setModel] = useState(vehicle.model ?? '');
  const [city, setCity] = useState(vehicle.city ?? '');
  const [insurance, setInsurance] = useState(vehicle.insuranceExpiryDate ?? '');
  const resetOdometer = (input: HTMLInputElement) => { input.value = vehicle.odometerKm === undefined ? '' : String(vehicle.odometerKm); };
  return <section className="bm-maintenance-vehicle" data-testid={`maintenance-vehicle-${vehicle.id}`}><h3>{identity(vehicle)}</h3>
    <label className="bm-field"><span>{text('availability')}</span><select disabled={disabled} value={vehicle.availability} onChange={e => save({ ...vehicle, availability: e.target.value as MaintenanceVehicle['availability'], updatedAt: new Date().toISOString() })}><option value="available">{text('available')}</option><option value="workshop">{text('workshop')}</option></select></label>
    <label className="bm-field"><span>{text('odometer')}</span><input type="number" min="0" disabled={disabled} defaultValue={vehicle.odometerKm ?? ''} onBlur={e => {
      const n = optionalNumber(e.target.value);
      if ((n === undefined && vehicle.odometerKm !== undefined) || (n !== undefined && (!Number.isFinite(n) || n < (vehicle.odometerKm ?? 0)))) { resetOdometer(e.currentTarget); return; }
      if (n === vehicle.odometerKm) return;
      if (!save({ ...vehicle, odometerKm: n, updatedAt: new Date().toISOString() })) resetOdometer(e.currentTarget);
    }} /></label>
    <form onSubmit={event => { event.preventDefault(); save({ ...vehicle, model: model.trim() || undefined, city: city.trim() || undefined, insuranceExpiryDate: insurance || undefined, updatedAt: new Date().toISOString() }); }}><fieldset disabled={disabled} className="bm-form-grid">
      <label className="bm-field"><span>{text('model')}</span><input value={model} onChange={e => setModel(e.target.value)} /></label><label className="bm-field"><span>{text('city')}</span><input value={city} onChange={e => setCity(e.target.value)} /></label><label className="bm-field"><span>{text('insuranceExpiry')}</span><input type="date" value={insurance} onChange={e => setInsurance(e.target.value)} /></label><button className="bm-primary" type="submit">{text('saveVehicleDetails')}</button>
    </fieldset></form>
  </section>;
}
