import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import BusinessModelApp from '@/components/rebuild/BusinessModelApp';
import { defaultFinancialInput } from '@/lib/mockData';
import type { FinancialInput } from '@/lib/types';
import { createStopRecord } from '@/lib/stops';
import { calculateFinancials } from '@/lib/calculations';

beforeEach(() => { cleanup(); localStorage.clear(); });
afterEach(cleanup);
const storedInput = () => JSON.parse(localStorage.getItem('vega-financialInput-v2')!) as FinancialInput;
function openFleet() {
  fireEvent.click(screen.getByRole('button', { name: /More|المزيد/i }));
  fireEvent.click(screen.getByRole('button', { name: /^Drivers & vehicles$/i }));
}
function seedTwoDrivers() {
  const input = structuredClone(defaultFinancialInput);
  input.drivers = input.drivers.slice(0, 2).map((driver, index) => ({ ...driver, id: `operator-${index}`, fullName: `Operator ${index}`, status: 'active' }));
  input.companyDriverCount = 2;
  input.driverSalary = 2500;
  input.vehicleClasses = input.vehicleClasses.map((vehicle, index) => ({ ...vehicle, quantity: index === 0 ? 4 : 0 }));
  localStorage.setItem('vega-financialInput-v2', JSON.stringify(input));
  return input;
}

describe('folder review operator regressions', () => {
  it('adding and removing a driver persists matching active headcount without changing vehicles', () => {
    const input = seedTwoDrivers();
    render(<BusinessModelApp />); openFleet();
    fireEvent.click(screen.getByTestId('add-driver'));
    expect(storedInput().companyDriverCount).toBe(3);
    expect(storedInput().drivers).toHaveLength(3);
    expect(storedInput().vehicleClasses).toEqual(input.vehicleClasses);
    const added = storedInput().drivers[2];
    fireEvent.click(screen.getByTestId(`remove-${added.id}`));
    fireEvent.click(screen.getByTestId(`confirm-yes-${added.id}`));
    expect(storedInput().companyDriverCount).toBe(2);
    expect(storedInput().drivers).toHaveLength(2);
  });

  it('status changes and later edits preserve inactive identities while counting only active drivers', () => {
    seedTwoDrivers(); render(<BusinessModelApp />); openFleet();
    fireEvent.change(screen.getByRole('combobox', { name: 'Operator 0 Status' }), { target: { value: 'inactive' } });
    expect(storedInput().companyDriverCount).toBe(1);
    expect(storedInput().drivers).toHaveLength(2);
    fireEvent.change(screen.getByRole('textbox', { name: 'Operator 1 Phone' }), { target: { value: '0501234567' } });
    expect(storedInput().drivers[0]).toMatchObject({ id: 'operator-0', fullName: 'Operator 0', status: 'inactive' });
    expect(storedInput().drivers[1].phone).toBe('0501234567');
    expect(storedInput().companyDriverCount).toBe(1);
  });

  it.each([true, false])('monthly driver payroll follows headcount and salary toggle (enabled=%s)', enabled => {
    const input = seedTwoDrivers();
    input.costToggles = { ...input.costToggles, driverSalary: enabled };
    localStorage.setItem('vega-financialInput-v2', JSON.stringify(input));
    render(<BusinessModelApp />);
    const section = document.querySelector('.bm-monthly-totals') as HTMLElement;
    const row = within(section).getByText('Drivers', { selector: 'strong' }).closest('.bm-total-rows > div') as HTMLElement;
    const salary = new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(enabled ? 2500 : 0);
    expect(row.querySelector('small')?.textContent).toBe(`2 × ${salary}`);
    const expected = new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(enabled ? 5000 : 0);
    expect(row.querySelector('b')?.textContent).toBe(expected);
  });

  it.each([true, false])('team payroll rows reconcile to engine totals with all team toggles enabled=%s', enabled => {
    const input = seedTwoDrivers();
    input.opsTeamCount = 2; input.opsTeamAvgSalary = 3000;
    input.salesTeamCount = 3; input.salesTeamBaseSalary = 2000;
    input.warehouseStaff = 4; input.warehouseStaffSalary = 1500;
    input.costToggles = { ...input.costToggles, opsTeam: enabled, salesTeam: enabled, warehouseStaff: enabled };
    localStorage.setItem('vega-financialInput-v2', JSON.stringify(input));
    render(<BusinessModelApp />);
    const section = document.querySelector('.bm-monthly-totals') as HTMLElement;
    const money = (amount: number) => new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(amount);
    for (const [label, count, salary] of [['Operations team', 2, 3000], ['Sales team', 3, 2000], ['Warehouse staff', 4, 1500]] as const) {
      const row = within(section).getByText(label, { selector: 'strong' }).closest('.bm-total-rows > div') as HTMLElement;
      expect(row.querySelector('small')?.textContent).toBe(`${count} × ${money(enabled ? salary : 0)}`);
      expect(row.querySelector('b')?.textContent).toBe(money(enabled ? count * salary : 0));
    }
    const output = calculateFinancials(input);
    const other = within(section).getByText('Other people costs', { selector: 'strong' }).closest('.bm-total-rows > div') as HTMLElement;
    expect(other.querySelector('b')?.textContent).toBe(money(output.costBreakdown.people - 5000 - (enabled ? 18000 : 0)));
    const rowSum = [...section.querySelectorAll('.bm-total-rows > div > b')].reduce((sum, cell) => sum + Number(cell.textContent?.replace(/[^0-9.-]/g, '')), 0);
    expect(rowSum).toBe(Math.round(output.totalCost));
  });

  it('planned stops alone prompt backup without daily records or model edits', () => {
    const stop = createStopRecord({ operationDate: '2026-10-09', customerName: 'Carrier client', stopLabel: 'Supplied stop' }, '2026-10-09T06:00:00.000Z');
    localStorage.setItem('vega-stops-v1', JSON.stringify([stop]));
    render(<BusinessModelApp />);
    expect(screen.getByTestId('backup-banner').getAttribute('data-reason')).toBe('never');
    expect(localStorage.getItem('vega-daily-reports-v2')).toBeNull();
    expect(localStorage.getItem('vega-financialInput-v2')).toBeNull();
  });
});
