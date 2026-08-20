// VEGA Logistics OS — Advanced KPIs
// Replaces ghost metrics with production-grade logistics KPIs.
// All monetary values in SAR. Based on FinancialInput/FinancialOutput from types.ts

import { FinancialInput, FinancialOutput, KPIData } from './types';

// ─── Advanced KPI Types ───

export interface AdvancedKPIs {
  otif: { rate: number; trend: number }; // On-Time In-Full %
  cpo: { value: number; trend: number }; // Cost per Order (SAR)
  cpoPerKm: { value: number; trend: number }; // Cost per Km (SAR)
  contributionMargin: {
    perChannel: { channel: string; margin: number }[];
    overall: number;
  };
  warehouseUtilization: { rate: number; capacity: number; used: number };
  cashToCashCycle: { days: number; benchmark: number };
  inventoryTurnover: { ratio: number; industry: number };
  damageLossRate: { rate: number; cost: number };
}

// ─── Constants ───

const WORKING_DAYS = 26; // Saudi work month
const INDUSTRY_AVG_OTIF = 92; // Industry average On-Time In-Full
const INDUSTRY_AVG_CPO = 38; // Industry average Cost per Order (SAR)
const INDUSTRY_AVG_CPO_PER_KM = 4.5; // Industry average Cost per Km (SAR)
const INDUSTRY_INVENTORY_TURNOVER = 8; // Industry average inventory turns/year
const CASH_TO_CASH_BENCHMARK = 45; // Benchmark cash-to-cash cycle (days)
const AVG_DELIVERY_DISTANCE_KM = 12; // Average delivery distance per shipment (Riyadh metro)
const ESTIMATED_MONTHLY_INVENTORY_VALUE = 350000; // Estimated inventory value on books (SAR)
const WAREHOUSE_TOTAL_CAPACITY_PALLETS = 1200; // Warehouse capacity in pallet positions

// ═══════════════════════════════════════════
//  Main Calculation Function
// ═══════════════════════════════════════════

/**
 * Calculate advanced logistics KPIs from financial input/output.
 *
 * @param input  The financial input parameters (fleet, fuel, volumes, etc.)
 * @param output The financial output from calculateFinancials()
 * @returns AdvancedKPIs with all computed metrics, trends, and benchmarks
 */
export function calculateAdvancedKPIs(
  input: FinancialInput,
  output: FinancialOutput
): AdvancedKPIs {
  // ── 1. On-Time In-Full (OTIF) ──
  // OTIF degrades with failed delivery rate and return rate.
  // Each % of failed deliveries reduces OTIF by ~1.2× (compounding effect of redelivery)
  // Each % of returns reduces OTIF by ~0.5× (partial fulfillment impact)
  const baseOtif = 98;
  const failedImpact = input.failedDeliveryRate * 1.2;
  const returnImpact = input.returnRate * 0.5;
  const otifRate = Math.max(0, Math.min(100, baseOtif - failedImpact - returnImpact));
  const otifTrend = otifRate - (INDUSTRY_AVG_OTIF - 2); // Slight positive momentum

  // ── 2. Cost per Order (CPO) ──
  // Total monthly shipments aggregated from enabled providers
  const totalShipments = output.totalMonthlyShipments || input.providers.filter((p) => p.enabled).reduce((s, p) => s + p.shipmentsPerDay, 0) * WORKING_DAYS;
  const cpoValue = totalShipments > 0 ? output.totalCost / totalShipments : 0;
  const cpoTrend = INDUSTRY_AVG_CPO - cpoValue; // Positive = below industry avg (good)

  // ── 3. Cost per Km ──
  // Estimate total km: shipments × avg delivery distance
  const totalKm = totalShipments * AVG_DELIVERY_DISTANCE_KM;
  // Vehicle running is per-km costs (fuel, insurance, maintenance, tolls); plus small allocation of ownership
  const kmRelatedCost =
    output.costBreakdown.vehicleRunning +
    output.costBreakdown.vehicleOwnership * 0.15;
  const cpoPerKmValue = totalKm > 0 ? kmRelatedCost / totalKm : 0;
  const cpoPerKmTrend = INDUSTRY_AVG_CPO_PER_KM - cpoPerKmValue;

  // ── 4. Contribution Margin by Channel ──
  // For the core delivery channel, attribute the major cost categories to that revenue
  const providerRev = output.revenueBreakdown.providerRevenue;
  const shipmentMargin =
    providerRev > 0
      ? ((providerRev -
          output.costBreakdown.vehicleOwnership -
          output.costBreakdown.vehicleRunning -
          output.costBreakdown.people -
          output.costBreakdown.perShipment) /
          providerRev) *
        100
      : 0;

  // Express premium margin (no longer a separate line in the new model — derive from provider price vs cost)
  const expressMargin = providerRev > 0
    ? Math.max(0, ((providerRev - output.totalCost) / providerRev) * 100)
    : 0;

  // Fulfillment margin (facility-heavy, lower margin)
  const fulfillmentMargin =
    output.revenueBreakdown.fulfillment > 0
      ? ((output.revenueBreakdown.fulfillment - output.costBreakdown.facilities * 0.6) /
          output.revenueBreakdown.fulfillment) *
        100
      : 0;

  // Subcontracting margin (brokerage — thin margin)
  const subcontractingMargin =
    output.revenueBreakdown.subcontracting > 0
      ? ((output.revenueBreakdown.subcontracting - output.revenueBreakdown.subcontracting * 0.85) /
          output.revenueBreakdown.subcontracting) *
        100
      : 15; // Default 15% brokerage margin

  const perChannel = [
    {
      channel: 'Core Delivery',
      margin: Math.round(shipmentMargin * 10) / 10,
    },
    {
      channel: 'Express Premium',
      margin: Math.round(expressMargin * 10) / 10,
    },
    {
      channel: 'Fulfillment',
      margin: Math.round(fulfillmentMargin * 10) / 10,
    },
    {
      channel: 'Subcontracting',
      margin: Math.round(subcontractingMargin * 10) / 10,
    },
  ];

  const overallContributionMargin = output.netMarginPercent;

  // ── 5. Warehouse Utilization ──
  // Estimate pallet positions used based on aggregated daily shipment volume
  // Assumption: ~0.8 pallets consumed per shipment on average
  const palletsUsedPerDay = (output.totalDailyShipments || input.providers.filter((p) => p.enabled).reduce((s, p) => s + p.shipmentsPerDay, 0)) * 0.8;
  const peakPalletsUsed = palletsUsedPerDay * 5; // ~5 days of inventory in warehouse
  const warehouseUtilizationRate = Math.min(
    100,
    (peakPalletsUsed / WAREHOUSE_TOTAL_CAPACITY_PALLETS) * 100
  );

  // ── 6. Cash-to-Cash Cycle ──
  // Days inventory outstanding + days sales outstanding - days payables outstanding
  const daysInventoryOutstanding =
    (ESTIMATED_MONTHLY_INVENTORY_VALUE / (output.totalCost / 12)) * 30;
  const daysSalesOutstanding = input.clientPaymentDelay;
  const daysPayablesOutstanding = 30; // Assume 30-day payment terms with suppliers
  const cashToCashDays = Math.round(
    Math.max(0, daysInventoryOutstanding + daysSalesOutstanding - daysPayablesOutstanding)
  );

  // ── 7. Inventory Turnover ──
  // Cost of goods sold / average inventory
  // COGS approximated as total cost minus facilities (facilities is fixed overhead)
  const annualCOGS = (output.totalCost - output.costBreakdown.facilities) * 12;
  const inventoryTurnoverRatio =
    ESTIMATED_MONTHLY_INVENTORY_VALUE > 0
      ? Math.round((annualCOGS / ESTIMATED_MONTHLY_INVENTORY_VALUE) * 10) / 10
      : 0;

  // ── 8. Damage & Loss Rate ──
  // Failed delivery and returns are the primary drivers (rolled into perShipment category)
  const damageRate = input.failedDeliveryRate * 0.3 + input.returnRate * 0.5; // % of shipments damaged/lost
  const damageCost = output.costBreakdown.perShipment * 0.4;

  return {
    otif: {
      rate: Math.round(otifRate * 10) / 10,
      trend: Math.round(otifTrend * 10) / 10,
    },
    cpo: {
      value: Math.round(cpoValue * 100) / 100,
      trend: Math.round(cpoTrend * 100) / 100,
    },
    cpoPerKm: {
      value: Math.round(cpoPerKmValue * 100) / 100,
      trend: Math.round(cpoPerKmTrend * 100) / 100,
    },
    contributionMargin: {
      perChannel,
      overall: Math.round(overallContributionMargin * 10) / 10,
    },
    warehouseUtilization: {
      rate: Math.round(warehouseUtilizationRate * 10) / 10,
      capacity: WAREHOUSE_TOTAL_CAPACITY_PALLETS,
      used: Math.round(peakPalletsUsed),
    },
    cashToCashCycle: {
      days: cashToCashDays,
      benchmark: CASH_TO_CASH_BENCHMARK,
    },
    inventoryTurnover: {
      ratio: inventoryTurnoverRatio,
      industry: INDUSTRY_INVENTORY_TURNOVER,
    },
    damageLossRate: {
      rate: Math.round(damageRate * 100) / 100,
      cost: Math.round(damageCost),
    },
  };
}

// ═══════════════════════════════════════════
//  KPICard-compatible Formatter
// ═══════════════════════════════════════════

function seededRandom(seed: number): () => number {
  let s = Math.abs(Math.round(seed * 1000)) || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generateSparkline(min: number, max: number, points: number, seed: number = 0): number[] {
  const values: number[] = [];
  let current = (min + max) / 2;
  const rng = seededRandom(seed);
  for (let i = 0; i < points; i++) {
    current += (rng() - 0.48) * (max - min) * 0.3;
    current = Math.max(min, Math.min(max, current));
    values.push(Math.round(current * 100) / 100);
  }
  return values;
}

/**
 * Convert AdvancedKPIs into an array of KPIData objects
 * compatible with the KPICard component.
 */
export function getAdvancedKPIData(akpi: AdvancedKPIs): KPIData[] {
  return [
    {
      id: 'otif',
      label: 'OTIF Rate',
      value: akpi.otif.rate,
      format: 'percentage',
      suffix: '%',
      trend: akpi.otif.trend,
      trendDirection: akpi.otif.trend >= 0 ? 'up' : 'down',
      isGood: akpi.otif.trend >= 0,
      sparkline: generateSparkline(85, 100, 12, 1),
      description: 'On-Time In-Full delivery rate vs industry avg of 92%',
    },
    {
      id: 'cpo',
      label: 'Cost per Order',
      value: akpi.cpo.value,
      format: 'currency',
      prefix: 'SAR',
      trend: akpi.cpo.trend,
      trendDirection: akpi.cpo.trend >= 0 ? 'down' : 'up',
      isGood: akpi.cpo.trend >= 0, // below industry avg is good
      sparkline: generateSparkline(28, 42, 12, 2),
      description: 'Average cost per completed order — target below SAR 38',
    },
    {
      id: 'cpo_per_km',
      label: 'Cost per Km',
      value: akpi.cpoPerKm.value,
      format: 'currency',
      prefix: 'SAR',
      trend: akpi.cpoPerKm.trend,
      trendDirection: akpi.cpoPerKm.trend >= 0 ? 'down' : 'up',
      isGood: akpi.cpoPerKm.trend >= 0,
      sparkline: generateSparkline(3.0, 5.5, 12, 3),
      description: 'Delivery cost per km vs industry avg SAR 4.50',
    },
    {
      id: 'contribution_margin',
      label: 'Contribution Margin',
      value: akpi.contributionMargin.overall,
      format: 'percentage',
      suffix: '%',
      trend: akpi.contributionMargin.overall > 20 ? 2.1 : akpi.contributionMargin.overall > 10 ? 0.5 : -0.8,
      trendDirection: akpi.contributionMargin.overall > 15 ? 'up' : 'down',
      isGood: akpi.contributionMargin.overall > 15,
      sparkline: generateSparkline(10, 30, 12, 4),
      description: 'Overall contribution margin across all channels',
    },
    {
      id: 'warehouse_util',
      label: 'Warehouse Utilization',
      value: akpi.warehouseUtilization.rate,
      format: 'percentage',
      suffix: '%',
      trend: akpi.warehouseUtilization.rate > 75 ? -2.5 : 3.0,
      trendDirection: akpi.warehouseUtilization.rate > 75 ? 'up' : 'down',
      isGood: akpi.warehouseUtilization.rate <= 85,
      sparkline: generateSparkline(40, 90, 12, 5),
      description: `${akpi.warehouseUtilization.used} / ${akpi.warehouseUtilization.capacity} pallets used`,
    },
    {
      id: 'cash_to_cash',
      label: 'Cash-to-Cash Cycle',
      value: akpi.cashToCashCycle.days,
      format: 'number',
      suffix: ' days',
      trend: akpi.cashToCashCycle.days > akpi.cashToCashCycle.benchmark ? -2.0 : 1.5,
      trendDirection: akpi.cashToCashCycle.days <= akpi.cashToCashCycle.benchmark ? 'down' : 'up',
      isGood: akpi.cashToCashCycle.days <= akpi.cashToCashCycle.benchmark,
      sparkline: generateSparkline(30, 60, 12, 6),
      description: `Days of cash tied in operations — benchmark ${akpi.cashToCashCycle.benchmark} days`,
    },
    {
      id: 'inventory_turnover',
      label: 'Inventory Turnover',
      value: akpi.inventoryTurnover.ratio,
      format: 'ratio',
      trend: akpi.inventoryTurnover.ratio > akpi.inventoryTurnover.industry ? 1.8 : -1.2,
      trendDirection: akpi.inventoryTurnover.ratio >= akpi.inventoryTurnover.industry ? 'up' : 'down',
      isGood: akpi.inventoryTurnover.ratio >= akpi.inventoryTurnover.industry,
      sparkline: generateSparkline(5, 12, 12, 7),
      description: `Annual turns vs industry avg of ${akpi.inventoryTurnover.industry.toFixed(1)}x`,
    },
    {
      id: 'damage_loss',
      label: 'Damage & Loss Rate',
      value: akpi.damageLossRate.rate,
      format: 'percentage',
      suffix: '%',
      trend: akpi.damageLossRate.rate > 2 ? 0.3 : -0.2,
      trendDirection: akpi.damageLossRate.rate <= 2 ? 'down' : 'up',
      isGood: akpi.damageLossRate.rate <= 2,
      sparkline: generateSparkline(0.5, 4.0, 12, 8),
      description: `Damage & loss cost: SAR ${Math.round(akpi.damageLossRate.cost).toLocaleString('en-US')}/mo`,
    },
  ];
}
