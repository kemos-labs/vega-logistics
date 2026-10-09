import { describe, it, expect } from 'vitest';
import { deriveMaintenanceOverview, deriveInspectionOutcome, type InspectionChecks, emptyMaintenanceState, readMaintenanceState, validateMaintenanceState, mergeMaintenanceState, getMaintenanceDueStatus, type MaintenanceState } from '@/lib/vehicleMaintenance';
const state = (): MaintenanceState => ({ version: 2, incidents: [], vehicles: [{ id: 'v', carNumber: '7', plate: '', availability: 'available', odometerKm: 100, updatedAt: '2026-10-09T10:00:00Z' }], records: [{ id: 'r', vehicleId: 'v', kind: 'oil', date: '2026-10-09', description: '', costSar: null, updatedAt: '2026-10-09T10:00:00Z' }] });
describe('maintenance persistence and evidence', () => {
  it('aggregates six inspection checks by worst evidence while accepting outcome-only history', () => {
    const checks: InspectionChecks = { tires: 'good', brakes: 'good', oil: 'good', battery: 'good', lights: 'good', body: 'good' };
    expect(deriveInspectionOutcome(checks)).toBe('good');
    checks.lights = 'follow-up'; expect(deriveInspectionOutcome(checks)).toBe('follow-up');
    checks.brakes = 'repair-needed'; expect(deriveInspectionOutcome(checks)).toBe('repair-needed');
    const s = state(); s.records[0].kind = 'inspection'; s.records[0].inspectionOutcome = 'repair-needed';
    expect(validateMaintenanceState(s)).toBe(true);
    s.records[0].inspectionChecks = checks; expect(validateMaintenanceState(s)).toBe(true);
    s.records[0].inspectionOutcome = 'good'; expect(validateMaintenanceState(s)).toBe(false);
    s.records[0].inspectionOutcome = 'repair-needed';
    const missing = { ...checks }; delete (missing as Partial<InspectionChecks>).tires;
    expect(validateMaintenanceState({ ...s, records: [{ ...s.records[0], inspectionChecks: missing }] })).toBe(false);
    expect(() => deriveInspectionOutcome(missing)).toThrow('inspection-checks-invalid');
    expect(validateMaintenanceState({ ...s, records: [{ ...s.records[0], inspectionChecks: { ...checks, brakes: 'unknown' } }] })).toBe(false);
    expect(validateMaintenanceState({ ...s, records: [{ ...s.records[0], kind: 'oil' }] })).toBe(false);
  });

  it('migrates absent storage and rejects malformed envelopes without erasing history', () => {
    expect(readMaintenanceState(null)).toEqual({ ok: true, state: emptyMaintenanceState() });
    for (const raw of ['{}', 'null', '{', JSON.stringify({ ...state(), version: 3 })]) expect(readMaintenanceState(raw).ok).toBe(false);
    expect(readMaintenanceState(JSON.stringify(state()))).toEqual({ ok: true, state: state() });
  });
  it('migrates a historical v1 without mutation and fails closed on malformed historical data', () => {
    const { incidents: omitted, ...legacy } = state(); void omitted;
    const old = { ...legacy, version: 1 };
    expect(readMaintenanceState(JSON.stringify(old))).toEqual({ ok: true, state: state() });
    expect(old.version).toBe(1);
    expect(validateMaintenanceState(old)).toBe(false);
    expect(readMaintenanceState(JSON.stringify({ ...old, records: [{ ...old.records[0], date: '2026-02-30' }] })).ok).toBe(false);
  });
  it('validates incident links, unique IDs, dates, description and unknown versus zero cost', () => {
    const s = state(); s.incidents.push({ id: 'i', vehicleId: 'v', type: 'accident', date: '2026-10-09', description: 'Body damage', estimatedCostSar: null, status: 'open', updatedAt: '2026-10-09T10:00:00Z' });
    expect(validateMaintenanceState(s)).toBe(true);
    s.incidents[0].estimatedCostSar = 0; expect(validateMaintenanceState(s)).toBe(true);
    for (const patch of [{ vehicleId: 'missing' }, { date: '2026-02-30' }, { description: ' ' }, { estimatedCostSar: -1 }, { estimatedCostSar: Infinity }, { type: 'invalid' }, { status: 'invalid' }]) {
      expect(validateMaintenanceState({ ...s, incidents: [{ ...s.incidents[0], ...patch }] })).toBe(false);
    }
    expect(validateMaintenanceState({ ...s, incidents: [...s.incidents, ...s.incidents] })).toBe(false);
    const incoming = structuredClone(s); incoming.incidents[0].status = 'resolved'; incoming.incidents[0].updatedAt = '2026-10-09T14:00:00+03:00';
    expect(mergeMaintenanceState(s, incoming).state.incidents[0].status).toBe('resolved');
    expect(s.incidents[0].status).toBe('open');
  });
  it('rejects backwards intervals and invalid optional insurance dates', () => {
    const s = state(); s.vehicles[0].model = 'Van'; s.vehicles[0].city = 'Riyadh'; s.vehicles[0].insuranceExpiryDate = '2026-10-09';
    expect(validateMaintenanceState(s)).toBe(true);
    expect(validateMaintenanceState({ ...s, vehicles: [{ ...s.vehicles[0], insuranceExpiryDate: '2026-02-30' }] })).toBe(false);
    s.records[0].nextDueDate = '2026-10-08'; expect(validateMaintenanceState(s)).toBe(false);
    delete s.records[0].nextDueDate; s.records[0].odometerKm = 100; s.records[0].nextDueKm = 99; expect(validateMaintenanceState(s)).toBe(false);
  });
  it('derives latest-kind attention, schedule coverage, insurance and service-only costs', () => {
    const s = state(); s.records[0].date = '2026-10-01'; s.records[0].nextDueDate = '2026-10-02'; s.records[0].costSar = 30;
    s.records.push({ ...s.records[0], id: 'new', date: '2026-10-08', nextDueDate: '2026-10-10', costSar: 0 });
    s.records.push({ ...s.records[1], id: 'repair', kind: 'repair', costSar: null });
    expect(deriveMaintenanceOverview(s, '2026-10-09')).toEqual({ vehicleCount: 1, workshopCount: 0, attentionVehicleCount: 0, unknownScheduleVehicleCount: 0, openIncidentCount: 0, insuranceDueCount: 0, insuranceUnknownCount: 1, knownServiceCostSar: 30, unknownServiceCostCount: 1 });
    s.vehicles[0].insuranceExpiryDate = '2026-10-09'; s.vehicles[0].availability = 'workshop';
    s.incidents.push({ id: 'i', vehicleId: 'v', type: 'breakdown', date: '2026-10-09', description: 'Engine', estimatedCostSar: 500, status: 'open', updatedAt: '2026-10-09T10:00:00Z' });
    expect(deriveMaintenanceOverview(s, '2026-10-09')).toMatchObject({ attentionVehicleCount: 1, insuranceDueCount: 1, insuranceUnknownCount: 0, workshopCount: 1, openIncidentCount: 1, knownServiceCostSar: 30 });
    s.records.forEach(r => { delete r.nextDueDate; r.nextDueKm = 200; });
    expect(deriveMaintenanceOverview(s, '2026-10-09').unknownScheduleVehicleCount).toBe(0);
    delete s.vehicles[0].odometerKm; expect(deriveMaintenanceOverview(s, '2026-10-09').unknownScheduleVehicleCount).toBe(1);
    expect(() => deriveMaintenanceOverview(s, '2026-02-30')).toThrow('maintenance-today-invalid');
  });
  it('rejects orphan, duplicate, impossible date and invalid cash/odometer evidence', () => {
    const invalid: MaintenanceState[] = [];
    let s = state(); s.records[0].vehicleId = 'missing'; invalid.push(s);
    s = state(); s.vehicles.push({ ...s.vehicles[0] }); invalid.push(s);
    s = state(); s.records[0].date = '2026-02-30'; invalid.push(s);
    s = state(); s.records[0].costSar = -1; invalid.push(s);
    s = state(); s.vehicles[0].odometerKm = NaN; invalid.push(s);
    s = state(); s.records[0].kind = 'inspection'; invalid.push(s);
    invalid.forEach(v => expect(validateMaintenanceState(v)).toBe(false));
    s = state(); s.records[0].costSar = 0; expect(validateMaintenanceState(s)).toBe(true);
  });
  it('merges strictly newer records without mutating either input or conflating timestamps', () => {
    const local = state(), incoming = state(); incoming.records[0].costSar = 25;
    expect(mergeMaintenanceState(local, incoming).stats.conflicts).toBe(1);
    incoming.records[0].updatedAt = '2026-10-09T14:00:00+03:00';
    const merged = mergeMaintenanceState(local, incoming);
    expect(merged.state.records[0].costSar).toBe(25); expect(merged.stats.updated).toBe(1);
    expect(local.records[0].costSar).toBeNull();
    merged.state.vehicles[0].carNumber = 'changed'; expect(local.vehicles[0].carNumber).toBe('7');
  });
  it('clears optional vehicle evidence when a newer current row omits it', () => {
    const local = state(); local.vehicles[0].model = 'Van'; local.vehicles[0].city = 'Riyadh'; local.vehicles[0].insuranceExpiryDate = '2026-12-31';
    const incoming = state(); incoming.vehicles[0].updatedAt = '2026-10-09T11:00:00Z'; incoming.vehicles[0].carNumber = '8';
    expect(mergeMaintenanceState(local, incoming).state.vehicles[0]).toMatchObject({ carNumber: '8' });
    expect(mergeMaintenanceState(local, incoming).state.vehicles[0].insuranceExpiryDate).toBeUndefined();
  });
  it('keeps date and km due evidence independent, equality due and missing unknown', () => {
    const s = state(), r = s.records[0], v = s.vehicles[0];
    expect(getMaintenanceDueStatus(r, v, '2026-10-09')).toEqual({ date: 'unknown', km: 'unknown', attention: false });
    r.nextDueDate = '2026-10-10'; r.nextDueKm = 100;
    expect(getMaintenanceDueStatus(r, v, '2026-10-09')).toEqual({ date: 'current', km: 'due', attention: true });
    r.nextDueDate = '2026-10-08'; delete v.odometerKm;
    expect(getMaintenanceDueStatus(r, v, '2026-10-09')).toEqual({ date: 'overdue', km: 'unknown', attention: true });
    delete r.nextDueDate; v.availability = 'workshop'; expect(getMaintenanceDueStatus(r, v, '2026-10-09').attention).toBe(true);
    v.availability = 'available'; r.inspectionOutcome = 'repair-needed'; expect(getMaintenanceDueStatus(r, v, '2026-10-09').attention).toBe(true);
  });
});
