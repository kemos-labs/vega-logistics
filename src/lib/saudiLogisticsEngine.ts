// VEGA Logistics OS — Saudi Fleet Planner Engine
// Saudi-specific: fuel 0.67/L, KM-based oil, straight-line depreciation, no freelancers/insurance

export interface SaudiCostInput {
  fleetSize: number;
  vanUtilization: number; // %
  vanPurchasePrice: number; // SAR
  vanLifespanYears: number;
  fuelPriceLiter: number; // SAR (91 octane = 0.67)
  fuelConsumptionPer100km: number; // L/100km
  kmPerVanPerDay: number;
  oilChangeCostPer5000km: number; // SAR
  tiresPerYear: number; // SAR
  otherMaintenancePerMonth: number; // SAR
  driverSalaryPerMonth: number; // SAR
  driverBenefitsPercent: number; // %
  warehouseRentPerMonth: number; // SAR
  utilitiesPerMonth: number; // SAR
  adminSalariesPerMonth: number; // SAR
  softwarePerMonth: number; // SAR
  communicationPerMonth: number; // SAR
  deliveriesPerVanPerDay: number;
  revenuePerDelivery: number; // SAR
  breakEvenBenchmark: number; // deliveries/day industry standard
}

export interface SaudiCostOutput {
  activeVans: number;
  monthlyKm: number;
  fuelPerVanPerMonth: number;
  oilPerVanPerMonth: number;
  tiresPerVanPerMonth: number;
  depreciationPerVanPerMonth: number;
  variableCostPerVan: number;
  driverTotalPerMonth: number;
  totalVariableCost: number;
  totalFixedCost: number;
  totalMonthlyCost: number;
  deliveriesPerDay: number;
  deliveriesPerMonth: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  marginPercent: number;
  breakEvenDeliveriesPerDay: number;
  costPerDelivery: number;
  revenuePerVanPerMonth: number;
  ebitda: number;
  ebitdaMargin: number;
  paybackMonths: number;
  fleetROI: number;
}

export interface MonteCarloSimResult {
  riskPercent: number; // % of loss scenarios
  p10: number;
  p50: number;
  p90: number;
  buckets: number[];
  min: number;
  max: number;
  totalRuns: number;
}

export function calculateSaudiCosts(input: SaudiCostInput): SaudiCostOutput {
  const workingDays = 22;
  const activeVans = Math.round((input.fleetSize * input.vanUtilization) / 100);
  const monthlyKm = input.kmPerVanPerDay * workingDays;

  // Per-van variable costs
  const fuelPerVanPerMonth =
    ((input.kmPerVanPerDay * input.fuelPriceLiter * input.fuelConsumptionPer100km) / 100) *
    workingDays;
  const oilPerVanPerMonth = (monthlyKm / 5000) * input.oilChangeCostPer5000km;
  const tiresPerVanPerMonth = input.tiresPerYear / 12;
  const depreciationPerVanPerMonth =
    input.vanPurchasePrice / (input.vanLifespanYears * 12);

  const variableCostPerVan =
    fuelPerVanPerMonth +
    oilPerVanPerMonth +
    tiresPerVanPerMonth +
    input.otherMaintenancePerMonth +
    depreciationPerVanPerMonth;

  const driverTotalPerMonth =
    input.driverSalaryPerMonth * (1 + input.driverBenefitsPercent / 100);

  // Totals
  const totalVariableCost = (variableCostPerVan + driverTotalPerMonth) * activeVans;
  const totalFixedCost =
    input.warehouseRentPerMonth +
    input.utilitiesPerMonth +
    input.adminSalariesPerMonth +
    input.softwarePerMonth +
    input.communicationPerMonth;

  const totalMonthlyCost = totalVariableCost + totalFixedCost;
  const deliveriesPerDay = input.deliveriesPerVanPerDay * activeVans;
  const deliveriesPerMonth = deliveriesPerDay * workingDays;
  const monthlyRevenue = deliveriesPerMonth * input.revenuePerDelivery;
  const monthlyProfit = monthlyRevenue - totalMonthlyCost;
  const marginPercent = monthlyRevenue > 0 ? (monthlyProfit / monthlyRevenue) * 100 : 0;

  // Break-even and unit metrics
  const breakEvenDeliveriesPerDay =
    input.revenuePerDelivery > 0
      ? totalMonthlyCost / input.revenuePerDelivery / workingDays
      : Infinity;
  const costPerDelivery =
    deliveriesPerDay > 0 ? totalMonthlyCost / deliveriesPerMonth : 0;
  const revenuePerVanPerMonth =
    input.deliveriesPerVanPerDay * input.revenuePerDelivery * workingDays;

  // EBITDA = Revenue − OpEx (excl depreciation)
  const ebitda =
    monthlyRevenue -
    (totalMonthlyCost - depreciationPerVanPerMonth * activeVans);
  const ebitdaMargin = monthlyRevenue > 0 ? (ebitda / monthlyRevenue) * 100 : 0;

  // Investor metrics
  const netContributionPerVan =
    input.deliveriesPerVanPerDay * input.revenuePerDelivery * workingDays -
    (variableCostPerVan + driverTotalPerMonth);
  const paybackMonths =
    netContributionPerVan > 0
      ? input.vanPurchasePrice / netContributionPerVan
      : Infinity;

  const totalFleetInvestment = input.fleetSize * input.vanPurchasePrice;
  const annualProfit = monthlyProfit * 12;
  const fleetROI = totalFleetInvestment > 0 ? (annualProfit / totalFleetInvestment) * 100 : 0;

  return {
    activeVans,
    monthlyKm,
    fuelPerVanPerMonth,
    oilPerVanPerMonth,
    tiresPerVanPerMonth,
    depreciationPerVanPerMonth,
    variableCostPerVan,
    driverTotalPerMonth,
    totalVariableCost,
    totalFixedCost,
    totalMonthlyCost,
    deliveriesPerDay,
    deliveriesPerMonth,
    monthlyRevenue,
    monthlyProfit,
    marginPercent,
    breakEvenDeliveriesPerDay,
    costPerDelivery,
    revenuePerVanPerMonth,
    ebitda,
    ebitdaMargin,
    paybackMonths,
    fleetROI,
  };
}

export function runSaudiMonteCarlo(
  input: SaudiCostInput,
  output: SaudiCostOutput,
  runs: number = 1000
): MonteCarloSimResult {
  let losses = 0;
  const profits: number[] = [];

  for (let i = 0; i < runs; i++) {
    const demandVariance = 0.85 + Math.random() * 0.3; // -15% to +15%
    const costVariance = 0.95 + Math.random() * 0.15; // -5% to +10%
    const fuelVariance = 0.9 + Math.random() * 0.25; // -10% to +15%

    const simDeliveries = output.deliveriesPerMonth * demandVariance;
    const simRevenue = simDeliveries * input.revenuePerDelivery;
    const simCost =
      output.totalVariableCost * costVariance * fuelVariance +
      output.totalFixedCost;
    const simProfit = simRevenue - simCost;

    profits.push(simProfit);
    if (simProfit < 0) losses++;
  }

  profits.sort((a, b) => a - b);
  const p10 = profits[Math.floor(runs * 0.1)];
  const p50 = profits[Math.floor(runs * 0.5)];
  const p90 = profits[Math.floor(runs * 0.9)];
  const riskPercent = (losses / runs) * 100;

  // Histogram buckets
  const buckets = Array(20).fill(0);
  const min = profits[0];
  const max = profits[runs - 1];
  const range = max - min || 1;
  profits.forEach((p) => {
    const idx = Math.min(19, Math.floor(((p - min) / range) * 20));
    buckets[idx]++;
  });

  return { riskPercent, p10, p50, p90, buckets, min, max, totalRuns: runs };
}

export const DEFAULT_SAUDI_INPUT: SaudiCostInput = {
  fleetSize: 6,
  vanUtilization: 88,
  vanPurchasePrice: 95000,
  vanLifespanYears: 5,
  fuelPriceLiter: 0.67,
  fuelConsumptionPer100km: 10,
  kmPerVanPerDay: 180,
  oilChangeCostPer5000km: 150,
  tiresPerYear: 1200,
  otherMaintenancePerMonth: 300,
  driverSalaryPerMonth: 3200,
  driverBenefitsPercent: 12,
  warehouseRentPerMonth: 8000,
  utilitiesPerMonth: 1200,
  adminSalariesPerMonth: 12000,
  softwarePerMonth: 800,
  communicationPerMonth: 400,
  deliveriesPerVanPerDay: 35,
  revenuePerDelivery: 22,
  breakEvenBenchmark: 210,
};
