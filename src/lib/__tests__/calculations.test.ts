import { describe, expect, it } from 'vitest';
import { calculateFinancials } from '../calculations';
import { defaultFinancialInput } from '../mockData';
import type { FinancialInput } from '../types';

function input(overrides: Partial<FinancialInput> = {}): FinancialInput {
  return {
    ...structuredClone(defaultFinancialInput),
    ...overrides,
  };
}

describe('financial model integrity', () => {
  it('does not count legacy vehicle overhead in ownership and running costs twice', () => {
    const result = calculateFinancials(input({
      vehicleClasses: [{
        ...defaultFinancialInput.vehicleClasses[0],
        quantity: 1,
        monthlyRent: 0,
        variableCost: 100,
      }],
      maintenance: [],
    }));

    expect(result.costBreakdown.vehicleOwnership).toBe(0);
    expect(result.maintenanceMonthlyCost).toBe(60);
    expect(result.costBreakdown.vehicleRunning).toBeGreaterThanOrEqual(40 + 60);
  });

  it('applies failed-delivery rate to both realized revenue and handling cost', () => {
    const successful = calculateFinancials(input({ failedDeliveryRate: 0, failedDeliveryCost: 8 }));
    const failed = calculateFinancials(input({ failedDeliveryRate: 10, failedDeliveryCost: 8 }));

    expect(failed.totalRevenue).toBeLessThan(successful.totalRevenue);
    expect(failed.totalCost).toBeGreaterThan(successful.totalCost);
  });

  it('reduces cash runway when customer payment delay increases', () => {
    const immediate = calculateFinancials(input({ clientPaymentDelay: 0 }));
    const delayed = calculateFinancials(input({ clientPaymentDelay: 60 }));

    expect(delayed.cashRunway).toBeLessThan(immediate.cashRunway);
  });

  it('caps explicit freelancer volume at available monthly provider volume', () => {
    const costToggles = { ...defaultFinancialInput.costToggles, freelancer: true };
    const total = calculateFinancials(input({ freelancerMonthlyVolume: 1_000_000, costToggles }));
    const defaultVolume = calculateFinancials(input({ freelancerMonthlyVolume: undefined, costToggles }));

    expect(total.freelancerMonthlyVolume).toBe(defaultVolume.totalMonthlyShipments);
    expect(total.freelancerMonthlyRevenue).toBe(defaultVolume.totalMonthlyShipments * defaultFinancialInput.freelancerProviderPrice);
  });

  it('uses editable company driver count and salary for payroll cost', () => {
    const tenDrivers = calculateFinancials(input({ companyDriverCount: 10, driverSalary: 4_000 }));
    const elevenDrivers = calculateFinancials(input({ companyDriverCount: 11, driverSalary: 4_000 }));

    expect(elevenDrivers.costBreakdown.people - tenDrivers.costBreakdown.people).toBe(4_000);
    // No hidden employee insurance is added to the clean company baseline.
  });
});
