import { describe, expect, it } from 'vitest';
import { emptyMaintenanceState, type MaintenanceRecord } from '@/lib/vehicleMaintenance';
import { buildMaintenanceHistoryCsv } from '@/lib/vehicleMaintenanceExport';
const stamp = '2026-10-01T00:00:00Z';
describe('maintenance CSV projection', () => {
  it('preserves cost coverage and protects spreadsheet formulas and quotes', () => {
    const state = emptyMaintenanceState();
    state.vehicles.push({id:'v', carNumber:'N1',plate:'',availability:'available',updatedAt:stamp});
    const record: MaintenanceRecord = {id:'r',vehicleId:'v',kind:'oil',date:'2026-10-01',costSar:null,description:'  =HYPERLINK("bad")',updatedAt:stamp};
    state.records.push(record,{...record,id:'r2',costSar:0,description:'Oil, filter'});
    const csv = buildMaintenanceHistoryCsv(state, state.records, key => key);
    expect(csv).toContain('"","unknown"'); expect(csv).toContain('"0","recorded"');
    expect(csv).toContain('"\'  =HYPERLINK(""bad"")"'); expect(csv).toContain('"Oil, filter"');
  });
  it('rejects rows outside the validated stored inventory', () => {
    const state = emptyMaintenanceState();
    expect(() => buildMaintenanceHistoryCsv(state,[{} as MaintenanceRecord], key => key)).toThrow('maintenance-export-invalid');
  });
});
