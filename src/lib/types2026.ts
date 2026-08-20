// VEGA Logistics OS — 2026 Domain Types
// AI/ML engines, IoT telemetry, digital twin, carbon accounting, blockchain.

export type AISeverity = 'low' | 'medium' | 'high' | 'critical';
export type AssetHealth = 'healthy' | 'degraded' | 'at_risk' | 'failed';
export type CarbonIntensity = 'low' | 'medium' | 'high';

// ═══════════════════════════════════════════
//  Computer Vision
// ═══════════════════════════════════════════

export interface CVDetection {
  id: string;
  timestamp: string;
  cameraId: string;
  siteId: string;
  objectClass: string;
  confidence: number; // 0-1
  boundingBox: { x: number; y: number; w: number; h: number };
  attributes: Record<string, string | number>;
}

export type CVDamageType =
  | 'dent'
  | 'scratch'
  | 'crack'
  | 'broken_glass'
  | 'tire_wear'
  | 'paint_damage'
  | 'cargo_damage';

export interface CVDamageAssessment {
  id: string;
  vehicleId: string;
  timestamp: string;
  damageType: CVDamageType;
  severity: 'minor' | 'moderate' | 'severe';
  confidence: number;
  estimatedRepairCost: number; // SAR
  imageRef: string;
  location: { lat: number; lng: number };
}

export interface CVLaneViolation {
  id: string;
  vehicleId: string;
  timestamp: string;
  type: 'lane_departure' | 'speeding' | 'hard_brake' | 'tailgating';
  severity: AISeverity;
  speedKmh: number;
  location: { lat: number; lng: number };
}

export interface CVSummary {
  totalDetections: number;
  damageCount: number;
  violationCount: number;
  averageConfidence: number;
  totalRepairEstimate: number;
  topDamageType: CVDamageType | null;
}

// ═══════════════════════════════════════════
//  NLP — Document Intelligence
// ═══════════════════════════════════════════

export type DocumentType =
  | 'bol'
  | 'invoice'
  | 'customs_declaration'
  | 'pod'
  | 'zatca_tax_invoice'
  | 'delivery_note'
  | 'purchase_order';

export interface NLPDocumentField {
  name: string;
  value: string;
  confidence: number;
  page?: number;
  bbox?: { x: number; y: number; w: number; h: number };
}

export interface NLPDocument {
  id: string;
  type: DocumentType;
  filename: string;
  language: 'en' | 'ar' | 'mixed';
  uploadedAt: string;
  pages: number;
  status: 'processing' | 'extracted' | 'validated' | 'rejected';
  fields: NLPDocumentField[];
  entities: NLPDocumentEntity[];
  validationIssues: string[];
  extractedAmount?: number;
  vatAmount?: number; // 15% ZATCA
}

export interface NLPDocumentEntity {
  type: 'person' | 'organization' | 'address' | 'phone' | 'email' | 'date' | 'amount' | 'vat_number' | 'cr_number';
  text: string;
  normalized?: string;
  confidence: number;
}

export interface NLPSentiment {
  text: string;
  score: number; // -1..1
  magnitude: number; // 0..inf
  language: 'en' | 'ar';
  intent?: string;
}

export interface NLPChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  citations?: { source: string; snippet: string }[];
  intent?: string;
  confidence?: number;
}

// ═══════════════════════════════════════════
//  Digital Twin
// ═══════════════════════════════════════════

export interface DigitalTwinState {
  id: string;
  entityType: 'warehouse' | 'fleet' | 'route' | 'supply_chain';
  entityId: string;
  timestamp: string;
  position?: { x: number; y: number; z: number };
  metrics: Record<string, number>;
  status: 'live' | 'simulated' | 'historical' | 'forecast';
  scenarioId?: string;
}

export interface TwinSimulationResult {
  scenarioName: string;
  duration: number; // simulated hours
  steps: number;
  kpis: {
    avgUtilization: number;
    totalDistance: number;
    totalDeliveries: number;
    totalEmissionsKg: number;
    avgServiceLevel: number;
  };
  timeline: { t: number; metric: string; value: number }[];
  bottlenecks: { at: number; node: string; severity: AISeverity }[];
}

export interface TwinScenario {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, number | string>;
  baselineResult?: TwinSimulationResult;
  optimizedResult?: TwinSimulationResult;
  improvementPct?: number;
}

// ═══════════════════════════════════════════
//  Reinforcement Learning — Route Optimizer
// ═══════════════════════════════════════════

export interface RLAction {
  id: string;
  type: 'reassign' | 'reroute' | 'hold' | 'swap' | 'add_vehicle';
  vehicleId?: string;
  routeId?: string;
  fromZone?: string;
  toZone?: string;
  expectedReward: number;
  confidence: number;
}

export interface RLRoute {
  id: string;
  vehicleId: string;
  stops: { id: string; address: string; lat: number; lng: number; eta: string; serviceMin: number }[];
  distanceKm: number;
  durationMin: number;
  reward: number;
  policyVersion: string;
}

export interface RLPrediction {
  baselineReward: number;
  optimizedReward: number;
  fuelSavingPct: number;
  timeSavingPct: number;
  expectedActions: RLAction[];
  confidence: number;
}

export interface RLTrainingStats {
  episodes: number;
  totalReward: number;
  avgReward: number;
  epsilon: number;
  loss: number;
  policyVersion: string;
  lastUpdate: string;
}

// ═══════════════════════════════════════════
//  Predictive Maintenance
// ═══════════════════════════════════════════

export interface TelemetrySample {
  vehicleId: string;
  timestamp: string;
  odometerKm: number;
  engineTempC: number;
  oilPressureKpa: number;
  batteryVoltage: number;
  fuelLevelPct: number;
  tirePressurePsi: number;
  brakePadMm: number;
  vibrationG: number;
  rpm: number;
  dtcCodes: string[]; // diagnostic trouble codes
}

export interface MaintenancePrediction {
  id: string;
  vehicleId: string;
  component: 'engine' | 'brakes' | 'tires' | 'battery' | 'transmission' | 'cooling';
  failureProbability30d: number; // 0-1
  failureProbability90d: number;
  predictedFailureDate?: string;
  remainingUsefulLifeKm?: number;
  recommendedAction: string;
  estimatedCost: number; // SAR
  priority: AISeverity;
  confidence: number;
}

export interface AssetHealthRecord {
  vehicleId: string;
  health: AssetHealth;
  healthScore: number; // 0-100
  mtbfDays: number; // mean time between failures
  lastFailureDate?: string;
  lastServiceDate: string;
  totalMaintenanceCost: number;
  openPredictions: number;
}

export interface MaintenanceSchedule {
  vehicleId: string;
  serviceType: 'preventive' | 'corrective' | 'predictive' | 'inspection';
  scheduledDate: string;
  estimatedDuration: number; // hours
  estimatedCost: number;
  reason: string;
  priority: AISeverity;
}

// ═══════════════════════════════════════════
//  Carbon & Sustainability
// ═══════════════════════════════════════════

export interface CarbonEmission {
  id: string;
  vehicleId?: string;
  warehouseId?: string;
  scope: 1 | 2 | 3;
  category: 'fuel_combustion' | 'electricity' | 'refrigerant' | 'upstream_transport' | 'downstream_transport';
  co2eKg: number;
  timestamp: string;
  source: 'measured' | 'estimated' | 'reported';
}

export interface CarbonIntensityByLane {
  laneId: string;
  fromZone: string;
  toZone: string;
  distanceKm: number;
  co2ePerTonKm: number;
  totalCo2eKg: number;
  intensity: CarbonIntensity;
  vehicleMix: string;
}

export interface CarbonOffset {
  id: string;
  projectName: string;
  registry: 'verra' | 'gold_standard' | 'aramco_saudi';
  co2eOffsetKg: number;
  pricePerTonne: number; // SAR
  vintage: number;
  retired: boolean;
  retirementDate?: string;
}

export interface ESGReport {
  periodStart: string;
  periodEnd: string;
  totalScope1: number;
  totalScope2: number;
  totalScope3: number;
  netEmissions: number;
  offsetsRetired: number;
  netZero: number;
  intensityPerRevenue: number; // kg CO2e per SAR 1000
  intensityPerShipment: number; // kg CO2e per shipment
  reductionVsBaseline: number; // %
  saudiNetZero2050Progress: number; // %
}

// ═══════════════════════════════════════════
//  AI Agent Coordination
// ═══════════════════════════════════════════

export type AgentCapability =
  | 'vision'
  | 'nlp'
  | 'routing'
  | 'maintenance'
  | 'carbon'
  | 'twin'
  | 'analytics';

export interface AIAgent {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'active' | 'learning' | 'error';
  capabilities: AgentCapability[];
  tasksCompleted: number;
  averageLatencyMs: number;
  accuracy: number; // 0-1
  lastActive: string;
  description: string;
}

export interface AgentTask {
  id: string;
  agentId: string;
  type: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: 'queued' | 'running' | 'complete' | 'failed';
  startedAt: string;
  completedAt?: string;
  latencyMs?: number;
  error?: string;
}

export interface AgentCoordinationEvent {
  id: string;
  timestamp: string;
  sourceAgent: string;
  targetAgent?: string;
  eventType: string;
  payload: Record<string, unknown>;
  consensus: boolean;
}

// ═══════════════════════════════════════════
//  Fleet 50 — Enterprise Logistics OS Types
// ═══════════════════════════════════════════

export type FleetRole =
  | 'super_admin'
  | 'fleet_manager'
  | 'dispatcher'
  | 'driver'
  | 'warehouse_operator'
  | 'maintenance_tech'
  | 'customer_support'
  | 'executive';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: FleetRole;
  tenantId: string;
  avatarColor: string;
  depotId?: string;
}

// ── Fleet & Telematics ──

export type VehicleStatus = 'moving' | 'stopped' | 'idle' | 'offline' | 'in_maintenance';
export type VehicleType = 'van' | 'truck_small' | 'truck_large' | 'refrigerated' | 'flatbed';

export interface Vehicle {
  id: string;
  plate: string;
  type: VehicleType;
  make: string;
  model: string;
  year: number;
  vin: string;
  fuelType: 'diesel' | 'gasoline' | 'electric' | 'hybrid';
  capacityKg: number;
  capacityM3: number;
  odometerKm: number;
  engineHours: number;
  status: VehicleStatus;
  homeDepotId: string;
  assignedDriverId?: string;
  telemetryDeviceId: string;
  insuranceExpiry: string;
  registrationExpiry: string;
  iqamaExpiry?: string;
  lastPingAt: string;
  lat: number;
  lng: number;
  speedKmh: number;
  heading: number;
  fuelLevelPct: number;
  ignitionOn: boolean;
  gForce: number;
  dtcCodes: string[];
}

export interface Geofence {
  id: string;
  name: string;
  type: 'depot' | 'customer' | 'restricted' | 'service_zone';
  polygon: { lat: number; lng: number }[];
  center: { lat: number; lng: number };
  radiusM: number;
  alertOnEntry: boolean;
  alertOnExit: boolean;
  alertOnDwell: boolean;
  dwellThresholdS: number;
}

export interface GeofenceEvent {
  id: string;
  vehicleId: string;
  geofenceId: string;
  type: 'entry' | 'exit' | 'dwell';
  timestamp: string;
  durationS?: number;
}

export interface Trip {
  id: string;
  vehicleId: string;
  driverId: string;
  startedAt: string;
  endedAt?: string;
  startLat: number;
  startLng: number;
  endLat?: number;
  endLng?: number;
  distanceKm: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  idleSeconds: number;
  harshBrakeCount: number;
  harshAccelCount: number;
  fuelConsumedL: number;
  startGeofenceId?: string;
  endGeofenceId?: string;
  status: 'in_progress' | 'completed' | 'cancelled';
}

// ── Drivers ──

export type DutyStatus = 'on_duty' | 'driving' | 'off_duty' | 'sleeper_berth';

export interface Driver {
  id: string;
  userId?: string;
  fullName: string;
  iqamaNo: string;
  iqamaExpiry: string;
  licenseNo: string;
  licenseClass: 'A' | 'B' | 'C' | 'D';
  licenseExpiry: string;
  status: 'available' | 'on_route' | 'on_break' | 'off_duty' | 'suspended';
  depotId: string;
  hireDate: string;
  phone: string;
  photoColor: string;
  rating: number; // 0-5
  totalTrips: number;
  safetyScore: number; // 0-100
  onTimeRate: number; // 0-1
  fuelEfficiencyScore: number; // 0-100
  totalKmThisMonth: number;
  totalHoursThisMonth: number;
  currentVehicleId?: string;
}

export interface HOSLog {
  id: string;
  driverId: string;
  dutyStatus: DutyStatus;
  timestamp: string;
  lat: number;
  lng: number;
  vehicleId?: string;
  notes?: string;
}

export interface HOSViolation {
  id: string;
  driverId: string;
  rule: '11h_driving' | '14h_duty' | '70h_8day' | '30min_break';
  startedAt: string;
  resolvedAt?: string;
  acknowledged: boolean;
}

export interface DVIRReport {
  id: string;
  driverId: string;
  vehicleId: string;
  type: 'pre_trip' | 'post_trip';
  startedAt: string;
  completedAt?: string;
  items: { name: string; status: 'ok' | 'defect'; note?: string }[];
  defects: string;
  photos: string[];
  signedAt?: string;
  odometerKm: number;
}

// ── Dispatch & Jobs ──

export type JobStatus = 'unassigned' | 'planned' | 'assigned' | 'en_route' | 'arrived' | 'delivered' | 'failed' | 'rescheduled' | 'cancelled';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Job {
  id: string;
  ref: string; // human-readable, e.g. JOB-2026-001234
  customerId: string;
  type: 'pickup' | 'delivery' | 'transfer';
  status: JobStatus;
  priority: JobPriority;
  weightKg: number;
  volumeM3: number;
  pieces: number;
  serviceWindowStart: string;
  serviceWindowEnd: string;
  totalDistanceKm?: number;
  totalDurationMin?: number;
  estimatedCostSar?: number;
  assignedVehicleId?: string;
  assignedDriverId?: string;
  routeId?: string;
  notes?: string;
  requiresColdChain: boolean;
  requiresSignature: boolean;
  specialHandling: string[];
  createdAt: string;
  createdBy: string;
  customerReference?: string;
}

export interface Stop {
  id: string;
  jobId: string;
  sequence: number;
  address: string;
  lat: number;
  lng: number;
  contactName?: string;
  contactPhone?: string;
  instructions?: string;
  type: 'pickup' | 'delivery';
  status: 'pending' | 'arrived' | 'completed' | 'failed';
  arrivedAt?: string;
  completedAt?: string;
  exceptionCode?: string;
  exceptionNote?: string;
  podId?: string;
  etaPredicted?: string;
  etaActual?: string;
}

export interface Route {
  id: string;
  vehicleId: string;
  driverId: string;
  jobIds: string[];
  stops: { stopId: string; sequence: number; etaPredicted: string; distanceFromPrevKm: number }[];
  plannedAt: string;
  startedAt?: string;
  endedAt?: string;
  polyline: { lat: number; lng: number }[];
  totalDistanceKm: number;
  totalDurationMin: number;
  optimizationVersion: string;
  algorithm: 'nearest_neighbor' | 'or_tools' | 'rl_optimized' | 'manual';
  costSar: number;
  fuelEstimateL: number;
}

export interface RouteOptimizationRequest {
  vehicleId: string;
  driverId: string;
  stopIds: string[];
  timeWindows: { stopId: string; start: string; end: string }[];
  trafficAware: boolean;
  startDepotId: string;
  endDepotId?: string;
}

export interface RouteOptimizationResult {
  routeId: string;
  orderedStopIds: string[];
  totalDistanceKm: number;
  totalDurationMin: number;
  fuelEstimateL: number;
  costSar: number;
  unassignedStopIds: string[];
  algorithm: Route['algorithm'];
  score: number; // 0-100, higher is better
  trafficFactor: number; // 1.0 = free flow
  improvementPctVsNaive: number;
}

export interface DispatchEvent {
  id: string;
  jobId: string;
  vehicleId?: string;
  driverId?: string;
  type: 'created' | 'assigned' | 'started' | 'arrived' | 'completed' | 'failed' | 'rerouted' | 'cancelled' | 'rescheduled';
  timestamp: string;
  actorId: string;
  payload?: Record<string, unknown>;
}

// ── Safety & Coaching ──

export type SafetyEventType = 'harsh_brake' | 'harsh_accel' | 'lane_departure' | 'tailgating' | 'distraction' | 'fatigue' | 'speeding' | 'phone_use' | 'no_seatbelt';
export type SafetyEventSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SafetyEvent {
  id: string;
  vehicleId: string;
  driverId: string;
  timestamp: string;
  type: SafetyEventType;
  severity: SafetyEventSeverity;
  lat: number;
  lng: number;
  speedKmh: number;
  gForce?: number;
  clipUrl?: string;
  thumbnailUrl?: string;
  durationS: number;
  reviewed: boolean;
}

export interface CoachingSession {
  id: string;
  driverId: string;
  coachId: string;
  safetyEventIds: string[];
  scheduledAt: string;
  completedAt?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes: string;
  actionItems: { description: string; dueAt: string; done: boolean }[];
  signedByDriver: boolean;
}

// ── Maintenance ──

export type WorkOrderType = 'preventive' | 'corrective' | 'predictive' | 'inspection' | 'recall';
export type WorkOrderStatus = 'open' | 'scheduled' | 'in_progress' | 'awaiting_parts' | 'completed' | 'cancelled';
export type WorkOrderPriority = 'low' | 'normal' | 'high' | 'critical';

export interface WorkOrder {
  id: string;
  vehicleId: string;
  type: WorkOrderType;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  title: string;
  description: string;
  openedAt: string;
  scheduledFor?: string;
  startedAt?: string;
  completedAt?: string;
  closedAt?: string;
  technicianId?: string;
  mileageKm: number;
  engineHours: number;
  laborHours: number;
  laborCostSar: number;
  partsCostSar: number;
  totalCostSar: number;
  parts: { partId: string; name: string; qty: number; unitCostSar: number }[];
  rootCause?: string;
  relatedSafetyEventId?: string;
  relatedPredictionId?: string;
}

export interface MaintenanceRule {
  id: string;
  vehicleType: VehicleType;
  component: 'engine_oil' | 'oil_filter' | 'air_filter' | 'brake_pads' | 'tires' | 'battery' | 'coolant' | 'transmission' | 'spark_plugs' | 'timing_belt';
  triggerType: 'odometer_km' | 'engine_hours' | 'calendar_days' | 'predictive_rul';
  triggerValue: number;
  lastDoneAt: string;
  lastDoneMileageKm: number;
  nextDueAt: string;
  nextDueMileageKm: number;
  costEstimateSar: number;
}

export interface Part {
  id: string;
  sku: string;
  name: string;
  category: string;
  stockQty: number;
  reorderLevel: number;
  unitCostSar: number;
  supplier: string;
  leadTimeDays: number;
}

// ── Fuel ──

export type FuelEventSource = 'card' | 'manual' | 'sensor' | 'estimated';

export interface FuelEvent {
  id: string;
  vehicleId: string;
  driverId?: string;
  timestamp: string;
  liters: number;
  costSar: number;
  pricePerLiter: number;
  stationName: string;
  stationBrand: string;
  odometerKm: number;
  source: FuelEventSource;
  cardNumber?: string;
  cardProvider?: string;
  gpsLat: number;
  gpsLng: number;
  kmSinceLastFill: number;
  consumptionLPer100km: number;
  isAnomaly: boolean;
  anomalyFlags: string[];
}

export interface FuelCard {
  id: string;
  vehicleId: string;
  cardNumber: string;
  provider: 'naft' | 'aldrees' | 'taziz' | 'sahel';
  status: 'active' | 'suspended' | 'expired';
  dailyLimitSar: number;
  monthlyLimitSar: number;
  allowedStationIds: string[];
}

export interface FuelAnomalyRule {
  type: 'over_capacity' | 'rapid_refuel' | 'out_of_route' | 'off_hours' | 'price_deviation' | 'mileage_inconsistency';
  description: string;
  weight: number;
}

// ── Compliance ──

export type ComplianceDocType = 'license' | 'registration' | 'insurance' | 'permit' | 'iqama' | 'medical_certificate' | 'hazmat' | 'commercial_permit';
export type ComplianceDocStatus = 'valid' | 'expiring_soon' | 'expired' | 'missing' | 'pending_review';

export interface ComplianceDocument {
  id: string;
  type: ComplianceDocType;
  ownerType: 'vehicle' | 'driver' | 'company';
  ownerId: string;
  documentNumber: string;
  issuedBy: string;
  issuedAt: string;
  expiresAt: string;
  status: ComplianceDocStatus;
  fileUrl: string;
  uploadedAt: string;
  uploadedBy: string;
  notes?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: FleetRole;
  action: string;
  resource: string;
  resourceId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip: string;
  userAgent: string;
  severity: 'info' | 'warning' | 'critical';
}

// ── Delivery & POD ──

export interface POD {
  id: string;
  stopId: string;
  jobId: string;
  signatureDataUrl?: string;
  photoUrls: string[];
  recipientName: string;
  recipientIdType?: 'national_id' | 'iqama' | 'passport' | 'none';
  recipientIdNumber?: string;
  notes?: string;
  capturedAt: string;
  gpsLat: number;
  gpsLng: number;
  deviceId: string;
  appVersion: string;
  failureReason?: string;
}

export interface DeliveryException {
  id: string;
  stopId: string;
  jobId: string;
  code: 'customer_not_available' | 'wrong_address' | 'damaged' | 'refused' | 'partial_delivery' | 'access_denied' | 'other';
  note: string;
  photos: string[];
  reportedAt: string;
  reportedBy: string;
  resolvedAt?: string;
  resolution?: 'rescheduled' | 'cancelled' | 'returned_to_depot' | 'delivered_late';
  resolutionNote?: string;
}

// ── Customer Portal ──

export type CustomerTier = 'standard' | 'silver' | 'gold' | 'platinum';

export interface Customer {
  id: string;
  name: string;
  type: 'b2b' | 'b2c';
  tier: CustomerTier;
  vatNumber?: string;
  crNumber?: string;
  billingEmail: string;
  billingAddress: string;
  primaryContactName: string;
  primaryContactPhone: string;
  paymentTermsDays: number;
  creditLimitSar: number;
  outstandingSar: number;
  lifetimeValueSar: number;
  totalShipments: number;
  onTimeRate: number;
  satisfactionScore: number; // 0-5
  joinedAt: string;
  status: 'active' | 'suspended' | 'inactive';
}

export interface Shipment {
  id: string;
  ref: string; // public-facing tracking number
  customerId: string;
  jobId: string;
  origin: { address: string; lat: number; lng: number; name?: string };
  destination: { address: string; lat: number; lng: number; name?: string };
  status: JobStatus;
  weightKg: number;
  pieces: number;
  serviceType: 'standard' | 'express' | 'same_day' | 'scheduled';
  bookedAt: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  etaPromised: string;
  etaPredicted: string;
  podId?: string;
  currentVehicleId?: string;
  currentDriverId?: string;
  currentLat?: number;
  currentLng?: number;
  specialInstructions?: string;
}

export interface CustomerNotification {
  id: string;
  customerId: string;
  shipmentId?: string;
  type: 'booked' | 'picked_up' | 'on_the_way' | 'arriving' | 'delivered' | 'exception' | 'delayed';
  channel: 'sms' | 'email' | 'whatsapp' | 'push';
  recipient: string;
  message: string;
  sentAt: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  costSar: number;
}

// ── Warehouse ──

export interface Warehouse {
  id: string;
  name: string;
  type: 'main' | 'cross_dock' | 'satellite';
  address: string;
  lat: number;
  lng: number;
  totalCapacityM3: number;
  usedCapacityM3: number;
  zonesCount: number;
  staffCount: number;
  operatingHours: string;
}

export interface InventoryItem {
  id: string;
  warehouseId: string;
  sku: string;
  name: string;
  category: string;
  qty: number;
  reservedQty: number;
  availableQty: number;
  binLocation: string;
  unitWeightKg: number;
  unitVolumeM3: number;
  unitValueSar: number;
  rfidTag?: string;
  barcode: string;
  requiresColdChain: boolean;
  lastCountedAt: string;
  expiryDate?: string;
  status: 'in_stock' | 'low' | 'out' | 'reserved' | 'in_transit';
}

export interface PickList {
  id: string;
  jobId: string;
  warehouseId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  items: { sku: string; name: string; qty: number; binLocation: string; picked: boolean }[];
  createdAt: string;
  completedAt?: string;
  totalPicks: number;
  picksCompleted: number;
}

export interface LoadPlan {
  id: string;
  vehicleId: string;
  routeId: string;
  jobIds: string[];
  totalWeightKg: number;
  totalVolumeM3: number;
  utilizationPct: number;
  manifest: { jobId: string; ref: string; weightKg: number; volumeM3: number; pieces: number; sequence: number }[];
  createdAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  loadingBayId?: string;
}

// ── Alerts & Exceptions ──

export type AlertSeverity = 'info' | 'warning' | 'high' | 'critical';
export type AlertStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed';

export interface Alert {
  id: string;
  timestamp: string;
  type: string;
  category: 'fleet' | 'driver' | 'maintenance' | 'fuel' | 'compliance' | 'customer' | 'safety' | 'system';
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  resourceType: string;
  resourceId: string;
  assignedTo?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  slaBreached: boolean;
}

// ── Driver Safety Scorecard (computed) ──

export interface DriverSafetyScorecard {
  driverId: string;
  periodStart: string;
  periodEnd: string;
  overallScore: number; // 0-100
  components: {
    harshBrake: number;
    harshAccel: number;
    speeding: number;
    distraction: number;
    fatigue: number;
    seatbelt: number;
    onTimeDelivery: number;
    fuelEfficiency: number;
  };
  totalEvents: number;
  criticalEvents: number;
  coachingSessionsCompleted: number;
  trend: 'improving' | 'stable' | 'declining';
}
