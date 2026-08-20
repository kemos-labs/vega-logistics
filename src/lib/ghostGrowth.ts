// VEGA Logistics OS — Ghost Growth Detection Engine
// "Operational density > fleet size"

import { GhostGrowthMetrics, GhostGrowthResult, GhostGrowthLevel } from './types';

// Seeded pseudo-random generator (deterministic per seed)
function seededRandom(seed: number): () => number {
  let s = Math.abs(Math.round(seed * 1000)) || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Calculate the Ghost Growth Index (0-100).
 *
 * Ghost Growth = revenue grows but operational health declines.
 * Hidden cost inflation masked by volume growth.
 *
 * Formula weights:
 * - Revenue Growth vs Margin Decay = 30%
 * - Fleet Growth vs Shipment Density = 25%
 * - Fuel Cost Growth = 15%
 * - Failed Delivery Growth = 15%
 * - Fleet Utilization = 15%
 */
export function calculateGhostGrowthIndex(metrics: GhostGrowthMetrics, fleetUtilization: number): GhostGrowthResult {
  let score = 0;

  // 1. Revenue-Margin Divergence (30 pts)
  // Ghost growth: revenue up but margin down
  const marginRevenueGap = metrics.revenueGrowth - (-metrics.marginDecay);
  if (marginRevenueGap > 0 && metrics.marginDecay < 0) {
    // Revenue growing but margin decaying = classic ghost growth
    score += Math.min(Math.abs(marginRevenueGap) * 3, 30);
  } else if (marginRevenueGap < 0) {
    score += Math.max(0, 15 + marginRevenueGap);
  } else {
    score += 8;
  }

  // 2. Fleet-Density Imbalance (25 pts)
  // Adding vehicles without improving density
  const densityEfficiency = metrics.shipmentDensity / Math.max(metrics.fleetGrowthRate * 100, 1);
  if (densityEfficiency < 1 && metrics.fleetGrowthRate > 2) {
    score += Math.min((1 - densityEfficiency) * 25, 25);
  } else if (metrics.fleetGrowthRate > 5) {
    score += 10;
  }

  // 3. Fuel Cost Escalation (15 pts)
  if (metrics.fuelCostGrowth > 3) {
    score += Math.min(metrics.fuelCostGrowth * 1.5, 15);
  }

  // 4. Failed Delivery Escalation (15 pts)
  if (metrics.failedDeliveryGrowth > 5) {
    score += Math.min(metrics.failedDeliveryGrowth, 15);
  }

  // 5. Fleet Utilization Penalty (15 pts)
  if (fleetUtilization < 60) {
    score += Math.min((60 - fleetUtilization) * 0.375, 15);
  } else if (fleetUtilization > 85) {
    score += Math.min((fleetUtilization - 85) * 0.3, 5); // over-utilization risk
  }

  // Cap at 100
  score = Math.min(Math.max(Math.round(score), 0), 100);

  // Determine level
  let level: GhostGrowthLevel;
  if (score <= 25) level = 'Safe';
  else if (score <= 50) level = 'Warning';
  else if (score <= 75) level = 'Critical';
  else level = 'Collapse';

  // Generate AI-style explanation
  const explanation = generateExplanation(level, metrics, fleetUtilization, score);

  // Generate recommendations
  const recommendations = generateRecommendations(level, metrics, fleetUtilization);

  // Generate mock history
  const history = generateHistory(score);

  return {
    index: score,
    level,
    metrics,
    explanation,
    recommendations,
    history,
  };
}

function generateExplanation(
  level: GhostGrowthLevel,
  m: GhostGrowthMetrics,
  utilization: number,
  score: number
): string {
  const parts: string[] = [];

  if (m.revenueGrowth > 5 && m.marginDecay < -1) {
    parts.push(
      `Revenue grew ${m.revenueGrowth.toFixed(1)}% but margins declined ${Math.abs(m.marginDecay).toFixed(1)}% — classic Ghost Growth pattern.`
    );
  }

  if (m.fleetGrowthRate > 3 && m.shipmentDensity < 15) {
    parts.push(
      `Fleet expanded ${m.fleetGrowthRate.toFixed(1)}% while shipment density remains low at ${m.shipmentDensity.toFixed(1)} shipments/km².`
    );
  }

  if (m.fuelCostGrowth > 3) {
    parts.push(`Fuel costs rising ${m.fuelCostGrowth.toFixed(1)}% — eroding operational margins.`);
  }

  if (m.failedDeliveryGrowth > 5) {
    parts.push(
      `Failed deliveries increasing ${m.failedDeliveryGrowth.toFixed(1)}% — service quality and cost risk.`
    );
  }

  if (utilization < 60) {
    parts.push(`Fleet utilization at ${utilization.toFixed(0)}% — vehicles are underutilized.`);
  }

  if (parts.length === 0) {
    return `Ghost Growth Index at ${score} — operations are in healthy balance. Revenue growth is supported by real operational density.`;
  }

  return parts.join(' ');
}

function generateRecommendations(
  level: GhostGrowthLevel,
  m: GhostGrowthMetrics,
  utilization: number
): string[] {
  const recs: string[] = [];

  if (level === 'Safe') {
    recs.push('Maintain current operational density strategy.');
    recs.push('Monitor fuel costs and failed delivery rates weekly.');
    return recs;
  }

  if (level === 'Warning') {
    recs.push('Freeze fleet expansion until utilization exceeds 70%.');
    recs.push('Audit cost per shipment trends over last 4 weeks.');
    recs.push('Review zone density — consolidate low-density routes.');
  }

  if (level === 'Critical') {
    recs.push('⚠ Immediate fleet expansion freeze.');
    recs.push('Reduce vehicle count in low-density zones by 15-20%.');
    recs.push('Implement mandatory route optimization within 7 days.');
    recs.push('Review driver productivity — terminate underperforming contracts.');
    recs.push('Negotiate fuel contracts or switch to fuel-efficient routing.');
  }

  if (level === 'Collapse') {
    recs.push('🚨 EMERGENCY: Operational collapse risk detected.');
    recs.push('Cut fleet by 25-30% immediately.');
    recs.push('Consolidate all operations to top 3 highest-density zones.');
    recs.push('Pause all non-essential spending for 30 days.');
    recs.push('Initiate emergency liquidity preservation protocol.');
    recs.push('Contact financial advisor — bankruptcy probability elevated.');
  }

  if (m.fuelCostGrowth > 3) {
    recs.push('Fuel cost escalation: switch to fuel-efficient routing and bulk purchasing.');
  }

  if (m.failedDeliveryGrowth > 5) {
    recs.push('Failed delivery spike: audit driver performance and zone assignments.');
  }

  if (utilization < 60) {
    recs.push(`Low fleet utilization (${utilization.toFixed(0)}%): reduce idle vehicles or increase shipment volume per vehicle.`);
  }

  return recs;
}

function generateHistory(currentScore: number): { date: string; index: number }[] {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const history: { date: string; index: number }[] = [];
  const rng = seededRandom(currentScore);

  for (let i = months.length - 1; i >= 0; i--) {
    const base = currentScore - (rng() * 15 - 5) * (months.length - i);
    history.push({
      date: months[i],
      index: Math.min(Math.max(Math.round(base), 0), 100),
    });
  }

  // Ensure current month matches
  history[history.length - 1].index = currentScore;
  return history;
}
