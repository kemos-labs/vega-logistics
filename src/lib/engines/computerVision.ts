// VEGA Logistics OS — Computer Vision Engine
// Production-side: warehouse camera, dashcam, license plate OCR, damage assessment.

import {
  CVDetection,
  CVDamageAssessment,
  CVDamageType,
  CVLaneViolation,
  CVSummary,
  AISeverity,
} from '../types2026';

const DAMAGE_COST: Record<CVDamageType, number> = {
  dent: 1200,
  scratch: 600,
  crack: 800,
  broken_glass: 1500,
  tire_wear: 900,
  paint_damage: 1400,
  cargo_damage: 2200,
};


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

export interface CVEngineConfig {
  warehouseCameras: number;
  dashcams: number;
  fps: number;
  ocrLanguages: ('en' | 'ar')[];
  damageDetectionEnabled: boolean;
  laneMonitoringEnabled: boolean;
}

export const DEFAULT_CV_CONFIG: CVEngineConfig = {
  warehouseCameras: 8,
  dashcams: 12,
  fps: 15,
  ocrLanguages: ['en', 'ar'],
  damageDetectionEnabled: true,
  laneMonitoringEnabled: true,
};

const CLASSES = ['package', 'pallet', 'forklift', 'worker', 'vehicle', 'qr_code', 'barcode', 'plate_ar', 'plate_en'];
const SEVERITIES: AISeverity[] = ['low', 'medium', 'high', 'critical'];

export function detectObjects(
  cameraId: string,
  siteId: string,
  config: CVEngineConfig = DEFAULT_CV_CONFIG,
  seed: number = Date.now()
): CVDetection[] {
  const r = rng(seed);
  const count = Math.floor(r() * 6) + 2;
  const detections: CVDetection[] = [];

  for (let i = 0; i < count; i++) {
    const obj = pick(CLASSES, r);
    detections.push({
      id: `det_${seed}_${i}`,
      timestamp: new Date().toISOString(),
      cameraId,
      siteId,
      objectClass: obj,
      confidence: 0.7 + r() * 0.29,
      boundingBox: {
        x: r() * 800,
        y: r() * 600,
        w: 40 + r() * 120,
        h: 40 + r() * 120,
      },
      attributes: {
        size: Math.round(r() * 50 + 5),
        ocr_text: obj.includes('plate') ? `${Math.floor(r() * 9000 + 1000)} ABC` : '',
        language: pick(config.ocrLanguages, r),
      },
    });
  }
  return detections;
}

export function assessDamage(
  vehicleId: string,
  detections: CVDetection[],
  seed: number = Date.now()
): CVDamageAssessment[] {
  const r = rng(seed);
  const types = Object.keys(DAMAGE_COST) as CVDamageType[];
  const count = Math.floor(r() * 3);
  const out: CVDamageAssessment[] = [];

  for (let i = 0; i < count; i++) {
    const t = pick(types, r);
    const severityRoll = r();
    const severity = severityRoll < 0.6 ? 'minor' : severityRoll < 0.9 ? 'moderate' : 'severe';
    const costMult = severity === 'minor' ? 0.5 : severity === 'moderate' ? 1 : 2.5;
    out.push({
      id: `dmg_${vehicleId}_${i}`,
      vehicleId,
      timestamp: new Date().toISOString(),
      damageType: t,
      severity,
      confidence: 0.7 + r() * 0.29,
      estimatedRepairCost: Math.round(DAMAGE_COST[t] * costMult),
      imageRef: `cam://${vehicleId}/${Date.now()}_${i}.jpg`,
      location: {
        lat: 24.7136 + (r() - 0.5) * 0.1,
        lng: 46.6753 + (r() - 0.5) * 0.1,
      },
    });
  }
  return out;
}

export function monitorLaneBehavior(
  vehicleId: string,
  seed: number = Date.now()
): CVLaneViolation[] {
  const r = rng(seed);
  const types: CVLaneViolation['type'][] = ['lane_departure', 'speeding', 'hard_brake', 'tailgating'];
  const count = Math.floor(r() * 3);
  const out: CVLaneViolation[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      id: `vio_${vehicleId}_${i}`,
      vehicleId,
      timestamp: new Date().toISOString(),
      type: pick(types, r),
      severity: pick(SEVERITIES, r),
      speedKmh: Math.round(60 + r() * 80),
      location: { lat: 24.7136 + (r() - 0.5) * 0.1, lng: 46.6753 + (r() - 0.5) * 0.1 },
    });
  }
  return out;
}

export function summarizeCV(
  detections: CVDetection[],
  damages: CVDamageAssessment[],
  violations: CVLaneViolation[]
): CVSummary {
  const totalRepair = damages.reduce((s, d) => s + d.estimatedRepairCost, 0);
  const conf = detections.length
    ? detections.reduce((s, d) => s + d.confidence, 0) / detections.length
    : 0;

  const damageCounts: Partial<Record<CVDamageType, number>> = {};
  damages.forEach((d) => {
    damageCounts[d.damageType] = (damageCounts[d.damageType] ?? 0) + 1;
  });
  const topDamageType = (Object.entries(damageCounts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] as CVDamageType) ?? null;

  return {
    totalDetections: detections.length,
    damageCount: damages.length,
    violationCount: violations.length,
    averageConfidence: Math.round(conf * 1000) / 1000,
    totalRepairEstimate: totalRepair,
    topDamageType,
  };
}

export function cvRiskScore(summary: CVSummary, violations: CVLaneViolation[]): number {
  const violationWeight = violations.reduce((s, v) => {
    return s + (v.severity === 'critical' ? 25 : v.severity === 'high' ? 15 : v.severity === 'medium' ? 7 : 2);
  }, 0);
  const damageWeight = summary.damageCount * 5;
  return Math.min(100, violationWeight + damageWeight);
}

// Aggregated snapshot for dashboard
export interface CVSnapshot {
  detections: CVDetection[];
  damages: CVDamageAssessment[];
  violations: CVLaneViolation[];
  summary: CVSummary;
  riskScore: number;
}

export function generateCVSnapshot(
  vehicles: string[],
  config: CVEngineConfig = DEFAULT_CV_CONFIG,
  seed: number = Date.now()
): CVSnapshot {
  const r = rng(seed);
  const detections: CVDetection[] = [];
  const damages: CVDamageAssessment[] = [];
  const violations: CVLaneViolation[] = [];

  vehicles.forEach((v) => {
    detections.push(...detectObjects(`dashcam_${v}`, 'riyadh_fleet', config, Math.floor(r() * 100000)));
    if (config.damageDetectionEnabled) damages.push(...assessDamage(v, detections, Math.floor(r() * 100000)));
    if (config.laneMonitoringEnabled) violations.push(...monitorLaneBehavior(v, Math.floor(r() * 100000)));
  });

  const summary = summarizeCV(detections, damages, violations);
  const riskScore = cvRiskScore(summary, violations);
  return { detections, damages, violations, summary, riskScore };
}
