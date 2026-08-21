import { describe, it, expect } from 'vitest';
import { calculateFinancials, applyOperationalPatch } from '@/lib/calculations';
import { defaultFinancialInput } from '@/lib/mockData';
import { buildProjection } from '@/lib/operationsReporting';
import type { FinancialInput } from '@/lib/types';

const clone = () => structuredClone(defaultFinancialInput);

function assertSane(output: ReturnType<typeof calculateFinancials>, label: string) {
  const fields = ['totalRevenue','totalCost','netMargin','costPerShipment','operationalBreakeven','cashRunway','fleetUtilization'] as const;
  for (const f of fields) {
    expect(Number.isFinite(output[f]), `${label}: ${f}=${output[f]} not finite`).toBe(true);
  }
}

describe('engine stress — adversarial numeric inputs', () => {
  const cases: [string, Partial<FinancialInput>][] = [
    ['NaN fuel price', { fuelPricePerLiter: NaN }],
    ['Infinity salary', { driverSalary: Infinity }],
    ['negative shipments', { failedDeliveryRate: -50 }],
    ['huge rate 1e308', { failedDeliveryRate: 1e308 }],
    ['payment delay 1e9', { clientPaymentDelay: 1e9 }],
    ['all zeros', { driverSalary: 0, opsTeamCount: 0, salesTeamCount: 0, warehouseStaff: 0, warehouseRent: 0, marketingBudget: 0 }],
    ['max safe integer rent', { warehouseRent: Number.MAX_SAFE_INTEGER }],
  ];
  for (const [label, patch] of cases) {
    it(`survives ${label}`, () => {
      const input = { ...clone(), ...patch };
      const out = calculateFinancials(input);
      assertSane(out, label);
    });
  }

  it('survives 10k providers × 5k vehicles', () => {
    const input = clone();
    input.providers = Array.from({ length: 10_000 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, shipmentsPerDay: (i % 7) + 1, pricePerShipment: 5 + (i % 3), enabled: true }));
    input.vehicleClasses = Array.from({ length: 5_000 }, (_, i) => ({ ...input.vehicleClasses[0], id: `v${i}`, name: `V${i}`, quantity: 2 }));
    const t0 = performance.now();
    const out = calculateFinancials(input);
    const dt = performance.now() - t0;
    assertSane(out, 'massive');
    console.log(`massive model (${input.providers.length} providers, ${input.vehicleClasses.length} classes): ${dt.toFixed(1)}ms`);
    expect(dt).toBeLessThan(2000);
  });

  it('1000 sequential updates stay fast (interactive budget)', () => {
    let input = clone();
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) {
      input = applyOperationalPatch(input, { fuelPricePerLiter: 1 + (i % 100) / 50 });
      calculateFinancials(input);
    }
    const dt = performance.now() - t0;
    console.log(`1000 edit+recalc cycles: ${dt.toFixed(0)}ms (${(dt/1000).toFixed(2)}ms/cycle)`);
    expect(dt).toBeLessThan(5000);
  });

  it('applyOperationalPatch driver sync with absurd counts', () => {
    const input = clone();
    const big = applyOperationalPatch(input, { companyDriverCount: 50_000 });
    expect(big.drivers).toHaveLength(50_000);
    const small = applyOperationalPatch(big, { companyDriverCount: 3 });
    expect(small.drivers).toHaveLength(3);
  });

  it('buildProjection handles a full year', () => {
    const out = calculateFinancials(clone());
    const t0 = performance.now();
    const trend = buildProjection(out, 365, {});
    expect(trend).toHaveLength(365);
    expect(performance.now() - t0).toBeLessThan(200);
  });

  it('no NaN contamination through chained patches', () => {
    let input = clone();
    for (const patch of [{ driverSalary: NaN }, { fuelPricePerLiter: Infinity }, { failedDeliveryRate: -1e308 }] as Partial<FinancialInput>[]) {
      input = applyOperationalPatch(input, patch);
    }
    // NaN/Infinity inputs must not produce NaN outputs
    const out = calculateFinancials(input);
    assertSane(out, 'chained');
  });
});
