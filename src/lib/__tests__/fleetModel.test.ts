import { describe, expect, it } from 'vitest';
import { resizeVehicleFleet } from '../fleetModel';
import { defaultFinancialInput } from '../mockData';
import type { VehicleClass } from '../types';

const mixedFleet: VehicleClass[] = [
  { ...defaultFinancialInput.vehicleClasses[0], id: 'car', quantity: 50 },
  { ...defaultFinancialInput.vehicleClasses[0], id: 'van', name: 'Van', quantity: 10 },
];

describe('fleet resizing', () => {
  it('sets the exact requested total and preserves the approximate vehicle mix', () => {
    const resized = resizeVehicleFleet(structuredClone(mixedFleet), 45);
    const total = resized.filter(row => row.enabled).reduce((sum, row) => sum + row.quantity, 0);

    expect(total).toBe(45);
    expect(resized[0].quantity).toBe(38);
    expect(resized[1].quantity).toBe(7);
  });

  it('supports totals smaller than any existing vehicle class', () => {
    const resized = resizeVehicleFleet(structuredClone(mixedFleet), 5);
    expect(resized.reduce((sum, row) => sum + row.quantity, 0)).toBe(5);
  });
});
