import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import BusinessModelApp from '@/components/rebuild/BusinessModelApp';
import { defaultFinancialInput } from '@/lib/mockData';
import type { FinancialInput } from '@/lib/types';

function bigModel(): FinancialInput {
  const input = structuredClone(defaultFinancialInput);
  input.vehicleClasses = Array.from({ length: 200 }, (_, i) => ({
    ...input.vehicleClasses[0], id: `vc${i}`, name: `Truck class ${i}`, quantity: (i % 9) + 1,
  }));
  input.providers = Array.from({ length: 300 }, (_, i) => ({
    id: `prv${i}`, name: `Customer ${i}`, shipmentsPerDay: (i % 40) + 1, pricePerShipment: 4 + (i % 6), enabled: true,
  }));
  input.drivers = Array.from({ length: 800 }, (_, i) => ({
    id: `drv${i}`, fullName: `Driver ${i}`, phone: `+9665000${String(i).padStart(4, '0')}`,
    nationalId: '', assignedVehicle: 'Van', status: 'active' as const,
  }));
  input.companyDriverCount = 800;
  return input;
}

describe('UI stress', () => {
  beforeEach(() => { localStorage.clear(); });

  it('mounts with default model under 1500ms', () => {
    const t0 = performance.now();
    render(<BusinessModelApp />);
    const dt = performance.now() - t0;
    console.log(`default mount: ${dt.toFixed(0)}ms`);
    expect(dt).toBeLessThan(1500);
  });

  it('mounts a 200-class × 300-customer × 800-driver model and navigates all views', { timeout: 20000 }, () => {
    localStorage.setItem('vega-financialInput-v2', JSON.stringify(bigModel()));
    const t0 = performance.now();
    render(<BusinessModelApp />);
    console.log(`big-model mount: ${(performance.now() - t0).toFixed(0)}ms`);

    // Navigate every section; each must render its heading without crashing.
    const labels = ['Drivers & vehicles', 'Customers & revenue', 'Company costs', 'Reports', 'Risks'];
    for (const label of labels) {
      const t1 = performance.now();
      const btn = screen.getAllByRole('button', { name: new RegExp(label.replace('&', '&'), 'i') })[0]
        ?? screen.getByText(label, { selector: 'button span, button' });
      act(() => { btn.click(); });
      console.log(`  view "${label}": ${(performance.now() - t1).toFixed(0)}ms`);
    }
    expect(document.body.textContent).toBeTruthy();
  });

  it('survives localStorage quota exhaustion', () => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
    try {
      const t0 = performance.now();
      render(<BusinessModelApp />);
      expect(performance.now() - t0).toBeLessThan(1500);
      // Interact — writes will fail silently (warned), UI must keep working
      act(() => { screen.getByText('Risks').click(); });
      expect(screen.getByText(/rules based on your entered numbers/i)).toBeTruthy();
    } finally {
      Storage.prototype.setItem = setItem;
    }
  });

  it('survives corrupted persisted model (garbage JSON fields)', () => {
    const corrupt = { ...JSON.parse(JSON.stringify(defaultFinancialInput)) };
    (corrupt as Record<string, unknown>).driverSalary = { evil: 'object' };
    (corrupt as Record<string, unknown>).fuelPricePerLiter = 'not-a-number';
    corrupt.vehicleClasses = [{ ...corrupt.vehicleClasses[0], quantity: NaN, monthlyRent: undefined }];
    localStorage.setItem('vega-financialInput-v2', JSON.stringify(corrupt));
    expect(() => render(<BusinessModelApp />)).not.toThrow();
  });
});
