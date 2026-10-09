import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useVehicleMaintenance, VehicleMaintenanceView } from '@/components/rebuild/VehicleMaintenanceView';
import { VEHICLE_MAINTENANCE_STORAGE_KEY, type MaintenanceState } from '@/lib/vehicleMaintenance';
import '@/lib/i18n';

function Harness() { const maintenance = useVehicleMaintenance(); return <VehicleMaintenanceView {...maintenance} />; }
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
const state: MaintenanceState = { version: 2, incidents: [], vehicles: [{ id: 'v', carNumber: 'N1', plate: '', odometerKm: 1000, availability: 'available', updatedAt: '2026-10-01T00:00:00Z' }], records: [] };
describe('maintenance operator workflow', () => {
  it('registers a vehicle and keeps a missing service cost unknown after remount', async () => {
    const view = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Vehicles' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Register vehicle' }).closest('fieldset')?.disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Car number'), { target: { value: 'N7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register vehicle' }));
    const plateBefore = JSON.parse(localStorage.getItem(VEHICLE_MAINTENANCE_STORAGE_KEY)!).vehicles[0].carNumber;
    expect(plateBefore).toBe('N7');
    fireEvent.click(screen.getByRole('button', { name: 'Oil changes' }));
    fireEvent.change(screen.getByLabelText('Service details / oil and filter notes'), { target: { value: 'Oil and filter replaced' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save service record' }));
    expect(JSON.parse(localStorage.getItem(VEHICLE_MAINTENANCE_STORAGE_KEY)!).records[0].costSar).toBeNull();
    view.unmount(); render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Service history' }));
    await waitFor(() => expect(screen.getByText('Oil and filter replaced')).toBeTruthy());
    expect(screen.getAllByText('Unknown / not recorded').length).toBeGreaterThan(0);
  });
  it('requires all inspection checks and flags a repair result as workshop', () => {
    const commit = vi.fn<(next: MaintenanceState) => boolean>(() => true);
    render(<VehicleMaintenanceView state={state} commit={commit} loaded error="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Periodic inspections' }));
    fireEvent.change(screen.getByLabelText('Vehicle'), { target: { value: 'v' } });
    fireEvent.change(screen.getByLabelText('Service type'), { target: { value: 'inspection' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save service record' }).closest('form')!);
    expect(commit).not.toHaveBeenCalled();
    for (const label of ['Tyres','Brakes','Oil condition','Battery','Lights','Bodywork']) fireEvent.change(screen.getByLabelText(label), { target: { value: label === 'Brakes' ? 'repair-needed' : 'good' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save service record' }).closest('form')!);
    expect(commit).toHaveBeenCalledOnce();
    expect(commit.mock.calls[0]?.[0]).toMatchObject({ vehicles: [{ availability: 'workshop' }], records: [{ inspectionOutcome: 'repair-needed' }] });
  });

  it('preserves malformed stored history and blocks editing', async () => {
    const raw = '{broken'; localStorage.setItem(VEHICLE_MAINTENANCE_STORAGE_KEY, raw);
    render(<Harness />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Vehicles' }));
    expect(screen.getByRole('button', { name: 'Register vehicle' }).closest('fieldset')?.disabled).toBe(true);
    expect(localStorage.getItem(VEHICLE_MAINTENANCE_STORAGE_KEY)).toBe(raw);
  });
  it('does not erase a known odometer on a blank edit', () => {
    const commit = vi.fn<(next: MaintenanceState) => boolean>(() => true);
    render(<VehicleMaintenanceView state={state} commit={commit} loaded error="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Vehicles' }));
    const input = screen.getAllByLabelText('Odometer (km)').find(e => (e as HTMLInputElement).value === '1000')!;
    fireEvent.change(input, { target: { value: '' } }); fireEvent.blur(input);
    expect(commit).not.toHaveBeenCalled(); expect((input as HTMLInputElement).value).toBe('1000');
  });
  it('does not claim save success when browser persistence fails', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Vehicles' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Register vehicle' }).closest('fieldset')?.disabled).toBe(false));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    fireEvent.change(screen.getByLabelText('Car number'), { target: { value: 'N9' } }); fireEvent.click(screen.getByRole('button', { name: 'Register vehicle' }));
    expect(screen.getByRole('alert').textContent).toContain('Changes were not saved');
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('maintenance expansion', () => {
  it('persists vehicle details and an incident, then resolves it without returning the vehicle to service', async () => {
    const view = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Vehicles' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Register vehicle' }).closest('fieldset')?.disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Car number'), { target: { value: 'N21' } });
    fireEvent.change(screen.getByLabelText('Model (optional)'), { target: { value: 'Van' } });
    fireEvent.change(screen.getByLabelText('Insurance expiry (optional)'), { target: { value: '2026-10-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register vehicle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Accidents & breakdowns' }));
    fireEvent.change(screen.getByLabelText('Incident details'), { target: { value: 'Engine warning; operator inspection needed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save incident' }));
    let stored = JSON.parse(localStorage.getItem(VEHICLE_MAINTENANCE_STORAGE_KEY)!);
    expect(stored.vehicles[0]).toMatchObject({model:'Van',insuranceExpiryDate:'2026-10-01',availability:'workshop'});
    expect(stored.incidents[0]).toMatchObject({status:'open',estimatedCostSar:null});
    view.unmount(); render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Accidents & breakdowns' }));
    await screen.findByText('Engine warning; operator inspection needed');
    fireEvent.click(screen.getByRole('button', { name: 'Mark resolved' }));
    stored = JSON.parse(localStorage.getItem(VEHICLE_MAINTENANCE_STORAGE_KEY)!);
    expect(stored.incidents[0].status).toBe('resolved'); expect(stored.vehicles[0].availability).toBe('workshop');
  });
  it('does not rewrite old storage on read and persists the versioned migration on an explicit edit', async () => {
    const legacy = JSON.stringify({version:1, vehicles:state.vehicles,records:[]});
    localStorage.setItem(VEHICLE_MAINTENANCE_STORAGE_KEY,legacy);
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Vehicles' }));
    await screen.findByText('N1');
    expect(localStorage.getItem(VEHICLE_MAINTENANCE_STORAGE_KEY)).toBe(legacy);
    fireEvent.click(screen.getByRole('button', { name: 'Save vehicle details' }));
    expect(JSON.parse(localStorage.getItem(VEHICLE_MAINTENANCE_STORAGE_KEY)!)).toMatchObject({version:2,incidents:[]});
  });
  it('shows inspection evidence in filtered history and keeps unrelated services out of the selection', () => {
    const checks = {tires:'good',brakes:'follow-up',oil:'good',battery:'good',lights:'good',body:'good'} as const;
    const withHistory: MaintenanceState = {...state,records:[
      {id:'inspection',vehicleId:'v',kind:'inspection',date:'2026-10-01',costSar:null,description:'Inspection evidence',inspectionOutcome:'follow-up',inspectionChecks:checks,updatedAt:'2026-10-01T00:00:00Z'},
      {id:'oil',vehicleId:'v',kind:'oil',date:'2026-10-01',costSar:0,description:'Oil evidence',updatedAt:'2026-10-01T00:00:00Z'}]};
    render(<VehicleMaintenanceView state={withHistory} commit={() => true} loaded error="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Service history' }));
    fireEvent.change(screen.getByLabelText('Filter by service type'), {target:{value:'inspection'}});
    expect(screen.getByText('Inspection evidence')).toBeTruthy(); expect(screen.queryByText('Oil evidence')).toBeNull();
    fireEvent.click(screen.getByText('Inspection checks'));
    expect(screen.getByText('Brakes: Follow-up required')).toBeTruthy();
  });
});
