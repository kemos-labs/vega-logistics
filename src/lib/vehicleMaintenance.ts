import { isValidCalendarDate } from '@/lib/operationsReporting';

export const VEHICLE_MAINTENANCE_STORAGE_KEY = 'vega-vehicle-maintenance-v1';
export interface MaintenanceVehicle {
  id: string;
  carNumber: string;
  plate: string;
  odometerKm?: number;
  model?: string;
  city?: string;
  insuranceExpiryDate?: string;
  availability: 'available' | 'workshop';
  updatedAt: string;
}
export const INSPECTION_COMPONENTS = ['tires', 'brakes', 'oil', 'battery', 'lights', 'body'] as const;
export type InspectionOutcome = 'good' | 'follow-up' | 'repair-needed';
export type InspectionChecks = Record<typeof INSPECTION_COMPONENTS[number], InspectionOutcome>;
/** Highest recorded attention level; no component weighting or invented threshold. */
export function deriveInspectionOutcome(checks: InspectionChecks): InspectionOutcome {
  if (!validInspectionChecks(checks)) throw new Error('inspection-checks-invalid');
  const values = INSPECTION_COMPONENTS.map(component => checks[component]);
  return values.includes('repair-needed') ? 'repair-needed' : values.includes('follow-up') ? 'follow-up' : 'good';
}
function validInspectionChecks(value: unknown): value is InspectionChecks {
  return object(value) && Object.keys(value).length === INSPECTION_COMPONENTS.length
    && INSPECTION_COMPONENTS.every(component => ['good', 'follow-up', 'repair-needed'].includes(String(value[component])));
}
export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  kind: 'oil' | 'repair' | 'inspection';
  date: string;
  costSar: number | null;
  description: string;
  odometerKm?: number;
  nextDueDate?: string;
  nextDueKm?: number;
  inspectionOutcome?: InspectionOutcome;
  /** Optional for previous outcome-only records; complete when supplied. */
  inspectionChecks?: InspectionChecks;
  updatedAt: string;
}
export interface MaintenanceIncident {
  id: string;
  vehicleId: string;
  type: 'accident' | 'breakdown' | 'other';
  date: string;
  description: string;
  estimatedCostSar: number | null;
  status: 'open' | 'resolved';
  updatedAt: string;
}
export interface MaintenanceState {
  version: 2;
  vehicles: MaintenanceVehicle[];
  records: MaintenanceRecord[];
  incidents: MaintenanceIncident[];
}
export const emptyMaintenanceState = (): MaintenanceState => ({ version: 2, vehicles: [], records: [], incidents: [] });
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string';
const nonempty = (v: unknown): v is string => text(v) && v.trim().length > 0;
const numeric = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const stamp = (v: unknown): boolean => text(v) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && isValidCalendarDate(v.slice(0, 10)) && Number.isFinite(Date.parse(v));
const optionalNumber = (v: unknown) => v === undefined || numeric(v);
const optionalDate = (v: unknown) => v === undefined || (text(v) && isValidCalendarDate(v));

/** Strict envelope validation; malformed history never becomes an empty success. */
export function validateMaintenanceState(value: unknown): value is MaintenanceState {
  if (!object(value) || value.version !== 2 || !Array.isArray(value.vehicles) || !Array.isArray(value.records) || !Array.isArray(value.incidents)) return false;
  const vehicleIds = new Set<string>();
  for (const v of value.vehicles) {
    if (!object(v) || !nonempty(v.id) || vehicleIds.has(v.id) || !text(v.carNumber) || !text(v.plate)
      || (!v.carNumber.trim() && !v.plate.trim()) || !optionalNumber(v.odometerKm)
      || (v.model !== undefined && !text(v.model)) || (v.city !== undefined && !text(v.city)) || !optionalDate(v.insuranceExpiryDate)
      || !['available', 'workshop'].includes(String(v.availability)) || !stamp(v.updatedAt)) return false;
    vehicleIds.add(v.id);
  }
  const recordIds = new Set<string>();
  for (const r of value.records) {
    if (!object(r) || !nonempty(r.id) || recordIds.has(r.id) || !text(r.vehicleId) || !vehicleIds.has(r.vehicleId)
      || !['oil', 'repair', 'inspection'].includes(String(r.kind)) || !text(r.date) || !isValidCalendarDate(r.date)
      || (r.costSar !== null && !numeric(r.costSar)) || !text(r.description) || !optionalNumber(r.odometerKm)
      || !optionalNumber(r.nextDueKm) || !optionalDate(r.nextDueDate) || !stamp(r.updatedAt)
      || (r.nextDueDate !== undefined && String(r.nextDueDate) < r.date)
      || (numeric(r.nextDueKm) && numeric(r.odometerKm) && r.nextDueKm < r.odometerKm)
      || (r.inspectionOutcome !== undefined && !['good', 'follow-up', 'repair-needed'].includes(String(r.inspectionOutcome)))
      || (r.kind === 'inspection' && r.inspectionOutcome === undefined)
      || (r.inspectionChecks !== undefined && (r.kind !== 'inspection' || !validInspectionChecks(r.inspectionChecks)
        || deriveInspectionOutcome(r.inspectionChecks) !== r.inspectionOutcome))) return false;
    recordIds.add(r.id);
  }
  const incidentIds = new Set<string>();
  for (const incident of value.incidents) {
    if (!object(incident) || !nonempty(incident.id) || incidentIds.has(incident.id)
      || !text(incident.vehicleId) || !vehicleIds.has(incident.vehicleId)
      || !['accident', 'breakdown', 'other'].includes(String(incident.type))
      || !text(incident.date) || !isValidCalendarDate(incident.date) || !nonempty(incident.description)
      || (incident.estimatedCostSar !== null && !numeric(incident.estimatedCostSar))
      || !['open', 'resolved'].includes(String(incident.status)) || !stamp(incident.updatedAt)) return false;
    incidentIds.add(incident.id);
  }
  return true;
}
/** Pure migration: only the historical inventory is accepted; malformed values stay invalid. */
export function migrateMaintenanceState(value: unknown): MaintenanceState | null {
  if (validateMaintenanceState(value)) return structuredClone(value);
  if (!object(value) || value.version !== 1 || value.incidents !== undefined) return null;
  const migrated = { ...value, version: 2, incidents: [] };
  return validateMaintenanceState(migrated) ? structuredClone(migrated) : null;
}
export function readMaintenanceState(raw: string | null | undefined): { ok: true; state: MaintenanceState } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, state: emptyMaintenanceState() };
  try {
    const parsed: unknown = JSON.parse(raw);
    const state = migrateMaintenanceState(parsed);
    return state ? { ok: true, state } : { ok: false, error: 'maintenance-state-invalid' };
  } catch { return { ok: false, error: 'maintenance-json-invalid' }; }
}
export interface MaintenanceMergeStats { added: number; updated: number; conflicts: number; identical: number }
/** Stable IDs and strictly newer timestamps win; Equal conflicting timestamps preserve local data. */
export function mergeMaintenanceState(current: MaintenanceState, incoming: MaintenanceState): { state: MaintenanceState; stats: MaintenanceMergeStats } {
  if (!validateMaintenanceState(current) || !validateMaintenanceState(incoming)) throw new Error('maintenance-state-invalid');
  const stats: MaintenanceMergeStats = { added: 0, updated: 0, conflicts: 0, identical: 0 };
  const merge = <T extends { id: string; updatedAt: string }>(local: T[], remote: T[]): T[] => {
    const rows = new Map(local.map(row => [row.id, structuredClone(row)]));
    for (const row of remote) {
      const old = rows.get(row.id);
      if (!old) { rows.set(row.id, structuredClone(row)); stats.added++; }
      else if (JSON.stringify(old) === JSON.stringify(row)) stats.identical++;
      else if (Date.parse(row.updatedAt) > Date.parse(old.updatedAt)) { rows.set(row.id, structuredClone(row)); stats.updated++; }
      else stats.conflicts++;
    }
    return [...rows.values()];
  };
  return { state: { version: 2, vehicles: merge(current.vehicles, incoming.vehicles), records: merge(current.records, incoming.records), incidents: merge(current.incidents, incoming.incidents) }, stats };
}
export type MaintenanceDueLevel = 'unknown' | 'current' | 'due' | 'overdue';
/** Calendar and odometer intervals are independent; absent evidence stays unknown. */
export function getMaintenanceDueStatus(record: MaintenanceRecord, vehicle: MaintenanceVehicle, today: string): { date: MaintenanceDueLevel; km: MaintenanceDueLevel; attention: boolean } {
  if (!isValidCalendarDate(today)) throw new Error('maintenance-today-invalid');
  const date: MaintenanceDueLevel = record.nextDueDate === undefined ? 'unknown' : record.nextDueDate < today ? 'overdue' : record.nextDueDate === today ? 'due' : 'current';
  const km: MaintenanceDueLevel = record.nextDueKm === undefined || vehicle.odometerKm === undefined ? 'unknown' : vehicle.odometerKm > record.nextDueKm ? 'overdue' : vehicle.odometerKm === record.nextDueKm ? 'due' : 'current';
  return { date, km, attention: vehicle.availability === 'workshop' || record.inspectionOutcome === 'repair-needed' || record.inspectionOutcome === 'follow-up' || ['due', 'overdue'].includes(date) || ['due', 'overdue'].includes(km) };
}

export interface MaintenanceOverview {
  vehicleCount: number;
  workshopCount: number;
  attentionVehicleCount: number;
  unknownScheduleVehicleCount: number;
  openIncidentCount: number;
  insuranceDueCount: number;
  insuranceUnknownCount: number;
  knownServiceCostSar: number;
  unknownServiceCostCount: number;
}
/** Latest service per kind controls attention/schedule. A usable date OR km interval with
 * recorded vehicle odometer is enough for schedule coverage; partial coverage stays visible
 * in getMaintenanceDueStatus. Insurance is due only on/before today, without a guessed window.
 * All historical service costs are summed once; incident estimates are deliberately separate. */
export function deriveMaintenanceOverview(state: MaintenanceState, today: string): MaintenanceOverview {
  if (!validateMaintenanceState(state)) throw new Error('maintenance-state-invalid');
  if (!isValidCalendarDate(today)) throw new Error('maintenance-today-invalid');
  const overview: MaintenanceOverview = { vehicleCount: state.vehicles.length, workshopCount: 0,
    attentionVehicleCount: 0, unknownScheduleVehicleCount: 0, openIncidentCount: state.incidents.filter(i => i.status === 'open').length,
    insuranceDueCount: 0, insuranceUnknownCount: 0, knownServiceCostSar: 0, unknownServiceCostCount: 0 };
  for (const record of state.records) {
    if (record.costSar === null) overview.unknownServiceCostCount++;
    else overview.knownServiceCostSar += record.costSar;
  }
  for (const vehicle of state.vehicles) {
    const latest = new Map<MaintenanceRecord['kind'], MaintenanceRecord>();
    for (const record of state.records.filter(r => r.vehicleId === vehicle.id)) {
      const old = latest.get(record.kind);
      if (!old || record.date > old.date || (record.date === old.date && Date.parse(record.updatedAt) > Date.parse(old.updatedAt))) latest.set(record.kind, record);
    }
    const records = [...latest.values()];
    const insuranceDue = vehicle.insuranceExpiryDate !== undefined && vehicle.insuranceExpiryDate <= today;
    if (vehicle.availability === 'workshop') overview.workshopCount++;
    if (insuranceDue) overview.insuranceDueCount++;
    if (vehicle.insuranceExpiryDate === undefined) overview.insuranceUnknownCount++;
    if (!records.some(r => r.nextDueDate !== undefined || (r.nextDueKm !== undefined && vehicle.odometerKm !== undefined))) overview.unknownScheduleVehicleCount++;
    if (insuranceDue || vehicle.availability === 'workshop' || records.some(r => getMaintenanceDueStatus(r, vehicle, today).attention)
      || state.incidents.some(i => i.vehicleId === vehicle.id && i.status === 'open')) overview.attentionVehicleCount++;
  }
  return overview;
}
