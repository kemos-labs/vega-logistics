// VEGA Logistics OS — Carbon & Sustainability Engine
// Aligned with Saudi Green Initiative / Vision 2030 net-zero 2060 target.
// Scope 1 (direct fuel), Scope 2 (electricity), Scope 3 (indirect value chain).

import {
  CarbonEmission,
  CarbonIntensityByLane,
  CarbonOffset,
  ESGReport,
  AISeverity,
} from '../types2026';

const FUEL_CO2E_KG_PER_LITER = 2.31; // gasoline 91 octane
const ELECTRICITY_CO2E_KG_PER_KWH = 0.55; // Saudi grid average
const EV_CO2E_KG_PER_KM = 0.05; // well-to-wheel Saudi grid
const ICE_CO2E_KG_PER_KM = 0.18; // 10 L/100km

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function calcFuelEmissionsKg(liters: number): number {
  return Math.round(liters * FUEL_CO2E_KG_PER_LITER * 100) / 100;
}

export function calcElectricityEmissionsKg(kwh: number): number {
  return Math.round(kwh * ELECTRICITY_CO2E_KG_PER_KWH * 100) / 100;
}

export function calcTripEmissionsKg(distanceKm: number, isEV: boolean = false): number {
  return Math.round((isEV ? EV_CO2E_KG_PER_KM : ICE_CO2E_KG_PER_KM) * distanceKm * 100) / 100;
}

export function generateEmissionsLog(
  vehicleCount: number,
  warehouseCount: number,
  days: number = 30,
  seed: number = Date.now()
): CarbonEmission[] {
  const r = rng(seed);
  const out: CarbonEmission[] = [];
  const now = Date.now();

  for (let day = 0; day < days; day++) {
    const dayTs = new Date(now - day * 24 * 3600 * 1000).toISOString();
    for (let v = 0; v < vehicleCount; v++) {
      const liters = 18 + r() * 22;
      out.push({
        id: `em_v_${v}_${day}`,
        vehicleId: `VEGA-${String(v + 1).padStart(3, '0')}`,
        scope: 1,
        category: 'fuel_combustion',
        co2eKg: calcFuelEmissionsKg(liters),
        timestamp: dayTs,
        source: r() > 0.2 ? 'measured' : 'estimated',
      });
    }
    for (let w = 0; w < warehouseCount; w++) {
      const kwh = 250 + r() * 200;
      out.push({
        id: `em_w_${w}_${day}`,
        warehouseId: `WH-${w + 1}`,
        scope: 2,
        category: 'electricity',
        co2eKg: calcElectricityEmissionsKg(kwh),
        timestamp: dayTs,
        source: 'measured',
      });
    }
  }

  return out;
}

export function aggregateByScope(emissions: CarbonEmission[]): { scope1: number; scope2: number; scope3: number } {
  const s1 = emissions.filter((e) => e.scope === 1).reduce((s, e) => s + e.co2eKg, 0);
  const s2 = emissions.filter((e) => e.scope === 2).reduce((s, e) => s + e.co2eKg, 0);
  const s3 = emissions.filter((e) => e.scope === 3).reduce((s, e) => s + e.co2eKg, 0);
  return {
    scope1: Math.round(s1),
    scope2: Math.round(s2),
    scope3: Math.round(s3),
  };
}

export function generateLaneIntensities(seed: number = Date.now()): CarbonIntensityByLane[] {
  const r = rng(seed);
  const lanes = [
    { from: 'Riyadh Central', to: 'Jeddah Port' },
    { from: 'Riyadh Central', to: 'Dammam Port' },
    { from: 'Riyadh Central', to: 'KAEC' },
    { from: 'Riyadh Central', to: 'Aramco Dhahran' },
    { from: 'Riyadh Central', to: 'Mecca' },
  ];
  return lanes.map((l, i) => {
    const distanceKm = 400 + r() * 700;
    const co2ePerTonKm = 0.06 + r() * 0.05;
    const totalCo2eKg = Math.round(co2ePerTonKm * (2 + r() * 3) * distanceKm);
    const intensity = totalCo2eKg / distanceKm > 0.1 ? 'high' : totalCo2eKg / distanceKm > 0.06 ? 'medium' : 'low';
    return {
      laneId: `lane_${i}`,
      fromZone: l.from,
      toZone: l.to,
      distanceKm: Math.round(distanceKm),
      co2ePerTonKm: Math.round(co2ePerTonKm * 1000) / 1000,
      totalCo2eKg,
      intensity: intensity as CarbonIntensityByLane['intensity'],
      vehicleMix: r() > 0.6 ? 'Diesel 100%' : 'Diesel 70% / Hybrid 30%',
    };
  });
}

export function generateOffsetPortfolio(seed: number = Date.now()): CarbonOffset[] {
  const r = rng(seed);
  const projects = [
    'Saudi Mangrove Restoration',
    'Red Sea Coral Rehabilitation',
    'Riyadh Solar Farm Alpha',
    'NEOM Green Hydrogen',
    'AlUla Reforestation',
  ];
  const registries: CarbonOffset['registry'][] = ['verra', 'gold_standard', 'aramco_saudi'];

  return projects.map((p, i) => ({
    id: `off_${i}`,
    projectName: p,
    registry: registries[Math.floor(r() * registries.length)],
    co2eOffsetKg: Math.round((r() * 5000 + 1000) * 1000),
    pricePerTonne: 60 + Math.floor(r() * 80),
    vintage: 2023 + Math.floor(r() * 3),
    retired: r() > 0.3,
    retirementDate: r() > 0.3 ? new Date(Date.now() - r() * 365 * 24 * 3600 * 1000).toISOString() : undefined,
  }));
}

export function buildESGReport(
  emissions: CarbonEmission[],
  offsets: CarbonOffset[],
  revenue: number,
  shipments: number,
): ESGReport {
  const { scope1, scope2, scope3 } = aggregateByScope(emissions);
  const offsetsRetired = offsets.filter((o) => o.retired).reduce((s, o) => s + o.co2eOffsetKg, 0);
  const totalGross = scope1 + scope2 + scope3;
  const netEmissions = Math.max(0, totalGross - offsetsRetired);
  const netZero = totalGross - offsetsRetired;
  const intensityPerRevenue = revenue > 0 ? Math.round((totalGross / (revenue / 1000)) * 100) / 100 : 0;
  const intensityPerShipment = shipments > 0 ? Math.round((totalGross / shipments) * 1000) / 1000 : 0;
  const reductionVsBaseline = Math.round((1 - totalGross / (totalGross * 1.4)) * 1000) / 10;
  const saudiNetZero2050Progress = Math.min(100, Math.round((reductionVsBaseline / 100) * 30));

  return {
    periodStart: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    periodEnd: new Date().toISOString(),
    totalScope1: scope1,
    totalScope2: scope2,
    totalScope3: scope3,
    netEmissions,
    offsetsRetired,
    netZero,
    intensityPerRevenue,
    intensityPerShipment,
    reductionVsBaseline,
    saudiNetZero2050Progress,
  };
}

export interface CarbonReductionAction {
  id: string;
  title: string;
  category: 'fleet' | 'route' | 'warehouse' | 'offset';
  co2eSavingKg: number;
  costSar: number;
  paybackMonths: number;
  priority: AISeverity;
  description: string;
}

export function generateReductionActions(overview: FleetEmissionsOverview): CarbonReductionAction[] {
  const actions: CarbonReductionAction[] = [
    {
      id: 'act_1',
      title: 'Switch 30% of fleet to EVs',
      category: 'fleet',
      co2eSavingKg: Math.round(overview.scope1 * 0.3),
      costSar: 1_800_000,
      paybackMonths: 36,
      priority: 'high',
      description: 'Replace 4 ICE vans with EVs. Reduces Scope 1 by ~30% and aligns with Saudi Vision 2030.',
    },
    {
      id: 'act_2',
      title: 'Optimize Riyadh–Jeddah lane',
      category: 'route',
      co2eSavingKg: Math.round(overview.scope1 * 0.05),
      costSar: 12_000,
      paybackMonths: 2,
      priority: 'high',
      description: 'Backhaul optimization on the busiest long-haul lane. 5% fuel reduction.',
    },
    {
      id: 'act_3',
      title: 'Warehouse LED + solar retrofit',
      category: 'warehouse',
      co2eSavingKg: Math.round(overview.scope2 * 0.35),
      costSar: 350_000,
      paybackMonths: 18,
      priority: 'medium',
      description: 'LED lighting + 50kW rooftop solar on Riyadh warehouse. Reduces Scope 2 by 35%.',
    },
    {
      id: 'act_4',
      title: 'Retire 1,500 tCO2e mangrove credits',
      category: 'offset',
      co2eSavingKg: 1_500_000,
      costSar: 120_000,
      paybackMonths: 1,
      priority: 'medium',
      description: 'Voluntary offset via Saudi Mangrove Restoration. Quick win for ESG reporting.',
    },
    {
      id: 'act_5',
      title: 'Driver eco-training program',
      category: 'route',
      co2eSavingKg: Math.round(overview.scope1 * 0.04),
      costSar: 45_000,
      paybackMonths: 4,
      priority: 'low',
      description: 'Eco-driving training for 12 drivers. 4% fuel economy improvement on average.',
    },
  ];
  return actions;
}

export interface FleetEmissionsOverview {
  emissions: CarbonEmission[];
  scope1: number;
  scope2: number;
  scope3: number;
  laneIntensities: CarbonIntensityByLane[];
  offsets: CarbonOffset[];
  report: ESGReport;
  actions: CarbonReductionAction[];
}

export function generateCarbonOverview(
  vehicleCount: number,
  warehouseCount: number,
  revenue: number,
  shipments: number,
  seed: number = Date.now()
): FleetEmissionsOverview {
  const emissions = generateEmissionsLog(vehicleCount, warehouseCount, 30, seed);
  const laneIntensities = generateLaneIntensities(seed);
  const offsets = generateOffsetPortfolio(seed);
  const report = buildESGReport(emissions, offsets, revenue, shipments);
  const overview: FleetEmissionsOverview = {
    emissions,
    scope1: report.totalScope1,
    scope2: report.totalScope2,
    scope3: report.totalScope3,
    laneIntensities,
    offsets,
    report,
    actions: [],
  };
  overview.actions = generateReductionActions(overview);
  return overview;
}
