// VEGA Logistics OS — KPI Engine (50-vehicle fleet)

import { FleetSnapshot } from './mockData50';

export interface FleetKPIs {
  // Operations
  fleetSize: number;
  vehiclesActive: number;
  vehiclesIdle: number;
  vehiclesOffline: number;
  vehiclesInMaintenance: number;
  fleetUtilization: number; // %
  avgSpeedKmh: number;

  // Drivers
  driversTotal: number;
  driversOnRoute: number;
  driversAvailable: number;
  avgSafetyScore: number;
  avgOnTimeRate: number;

  // Jobs
  jobsActive: number;
  jobsDeliveredToday: number;
  jobsFailed: number;
  onTimeDeliveryRate: number; // %
  firstAttemptRate: number; // %

  // Safety
  safetyEvents7d: number;
  criticalSafetyEvents: number;

  // Maintenance
  openWorkOrders: number;
  overdueMaintenance: number;
  fleetMTTR: number; // hours
  fleetMTBF: number; // days

  // Fuel
  fuelCostMonth: number;
  avgConsumptionL100km: number;
  fuelAnomalies: number;

  // Compliance
  expiredDocuments: number;
  expiringSoonDocuments: number;

  // Customer
  activeCustomers: number;
  customerSatisfaction: number; // 0-5
  openAlerts: number;
  criticalAlerts: number;
}

export function calculateFleetKPIs(s: FleetSnapshot): FleetKPIs {
  const moving = s.vehicles.filter((v) => v.status === 'moving').length;
  const idle = s.vehicles.filter((v) => v.status === 'idle' || v.status === 'stopped').length;
  const offline = s.vehicles.filter((v) => v.status === 'offline').length;
  const inMaint = s.vehicles.filter((v) => v.status === 'in_maintenance').length;
  const active = moving + idle;

  const driversOnRoute = s.drivers.filter((d) => d.status === 'on_route').length;
  const driversAvailable = s.drivers.filter((d) => d.status === 'available').length;
  const avgSafety = s.drivers.length ? s.drivers.reduce((sum, d) => sum + d.safetyScore, 0) / s.drivers.length : 0;
  const avgOTR = s.drivers.length ? s.drivers.reduce((sum, d) => sum + d.onTimeRate, 0) / s.drivers.length : 0;

  const jobsActive = s.jobs.filter((j) => ['assigned', 'en_route', 'arrived', 'planned'].includes(j.status)).length;
  const jobsDelivered = s.jobs.filter((j) => j.status === 'delivered').length;
  const jobsFailed = s.jobs.filter((j) => j.status === 'failed').length;
  const closed = jobsDelivered + jobsFailed;
  const onTimeRate = closed > 0 ? jobsDelivered / closed : 1;
  const firstAttempt = jobsDelivered > 0 ? jobsDelivered / closed : 0;

  const safety7d = s.safetyEvents.length;
  const criticalSafety = s.safetyEvents.filter((e) => e.severity === 'critical').length;

  const openWO = s.workOrders.filter((w) => ['open', 'scheduled', 'in_progress', 'awaiting_parts'].includes(w.status)).length;
  const overdueWO = s.workOrders.filter((w) => w.scheduledFor && Date.parse(w.scheduledFor) < Date.now() && w.status !== 'completed').length;
  const closedWO = s.workOrders.filter((w) => w.status === 'completed');
  const mttr = closedWO.length ? closedWO.reduce((sum, w) => sum + w.laborHours, 0) / closedWO.length : 0;
  const mtbf = s.vehicles.length ? 30 / Math.max(1, closedWO.length / s.vehicles.length) : 0;

  const fuelCost = s.fuelEvents.reduce((sum, f) => sum + f.costSar, 0);
  const avgCons = s.fuelEvents.length ? s.fuelEvents.reduce((sum, f) => sum + f.consumptionLPer100km, 0) / s.fuelEvents.length : 0;
  const anomalies = s.fuelEvents.filter((f) => f.isAnomaly).length;

  const expiredDocs = s.complianceDocuments.filter((c) => c.status === 'expired').length;
  const expiringDocs = s.complianceDocuments.filter((c) => c.status === 'expiring_soon').length;

  const avgSat = s.customers.length ? s.customers.reduce((sum, c) => sum + c.satisfactionScore, 0) / s.customers.length : 0;
  const openAlerts = s.alerts.filter((a) => a.status === 'open').length;
  const criticalAlerts = s.alerts.filter((a) => a.severity === 'critical' && a.status !== 'resolved').length;

  return {
    fleetSize: s.vehicles.length,
    vehiclesActive: active,
    vehiclesIdle: idle,
    vehiclesOffline: offline,
    vehiclesInMaintenance: inMaint,
    fleetUtilization: s.vehicles.length ? (active / s.vehicles.length) * 100 : 0,
    avgSpeedKmh: moving ? s.vehicles.filter((v) => v.status === 'moving').reduce((sum, v) => sum + v.speedKmh, 0) / moving : 0,
    driversTotal: s.drivers.length,
    driversOnRoute,
    driversAvailable,
    avgSafetyScore: Math.round(avgSafety),
    avgOnTimeRate: Math.round(avgOTR * 1000) / 1000,
    jobsActive,
    jobsDeliveredToday: jobsDelivered,
    jobsFailed,
    onTimeDeliveryRate: Math.round(onTimeRate * 1000) / 10,
    firstAttemptRate: Math.round(firstAttempt * 1000) / 10,
    safetyEvents7d: safety7d,
    criticalSafetyEvents: criticalSafety,
    openWorkOrders: openWO,
    overdueMaintenance: overdueWO,
    fleetMTTR: Math.round(mttr * 10) / 10,
    fleetMTBF: Math.round(mtbf * 10) / 10,
    fuelCostMonth: Math.round(fuelCost),
    avgConsumptionL100km: Math.round(avgCons * 10) / 10,
    fuelAnomalies: anomalies,
    expiredDocuments: expiredDocs,
    expiringSoonDocuments: expiringDocs,
    activeCustomers: s.customers.filter((c) => c.status === 'active').length,
    customerSatisfaction: Math.round(avgSat * 10) / 10,
    openAlerts,
    criticalAlerts,
  };
}

// Trend series for charts
export function generateKPITrends(s: FleetSnapshot, days: number = 14) {
  const r = (() => { let x = 1; return () => (x = (x * 9301 + 49297) % 233280) / 233280; })();
  return {
    onTimeRate: Array.from({ length: days }, (_, i) => Math.round((85 + r() * 12 - i * 0.1) * 10) / 10),
    fleetUtil: Array.from({ length: days }, (_, i) => Math.round((72 + r() * 8 - i * 0.2) * 10) / 10),
    safetyScore: Array.from({ length: days }, (_, i) => Math.round((82 + r() * 5 + i * 0.1) * 10) / 10),
    fuelEff: Array.from({ length: days }, (_, i) => Math.round((9.5 + r() * 1 - i * 0.02) * 10) / 10),
    costPerKm: Array.from({ length: days }, (_, i) => Math.round((1.85 + r() * 0.3 - i * 0.005) * 100) / 100),
    deliveries: Array.from({ length: days }, (_, i) => Math.floor(120 + r() * 30 + i * 0.5)),
  };
}

export interface DriverLeaderboardEntry {
  driverId: string;
  name: string;
  safetyScore: number;
  onTimeRate: number;
  fuelEfficiency: number;
  totalKm: number;
  totalHours: number;
  trips: number;
  rating: number;
  compositeScore: number;
}

export function getDriverLeaderboard(s: FleetSnapshot, limit: number = 10): DriverLeaderboardEntry[] {
  return s.drivers
    .map((d) => ({
      driverId: d.id,
      name: d.fullName,
      safetyScore: d.safetyScore,
      onTimeRate: Math.round(d.onTimeRate * 1000) / 10,
      fuelEfficiency: d.fuelEfficiencyScore,
      totalKm: d.totalKmThisMonth,
      totalHours: d.totalHoursThisMonth,
      trips: d.totalTrips,
      rating: d.rating,
      compositeScore: Math.round((d.safetyScore * 0.35 + d.onTimeRate * 100 * 0.25 + d.fuelEfficiencyScore * 0.25 + d.rating * 20 * 0.15) * 10) / 10,
    }))
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, limit);
}

export interface VehicleHealthEntry {
  vehicleId: string;
  plate: string;
  health: 'healthy' | 'attention' | 'critical';
  score: number;
  openWorkOrders: number;
  overdue: number;
  nextServiceKm: number;
  fuelLevel: number;
  lastPingMin: number;
}

export function getVehicleHealthGrid(s: FleetSnapshot): VehicleHealthEntry[] {
  return s.vehicles.map((v) => {
    const wo = s.workOrders.filter((w) => w.vehicleId === v.id && ['open', 'scheduled', 'in_progress'].includes(w.status));
    const overdue = wo.filter((w) => w.scheduledFor && Date.parse(w.scheduledFor) < Date.now()).length;
    const nextServiceRule = s.maintenanceRules.find((r) => r.id === `MR-${v.id}-OIL`);
    const nextServiceKm = nextServiceRule ? nextServiceRule.nextDueMileageKm - v.odometerKm : 10000;
    const score = Math.max(0, 100 - wo.length * 15 - overdue * 25 - (nextServiceKm < 0 ? 30 : 0) - (v.status === 'offline' ? 20 : 0));
    const health: VehicleHealthEntry['health'] = score > 75 ? 'healthy' : score > 45 ? 'attention' : 'critical';
    return {
      vehicleId: v.id,
      plate: v.plate,
      health,
      score,
      openWorkOrders: wo.length,
      overdue,
      nextServiceKm,
      fuelLevel: v.fuelLevelPct,
      lastPingMin: Math.round((Date.now() - Date.parse(v.lastPingAt)) / 60000),
    };
  });
}
