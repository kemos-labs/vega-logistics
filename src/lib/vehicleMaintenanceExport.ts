import { validateMaintenanceState, type MaintenanceRecord, type MaintenanceState } from '@/lib/vehicleMaintenance';

/** Local CSV projection: unknown costs stay blank plus an explicit coverage column. */
export function buildMaintenanceHistoryCsv(state: MaintenanceState, records: MaintenanceRecord[], label: (key: string) => string): string {
  if (!validateMaintenanceState(state) || records.some(row => !state.records.includes(row))) throw new Error('maintenance-export-invalid');
  const cell = (value: string) => '"' + (/^[\s]*[=+\-@]|^[\t\r\n]/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"';
  const keys = ['vehicle', 'kind', 'date', 'costShort', 'costCoverage', 'descriptionShort', 'nextDate', 'nextKm', 'inspectionOutcome'];
  const rows = [keys.map(label), ...records.map(record => {
    const vehicle = state.vehicles.find(row => row.id === record.vehicleId)!;
    return [[vehicle.carNumber, vehicle.plate].filter(Boolean).join(' · '), label(record.kind), record.date,
      record.costSar === null ? '' : String(record.costSar), label(record.costSar === null ? 'unknown' : 'recorded'), record.description,
      record.nextDueDate ?? '', record.nextDueKm === undefined ? '' : String(record.nextDueKm), record.inspectionOutcome ? label(record.inspectionOutcome) : ''];
  })];
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
