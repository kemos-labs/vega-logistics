// VEGA Logistics OS — Dispatch Engine
// Route optimization: nearest-neighbor with traffic awareness, time windows, ETA prediction.

import { Stop, Job, Vehicle, Driver, RouteOptimizationResult, RouteOptimizationRequest } from '../types2026';

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function timeWindowScore(arrivalS: number, tw: { start: string; end: string } | undefined): number {
  if (!tw) return 0;
  const start = Date.parse(tw.start) / 1000;
  const end = Date.parse(tw.end) / 1000;
  if (arrivalS < start) return -(start - arrivalS) / 60; // wait penalty
  if (arrivalS > end) return -(arrivalS - end) / 60 * 2; // late penalty worse
  return 0;
}

export function optimizeRoute(
  request: RouteOptimizationRequest,
  stops: Stop[],
  vehicle: Vehicle,
  trafficFactor: number = 1.0,
  seed: number = Date.now()
): RouteOptimizationResult {
  const r = rng(seed);
  const candidateStops = stops.filter((s) => request.stopIds.includes(s.id));
  if (candidateStops.length === 0) {
    return {
      routeId: '',
      orderedStopIds: [],
      totalDistanceKm: 0,
      totalDurationMin: 0,
      fuelEstimateL: 0,
      costSar: 0,
      unassignedStopIds: [],
      algorithm: 'nearest_neighbor',
      score: 0,
      trafficFactor,
      improvementPctVsNaive: 0,
    };
  }

  // Nearest-neighbor TSP with time window awareness
  const remaining = [...candidateStops];
  const ordered: Stop[] = [];
  let current = { lat: 24.7136, lng: 46.6753 }; // depot
  let totalDist = 0;
  let totalDur = 0;
  const now = Date.now() / 1000;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestCost = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const stop = remaining[i];
      const dist = haversineKm(current, stop);
      const tw = request.timeWindows.find((tw) => tw.stopId === stop.id);
      const eta = now + (totalDist / 30) * 3600 + (dist / 30) * 3600;
      const twPenalty = timeWindowScore(eta, tw);
      const cost = dist * 1.0 + twPenalty * 0.01;
      if (cost < bestCost) {
        bestCost = cost;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    const d = haversineKm(current, next);
    totalDist += d;
    totalDur += (d / 30) * 60 * trafficFactor + 5; // 5 min service time
    current = next;
    ordered.push(next);
  }

  // Return to depot
  const returnDist = haversineKm(current, { lat: 24.7136, lng: 46.6753 });
  totalDist += returnDist;
  totalDur += (returnDist / 30) * 60 * trafficFactor;

  // Fuel estimate: 10L/100km baseline
  const fuelL = (totalDist * 10) / 100;
  const costSar = fuelL * 2.18 + 50; // base + per-km

  // Naive baseline (random order) for comparison
  const naive = [...candidateStops].sort(() => r() - 0.5);
  let naiveDist = haversineKm({ lat: 24.7136, lng: 46.6753 }, naive[0]);
  for (let i = 1; i < naive.length; i++) {
    naiveDist += haversineKm(naive[i - 1], naive[i]);
  }
  naiveDist += haversineKm(naive[naive.length - 1], { lat: 24.7136, lng: 46.6753 });
  const improvementPct = naiveDist > 0 ? Math.round(((naiveDist - totalDist) / naiveDist) * 1000) / 10 : 0;

  const score = Math.max(0, 100 - Math.abs(improvementPct) * 2 - (totalDur / 60) * 1.5);

  return {
    routeId: `RTE-${Date.now().toString(36).toUpperCase()}`,
    orderedStopIds: ordered.map((s) => s.id),
    totalDistanceKm: Math.round(totalDist * 10) / 10,
    totalDurationMin: Math.round(totalDur),
    fuelEstimateL: Math.round(fuelL * 10) / 10,
    costSar: Math.round(costSar),
    unassignedStopIds: [],
    algorithm: 'nearest_neighbor',
    score: Math.round(score),
    trafficFactor: Math.round(trafficFactor * 100) / 100,
    improvementPctVsNaive: improvementPct,
  };
}

export function predictETA(
  vehicle: Vehicle,
  stopLat: number,
  stopLng: number,
  trafficFactor: number = 1.0
): { etaMin: number; distanceKm: number; confidence: number } {
  const dist = haversineKm({ lat: vehicle.lat, lng: vehicle.lng }, { lat: stopLat, lng: stopLng });
  const speed = Math.max(20, vehicle.speedKmh || 40);
  const etaMin = (dist / speed) * 60 * trafficFactor;
  return {
    etaMin: Math.round(etaMin),
    distanceKm: Math.round(dist * 10) / 10,
    confidence: vehicle.status === 'moving' ? 0.85 : 0.65,
  };
}

export function assignJobToDriver(
  job: Job,
  candidates: { vehicle: Vehicle; driver: Driver }[],
  jobLocation: { lat: number; lng: number }
): { vehicle: Vehicle; driver: Driver; score: number; reason: string }[] {
  return candidates
    .map(({ vehicle, driver }) => {
      const dist = haversineKm({ lat: vehicle.lat, lng: vehicle.lng }, jobLocation);
      const workloadPenalty = driver.totalHoursThisMonth / 200; // 0-1
      const score = Math.max(0, 100 - dist * 0.5 - workloadPenalty * 30 + driver.safetyScore * 0.2);
      const reason = `${dist.toFixed(1)} km away · ${driver.totalHoursThisMonth}h this month · safety ${driver.safetyScore}`;
      return { vehicle, driver, score: Math.round(score), reason };
    })
    .sort((a, b) => b.score - a.score);
}

export interface DispatchBoard {
  unassigned: Job[];
  planned: Job[];
  inProgress: Job[];
  delivered: Job[];
  failed: Job[];
}

export function buildDispatchBoard(jobs: Job[]): DispatchBoard {
  return {
    unassigned: jobs.filter((j) => j.status === 'unassigned'),
    planned: jobs.filter((j) => j.status === 'planned'),
    inProgress: jobs.filter((j) => ['assigned', 'en_route', 'arrived'].includes(j.status)),
    delivered: jobs.filter((j) => j.status === 'delivered'),
    failed: jobs.filter((j) => j.status === 'failed'),
  };
}
