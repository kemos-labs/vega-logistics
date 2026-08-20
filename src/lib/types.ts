// VEGA Logistics OS — Core Types

export type Module =
  | 'command-center' | 'autoclaw' | 'ghost-growth' | 'fleet' | 'risk' | 'analytics' | 'feasibility'
  | 'ai-agents' | 'digital-twin' | 'carbon' | 'predictive-maintenance' | 'computer-vision' | 'rl-route'
  | 'live-map' | 'dispatch' | 'drivers' | 'maintenance' | 'fuel' | 'compliance' | 'delivery' | 'customer'
  | 'wms' | 'safety' | 'analytics50' | 'admin'
  | 'providers' | 'freelancers' | 'fleet-vehicles';

export type GhostGrowthLevel = 'Safe' | 'Warning' | 'Critical' | 'Collapse';

export interface KPIData {
  id: string;
  label: string;
  value: number;
  format: 'number' | 'currency' | 'percentage' | 'time' | 'ratio';
  prefix?: string;
  suffix?: string;
  trend: number; // % change from previous period
  trendDirection: 'up' | 'down';
  isGood: boolean; // is the trend direction positive?
  sparkline: number[];
  description: string;
}

// ─── Vehicle class (editable fleet composition) ───────────────────────────
export type FuelType = 'petrol' | 'diesel' | 'electric' | 'hybrid';

export interface VehicleClass {
  id: string;
  name: string;          // e.g. "Van", "Pickup Truck"
  quantity: number;      // count of vehicles in this class
  monthlyRent: number;   // SAR / vehicle / month (0 if owned)
  variableCost: number;  // SAR / vehicle / month (legacy shared vehicle overhead split between insurance and maintenance)
  enabled: boolean;      // include in fleet totals
  driverSalary: number;  // SAR / month per driver assigned to this class
  fuelType: FuelType;    // fuel type for this class
  fuelEfficiency: number; // L/100km (or kWh/100km for electric)
  avgDailyDistance: number; // km per day per vehicle
  purchasePrice: number; // SAR purchase price (0 = rented)
  depreciationMonths: number; // months over which to depreciate (0 = no depreciation)
}

// ─── Shipment provider (editable list) ────────────────────────────────────
export interface Provider {
  id: string;
  name: string;          // e.g. "Provider 1", "Aramex"
  shipmentsPerDay: number;
  pricePerShipment: number; // SAR
  enabled: boolean;
}

// ─── Maintenance entry (editable, anchored to vehicle class) ──────────────
export type MaintenanceType = 'routine' | 'repair' | 'tyre';

export interface MaintenanceEntry {
  id: string;
  vehicleClassId: string; // reference to VehicleClass.id
  type: MaintenanceType;
  costPerEvent: number;   // SAR
  frequency: number;      // events per vehicle per month
  enabled: boolean;
}

// ─── Driver record (editable, synced to fleet utilization) ────────────────
export type DriverStatus = 'active' | 'inactive';

export interface DriverRecord {
  id: string;
  fullName: string;
  phone: string;
  nationalId: string;
  assignedVehicle: string;  // vehicle class name or plate
  status: DriverStatus;
}

// ─── Cost line enable toggle ──────────────────────────────────────────────
export type CostLineKey =
  | 'lease'
  | 'vehicleInsurance'
  | 'maintenance'
  | 'tolls'
  | 'fines'
  | 'financing'
  | 'fuel'
  | 'telematics'
  | 'dashcam'
  | 'fuelCard'
  | 'driverSalary'
  | 'opsTeam'
  | 'salesTeam'
  | 'salesCommission'
  | 'warehouseStaff'
  | 'healthInsurance'
  | 'warehouseRent'
  | 'warehouseUtils'
  | 'officeRent'
  | 'internet'
  | 'electricity'
  | 'marketing'
  | 'accountingLegal'
  | 'technologySaaS'
  | 'cargoInsurance'
  | 'liabilityInsurance'
  | 'misc'
  | 'packaging'
  | 'pickPack'
  | 'labelsAndDocs'
  | 'returnLogistics'
  | 'failedDeliveries'
  | 'returns'
  | 'freelancer'
  | 'fulfillment'
  | 'subcontracting';

// ─── Provider evaluation rating ───────────────────────────────────────────
export type ProviderRating = 'good' | 'average' | 'bad';

// ─── Main financial input (single source of truth) ────────────────────────
export interface FinancialInput {
  // Vehicle composition (drives fleet cost)
  vehicleClasses: VehicleClass[];

  // Shipment providers (drives volume + revenue)
  providers: Provider[];

  // Maintenance (anchored to vehicle classes)
  maintenance: MaintenanceEntry[];

  // Freelancer model — Provider gives us a shipment at price X, we pay (X - 0.50) to the freelancer
  freelancerProviderPrice: number; // SAR we receive from the shipment provider per shipment
  freelancerRate: number;         // SAR we pay the freelancer per shipment (must be < provider price)
  freelancerMonthlyVolume?: number; // optional explicit monthly volume; defaults to enabled provider volume

  // Driver records (editable; count derives to company-driver count)
  drivers: DriverRecord[];
  companyDriverCount: number;  // editable count of company drivers (syncs with drivers.length)

  // Driver & staff costs
  driverSalary: number;        // monthly per company driver
  opsTeamCount: number;
  opsTeamAvgSalary: number;    // monthly SAR
  salesTeamCount: number;
  salesTeamBaseSalary: number; // monthly SAR
  salesCommissionPercent: number; // %

  // Warehouse
  warehouseRent: number;       // monthly
  warehouseUtilities: number;  // monthly
  warehouseStaff: number;
  warehouseStaffSalary: number;

  // Office & utilities
  internetCost: number;
  electricityCost: number;
  officeRent: number;
  marketingBudget: number;
  accountingLegal: number;

  // Per-unit variable (still per-shipment, but flaggable)
  packagingCostPerUnit: number;
  pickPackLaborPerOrder: number;
  labelsAndDocs: number;
  returnLogisticsCost: number;

  // Tech & SaaS
  technologySaaS: number;
  gpsTelematics: number;      // per-vehicle monthly SAR (applies to total fleet)
  dashcamSubscription: number;
  fuelCardFee: number;

  // Fuel inputs (fleet-wide since fleet is rented we use average)
  fuelPricePerLiter: number;
  fuelEfficiencyL100km: number;
  avgDistancePerVehiclePerDay: number;

  // Operational metrics (drive per-shipment failure / return costs)
  failedDeliveryRate: number; // %
  failedDeliveryCost?: number; // SAR per failed attempt; defaults to returnLogisticsCost
  returnRate: number;         // %
  clientPaymentDelay: number; // days

  // Insurance
  cargoInsurance: number;
  liabilityInsurance: number;
  healthInsurancePerEmployee: number;

  // Other
  miscExpenses: number;
  fulfillmentRevenue: number;
  subcontractingRevenue: number;

  // Per-line cost enable flags
  costToggles: Partial<Record<CostLineKey, boolean>>;

  // Global per-unit display toggle (toggles all metrics between /month and /shipment)
  perUnitView: boolean;
}

// 6-rolled-up cost categories — keeps the breakdown readable
export type CostCategoryKey =
  | 'vehicleOwnership'   // lease, depreciation for owned assets, vehicle financing
  | 'vehicleRunning'     // fuel, insurance, maintenance, tolls, fines, telematics, dashcam, fuel card
  | 'people'             // driver salaries, ops, sales, warehouse staff, health insurance
  | 'facilities'         // warehouse rent+utilities, office rent, internet, electricity
  | 'perShipment'        // packaging, pick-pack, labels, return logistics, failed deliveries, returns
  | 'other';             // marketing, accounting/legal, cargo insurance, liability, tech SaaS, misc

export interface CostBreakdown {
  vehicleOwnership: number;
  vehicleRunning: number;
  people: number;
  facilities: number;
  perShipment: number;
  other: number;
  costPerShipment: number;
  total: number;
}

export interface RevenueBreakdown {
  providerRevenue: number;   // sum from providers
  fulfillment: number;
  subcontracting: number;
  total: number;
}

export interface FinancialOutput {
  totalRevenue: number;
  totalCost: number;
  netMargin: number;
  netMarginPercent: number;
  costPerShipment: number;
  burnRate: number;
  cashRunway: number;
  operationalBreakeven: number;

  // Aggregated shipment volume (sum of providers)
  totalDailyShipments: number;
  totalMonthlyShipments: number;
  avgRevenuePerShipment: number; // weighted

  // Per-provider evaluation
  providerEvaluations: ProviderEvaluation[];

  // Per-driver / fleet utilization
  companyDriverCount: number;
  activeDriverCount: number;
  fleetUtilization: number;
  fleetMonthlyCost: number;
  fuelMonthlyCost: number;
  maintenanceMonthlyCost: number;

  // Freelancer P&L (separate from fleet)
  freelancerMonthlyVolume: number;
  freelancerMonthlyRevenue: number;
  freelancerMonthlyPayout: number;
  freelancerMonthlyProfit: number;

  costBreakdown: CostBreakdown;
  revenueBreakdown: RevenueBreakdown;
}

export interface ProviderEvaluation {
  id: string;
  name: string;
  shipmentsPerDay: number;
  pricePerShipment: number;
  volumeShare: number;        // 0-1
  priceVsAverage: number;     // ratio vs weighted avg (1.0 = average)
  rating: ProviderRating;
  enabled: boolean;
  monthlyRevenue: number;
}

export interface GhostGrowthMetrics {
  revenueGrowth: number;
  marginDecay: number;
  fleetGrowthRate: number;
  shipmentDensity: number;
  fuelCostGrowth: number;
  failedDeliveryGrowth: number;
}

export interface GhostGrowthResult {
  index: number;
  level: GhostGrowthLevel;
  metrics: GhostGrowthMetrics;
  explanation: string;
  recommendations: string[];
  history: { date: string; index: number }[];
}

export interface VehicleLocation {
  id: string;
  driverName: string;
  plate: string;
  lat: number;
  lng: number;
  status: 'active' | 'idle' | 'maintenance' | 'returning';
  speed: number;
  heading: number;
  deliveriesCompleted: number;
  deliveriesTotal: number;
  eta: string;
  fuelLevel: number;
  zone: string;
  profitability: number;
}

export interface ZoneDensity {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  shipmentCount: number;
  density: 'high' | 'medium' | 'low' | 'dead';
  avgRevenue: number;
  failedRate: number;
}

export interface SimulationConfig {
  updateInterval: number;
  volatility: number;
  trend: 'stable' | 'growing' | 'declining' | 'volatile';
}
