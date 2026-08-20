// VEGA Logistics OS — Mock Data Generator
// Uses caching to prevent data from jumping on every render cycle

import {
  KPIData,
  FinancialInput,
  VehicleLocation,
  ZoneDensity,
  DriverRecord,
  VehicleClass,
  Provider,
  MaintenanceEntry,
} from './types';
import { calculateFinancials } from './calculations';

// ─── Default Vehicle Classes (editable fleet composition) ─────────────
const defaultVehicleClasses: VehicleClass[] = [
  { id: 'vc-car', name: 'Car', quantity: 4, monthlyRent: 0, variableCost: 0, enabled: true, driverSalary: 2500, fuelType: 'petrol', fuelEfficiency: 9.5, avgDailyDistance: 180, purchasePrice: 0, depreciationMonths: 0 },
];

// ─── Default Shipment Providers ────────────────────────────────────────
const defaultProviders: Provider[] = [
  { id: 'customer-1', name: 'Customer 1', shipmentsPerDay: 200, pricePerShipment: 10, enabled: true },
];

// ─── Default Maintenance Entries (anchored to vehicle classes) ─────────
const defaultMaintenance: MaintenanceEntry[] = [];

// ─── Default Driver Records ────────────────────────────────────────────
const defaultDrivers: DriverRecord[] = [
  { id: 'drv-1', fullName: 'Driver 1', phone: '', nationalId: '', assignedVehicle: 'Car', status: 'active' },
  { id: 'drv-2', fullName: 'Driver 2', phone: '', nationalId: '', assignedVehicle: 'Car', status: 'active' },
  { id: 'drv-3', fullName: 'Driver 3', phone: '', nationalId: '', assignedVehicle: 'Car', status: 'active' },
  { id: 'drv-4', fullName: 'Driver 4', phone: '', nationalId: '', assignedVehicle: 'Car', status: 'active' },
];

// ─── Default Financial Inputs ──────────────────────────────────────────
export const defaultFinancialInput: FinancialInput = {
  vehicleClasses: defaultVehicleClasses,
  providers: defaultProviders,
  maintenance: defaultMaintenance,
  drivers: defaultDrivers,
  companyDriverCount: 4,

  // Freelancer model
  freelancerProviderPrice: 10,  // we receive SAR 10 from the provider
  freelancerRate: 9.5,         // we pay the freelancer SAR 9.50 (we keep 0.50)

  // Driver & staff
  driverSalary: 2500,
  opsTeamCount: 1,
  opsTeamAvgSalary: 5000,
  salesTeamCount: 2,
  salesTeamBaseSalary: 2500,
  salesCommissionPercent: 0,

  // Warehouse
  warehouseRent: 3800,
  warehouseUtilities: 0,
  warehouseStaff: 0,
  warehouseStaffSalary: 0,

  // Office
  internetCost: 1200,
  electricityCost: 2500,
  officeRent: 0,
  marketingBudget: 0,
  accountingLegal: 0,

  // Per-unit
  packagingCostPerUnit: 0,
  pickPackLaborPerOrder: 0,
  labelsAndDocs: 0,
  returnLogisticsCost: 0,

  // Tech
  technologySaaS: 0,
  gpsTelematics: 0,
  dashcamSubscription: 0,
  fuelCardFee: 0,

  // Fuel
  fuelPricePerLiter: 2.13,
  fuelEfficiencyL100km: 9.5,
  avgDistancePerVehiclePerDay: 180,

  // Operational metrics
  failedDeliveryRate: 5.5,
  failedDeliveryCost: 0,
  returnRate: 2.8,
  clientPaymentDelay: 1,

  // Insurance
  cargoInsurance: 0,
  liabilityInsurance: 0,
  healthInsurancePerEmployee: 0,

  // Other
  miscExpenses: 0,
  fulfillmentRevenue: 18000,
  subcontractingRevenue: 8000,

  // Toggles — explicit "off" for fulfillment/subcontracting so users opt in
  costToggles: {
    fulfillment: false,
    subcontracting: false,
    freelancer: false,
  },

  perUnitView: false,
};

// ─── Ghost Growth Metrics ───
export const defaultGhostMetrics = {
  revenueGrowth: 8.5,
  marginDecay: -3.2,
  fleetGrowthRate: 12.5,
  shipmentDensity: 8.7,
  fuelCostGrowth: 4.8,
  failedDeliveryGrowth: 7.2,
};

// ─── Stable Random Generator ───
let _callCounter = 0;

function seededRandom(): number {
  _callCounter++;
  const x = Math.sin(_callCounter * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function stableRandom(min: number, max: number): number {
  return min + seededRandom() * (max - min);
}

// ─── Cached Data ───
let _vehicleCache: VehicleLocation[] | null = null;
let _zoneCache: ZoneDensity[] | null = null;

const riyadhZones = [
  { name: 'Al Olaya', lat: 24.6937, lng: 46.6700 },
  { name: 'Al Malaz', lat: 24.6728, lng: 46.7416 },
  { name: 'Al Murabba', lat: 24.6549, lng: 46.7102 },
  { name: 'Al Sulimaniyah', lat: 24.6998, lng: 46.6978 },
  { name: 'Al Naseem', lat: 24.6250, lng: 46.7794 },
  { name: 'King Fahd', lat: 24.6870, lng: 46.6386 },
  { name: 'Al Hamra', lat: 24.7492, lng: 46.7217 },
  { name: 'Al Yasmin', lat: 24.8049, lng: 46.6648 },
  { name: 'Al Nakheel', lat: 24.7414, lng: 46.6540 },
  { name: 'Al Rabwa', lat: 24.6907, lng: 46.7788 },
];

const driverNames = [
  'Ahmed Al-Rashid', 'Mohammed Al-Otaibi', 'Khalid Al-Qahtani', 'Faisal Al-Harbi',
  'Sultan Al-Shammari', 'Abdullah Al-Ghamdi', 'Nasser Al-Dosari', 'Omar Al-Mutairi',
  'Yousef Al-Shehri', 'Bandar Al-Anazi', 'Turki Al-Subaie', 'Saad Al-Zahrani',
];

// ─── KPI Data ───
export function getKPIData(input?: FinancialInput): KPIData[] {
  const fin = input || defaultFinancialInput;
  const result = calculateFinancials(fin);

  return [
    {
      id: 'shipments',
      label: 'Daily Shipments',
      value: result.totalDailyShipments,
      format: 'number',
      trend: 4.2,
      trendDirection: 'up',
      isGood: true,
      sparkline: generateStableSparkline(310, 340, 12),
      description: 'Total shipments processed today (from all providers)',
    },
    {
      id: 'cost_per_shipment',
      label: 'Cost / Shipment',
      value: result.costPerShipment,
      format: 'currency',
      prefix: 'SAR',
      trend: 1.8,
      trendDirection: 'up',
      isGood: false,
      sparkline: generateStableSparkline(result.costPerShipment - 0.5, result.costPerShipment + 0.5, 12),
      description: 'Average cost per completed shipment',
    },
    {
      id: 'net_margin',
      label: 'Net Margin',
      value: result.netMarginPercent,
      format: 'percentage',
      suffix: '%',
      trend: 2.3,
      trendDirection: 'down',
      isGood: false,
      sparkline: generateStableSparkline(19, 25, 12),
      description: 'Net profit margin after all costs',
    },
    {
      id: 'liquidity_runway',
      label: 'Liquidity Runway',
      value: result.cashRunway,
      format: 'time',
      suffix: 'mo',
      trend: 0.5,
      trendDirection: 'up',
      isGood: true,
      sparkline: generateStableSparkline(result.cashRunway - 2, result.cashRunway + 1, 12),
      description: 'Months of runway at current burn rate',
    },
    {
      id: 'fleet_utilization',
      label: 'Fleet Utilization',
      value: result.fleetUtilization,
      format: 'percentage',
      suffix: '%',
      trend: 3.1,
      trendDirection: 'down',
      isGood: false,
      sparkline: generateStableSparkline(65, 80, 12),
      description: 'Active vehicle utilization rate',
    },
    {
      id: 'return_rate',
      label: 'Return Rate',
      value: 2.8,
      format: 'percentage',
      suffix: '%',
      trend: 0.4,
      trendDirection: 'down',
      isGood: true,
      sparkline: generateStableSparkline(2.5, 4.0, 12),
      description: 'Shipment return rate',
    },
    {
      id: 'sla',
      label: 'SLA Success',
      value: 94.2,
      format: 'percentage',
      suffix: '%',
      trend: 1.1,
      trendDirection: 'up',
      isGood: true,
      sparkline: generateStableSparkline(91, 96, 12),
      description: 'On-time delivery success rate',
    },
    {
      id: 'per_vehicle_profit',
      label: 'Per Vehicle Profit',
      value: result.netMargin / Math.max(1, fin.vehicleClasses.reduce((s, c) => s + c.quantity, 0)),
      format: 'currency',
      prefix: 'SAR',
      trend: -2.3,
      trendDirection: 'down',
      isGood: true,
      sparkline: generateStableSparkline(result.costPerShipment - 1.5, result.costPerShipment + 2, 12),
      description: 'Monthly net profit allocated per vehicle',
    },
  ];
}

// ─── Vehicle Data (cached) ───
export function getVehicles(): VehicleLocation[] {
  if (_vehicleCache) return _vehicleCache;
  _callCounter = 0;

  _vehicleCache = Array.from({ length: 12 }, (_, i) => {
    const zone = riyadhZones[i % riyadhZones.length];
    const isActive = stableRandom(0, 1) > 0.15;

    return {
      id: `VEGA-${String(i + 1).padStart(3, '0')}`,
      driverName: driverNames[i],
      plate: `${Math.floor(stableRandom(1000, 9999))} RYD`,
      lat: zone.lat + (stableRandom(0, 1) - 0.5) * 0.02,
      lng: zone.lng + (stableRandom(0, 1) - 0.5) * 0.02,
      status: isActive ? 'active' : stableRandom(0, 1) > 0.5 ? 'idle' : 'returning',
      speed: isActive ? Math.floor(stableRandom(10, 70)) : 0,
      heading: Math.floor(stableRandom(0, 360)),
      deliveriesCompleted: Math.floor(stableRandom(5, 30)),
      deliveriesTotal: Math.floor(stableRandom(25, 35)),
      eta: `${Math.floor(stableRandom(1, 5))}h ${Math.floor(stableRandom(0, 60))}m`,
      fuelLevel: Math.floor(stableRandom(30, 90)),
      zone: zone.name,
      profitability: Math.floor(stableRandom(2000, 7000)),
    };
  });

  return _vehicleCache;
}

// ─── Zone Density Data (cached) ───
export function getZoneDensity(): ZoneDensity[] {
  if (_zoneCache) return _zoneCache;

  _zoneCache = riyadhZones.map((z, i) => {
    const shipments = Math.floor(stableRandom(10, 60));
    let density: ZoneDensity['density'];
    if (shipments > 40) density = 'high';
    else if (shipments > 25) density = 'medium';
    else if (shipments > 10) density = 'low';
    else density = 'dead';

    return {
      id: `zone-${i}`,
      name: z.name,
      lat: z.lat,
      lng: z.lng,
      radius: 1500,
      shipmentCount: shipments,
      density,
      avgRevenue: Math.floor(stableRandom(800, 2800)),
      failedRate: Math.floor(stableRandom(1, 11)),
    };
  });

  return _zoneCache;
}

// ─── Helpers ───
function generateStableSparkline(min: number, max: number, points: number): number[] {
  const values: number[] = [];
  let current = (min + max) / 2;
  for (let i = 0; i < points; i++) {
    current += (stableRandom(0, 1) - 0.48) * (max - min) * 0.3;
    current = Math.max(min, Math.min(max, current));
    values.push(Math.round(current * 100) / 100);
  }
  return values;
}
