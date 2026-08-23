// VEGA Logistics OS — 50-Vehicle Fleet Mock Data Generator
// Deterministic, seeded. Produces a realistic snapshot of a Saudi logistics carrier.

import {
  Vehicle, Driver, Job, Stop, Geofence, Trip, SafetyEvent,
  WorkOrder, FuelEvent, Customer, Shipment, InventoryItem, Warehouse,
  PickList, LoadPlan, ComplianceDocument, AuditEvent, Alert,
  HOSLog, DVIRReport, POD, DeliveryException, CoachingSession,
  DriverSafetyScorecard, FuelCard, Part, CustomerNotification,
  MaintenanceRule, Route, GeofenceEvent,
  VehicleType, VehicleStatus, JobStatus, SafetyEventType,

} from '../types2026';

// ── Utilities ──

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function pick<T>(arr: T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)];
}

function pickN<T>(arr: T[], n: number, r: () => number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(r() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

const SAUDI_FIRST_NAMES = [
  'Ahmed', 'Mohammed', 'Khalid', 'Faisal', 'Sultan', 'Abdullah', 'Nasser', 'Omar',
  'Yousef', 'Bandar', 'Turki', 'Saad', 'Hassan', 'Majed', 'Waleed', 'Rayan',
  'Salman', 'Ibrahim', 'Fahad', 'Nawaf', 'Saeed', 'Mishal', 'Talal', 'Mansour',
  'Hamad', 'Thamer', 'Badr', 'Fares', 'Mutlaq', 'Naif', 'Suhail', 'Ziyad',
];
const SAUDI_LAST_NAMES = [
  'Al-Rashid', 'Al-Otaibi', 'Al-Qahtani', 'Al-Harbi', 'Al-Shammari', 'Al-Ghamdi',
  'Al-Dosari', 'Al-Mutairi', 'Al-Shehri', 'Al-Anazi', 'Al-Subaie', 'Al-Zahrani',
  'Al-Qarni', 'Al-Balawi', 'Al-Johani', 'Al-Hajri', 'Al-Dawsari', 'Al-Ahmadi',
  'Al-Malki', 'Al-Omari', 'Al-Asmari', 'Al-Utaybi', 'Al-Sharif', 'Al-Khalifah',
];

const RIYADH_DEPOTS = [
  { id: 'DEPOT-RYD-01', name: 'Riyadh Central Depot', lat: 24.7136, lng: 46.6753 },
  { id: 'DEPOT-RYD-02', name: 'Riyadh South Hub', lat: 24.5800, lng: 46.7700 },
  { id: 'DEPOT-JED-01', name: 'Jeddah Coastal Depot', lat: 21.4858, lng: 39.1925 },
  { id: 'DEPOT-DMM-01', name: 'Dammam Eastern Depot', lat: 26.4207, lng: 50.0888 },
];

const RIYADH_ZONES = [
  'Al Olaya', 'Al Malaz', 'Al Murabba', 'Al Sulimaniyah', 'Al Naseem',
  'King Fahd', 'Al Hamra', 'Al Yasmin', 'Al Nakheel', 'Al Rabwa',
  'Diplomatic Quarter', 'Al Wurud', 'Hittin', 'Al Qirawan', 'Al Arid',
];

const VEHICLE_MAKES = [
  { make: 'Toyota', models: ['Hiace', 'Hilux', 'Coaster'] },
  { make: 'Hyundai', models: ['H100', 'H350', 'County'] },
  { make: 'Mercedes', models: ['Sprinter', 'Atego', 'Actros'] },
  { make: 'Isuzu', models: ['D-Max', 'NPR', 'NQR'] },
  { make: 'Ford', models: ['Transit', 'F-150', 'Cargo'] },
  { make: 'MAN', models: ['TGE', 'TGL', 'TGS'] },
];

const FUEL_BRANDS = ['Al-Drees', 'Naft', 'Sahel', 'Taziz', 'Aldrees Plus'];

const CATEGORIES = ['Electronics', 'Apparel', 'F&B', 'Pharma', 'Auto Parts', 'Furniture', 'Documents', 'Industrial'];

// ── Seed-based generator ──

export interface FleetSnapshot {
  vehicles: Vehicle[];
  drivers: Driver[];
  jobs: Job[];
  stops: Stop[];
  routes: Route[];
  geofences: Geofence[];
  geofenceEvents: GeofenceEvent[];
  trips: Trip[];
  safetyEvents: SafetyEvent[];
  workOrders: WorkOrder[];
  maintenanceRules: MaintenanceRule[];
  parts: Part[];
  fuelEvents: FuelEvent[];
  fuelCards: FuelCard[];
  customers: Customer[];
  shipments: Shipment[];
  warehouses: Warehouse[];
  inventory: InventoryItem[];
  pickLists: PickList[];
  loadPlans: LoadPlan[];
  complianceDocuments: ComplianceDocument[];
  auditEvents: AuditEvent[];
  alerts: Alert[];
  hosLogs: HOSLog[];
  dvirReports: DVIRReport[];
  pods: POD[];
  deliveryExceptions: DeliveryException[];
  coachingSessions: CoachingSession[];
  scorecards: DriverSafetyScorecard[];
  customerNotifications: CustomerNotification[];
}

export function generateFleetSnapshot(seed: number = 42): FleetSnapshot {
  const r = rng(seed);

  // ── Geofences (10) ──
  const depots: Geofence[] = RIYADH_DEPOTS.map((d) => ({
    id: `GF-DEPOT-${d.id.slice(-3)}`,
    name: d.name,
    type: 'depot' as const,
    polygon: [],
    center: { lat: d.lat, lng: d.lng },
    radiusM: 500,
    alertOnEntry: false,
    alertOnExit: true,
    alertOnDwell: false,
    dwellThresholdS: 600,
  }));
  const serviceZones: Geofence[] = Array.from({ length: 6 }, (_, i) => ({
    id: `GF-CUST-${String(i + 1).padStart(2, '0')}`,
    name: `${RIYADH_ZONES[i]} Service Zone`,
    type: 'service_zone' as const,
    polygon: [],
    center: { lat: 24.7136 + (r() - 0.5) * 0.2, lng: 46.6753 + (r() - 0.5) * 0.2 },
    radiusM: 1500 + r() * 1000,
    alertOnEntry: true,
    alertOnExit: false,
    alertOnDwell: true,
    dwellThresholdS: 300,
  }));
  const geofences: Geofence[] = [...depots, ...serviceZones];

  // ── Drivers (60, so 10 spare) ──
  const drivers: Driver[] = Array.from({ length: 60 }, (_, i) => {
    const first = pick(SAUDI_FIRST_NAMES, r);
    const last = pick(SAUDI_LAST_NAMES, r);
    const depot = pick(RIYADH_DEPOTS, r);
    const statusRoll = r();
    const status: Driver['status'] =
      statusRoll < 0.65 ? 'on_route' : statusRoll < 0.8 ? 'available' : statusRoll < 0.9 ? 'on_break' : statusRoll < 0.97 ? 'off_duty' : 'suspended';
    return {
      id: `DRV-${String(i + 1).padStart(3, '0')}`,
      fullName: `${first} ${last}`,
      iqamaNo: `${2300 + Math.floor(r() * 1000)}${String(Math.floor(r() * 9999999)).padStart(7, '0')}`,
      iqamaExpiry: new Date(Date.now() + (r() * 365 - 30) * 24 * 3600 * 1000).toISOString(),
      licenseNo: `LIC-${Math.floor(r() * 1000000)}`,
      licenseClass: pick(['A', 'B', 'C', 'D'] as const, r),
      licenseExpiry: new Date(Date.now() + (r() * 365 - 20) * 24 * 3600 * 1000).toISOString(),
      status,
      depotId: depot.id,
      hireDate: new Date(Date.now() - r() * 365 * 5 * 24 * 3600 * 1000).toISOString(),
      phone: `+9665${Math.floor(r() * 90000000 + 10000000)}`,
      photoColor: pick(['#3b82f6', '#a855f7', '#22c55e', '#f97316', '#06b6d4', '#eab308', '#ef4444'], r),
      rating: Math.round((3.5 + r() * 1.5) * 10) / 10,
      totalTrips: Math.floor(r() * 800 + 100),
      safetyScore: Math.round(70 + r() * 30),
      onTimeRate: Math.round((0.85 + r() * 0.14) * 1000) / 1000,
      fuelEfficiencyScore: Math.round(65 + r() * 35),
      totalKmThisMonth: Math.floor(r() * 3000 + 500),
      totalHoursThisMonth: Math.round(r() * 160 + 20),
      currentVehicleId: status === 'on_route' ? `VEH-${String(Math.floor(r() * 50) + 1).padStart(3, '0')}` : undefined,
    };
  });

  // ── Vehicles (50) ──
  const vehicles: Vehicle[] = Array.from({ length: 50 }, (_, i) => {
    const makeObj = pick(VEHICLE_MAKES, r);
    const type: VehicleType = pick(['van', 'truck_small', 'truck_large', 'refrigerated', 'flatbed'], r);
    const depot = pick(RIYADH_DEPOTS, r);
    const driverOnRoute = drivers.find((d) => d.status === 'on_route' && !d.currentVehicleId);
    const statusRoll = r();
    const status: VehicleStatus =
      statusRoll < 0.55 ? 'moving' : statusRoll < 0.75 ? 'stopped' : statusRoll < 0.85 ? 'idle' : statusRoll < 0.95 ? 'offline' : 'in_maintenance';
    const v: Vehicle = {
      id: `VEH-${String(i + 1).padStart(3, '0')}`,
      plate: `${Math.floor(r() * 9000 + 1000)} ${pick(['RYD', 'JED', 'DMM', 'MEC', 'TAB'], r)}`,
      type,
      make: makeObj.make,
      model: pick(makeObj.models, r),
      year: 2018 + Math.floor(r() * 8),
      vin: `VIN${Math.floor(r() * 1e15).toString(36).toUpperCase().padStart(14, '0')}`,
      fuelType: pick(['diesel', 'diesel', 'gasoline', 'hybrid'] as const, r),
      capacityKg: type === 'van' ? 1500 : type === 'truck_small' ? 3500 : type === 'truck_large' ? 12000 : 2500,
      capacityM3: type === 'van' ? 12 : type === 'truck_small' ? 20 : type === 'truck_large' ? 45 : 18,
      odometerKm: Math.floor(30000 + r() * 270000),
      engineHours: Math.floor(2000 + r() * 8000),
      status,
      homeDepotId: depot.id,
      assignedDriverId: status === 'moving' || status === 'idle' ? driverOnRoute?.id : undefined,
      telemetryDeviceId: `DEV-${String(i + 1).padStart(4, '0')}`,
      insuranceExpiry: new Date(Date.now() + (r() * 365 - 30) * 24 * 3600 * 1000).toISOString(),
      registrationExpiry: new Date(Date.now() + (r() * 365 - 60) * 24 * 3600 * 1000).toISOString(),
      iqamaExpiry: undefined,
      lastPingAt: status === 'offline'
        ? new Date(Date.now() - (r() * 24 + 1) * 3600 * 1000).toISOString()
        : new Date(Date.now() - r() * 60 * 1000).toISOString(),
      lat: depot.lat + (r() - 0.5) * 0.15,
      lng: depot.lng + (r() - 0.5) * 0.15,
      speedKmh: status === 'moving' ? Math.floor(r() * 80 + 20) : 0,
      heading: Math.floor(r() * 360),
      fuelLevelPct: status === 'offline' ? Math.floor(r() * 30) : Math.floor(20 + r() * 75),
      ignitionOn: status !== 'offline' && status !== 'in_maintenance' && r() > 0.1,
      gForce: status === 'moving' ? r() * 0.4 : 0,
      dtcCodes: r() > 0.85 ? [`P${Math.floor(r() * 500)}`] : [],
    };
    if (v.assignedDriverId) {
      const d = drivers.find((dr) => dr.id === v.assignedDriverId);
      if (d) d.currentVehicleId = v.id;
    }
    return v;
  });

  // ── Customers (30) ──
  const customerNames = [
    'Almarai', 'SABIC', 'STC', 'Al Rajhi', 'Jarir Marketing', 'Extra Stores',
    'Panda Retail', 'Nahdi Medical', 'Aldrees Petroleum', 'Saudia Airlines',
    'Alhokair Fashion', 'eXtra', 'Mouwasat Medical', 'SAVOLA', 'Tasnee',
    'Yansab', 'Maaden', 'Bank AlBilad', 'Alinma Bank', 'Dar Al Arkan',
    'BinDawood', 'Farm Superstores', 'Tamimi Markets', 'Leejam Sports',
    'SACO', 'Alhammadi Trading', 'Aujan Industries', 'Halwani Bros',
    'Cenomi Centers', 'AlArabia Outdoor',
  ];
  const customers: Customer[] = customerNames.map((name, i) => {
    const tier = pick(['standard', 'silver', 'gold', 'platinum'] as const, r);
    return {
      id: `CUS-${String(i + 1).padStart(3, '0')}`,
      name,
      type: i < 20 ? 'b2b' : 'b2c',
      tier,
      vatNumber: i < 20 ? `3${Math.floor(r() * 1e14).toString().padStart(14, '0')}` : undefined,
      crNumber: i < 20 ? `1${Math.floor(r() * 1e9).toString().padStart(9, '0')}` : undefined,
      billingEmail: `billing@${name.toLowerCase().replace(/\s+/g, '')}.sa`,
      billingAddress: `${pick(RIYADH_ZONES, r)}, Riyadh 11564, Saudi Arabia`,
      primaryContactName: `${pick(SAUDI_FIRST_NAMES, r)} ${pick(SAUDI_LAST_NAMES, r)}`,
      primaryContactPhone: `+9661${Math.floor(r() * 9000000 + 1000000)}`,
      paymentTermsDays: pick([15, 30, 45, 60], r),
      creditLimitSar: tier === 'platinum' ? 500000 : tier === 'gold' ? 200000 : tier === 'silver' ? 75000 : 25000,
      outstandingSar: Math.floor(r() * 100000),
      lifetimeValueSar: Math.floor(r() * 5000000 + 100000),
      totalShipments: Math.floor(r() * 2000 + 50),
      onTimeRate: Math.round((0.85 + r() * 0.14) * 1000) / 1000,
      satisfactionScore: Math.round((3.5 + r() * 1.5) * 10) / 10,
      joinedAt: new Date(Date.now() - r() * 1000 * 24 * 3600 * 1000).toISOString(),
      status: r() > 0.95 ? 'suspended' : 'active',
    };
  });

  // ── Warehouses (3) ──
  const warehouses: Warehouse[] = RIYADH_DEPOTS.slice(0, 3).map((d, i) => ({
    id: d.id,
    name: d.name,
    type: i === 0 ? 'main' : 'cross_dock',
    address: `${pick(RIYADH_ZONES, r)}, Riyadh`,
    lat: d.lat,
    lng: d.lng,
    totalCapacityM3: 5000,
    usedCapacityM3: Math.floor(2000 + r() * 2500),
    zonesCount: 8 + i * 2,
    staffCount: 12 + i * 4,
    operatingHours: '24/7',
  }));

  // ── Inventory (80 items) ──
  const inventory: InventoryItem[] = Array.from({ length: 80 }, (_, i) => {
    const wh = pick(warehouses, r);
    const cat = pick(CATEGORIES, r);
    const qty = Math.floor(r() * 200);
    const reserved = Math.floor(r() * Math.min(qty, 50));
    const status: InventoryItem['status'] =
      qty === 0 ? 'out' : qty < 20 ? 'low' : reserved > 0 ? 'reserved' : 'in_stock';
    return {
      id: `INV-${String(i + 1).padStart(4, '0')}`,
      warehouseId: wh.id,
      sku: `SKU-${cat.toUpperCase().slice(0, 3)}-${String(i + 1).padStart(5, '0')}`,
      name: `${cat} Item ${i + 1}`,
      category: cat,
      qty,
      reservedQty: reserved,
      availableQty: qty - reserved,
      binLocation: `${pick(['A', 'B', 'C', 'D'], r)}-${Math.floor(r() * 50 + 1)}`,
      unitWeightKg: Math.round((0.5 + r() * 10) * 10) / 10,
      unitVolumeM3: Math.round((0.01 + r() * 0.5) * 100) / 100,
      unitValueSar: Math.floor(r() * 500 + 10),
      rfidTag: r() > 0.5 ? `RFID${Math.floor(r() * 1e10)}` : undefined,
      barcode: `8${Math.floor(r() * 1e12).toString().padStart(12, '0')}`,
      requiresColdChain: cat === 'Pharma' || cat === 'F&B',
      lastCountedAt: new Date(Date.now() - r() * 30 * 24 * 3600 * 1000).toISOString(),
      expiryDate: cat === 'Pharma' || cat === 'F&B' ? new Date(Date.now() + (r() * 365) * 24 * 3600 * 1000).toISOString() : undefined,
      status,
    };
  });

  // ── Jobs (200) & Stops ──
  const jobs: Job[] = [];
  const stops: Stop[] = [];
  const shipments: Shipment[] = [];
  for (let i = 0; i < 200; i++) {
    const customer = pick(customers, r);
    const jobId = `JOB-2026-${String(i + 1).padStart(5, '0')}`;
    const priority = pick(['low', 'normal', 'normal', 'normal', 'high', 'urgent'] as const, r);
    const statusRoll = r();
    const status: JobStatus =
      statusRoll < 0.15 ? 'unassigned' :
      statusRoll < 0.35 ? 'planned' :
      statusRoll < 0.55 ? 'assigned' :
      statusRoll < 0.75 ? 'en_route' :
      statusRoll < 0.85 ? 'arrived' :
      statusRoll < 0.95 ? 'delivered' :
      'failed';
    const pickupOffsetH = -r() * 4;
    const deliveryOffsetH = pickupOffsetH + 2 + r() * 6;
    const startDate = new Date(Date.now() + pickupOffsetH * 3600 * 1000);
    const endDate = new Date(Date.now() + deliveryOffsetH * 3600 * 1000);
    const job: Job = {
      id: jobId,
      ref: jobId,
      customerId: customer.id,
      type: pick(['pickup', 'delivery', 'transfer'], r),
      status,
      priority,
      weightKg: Math.floor(r() * 500 + 5),
      volumeM3: Math.round((0.5 + r() * 5) * 10) / 10,
      pieces: Math.floor(r() * 20 + 1),
      serviceWindowStart: startDate.toISOString(),
      serviceWindowEnd: endDate.toISOString(),
      totalDistanceKm: status !== 'unassigned' ? Math.round(15 + r() * 80) : undefined,
      totalDurationMin: status !== 'unassigned' ? Math.round(30 + r() * 120) : undefined,
      estimatedCostSar: status !== 'unassigned' ? Math.round(80 + r() * 400) : undefined,
      assignedVehicleId: ['assigned', 'en_route', 'arrived', 'delivered'].includes(status) ? `VEH-${String(Math.floor(r() * 50) + 1).padStart(3, '0')}` : undefined,
      assignedDriverId: ['assigned', 'en_route', 'arrived', 'delivered'].includes(status) ? `DRV-${String(Math.floor(r() * 60) + 1).padStart(3, '0')}` : undefined,
      notes: r() > 0.85 ? pick(['Leave at reception', 'Call on arrival', 'Use loading dock B', 'Security code: 4571#'], r) : undefined,
      requiresColdChain: customer.tier === 'platinum' && r() > 0.7,
      requiresSignature: customer.type === 'b2b' || r() > 0.6,
      specialHandling: r() > 0.9 ? [pick(['Fragile', 'Hazmat', 'High-value', 'Heavy'], r)] : [],
      createdAt: new Date(Date.now() - r() * 48 * 3600 * 1000).toISOString(),
      createdBy: 'admin@vega.sa',
      customerReference: `PO-${Math.floor(r() * 1e6)}`,
    };
    jobs.push(job);

    // Origin stop
    const originZone = pick(RIYADH_ZONES, r);
    const destZone = pick(RIYADH_ZONES, r);
    const originStop: Stop = {
      id: `STP-${jobId}-O`,
      jobId,
      sequence: 1,
      address: `${pick(['King Fahd Rd', 'Olaya St', 'Makkah Rd', 'Tahliya St'], r)}, ${originZone}, Riyadh`,
      lat: 24.7136 + (r() - 0.5) * 0.15,
      lng: 46.6753 + (r() - 0.5) * 0.15,
      contactName: `${pick(SAUDI_FIRST_NAMES, r)} ${pick(SAUDI_LAST_NAMES, r)}`,
      contactPhone: `+9665${Math.floor(r() * 90000000 + 10000000)}`,
      type: 'pickup',
      status: status === 'delivered' || status === 'en_route' ? 'completed' : status === 'arrived' ? 'arrived' : 'pending',
      arrivedAt: status === 'delivered' || status === 'en_route' ? new Date(Date.now() - 2 * 3600 * 1000).toISOString() : undefined,
      completedAt: status === 'delivered' || status === 'en_route' ? new Date(Date.now() - 1.8 * 3600 * 1000).toISOString() : undefined,
    };
    stops.push(originStop);
    const destStop: Stop = {
      id: `STP-${jobId}-D`,
      jobId,
      sequence: 2,
      address: `${pick(['King Fahd Rd', 'Olaya St', 'Makkah Rd', 'Tahliya St'], r)}, ${destZone}, Riyadh`,
      lat: 24.7136 + (r() - 0.5) * 0.15,
      lng: 46.6753 + (r() - 0.5) * 0.15,
      contactName: customer.primaryContactName,
      contactPhone: customer.primaryContactPhone,
      instructions: r() > 0.7 ? pick(['Reception 2nd floor', 'Loading bay B', 'Gate 3', 'After 5pm only'], r) : undefined,
      type: 'delivery',
      status: status === 'delivered' ? 'completed' : status === 'failed' ? 'failed' : status === 'arrived' ? 'arrived' : 'pending',
      arrivedAt: status === 'arrived' || status === 'delivered' || status === 'failed' ? new Date(Date.now() - 0.3 * 3600 * 1000).toISOString() : undefined,
      completedAt: status === 'delivered' ? new Date(Date.now() - 0.1 * 3600 * 1000).toISOString() : undefined,
      exceptionCode: status === 'failed' ? pick(['customer_not_available', 'wrong_address', 'damaged', 'refused'], r) : undefined,
    };
    stops.push(destStop);

    // Shipment (public tracking)
    shipments.push({
      id: `SHP-${jobId}`,
      ref: `VEGA${Math.floor(r() * 1e9).toString().padStart(9, '0')}`,
      customerId: customer.id,
      jobId,
      origin: { address: originStop.address, lat: originStop.lat, lng: originStop.lng, name: originZone },
      destination: { address: destStop.address, lat: destStop.lat, lng: destStop.lng, name: destZone },
      status,
      weightKg: job.weightKg,
      pieces: job.pieces,
      serviceType: pick(['standard', 'standard', 'express', 'same_day'], r),
      bookedAt: job.createdAt,
      pickedUpAt: originStop.completedAt,
      deliveredAt: destStop.completedAt,
      etaPromised: job.serviceWindowEnd,
      etaPredicted: new Date(Date.now() + r() * 4 * 3600 * 1000).toISOString(),
      podId: status === 'delivered' ? `POD-${jobId}` : undefined,
      currentVehicleId: job.assignedVehicleId,
      currentDriverId: job.assignedDriverId,
      currentLat: destStop.lat,
      currentLng: destStop.lng,
    });
  }

  // ── Routes (active) ──
  const routes: Route[] = jobs
    .filter((j) => ['assigned', 'en_route', 'arrived'].includes(j.status) && j.assignedVehicleId)
    .slice(0, 30)
    .map((j) => ({
      id: `RTE-${j.id.slice(-8)}`,
      vehicleId: j.assignedVehicleId!,
      driverId: j.assignedDriverId!,
      jobIds: [j.id],
      stops: stops.filter((s) => s.jobId === j.id).map((s, i) => ({
        stopId: s.id,
        sequence: s.sequence,
        etaPredicted: s.etaPredicted ?? new Date(Date.now() + i * 3600 * 1000).toISOString(),
        distanceFromPrevKm: i === 0 ? 0 : 5 + r() * 25,
      })),
      plannedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      startedAt: j.status !== 'assigned' ? new Date(Date.now() - 1 * 3600 * 1000).toISOString() : undefined,
      polyline: [],
      totalDistanceKm: j.totalDistanceKm ?? 30,
      totalDurationMin: j.totalDurationMin ?? 60,
      optimizationVersion: '2026.1.0',
      algorithm: pick(['or_tools', 'rl_optimized', 'nearest_neighbor'] as const, r),
      costSar: j.estimatedCostSar ?? 150,
      fuelEstimateL: Math.round((j.totalDistanceKm ?? 30) * 0.1 * 10) / 10,
    }));

  // ── Trips (last 30 days, sample of 80) ──
  const trips: Trip[] = Array.from({ length: 80 }, (_, i) => {
    const v = pick(vehicles, r);
    const d = pick(drivers, r);
    const startH = -r() * 30 * 24;
    const durH = 1 + r() * 8;
    return {
      id: `TRP-${String(i + 1).padStart(5, '0')}`,
      vehicleId: v.id,
      driverId: d.id,
      startedAt: new Date(Date.now() + startH * 3600 * 1000).toISOString(),
      endedAt: new Date(Date.now() + (startH + durH) * 3600 * 1000).toISOString(),
      startLat: v.lat - 0.05,
      startLng: v.lng - 0.05,
      endLat: v.lat + 0.05,
      endLng: v.lng + 0.05,
      distanceKm: Math.round(20 + r() * 200),
      maxSpeedKmh: Math.round(80 + r() * 40),
      avgSpeedKmh: Math.round(40 + r() * 30),
      idleSeconds: Math.floor(r() * 1800),
      harshBrakeCount: Math.floor(r() * 4),
      harshAccelCount: Math.floor(r() * 5),
      fuelConsumedL: Math.round((10 + r() * 30) * 10) / 10,
      startGeofenceId: pick(geofences, r).id,
      endGeofenceId: pick(geofences, r).id,
      status: 'completed',
    };
  });

  // ── Geofence events (last 24h) ──
  const geofenceEvents: GeofenceEvent[] = Array.from({ length: 60 }, (_, i) => {
    const v = pick(vehicles, r);
    const gf = pick(geofences, r);
    return {
      id: `GFE-${String(i + 1).padStart(5, '0')}`,
      vehicleId: v.id,
      geofenceId: gf.id,
      type: pick(['entry', 'exit', 'dwell'] as const, r),
      timestamp: new Date(Date.now() - r() * 24 * 3600 * 1000).toISOString(),
      durationS: r() > 0.5 ? Math.floor(r() * 1800) : undefined,
    };
  });

  // ── Safety events (last 7 days) ──
  const safetyTypes: SafetyEventType[] = ['harsh_brake', 'harsh_accel', 'lane_departure', 'tailgating', 'distraction', 'fatigue', 'speeding', 'phone_use', 'no_seatbelt'];
  const safetyEvents: SafetyEvent[] = Array.from({ length: 100 }, (_, i) => {
    const v = pick(vehicles.filter((vh) => vh.status === 'moving' || vh.status === 'stopped'), r);
    const d = drivers.find((dr) => dr.currentVehicleId === v.id) ?? pick(drivers, r);
    return {
      id: `SE-${String(i + 1).padStart(5, '0')}`,
      vehicleId: v.id,
      driverId: d.id,
      timestamp: new Date(Date.now() - r() * 7 * 24 * 3600 * 1000).toISOString(),
      type: pick(safetyTypes, r),
      severity: pick(['low', 'medium', 'high', 'critical'] as const, r),
      lat: v.lat,
      lng: v.lng,
      speedKmh: v.speedKmh,
      gForce: r() * 0.8,
      clipUrl: r() > 0.3 ? `https://clips.vega.sa/${v.id}/${i}.mp4` : undefined,
      thumbnailUrl: r() > 0.3 ? `https://clips.vega.sa/${v.id}/${i}.jpg` : undefined,
      durationS: Math.floor(r() * 15) + 3,
      reviewed: r() > 0.4,
    };
  });

  // ── Coaching sessions ──
  const coachingSessions: CoachingSession[] = Array.from({ length: 15 }, (_, i) => {
    const d = pick(drivers, r);
    return {
      id: `COA-${String(i + 1).padStart(3, '0')}`,
      driverId: d.id,
      coachId: 'mgr-1',
      safetyEventIds: pickN(safetyEvents, 2, r).map((e) => e.id),
      scheduledAt: new Date(Date.now() + r() * 14 * 24 * 3600 * 1000).toISOString(),
      completedAt: r() > 0.5 ? new Date(Date.now() - r() * 14 * 24 * 3600 * 1000).toISOString() : undefined,
      status: pick(['scheduled', 'in_progress', 'completed', 'cancelled'] as const, r),
      notes: 'Reviewed dashcam footage, agreed on safer following distance.',
      actionItems: [
        { description: 'Maintain 3-second following distance', dueAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(), done: r() > 0.5 },
      ],
      signedByDriver: r() > 0.5,
    };
  });

  // ── Parts inventory ──
  const parts: Part[] = [
    { id: 'P-OIL-1', sku: 'OIL-5W30', name: 'Engine Oil 5W-30 (5L)', category: 'fluids', stockQty: 48, reorderLevel: 20, unitCostSar: 145, supplier: 'Alhammadi', leadTimeDays: 2 },
    { id: 'P-OIL-FLT', sku: 'OIL-FLT-001', name: 'Oil Filter Universal', category: 'filters', stockQty: 120, reorderLevel: 50, unitCostSar: 25, supplier: 'Alhammadi', leadTimeDays: 2 },
    { id: 'P-AIR-FLT', sku: 'AIR-FLT-001', name: 'Air Filter', category: 'filters', stockQty: 85, reorderLevel: 40, unitCostSar: 55, supplier: 'Alhammadi', leadTimeDays: 3 },
    { id: 'P-BRAKE-PAD', sku: 'BRK-PAD-001', name: 'Brake Pad Set (Front)', category: 'brakes', stockQty: 32, reorderLevel: 15, unitCostSar: 280, supplier: 'Aldrees', leadTimeDays: 5 },
    { id: 'P-BRAKE-DSK', sku: 'BRK-DSK-001', name: 'Brake Disc (Front)', category: 'brakes', stockQty: 18, reorderLevel: 10, unitCostSar: 420, supplier: 'Aldrees', leadTimeDays: 5 },
    { id: 'P-TIRE-265', sku: 'TIRE-265-70R17', name: 'Tire 265/70R17', category: 'tires', stockQty: 64, reorderLevel: 30, unitCostSar: 580, supplier: 'Bridgestone Arabia', leadTimeDays: 7 },
    { id: 'P-BAT-12V', sku: 'BAT-12V-100AH', name: 'Battery 12V 100Ah', category: 'electrical', stockQty: 12, reorderLevel: 8, unitCostSar: 650, supplier: 'Almabani', leadTimeDays: 3 },
    { id: 'P-COOL-1', sku: 'COOL-1', name: 'Coolant 5L', category: 'fluids', stockQty: 28, reorderLevel: 15, unitCostSar: 85, supplier: 'Alhammadi', leadTimeDays: 2 },
    { id: 'P-SPARK', sku: 'SPARK-001', name: 'Spark Plug', category: 'engine', stockQty: 96, reorderLevel: 40, unitCostSar: 35, supplier: 'Almabani', leadTimeDays: 4 },
    { id: 'P-WIPER', sku: 'WIPER-001', name: 'Wiper Blade Set', category: 'consumables', stockQty: 75, reorderLevel: 30, unitCostSar: 45, supplier: 'Alhammadi', leadTimeDays: 2 },
  ];

  // ── Work orders (40) ──
  const workOrders: WorkOrder[] = Array.from({ length: 40 }, (_, i) => {
    const v = pick(vehicles, r);
    const type = pick(['preventive', 'corrective', 'predictive', 'inspection'] as const, r);
    const status = pick(['open', 'scheduled', 'in_progress', 'awaiting_parts', 'completed'] as const, r);
    const opened = new Date(Date.now() - r() * 30 * 24 * 3600 * 1000);
    const closedDate = status === 'completed' ? new Date(opened.getTime() + (1 + r() * 5) * 24 * 3600 * 1000) : undefined;
    const closed = closedDate ? closedDate.toISOString() : undefined;
    const laborH = Math.round((1 + r() * 6) * 10) / 10;
    const laborCost = laborH * 120;
    const partsCost = Math.floor(r() * 2000);
    return {
      id: `WO-${String(i + 1).padStart(4, '0')}`,
      vehicleId: v.id,
      type,
      status,
      priority: pick(['low', 'normal', 'high', 'critical'] as const, r),
      title: pick([
        'Oil & filter change', 'Brake pad replacement', 'Tire rotation', 'Battery test',
        'Coolant flush', 'A/C service', 'Transmission service', 'Annual inspection',
        'Suspension repair', 'Engine diagnostic', 'DPF regeneration',
      ], r),
      description: pick([
        'Routine service per maintenance schedule.',
        'Driver reported grinding noise on braking.',
        'Tire wear uneven — alignment needed.',
        'Battery failing load test.',
        'Customer complaint: A/C not cooling.',
      ], r),
      openedAt: opened.toISOString(),
      scheduledFor: status !== 'open' ? new Date(opened.getTime() + 1 * 24 * 3600 * 1000).toISOString() : undefined,
      startedAt: status === 'in_progress' || status === 'completed' ? new Date(opened.getTime() + 1 * 24 * 3600 * 1000).toISOString() : undefined,
      completedAt: closed,
      closedAt: closed,
      technicianId: `TECH-${Math.floor(r() * 4) + 1}`,
      mileageKm: v.odometerKm,
      engineHours: v.engineHours,
      laborHours: laborH,
      laborCostSar: laborCost,
      partsCostSar: partsCost,
      totalCostSar: laborCost + partsCost,
      parts: r() > 0.3 ? [pick(parts, r)].map((p) => ({ partId: p.id, name: p.name, qty: 1, unitCostSar: p.unitCostSar })) : [],
      rootCause: type === 'corrective' ? pick(['Wear & tear', 'Driver abuse', 'Manufacturing defect', 'Road conditions'], r) : undefined,
      relatedSafetyEventId: r() > 0.9 ? pick(safetyEvents, r).id : undefined,
    };
  });

  // ── Maintenance rules (per vehicle, key components) ──
  const maintenanceRules: MaintenanceRule[] = vehicles.flatMap((v) => [
    {
      id: `MR-${v.id}-OIL`,
      vehicleType: v.type,
      component: 'engine_oil',
      triggerType: 'odometer_km',
      triggerValue: 10000,
      lastDoneAt: new Date(Date.now() - r() * 90 * 24 * 3600 * 1000).toISOString(),
      lastDoneMileageKm: v.odometerKm - Math.floor(r() * 10000),
      nextDueAt: new Date(Date.now() + r() * 30 * 24 * 3600 * 1000).toISOString(),
      nextDueMileageKm: v.odometerKm + Math.floor(10000 - r() * 10000),
      costEstimateSar: 250,
    },
    {
      id: `MR-${v.id}-BRAKE`,
      vehicleType: v.type,
      component: 'brake_pads',
      triggerType: 'odometer_km',
      triggerValue: 40000,
      lastDoneAt: new Date(Date.now() - r() * 180 * 24 * 3600 * 1000).toISOString(),
      lastDoneMileageKm: v.odometerKm - Math.floor(r() * 40000),
      nextDueAt: new Date(Date.now() + r() * 60 * 24 * 3600 * 1000).toISOString(),
      nextDueMileageKm: v.odometerKm + Math.floor(40000 - r() * 40000),
      costEstimateSar: 1200,
    },
    {
      id: `MR-${v.id}-TIRE`,
      vehicleType: v.type,
      component: 'tires',
      triggerType: 'odometer_km',
      triggerValue: 60000,
      lastDoneAt: new Date(Date.now() - r() * 365 * 24 * 3600 * 1000).toISOString(),
      lastDoneMileageKm: v.odometerKm - Math.floor(r() * 60000),
      nextDueAt: new Date(Date.now() + r() * 90 * 24 * 3600 * 1000).toISOString(),
      nextDueMileageKm: v.odometerKm + Math.floor(60000 - r() * 60000),
      costEstimateSar: 2400,
    },
  ]);

  // ── Fuel events (last 30 days, 150) ──
  const fuelEvents: FuelEvent[] = Array.from({ length: 150 }, (_, i) => {
    const v = pick(vehicles, r);
    const station = pick(FUEL_BRANDS, r);
    const liters = 20 + r() * 80;
    const pricePerLiter = 2.18 + (r() - 0.5) * 0.3;
    const kmSince = liters / 0.1 + r() * 50;
    const cons = (liters / kmSince) * 100;
    const anomalyRoll = r();
    const isAnomaly = anomalyRoll > 0.92;
    const flags: string[] = [];
    if (isAnomaly) {
      if (r() > 0.5) flags.push('over_capacity');
      if (r() > 0.5) flags.push('price_deviation');
      if (r() > 0.5) flags.push('out_of_route');
      if (r() > 0.5) flags.push('off_hours');
    }
    return {
      id: `FE-${String(i + 1).padStart(5, '0')}`,
      vehicleId: v.id,
      driverId: v.assignedDriverId,
      timestamp: new Date(Date.now() - r() * 30 * 24 * 3600 * 1000).toISOString(),
      liters: Math.round(liters * 10) / 10,
      costSar: Math.round(liters * pricePerLiter * 100) / 100,
      pricePerLiter: Math.round(pricePerLiter * 100) / 100,
      stationName: `${station} Station #${Math.floor(r() * 200)}`,
      stationBrand: station,
      odometerKm: v.odometerKm,
      source: pick(['card', 'card', 'card', 'manual', 'sensor'] as const, r),
      cardNumber: r() > 0.5 ? `**** **** **** ${Math.floor(r() * 10000)}` : undefined,
      cardProvider: pick(['naft', 'aldrees', 'taziz', 'sahel'] as const, r),
      gpsLat: v.lat + (r() - 0.5) * 0.05,
      gpsLng: v.lng + (r() - 0.5) * 0.05,
      kmSinceLastFill: Math.round(kmSince),
      consumptionLPer100km: Math.round(cons * 10) / 10,
      isAnomaly,
      anomalyFlags: flags,
    };
  });

  // ── Fuel cards (50) ──
  const fuelCards: FuelCard[] = vehicles.map((v) => ({
    id: `FC-${v.id.slice(-3)}`,
    vehicleId: v.id,
    cardNumber: `**** **** **** ${Math.floor(r() * 10000)}`,
    provider: pick(['naft', 'aldrees', 'taziz', 'sahel'] as const, r),
    status: 'active',
    dailyLimitSar: 500,
    monthlyLimitSar: 10000,
    allowedStationIds: [],
  }));

  // ── Compliance documents ──
  const complianceDocuments: ComplianceDocument[] = [];
  vehicles.forEach((v) => {
    const expiryDays = (Date.parse(v.insuranceExpiry) - Date.now()) / (24 * 3600 * 1000);
    const regDays = (Date.parse(v.registrationExpiry) - Date.now()) / (24 * 3600 * 1000);
    complianceDocuments.push({
      id: `CD-${v.id}-INS`,
      type: 'insurance',
      ownerType: 'vehicle',
      ownerId: v.id,
      documentNumber: `INS-${Math.floor(r() * 1e8)}`,
      issuedBy: 'Tawuniya',
      issuedAt: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString(),
      expiresAt: v.insuranceExpiry,
      status: expiryDays < 0 ? 'expired' : expiryDays < 30 ? 'expiring_soon' : 'valid',
      fileUrl: `https://docs.vega.sa/${v.id}-insurance.pdf`,
      uploadedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      uploadedBy: 'admin@vega.sa',
    });
    complianceDocuments.push({
      id: `CD-${v.id}-REG`,
      type: 'registration',
      ownerType: 'vehicle',
      ownerId: v.id,
      documentNumber: v.plate,
      issuedBy: 'Traffic Department',
      issuedAt: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString(),
      expiresAt: v.registrationExpiry,
      status: regDays < 0 ? 'expired' : regDays < 30 ? 'expiring_soon' : 'valid',
      fileUrl: `https://docs.vega.sa/${v.id}-registration.pdf`,
      uploadedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      uploadedBy: 'admin@vega.sa',
    });
  });
  drivers.forEach((d) => {
    const iqamaDays = (Date.parse(d.iqamaExpiry) - Date.now()) / (24 * 3600 * 1000);
    const licenseDays = (Date.parse(d.licenseExpiry) - Date.now()) / (24 * 3600 * 1000);
    complianceDocuments.push({
      id: `CD-${d.id}-IQM`,
      type: 'iqama',
      ownerType: 'driver',
      ownerId: d.id,
      documentNumber: d.iqamaNo,
      issuedBy: 'MOI',
      issuedAt: new Date(Date.now() - 365 * 2 * 24 * 3600 * 1000).toISOString(),
      expiresAt: d.iqamaExpiry,
      status: iqamaDays < 0 ? 'expired' : iqamaDays < 30 ? 'expiring_soon' : 'valid',
      fileUrl: `https://docs.vega.sa/${d.id}-iqama.pdf`,
      uploadedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      uploadedBy: 'admin@vega.sa',
    });
    complianceDocuments.push({
      id: `CD-${d.id}-LIC`,
      type: 'license',
      ownerType: 'driver',
      ownerId: d.id,
      documentNumber: d.licenseNo,
      issuedBy: 'Traffic Department',
      issuedAt: new Date(Date.now() - 365 * 5 * 24 * 3600 * 1000).toISOString(),
      expiresAt: d.licenseExpiry,
      status: licenseDays < 0 ? 'expired' : licenseDays < 30 ? 'expiring_soon' : 'valid',
      fileUrl: `https://docs.vega.sa/${d.id}-license.pdf`,
      uploadedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      uploadedBy: 'admin@vega.sa',
    });
  });

  // ── PODs (one per delivered stop) ──
  const pods: POD[] = stops
    .filter((s) => s.status === 'completed' && s.type === 'delivery')
    .slice(0, 80)
    .map((s) => {
      return {
        id: `POD-${s.id}`,
        stopId: s.id,
        jobId: s.jobId,
        signatureDataUrl: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80"><path d="M10,60 Q30,10 50,40 T100,50 T150,30 T190,55" stroke="black" fill="none" stroke-width="2"/></svg>')}`,
        photoUrls: [`https://pod.vega.sa/${s.id}.jpg`],
        recipientName: s.contactName ?? 'Recipient',
        recipientIdType: r() > 0.5 ? 'iqama' : 'national_id',
        recipientIdNumber: `${Math.floor(r() * 1e10)}`,
        notes: r() > 0.8 ? 'Package left at reception per instructions' : undefined,
        capturedAt: s.completedAt ?? new Date().toISOString(),
        gpsLat: s.lat,
        gpsLng: s.lng,
        deviceId: pick(vehicles, r).telemetryDeviceId,
        appVersion: '2.4.1',
      };
    });

  // ── Delivery exceptions ──
  const deliveryExceptions: DeliveryException[] = stops
    .filter((s) => s.status === 'failed')
    .slice(0, 25)
    .map((s, i) => ({
      id: `EXC-${String(i + 1).padStart(4, '0')}`,
      stopId: s.id,
      jobId: s.jobId,
      code: (s.exceptionCode ?? 'customer_not_available') as DeliveryException['code'],
      note: pick([
        'Customer not available, will retry tomorrow',
        'Address incorrect, customer unreachable',
        'Package damaged in transit',
        'Customer refused delivery',
        'Access denied at building',
      ], r),
      photos: r() > 0.5 ? [`https://pod.vega.sa/exc-${s.id}.jpg`] : [],
      reportedAt: s.arrivedAt ?? new Date().toISOString(),
      reportedBy: 'driver-app',
      resolvedAt: r() > 0.5 ? new Date().toISOString() : undefined,
      resolution: r() > 0.5 ? pick(['rescheduled', 'cancelled', 'returned_to_depot'] as const, r) : undefined,
    }));

  // ── HOS logs (sample) ──
  const hosLogs: HOSLog[] = drivers
    .filter((d) => d.status === 'on_route')
    .slice(0, 20)
    .flatMap((d) => {
      const logs: HOSLog[] = [];
      const now = Date.now();
      for (let h = 8; h >= 0; h--) {
        logs.push({
          id: `HOS-${d.id}-${h}`,
          driverId: d.id,
          dutyStatus: h === 0 ? 'driving' : h < 4 ? 'driving' : h < 6 ? 'on_duty' : h < 7 ? 'sleeper_berth' : 'off_duty',
          timestamp: new Date(now - h * 3600 * 1000).toISOString(),
          lat: 24.7136 + (r() - 0.5) * 0.1,
          lng: 46.6753 + (r() - 0.5) * 0.1,
          vehicleId: d.currentVehicleId,
        });
      }
      return logs;
    });

  // ── DVIR reports ──
  const dvirReports: DVIRReport[] = drivers.slice(0, 30).map((d, i) => {
    const hasDefect = r() > 0.85;
    return {
      id: `DVIR-${String(i + 1).padStart(4, '0')}`,
      driverId: d.id,
      vehicleId: d.currentVehicleId ?? pick(vehicles, r).id,
      type: pick(['pre_trip', 'post_trip'] as const, r),
      startedAt: new Date(Date.now() - r() * 24 * 3600 * 1000).toISOString(),
      completedAt: new Date(Date.now() - r() * 24 * 3600 * 1000 + 15 * 60 * 1000).toISOString(),
      items: [
        { name: 'Tires', status: hasDefect && r() > 0.5 ? 'defect' : 'ok', note: hasDefect ? 'Front left low pressure' : undefined },
        { name: 'Lights', status: 'ok' },
        { name: 'Brakes', status: 'ok' },
        { name: 'Mirrors', status: 'ok' },
        { name: 'Horn', status: 'ok' },
        { name: 'Seatbelts', status: 'ok' },
        { name: 'Wipers', status: hasDefect && r() > 0.5 ? 'defect' : 'ok' },
        { name: 'Fluids', status: 'ok' },
        { name: 'Cargo secure', status: 'ok' },
      ],
      defects: hasDefect ? 'Front left tire low pressure (32 PSI)' : '',
      photos: hasDefect && r() > 0.5 ? [`https://dvir.vega.sa/${i}.jpg`] : [],
      signedAt: new Date(Date.now() - r() * 24 * 3600 * 1000 + 15 * 60 * 1000).toISOString(),
      odometerKm: pick(vehicles, r).odometerKm,
    };
  });

  // ── Pick lists & Load plans ──
  const pickLists: PickList[] = jobs
    .filter((j) => j.requiresColdChain || j.specialHandling.length > 0 || j.pieces > 10)
    .slice(0, 30)
    .map((j, i) => ({
      id: `PL-${String(i + 1).padStart(4, '0')}`,
      jobId: j.id,
      warehouseId: pick(warehouses, r).id,
      status: pick(['pending', 'in_progress', 'completed'] as const, r),
      assignedTo: `OP-${Math.floor(r() * 8) + 1}`,
      items: Array.from({ length: Math.min(j.pieces, 6) }, (_, k) => ({
        sku: pick(inventory, r).sku,
        name: `Item ${k + 1}`,
        qty: Math.floor(r() * 5 + 1),
        binLocation: pick(inventory, r).binLocation,
        picked: r() > 0.3,
      })),
      createdAt: j.createdAt,
      completedAt: r() > 0.5 ? new Date().toISOString() : undefined,
      totalPicks: j.pieces,
      picksCompleted: Math.floor(j.pieces * (0.3 + r() * 0.7)),
    }));

  const loadPlans: LoadPlan[] = routes.slice(0, 15).map((r2, i) => {
    const jobIds = r2.jobIds;
    return {
      id: `LP-${String(i + 1).padStart(4, '0')}`,
      vehicleId: r2.vehicleId,
      routeId: r2.id,
      jobIds,
      totalWeightKg: jobs.filter((j) => jobIds.includes(j.id)).reduce((s, j) => s + j.weightKg, 0),
      totalVolumeM3: jobs.filter((j) => jobIds.includes(j.id)).reduce((s, j) => s + j.volumeM3, 0),
      utilizationPct: Math.floor(60 + r() * 30),
      manifest: jobIds.map((jid, idx) => {
        const j = jobs.find((jb) => jb.id === jid)!;
        return { jobId: jid, ref: j.ref, weightKg: j.weightKg, volumeM3: j.volumeM3, pieces: j.pieces, sequence: idx + 1 };
      }),
      createdAt: r2.plannedAt,
      verifiedAt: r() > 0.5 ? new Date().toISOString() : undefined,
      verifiedBy: r() > 0.5 ? `OP-${Math.floor(r() * 8) + 1}` : undefined,
      loadingBayId: `BAY-${Math.floor(r() * 6) + 1}`,
    };
  });

  // ── Customer notifications ──
  const customerNotifications: CustomerNotification[] = jobs.slice(0, 50).flatMap((j) => {
    const out: CustomerNotification[] = [];
    const customer = customers.find((c) => c.id === j.customerId)!;
    out.push({
      id: `NTF-${j.id}-1`,
      customerId: customer.id,
      shipmentId: `SHP-${j.id}`,
      type: 'booked',
      channel: pick(['email', 'sms', 'whatsapp'] as const, r),
      recipient: customer.billingEmail,
      message: `Shipment ${j.ref} booked.`,
      sentAt: j.createdAt,
      status: 'delivered',
      costSar: r() > 0.5 ? 0.15 : 0.05,
    });
    if (['en_route', 'arrived', 'delivered'].includes(j.status)) {
      out.push({
        id: `NTF-${j.id}-2`,
        customerId: customer.id,
        shipmentId: `SHP-${j.id}`,
        type: 'on_the_way',
        channel: 'sms',
        recipient: customer.primaryContactPhone,
        message: `Your shipment is on the way. Track: vegasa.app/t/${j.ref}`,
        sentAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
        status: 'delivered',
        costSar: 0.08,
      });
    }
    if (j.status === 'delivered') {
      out.push({
        id: `NTF-${j.id}-3`,
        customerId: customer.id,
        shipmentId: `SHP-${j.id}`,
        type: 'delivered',
        channel: 'whatsapp',
        recipient: customer.primaryContactPhone,
        message: `Delivered. POD: vegasa.app/pod/${j.ref}`,
        sentAt: new Date().toISOString(),
        status: 'delivered',
        costSar: 0.12,
      });
    }
    return out;
  });

  // ── Audit events (recent 100) ──
  const auditEvents: AuditEvent[] = Array.from({ length: 100 }, (_, i) => {
    const driver = pick(drivers, r);
    return {
      id: `AUD-${String(i + 1).padStart(5, '0')}`,
      timestamp: new Date(Date.now() - r() * 24 * 3600 * 1000).toISOString(),
      actorId: driver.userId ?? `usr-${driver.id}`,
      actorName: driver.fullName,
      actorRole: 'driver',
      action: pick(['login', 'job_start', 'job_complete', 'pod_capture', 'dvir_submit', 'reroute_request'], r),
      resource: pick(['job', 'pod', 'dvir', 'route'], r),
      resourceId: `res-${Math.floor(r() * 10000)}`,
      ip: `10.0.${Math.floor(r() * 255)}.${Math.floor(r() * 255)}`,
      userAgent: 'VegaDriver/2.4.1 (Android 14)',
      severity: 'info',
    };
  });

  // ── Scorecards ──
  const scorecards: DriverSafetyScorecard[] = drivers.map((d) => {
    const events = safetyEvents.filter((e) => e.driverId === d.id);
    const total = events.length;
    const critical = events.filter((e) => e.severity === 'critical' || e.severity === 'high').length;
    return {
      driverId: d.id,
      periodStart: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      periodEnd: new Date().toISOString(),
      overallScore: d.safetyScore,
      components: {
        harshBrake: Math.round(60 + r() * 40),
        harshAccel: Math.round(60 + r() * 40),
        speeding: Math.round(60 + r() * 40),
        distraction: Math.round(60 + r() * 40),
        fatigue: Math.round(60 + r() * 40),
        seatbelt: 100,
        onTimeDelivery: Math.round(d.onTimeRate * 100),
        fuelEfficiency: d.fuelEfficiencyScore,
      },
      totalEvents: total,
      criticalEvents: critical,
      coachingSessionsCompleted: coachingSessions.filter((c) => c.driverId === d.id && c.status === 'completed').length,
      trend: r() > 0.6 ? 'improving' : r() > 0.3 ? 'stable' : 'declining',
    };
  });

  // ── Alerts ──
  const alerts: Alert[] = [];
  vehicles.filter((v) => v.status === 'offline').forEach((v) => {
    alerts.push({
      id: `ALT-${v.id}`,
      timestamp: v.lastPingAt,
      type: 'vehicle_offline',
      category: 'fleet',
      severity: 'warning',
      status: 'open',
      title: `Vehicle ${v.plate} offline`,
      description: `Last ping was ${Math.round((Date.now() - Date.parse(v.lastPingAt)) / 60000)} minutes ago.`,
      resourceType: 'vehicle',
      resourceId: v.id,
      slaBreached: (Date.now() - Date.parse(v.lastPingAt)) > 3 * 3600 * 1000,
    });
  });
  complianceDocuments.filter((c) => c.status === 'expiring_soon' || c.status === 'expired').slice(0, 10).forEach((c) => {
    alerts.push({
      id: `ALT-CD-${c.id}`,
      timestamp: new Date().toISOString(),
      type: c.status === 'expired' ? 'document_expired' : 'document_expiring',
      category: 'compliance',
      severity: c.status === 'expired' ? 'critical' : 'warning',
      status: c.status === 'expired' ? 'open' : 'acknowledged',
      title: `${c.type} ${c.status === 'expired' ? 'expired' : 'expiring soon'}`,
      description: `${c.ownerType} ${c.ownerId}: ${c.documentNumber}`,
      resourceType: c.ownerType,
      resourceId: c.ownerId,
      slaBreached: c.status === 'expired',
    });
  });
  safetyEvents.filter((e) => e.severity === 'critical').slice(0, 5).forEach((e) => {
    alerts.push({
      id: `ALT-SE-${e.id}`,
      timestamp: e.timestamp,
      type: 'safety_event',
      category: 'safety',
      severity: 'high',
      status: e.reviewed ? 'acknowledged' : 'open',
      title: `Critical safety event: ${e.type}`,
      description: `Driver in vehicle ${e.vehicleId} at ${e.speedKmh} km/h`,
      resourceType: 'safety_event',
      resourceId: e.id,
      slaBreached: !e.reviewed,
    });
  });

  return {
    vehicles,
    drivers,
    jobs,
    stops,
    routes,
    geofences,
    geofenceEvents,
    trips,
    safetyEvents,
    workOrders,
    maintenanceRules,
    parts,
    fuelEvents,
    fuelCards,
    customers,
    shipments,
    warehouses,
    inventory,
    pickLists,
    loadPlans,
    complianceDocuments,
    auditEvents,
    alerts,
    hosLogs,
    dvirReports,
    pods,
    deliveryExceptions,
    coachingSessions,
    scorecards,
    customerNotifications,
  };
}
