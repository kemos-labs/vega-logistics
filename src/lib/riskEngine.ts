// VEGA Logistics OS — Risk Engine & Monte Carlo Simulations

import { FinancialInput, FinancialOutput } from './types';
import { calculateFinancials } from './calculations';

export interface RiskScenario {
  name: string;
  fuelPrice: number;
  failedDeliveryRate: number;
  dailyShipments: number;
  avgRevenue: number;
  paymentDelay: number;
  vehicleCount: number;
}

export interface MonteCarloResult {
  scenarios: RiskScenario[];
  results: {
    netMargin: number[];
    costPerShipment: number[];
    cashRunway: number[];
    collapseProbability: number;
  };
  distribution: {
    bins: number[];
    counts: number[];
    mean: number;
    median: number;
    p5: number;
    p95: number;
    stdDev: number;
  };
}

export interface RiskSurfacePoint {
  x: number;
  y: number;
  z: number;
  xLabel: string;
  yLabel: string;
}

export interface RiskSurface {
  title: string;
  xLabel: string;
  yLabel: string;
  zLabel: string;
  points: RiskSurfacePoint[][];
  interpretation: string;
}

function totalVehicleCount(input: FinancialInput): number {
  return input.vehicleClasses.filter((c) => c.enabled).reduce((s, c) => s + c.quantity, 0);
}

function totalDailyShipments(input: FinancialInput, output: FinancialOutput): number {
  return output.totalDailyShipments || input.providers.filter((p) => p.enabled).reduce((s, p) => s + p.shipmentsPerDay, 0);
}

function weightedAvgPrice(input: FinancialInput, output: FinancialOutput): number {
  return output.avgRevenuePerShipment || 0;
}

function normalRandom(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function runMonteCarlo(input: FinancialInput, simulations: number = 1000): MonteCarloResult {
  const scenarios: RiskScenario[] = [];
  const netMargins: number[] = [];
  const costPerShipments: number[] = [];
  const cashRunways: number[] = [];

  const baseShipments = totalDailyShipments(input, calculateFinancials(input));
  const baseAvg = weightedAvgPrice(input, calculateFinancials(input));
  const baseVehicles = totalVehicleCount(input);

  for (let i = 0; i < simulations; i++) {
    const scenario: RiskScenario = {
      name: `Scenario ${i + 1}`,
      fuelPrice: Math.max(1.5, normalRandom(input.fuelPricePerLiter, 0.3)),
      failedDeliveryRate: Math.max(0, normalRandom(input.failedDeliveryRate, 3)),
      dailyShipments: Math.max(10, Math.round(normalRandom(baseShipments, baseShipments * 0.15))),
      avgRevenue: Math.max(15, normalRandom(baseAvg, 5)),
      paymentDelay: Math.max(15, Math.round(normalRandom(input.clientPaymentDelay, 15))),
      vehicleCount: Math.max(2, Math.round(normalRandom(baseVehicles, 3))),
    };

    // Perturb the input: scale providers, fuel, etc.
    const scale = scenario.dailyShipments / Math.max(1, baseShipments);
    const perturbedProviders = input.providers.map((p) => ({
      ...p,
      shipmentsPerDay: Math.max(0, Math.round(p.shipmentsPerDay * scale)),
      pricePerShipment: Math.max(0, p.pricePerShipment + (scenario.avgRevenue - baseAvg)),
    }));
    // Scale every class to the scenario fleet size. The old implementation
    // only added positive deltas to the first class, so downside scenarios
    // silently kept the base fleet and understated risk.
    const fleetScale = scenario.vehicleCount / Math.max(1, baseVehicles);
    const perturbedVehicleClasses = input.vehicleClasses.map((c) => ({
      ...c,
      quantity: Math.max(0, Math.round(c.quantity * fleetScale)),
    }));

    const simInput: FinancialInput = {
      ...input,
      fuelPricePerLiter: scenario.fuelPrice,
      failedDeliveryRate: scenario.failedDeliveryRate,
      clientPaymentDelay: scenario.paymentDelay,
      providers: perturbedProviders,
      vehicleClasses: perturbedVehicleClasses,
      packagingCostPerUnit: input.packagingCostPerUnit * (1 + (Math.random() - 0.5) * 0.4),
      pickPackLaborPerOrder: input.pickPackLaborPerOrder * (1 + (Math.random() - 0.5) * 0.4),
    };

    const result = calculateFinancials(simInput);
    scenarios.push(scenario);
    netMargins.push(result.netMarginPercent);
    costPerShipments.push(result.costPerShipment);
    cashRunways.push(result.cashRunway);
  }

  const sorted = [...netMargins].sort((a, b) => a - b);
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const p5 = sorted[Math.floor(sorted.length * 0.05)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const stdDev = Math.sqrt(sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / sorted.length);

  const minVal = Math.floor(sorted[0]);
  const maxVal = Math.ceil(sorted[sorted.length - 1]);
  const binCount = 30;
  const binWidth = (maxVal - minVal) / binCount;
  const bins: number[] = [];
  const counts: number[] = [];

  for (let i = 0; i < binCount; i++) {
    const binStart = minVal + i * binWidth;
    const binEnd = binStart + binWidth;
    bins.push(Math.round(binStart * 10) / 10);
    counts.push(sorted.filter((v) => v >= binStart && v < binEnd).length);
  }

  const collapseProbability = sorted.filter((v) => v < 0).length / sorted.length;

  return {
    scenarios,
    results: {
      netMargin: netMargins,
      costPerShipment: costPerShipments,
      cashRunway: cashRunways,
      collapseProbability,
    },
    distribution: {
      bins,
      counts,
      mean,
      median,
      p5,
      p95,
      stdDev,
    },
  };
}

export function generateRiskSurfaces(input: FinancialInput, output: FinancialOutput): RiskSurface[] {
  const surfaces: RiskSurface[] = [];
  const resolution = 15;
  const baseShipments = totalDailyShipments(input, output);

  // Surface 1: Fleet Size × Shipment Density → Net Margin
  const s1Points: RiskSurfacePoint[][] = [];
  for (let i = 0; i < resolution; i++) {
    const row: RiskSurfacePoint[] = [];
    const fleetSize = 5 + (i / (resolution - 1)) * 30;
    for (let j = 0; j < resolution; j++) {
      const density = Math.max(10, Math.round(baseShipments * 0.4) + (j / (resolution - 1)) * Math.max(200, baseShipments * 1.5));
      const perturbedClasses = input.vehicleClasses.map((c, idx) =>
        idx === 0 ? { ...c, quantity: Math.max(0, Math.round(fleetSize)) } : c
      );
      const scale = density / Math.max(1, baseShipments);
      const perturbedProviders = input.providers.map((p) => ({
        ...p,
        shipmentsPerDay: Math.max(0, Math.round(p.shipmentsPerDay * scale)),
      }));
      const testInput: FinancialInput = { ...input, vehicleClasses: perturbedClasses, providers: perturbedProviders };
      const result = calculateFinancials(testInput);
      row.push({
        x: fleetSize,
        y: density,
        z: parseFloat(result.netMarginPercent.toFixed(2)),
        xLabel: `${Math.round(fleetSize)} vehicles`,
        yLabel: `${Math.round(density)} shipments`,
      });
    }
    s1Points.push(row);
  }
  surfaces.push({
    title: 'Fleet Size × Shipment Density → Net Margin',
    xLabel: 'Fleet Size',
    yLabel: 'Daily Shipments',
    zLabel: 'Net Margin %',
    points: s1Points,
    interpretation: 'Sweet spot: moderate fleet with high density yields peak margins. Over-expansion without density kills profitability.',
  });

  // Surface 2: Fuel Price × Failed Delivery Rate → Liquidity Stress
  const s2Points: RiskSurfacePoint[][] = [];
  for (let i = 0; i < resolution; i++) {
    const row: RiskSurfacePoint[] = [];
    const fuelPrice = 1.5 + (i / (resolution - 1)) * 1.5;
    for (let j = 0; j < resolution; j++) {
      const failedRate = (j / (resolution - 1)) * 15;
      const testInput: FinancialInput = {
        ...input,
        fuelPricePerLiter: parseFloat(fuelPrice.toFixed(2)),
        failedDeliveryRate: parseFloat(failedRate.toFixed(1)),
      };
      const result = calculateFinancials(testInput);
      const liquidityStress = Math.min(100, Math.max(0, (1 - result.cashRunway / 24) * 100));
      row.push({
        x: fuelPrice,
        y: failedRate,
        z: parseFloat(liquidityStress.toFixed(1)),
        xLabel: `SAR ${fuelPrice.toFixed(2)}/L`,
        yLabel: `${failedRate.toFixed(1)}% failed`,
      });
    }
    s2Points.push(row);
  }
  surfaces.push({
    title: 'Fuel Price × Failed Delivery Rate → Liquidity Stress',
    xLabel: 'Fuel Price (SAR/L)',
    yLabel: 'Failed Delivery Rate %',
    zLabel: 'Liquidity Stress (0-100)',
    points: s2Points,
    interpretation: 'Rising fuel + rising failures = exponential liquidity stress. The cliff is steeper than linear intuition suggests.',
  });

  // Surface 3: Payment Delay × Cost Multiplier → Collapse Probability
  const s3Points: RiskSurfacePoint[][] = [];
  for (let i = 0; i < resolution; i++) {
    const row: RiskSurfacePoint[] = [];
    const delay = 15 + (i / (resolution - 1)) * 75;
    for (let j = 0; j < resolution; j++) {
      const costMultiplier = 0.8 + (j / (resolution - 1)) * 0.6;
      const testInput: FinancialInput = {
        ...input,
        clientPaymentDelay: Math.round(delay),
        driverSalary: Math.round(input.driverSalary * costMultiplier),
        warehouseRent: Math.round(input.warehouseRent * costMultiplier),
        warehouseUtilities: Math.round(input.warehouseUtilities * costMultiplier),
        officeRent: Math.round(input.officeRent * costMultiplier),
        opsTeamAvgSalary: Math.round(input.opsTeamAvgSalary * costMultiplier),
      };
      const result = calculateFinancials(testInput);
      const collapseProbability = result.netMarginPercent < 0
        ? Math.min(100, Math.abs(result.netMarginPercent) * 5 + (12 - Math.min(result.cashRunway, 12)) * 5)
        : Math.max(0, (12 - Math.min(result.cashRunway, 12)) * 3);
      row.push({
        x: delay,
        y: costMultiplier,
        z: parseFloat(Math.min(100, collapseProbability).toFixed(1)),
        xLabel: `${Math.round(delay)} days`,
        yLabel: `${(costMultiplier * 100).toFixed(0)}% cost base`,
      });
    }
    s3Points.push(row);
  }
  surfaces.push({
    title: 'Payment Delay × Cost Multiplier → Collapse Probability %',
    xLabel: 'Payment Delay (days)',
    yLabel: 'Cost Multiplier',
    zLabel: 'Collapse Probability %',
    points: s3Points,
    interpretation: 'Beyond 60 days payment delay, the collapse cliff activates. Combined with cost inflation, risk accelerates non-linearly.',
  });

  return surfaces;
}

export interface RiskScores {
  liquidityRisk: { score: number; level: string; color: string };
  operationalRisk: { score: number; level: string; color: string };
  strategicRisk: { score: number; level: string; color: string };
  marketRisk: { score: number; level: string; color: string };
  overallRisk: { score: number; level: string; color: string };
}

function scoreLevel(s: number): { level: string; color: string } {
  if (s <= 25) return { level: 'Low', color: '#22c55e' };
  if (s <= 50) return { level: 'Moderate', color: '#eab308' };
  if (s <= 75) return { level: 'High', color: '#f97316' };
  return { level: 'Critical', color: '#ef4444' };
}

export function calculateRiskScores(input: FinancialInput, output: FinancialOutput, mcResult?: MonteCarloResult): RiskScores {
  let liquidityScore = 0;
  if (output.cashRunway < 3) liquidityScore += 50;
  else if (output.cashRunway < 6) liquidityScore += 30;
  else if (output.cashRunway < 12) liquidityScore += 15;
  if (output.burnRate > 0) liquidityScore += Math.min(output.burnRate / 50000 * 30, 30);
  if (input.clientPaymentDelay > 45) liquidityScore += 15;
  if (input.clientPaymentDelay > 60) liquidityScore += 15;
  if (mcResult) liquidityScore += mcResult.results.collapseProbability * 30;
  liquidityScore = Math.min(liquidityScore, 100);

  let opScore = 0;
  if (output.fleetUtilization < 50) opScore += 25;
  else if (output.fleetUtilization < 65) opScore += 15;
  if (input.failedDeliveryRate > 5) opScore += Math.min(input.failedDeliveryRate * 4, 30);
  if (input.returnRate > 3) opScore += Math.min(input.returnRate * 4, 20);
  if (output.costPerShipment > 25) opScore += 20;
  opScore = Math.min(opScore, 100);

  let stratScore = 0;
  if (output.netMarginPercent < 10) stratScore += 30;
  else if (output.netMarginPercent < 20) stratScore += 15;
  if (output.netMargin < 0) stratScore += 25;
  stratScore = Math.min(stratScore, 100);

  let marketScore = 0;
  if (input.fuelPricePerLiter > 2.5) marketScore += 25;
  else if (input.fuelPricePerLiter > 2.0) marketScore += 15;
  if (input.clientPaymentDelay > 30) marketScore += 15;
  if (mcResult) {
    const volatility = mcResult.distribution.stdDev;
    if (volatility > 10) marketScore += 30;
    else if (volatility > 5) marketScore += 15;
  }
  marketScore = Math.min(marketScore, 100);

  const overallScore = Math.round((liquidityScore * 0.35 + opScore * 0.25 + stratScore * 0.25 + marketScore * 0.15));

  return {
    liquidityRisk: { score: Math.round(liquidityScore), ...scoreLevel(liquidityScore) },
    operationalRisk: { score: Math.round(opScore), ...scoreLevel(opScore) },
    strategicRisk: { score: Math.round(stratScore), ...scoreLevel(stratScore) },
    marketRisk: { score: Math.round(marketScore), ...scoreLevel(marketScore) },
    overallRisk: { score: overallScore, ...scoreLevel(overallScore) },
  };
}
