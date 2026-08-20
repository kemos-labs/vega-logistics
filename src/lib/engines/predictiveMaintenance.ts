// VEGA Logistics OS — Predictive Maintenance Engine
// RUL (remaining useful life) prediction from telemetry + failure probability by component.

import {
  AssetHealth,
  AssetHealthRecord,
  MaintenancePrediction,
  MaintenanceSchedule,
  TelemetrySample,
  AISeverity,
} from '../types2026';

const COMPONENTS: MaintenancePrediction['component'][] = [
  'engine', 'brakes', 'tires', 'battery', 'transmission', 'cooling',
];

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function generateTelemetry(vehicleId: string, hoursBack: number = 24, seed: number = Date.now()): TelemetrySample[] {
  const r = rng(seed);
  const samples: TelemetrySample[] = [];
  const now = Date.now();
  for (let h = hoursBack; h >= 0; h--) {
    const ts = new Date(now - h * 3600 * 1000).toISOString();
    samples.push({
      vehicleId,
      timestamp: ts,
      odometerKm: 80000 + (hoursBack - h) * 40 + r() * 5,
      engineTempC: 88 + r() * 12,
      oilPressureKpa: 380 - r() * 40,
      batteryVoltage: 12.4 + r() * 1.2,
      fuelLevelPct: Math.max(5, 95 - h * 3.5 - r() * 5),
      tirePressurePsi: 32 + r() * 4,
      brakePadMm: 8 - (hoursBack - h) * 0.01 + r() * 0.2,
      vibrationG: 0.4 + r() * 0.6,
      rpm: 1500 + r() * 1500,
      dtcCodes: r() > 0.95 ? [`P${Math.floor(r() * 500)}`] : [],
    });
  }
  return samples;
}

export function predictComponentFailure(
  vehicleId: string,
  telemetry: TelemetrySample[],
  component: MaintenancePrediction['component'],
  seed: number = Date.now()
): MaintenancePrediction {
  const r = rng(seed + vehicleId.charCodeAt(0));
  const latest = telemetry[telemetry.length - 1];

  let prob30 = 0.02;
  let prob90 = 0.05;
  let cost = 500;
  let action = 'Routine inspection recommended.';
  let rul: number | undefined;

  switch (component) {
    case 'engine': {
      const tempStress = Math.max(0, latest.engineTempC - 95) / 10;
      const vibStress = latest.vibrationG / 2;
      prob30 = Math.min(0.6, 0.02 + tempStress * 0.15 + vibStress * 0.08);
      prob90 = Math.min(0.95, prob30 + 0.15);
      cost = 3500 + Math.floor(r() * 2500);
      action = prob30 > 0.3 ? 'Schedule engine diagnostic within 7 days.' : 'Continue routine oil change schedule.';
      rul = Math.max(2000, 50000 * (1 - prob90));
      break;
    }
    case 'brakes': {
      const padWear = Math.max(0, 8 - latest.brakePadMm) / 8;
      prob30 = Math.min(0.7, 0.05 + padWear * 0.6);
      prob90 = Math.min(0.98, prob30 + 0.2);
      cost = 800 + Math.floor(r() * 600);
      action = prob30 > 0.4 ? 'Replace brake pads within 2 weeks.' : 'Monitor pad thickness.';
      rul = Math.max(1000, 30000 * (1 - prob90));
      break;
    }
    case 'tires': {
      const pressureDeviation = Math.abs(latest.tirePressurePsi - 32) / 32;
      prob30 = Math.min(0.5, 0.03 + pressureDeviation * 0.4);
      prob90 = Math.min(0.9, prob30 + 0.18);
      cost = 1500 + Math.floor(r() * 800);
      action = prob30 > 0.25 ? 'Rotate and balance tires; check alignment.' : 'Maintain pressure checks.';
      rul = Math.max(3000, 60000 * (1 - prob90));
      break;
    }
    case 'battery': {
      const voltageIssue = latest.batteryVoltage < 12.2;
      prob30 = voltageIssue ? 0.35 : 0.05;
      prob90 = voltageIssue ? 0.7 : 0.18;
      cost = 600 + Math.floor(r() * 300);
      action = voltageIssue ? 'Battery load test recommended.' : 'Battery healthy.';
      rul = Math.max(500, 24000 * (1 - prob90));
      break;
    }
    case 'transmission': {
      const rpmStress = latest.rpm / 3000;
      prob30 = Math.min(0.4, 0.02 + rpmStress * 0.2);
      prob90 = Math.min(0.85, prob30 + 0.15);
      cost = 2500 + Math.floor(r() * 1500);
      action = 'Continue transmission fluid checks every 30k km.';
      rul = Math.max(5000, 80000 * (1 - prob90));
      break;
    }
    case 'cooling': {
      const tempHigh = latest.engineTempC > 100;
      prob30 = tempHigh ? 0.25 : 0.04;
      prob90 = tempHigh ? 0.55 : 0.15;
      cost = 900 + Math.floor(r() * 600);
      action = tempHigh ? 'Inspect cooling system; check coolant level.' : 'Routine coolant check.';
      rul = Math.max(2000, 40000 * (1 - prob90));
      break;
    }
  }

  const priority: AISeverity =
    prob30 > 0.5 ? 'critical' : prob30 > 0.3 ? 'high' : prob30 > 0.15 ? 'medium' : 'low';

  const predictedDate = new Date(Date.now() + 30 * prob30 * 24 * 3600 * 1000).toISOString();

  return {
    id: `pred_${vehicleId}_${component}_${Date.now()}`,
    vehicleId,
    component,
    failureProbability30d: Math.round(prob30 * 1000) / 1000,
    failureProbability90d: Math.round(prob90 * 1000) / 1000,
    predictedFailureDate: predictedDate,
    remainingUsefulLifeKm: Math.round(rul ?? 0),
    recommendedAction: action,
    estimatedCost: cost,
    priority,
    confidence: 0.7 + r() * 0.25,
  };
}

export function predictAllComponents(vehicleId: string, telemetry: TelemetrySample[]): MaintenancePrediction[] {
  return COMPONENTS.map((c) => predictComponentFailure(vehicleId, telemetry, c));
}

export function calculateAssetHealth(
  vehicleId: string,
  predictions: MaintenancePrediction[]
): AssetHealthRecord {
  const totalCost = predictions.reduce((s, p) => s + p.estimatedCost, 0);
  const max30 = Math.max(...predictions.map((p) => p.failureProbability30d));
  const max90 = Math.max(...predictions.map((p) => p.failureProbability90d));

  const healthScore = Math.max(0, Math.round(100 - max30 * 60 - max90 * 30));
  const health: AssetHealth =
    healthScore > 80 ? 'healthy' : healthScore > 60 ? 'degraded' : healthScore > 30 ? 'at_risk' : 'failed';

  return {
    vehicleId,
    health,
    healthScore,
    mtbfDays: Math.round(60 + (1 - max30) * 180),
    lastServiceDate: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    totalMaintenanceCost: totalCost,
    openPredictions: predictions.filter((p) => p.priority === 'high' || p.priority === 'critical').length,
  };
}

export function scheduleMaintenance(
  predictions: MaintenancePrediction[]
): MaintenanceSchedule[] {
  return predictions
    .filter((p) => p.priority === 'high' || p.priority === 'critical')
    .map((p) => {
      const days = Math.max(1, Math.round(30 * (1 - p.failureProbability30d)));
      return {
        vehicleId: p.vehicleId,
        serviceType: 'predictive' as const,
        scheduledDate: new Date(Date.now() + days * 24 * 3600 * 1000).toISOString(),
        estimatedDuration: p.component === 'engine' || p.component === 'transmission' ? 6 : 2,
        estimatedCost: p.estimatedCost,
        reason: `${p.component}: ${(p.failureProbability30d * 100).toFixed(0)}% failure risk in 30d — ${p.recommendedAction}`,
        priority: p.priority,
      };
    })
    .sort((a, b) => {
      const order: Record<AISeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    });
}

export interface FleetMaintenanceOverview {
  assets: AssetHealthRecord[];
  predictions: MaintenancePrediction[];
  schedule: MaintenanceSchedule[];
  totalEstimatedCost: number;
  criticalCount: number;
  highCount: number;
  avgHealthScore: number;
}

export function generateFleetOverview(vehicleIds: string[], seed: number = Date.now()): FleetMaintenanceOverview {
  const assets: AssetHealthRecord[] = [];
  const predictions: MaintenancePrediction[] = [];
  const schedule: MaintenanceSchedule[] = [];

  vehicleIds.forEach((vid, i) => {
    const telemetry = generateTelemetry(vid, 24, seed + i * 7);
    const preds = predictAllComponents(vid, telemetry);
    predictions.push(...preds);
    assets.push(calculateAssetHealth(vid, preds));
    schedule.push(...scheduleMaintenance(preds));
  });

  return {
    assets,
    predictions,
    schedule,
    totalEstimatedCost: schedule.reduce((s, m) => s + m.estimatedCost, 0),
    criticalCount: predictions.filter((p) => p.priority === 'critical').length,
    highCount: predictions.filter((p) => p.priority === 'high').length,
    avgHealthScore: Math.round(assets.reduce((s, a) => s + a.healthScore, 0) / Math.max(1, assets.length)),
  };
}
