// VEGA Logistics OS — Rented Fleet Engine
// Rental van model: no purchase, no depreciation, no insurance
// Saudi Arabia: fuel 0.67/L, last-mile delivery, 22 working days

export interface ZoneData {
  name: string;
  deliveries: number;
  pricePerDelivery: number;
  active: boolean;
}

export interface DriverData {
  name: string;
  deliveriesPerDay: number;
  kmPerDay: number;
  fuelActual: number;
  attendance: number;
}

export interface RentedFleetInput {
  fleetSize: number;
  utilization: number;
  vanRentPerMonth: number;
  kmPerDay: number;
  fuelPriceLiter: number;
  fuelPer100km: number;
  oilPer5000km: number;
  tiresPerYear: number;
  otherMaintPerMonth: number;
  driverSalary: number;
  driverBenefits: number;
  warehouseRent: number;
  utilities: number;
  adminSalaries: number;
  software: number;
  comms: number;
  deliveriesPerVanPerDay: number;
  revenuePerDelivery: number;
  workingDays: number;
}

export interface RentedFleetOutput {
  activeVans: number;
  fuelPerVan: number;
  oilPerVan: number;
  tiresPerVan: number;
  driverTotal: number;
  varPerVan: number;
  totalVar: number;
  totalFixed: number;
  totalCost: number;
  delPerDay: number;
  delPerMonth: number;
  revenue: number;
  profit: number;
  margin: number;
  costPerDel: number;
  breakEvenDel: number;
  monthlyContribPerVan: number;
  setupCost: number;
  paybackMonths: number | string;
  ebitdaMargin: number;
  annualROI: number;
}

export interface MCResult {
  risk: string;
  p10: number;
  p50: number;
  p90: number;
  buckets: number[];
  min: number;
  max: number;
}

// Defaults
export const DEFAULT_RENTED: RentedFleetInput = {
  fleetSize: 5,
  utilization: 88,
  vanRentPerMonth: 1750,
  kmPerDay: 180,
  fuelPriceLiter: 0.67,
  fuelPer100km: 10,
  oilPer5000km: 150,
  tiresPerYear: 1200,
  otherMaintPerMonth: 200,
  driverSalary: 3200,
  driverBenefits: 12,
  warehouseRent: 8000,
  utilities: 1200,
  adminSalaries: 12000,
  software: 800,
  comms: 400,
  deliveriesPerVanPerDay: 35,
  revenuePerDelivery: 17,
  workingDays: 22,
};

export const DEFAULT_ZONES: ZoneData[] = [
  { name: "Zone A – Downtown", deliveries: 40, pricePerDelivery: 18, active: true },
  { name: "Zone B – Suburbs", deliveries: 30, pricePerDelivery: 16, active: true },
  { name: "Zone C – Industrial", deliveries: 25, pricePerDelivery: 15, active: false },
];

export const DEFAULT_DRIVERS: DriverData[] = [
  { name: "Driver 1", deliveriesPerDay: 38, kmPerDay: 160, fuelActual: 17, attendance: 96 },
  { name: "Driver 2", deliveriesPerDay: 32, kmPerDay: 195, fuelActual: 22, attendance: 91 },
  { name: "Driver 3", deliveriesPerDay: 41, kmPerDay: 155, fuelActual: 15, attendance: 98 },
];

export function calculateRentedFleet(input: RentedFleetInput): RentedFleetOutput {
  const activeVans = Math.round(input.fleetSize * input.utilization / 100);
  const monthlyKm = input.kmPerDay * input.workingDays;
  const fuelPerVan = (input.kmPerDay * input.fuelPriceLiter * input.fuelPer100km / 100) * input.workingDays;
  const oilPerVan = (monthlyKm / 5000) * input.oilPer5000km;
  const tiresPerVan = input.tiresPerYear / 12;
  const driverTotal = input.driverSalary * (1 + input.driverBenefits / 100);
  const varPerVan = input.vanRentPerMonth + fuelPerVan + oilPerVan + tiresPerVan + input.otherMaintPerMonth + driverTotal;
  const totalVar = varPerVan * activeVans;
  const totalFixed = input.warehouseRent + input.utilities + input.adminSalaries + input.software + input.comms;
  const totalCost = totalVar + totalFixed;
  const delPerDay = input.deliveriesPerVanPerDay * activeVans;
  const delPerMonth = delPerDay * input.workingDays;
  const revenue = delPerMonth * input.revenuePerDelivery;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const costPerDel = delPerMonth > 0 ? totalCost / delPerMonth : 0;
  const breakEvenDel = input.revenuePerDelivery > 0 ? totalCost / input.revenuePerDelivery / input.workingDays : 0;
  const monthlyContribPerVan = (input.deliveriesPerVanPerDay * input.revenuePerDelivery * input.workingDays) - varPerVan;
  const setupCost = (input.vanRentPerMonth * 2 * input.fleetSize) + (input.warehouseRent * 2);
  const paybackMonths = monthlyContribPerVan > 0 ? Math.ceil(setupCost / (monthlyContribPerVan * activeVans)) : "—";
  const ebitdaMargin = revenue > 0 ? ((profit + oilPerVan * activeVans + tiresPerVan * activeVans) / revenue) * 100 : 0;
  const annualROI = setupCost > 0 ? (profit * 12 / setupCost) * 100 : 0;
  return { activeVans, fuelPerVan, oilPerVan, tiresPerVan, driverTotal, varPerVan, totalVar, totalFixed, totalCost, delPerDay, delPerMonth, revenue, profit, margin, costPerDel, breakEvenDel, monthlyContribPerVan, setupCost, paybackMonths, ebitdaMargin, annualROI };
}

export function runRentedMC(input: RentedFleetInput, output: RentedFleetOutput, sims: number = 1000): MCResult {
  let losses = 0;
  const profits: number[] = [];
  for (let i = 0; i < sims; i++) {
    const dem = 0.85 + Math.random() * 0.3;
    const costV = 0.95 + Math.random() * 0.15;
    const fuel = 0.9 + Math.random() * 0.25;
    const simRev = output.delPerMonth * dem * input.revenuePerDelivery;
    const simCost = output.totalVar * costV * fuel + output.totalFixed;
    const p = simRev - simCost;
    profits.push(p);
    if (p < 0) losses++;
  }
  profits.sort((a,b) => a-b);
  const min = profits[0], max = profits[sims-1];
  const buckets = Array(20).fill(0);
  profits.forEach(p => {
    const idx = Math.min(19, Math.floor(((p-min)/(max-min+1))*20));
    buckets[idx]++;
  });
  return {
    risk: ((losses/sims)*100).toFixed(1),
    p10: profits[Math.floor(sims*0.1)],
    p50: profits[Math.floor(sims*0.5)],
    p90: profits[Math.floor(sims*0.9)],
    buckets, min, max
  };
}

export function driverScore(d: DriverData, targetDel: number, fuelTarget: number): number {
  const delScore = Math.min(100, (d.deliveriesPerDay/targetDel)*100) * 0.5;
  const fuelScore = Math.min(100, (fuelTarget/d.fuelActual)*100) * 0.25;
  const attScore = (d.attendance/100)*100 * 0.25;
  return Math.round(delScore + fuelScore + attScore);
}
