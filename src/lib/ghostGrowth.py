# VEGA Logistics OS — Ghost Growth Detection Engine (Python version for testing)
# "Operational density > fleet size"

import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.types import GhostGrowthMetrics, GhostGrowthResult, GhostGrowthLevel


def seeded_random(seed: int):
    """Seeded pseudo-random generator (deterministic per seed)."""
    s = max(1, abs(round(seed * 1000)))
    def random():
        nonlocal s
        s = (s * 9301 + 49297) % 233280
        return s / 233280
    return random


def calculateGhostGrowthIndex(metrics: GhostGrowthMetrics, fleet_utilization: float) -> GhostGrowthResult:
    """
    Calculate the Ghost Growth Index (0-100).
    
    Ghost Growth = revenue grows but operational health declines.
    Hidden cost inflation masked by volume growth.
    
    Formula weights:
    - Revenue Growth vs Margin Decay = 30%
    - Fleet Growth vs Shipment Density = 25%
    - Fuel Cost Growth = 15%
    - Failed Delivery Growth = 15%
    - Fleet Utilization = 15%
    """
    score = 0.0
    
    # 1. Revenue-Margin Divergence (30 pts)
    # Ghost growth: revenue up but margin down
    margin_revenue_gap = metrics.revenueGrowth - (-metrics.marginDecay)
    if margin_revenue_gap > 0 and metrics.marginDecay < 0:
        # Revenue growing but margin decaying = classic ghost growth
        score += min(abs(margin_revenue_gap) * 3, 30)
    elif margin_revenue_gap < 0:
        score += max(0, 15 + margin_revenue_gap)
    else:
        score += 8
    
    # 2. Fleet-Density Imbalance (25 pts)
    # Adding vehicles without improving density
    density_efficiency = metrics.shipmentDensity / max(metrics.fleetGrowthRate * 100, 1)
    if density_efficiency < 1 and metrics.fleetGrowthRate > 2:
        score += min((1 - density_efficiency) * 25, 25)
    elif metrics.fleetGrowthRate > 5:
        score += 10
    
    # 3. Fuel Cost Escalation (15 pts)
    if metrics.fuelCostGrowth > 3:
        score += min(metrics.fuelCostGrowth * 1.5, 15)
    
    # 4. Failed Delivery Escalation (15 pts)
    if metrics.failedDeliveryGrowth > 5:
        score += min(metrics.failedDeliveryGrowth, 15)
    
    # 5. Fleet Utilization Penalty (15 pts)
    if fleet_utilization < 60:
        score += min((60 - fleet_utilization) * 0.375, 15)
    elif fleet_utilization > 85:
        score += min((fleet_utilization - 85) * 0.3, 5)  # over-utilization risk
    
    # Cap at 100
    score = min(max(round(score), 0), 100)
    
    # Determine level
    if score <= 25:
        level = 'Safe'
    elif score <= 50:
        level = 'Warning'
    elif score <= 75:
        level = 'Critical'
    else:
        level = 'Collapse'
    
    # Generate AI-style explanation
    explanation = generate_explanation(level, metrics, fleet_utilization, score)
    
    # Generate recommendations
    recommendations = generate_recommendations(level, metrics, fleet_utilization)
    
    # Generate mock history
    history = generate_history(score)
    
    return GhostGrowthResult(
        index=score,
        level=level,
        metrics=metrics,
        explanation=explanation,
        recommendations=recommendations,
        history=history
    )


def generate_explanation(level, m, utilization, score):
    """Generate an explanation of the ghost growth index."""
    parts = []
    
    if m.revenueGrowth > 5 and m.marginDecay < -1:
        parts.append(
            f"Revenue grew {m.revenueGrowth:.1f}% but margins declined {abs(m.marginDecay):.1f}% — classic Ghost Growth pattern."
        )
    
    if m.fleetGrowthRate > 3 and m.shipmentDensity < 15:
        parts.append(
            f"Fleet expanded {m.fleetGrowthRate:.1f}% while shipment density remains low at {m.shipmentDensity:.1f} shipments/km²."
        )
    
    if m.fuelCostGrowth > 3:
        parts.append(f"Fuel costs rising {m.fuelCostGrowth:.1f}% — eroding operational margins.")
    
    if m.failedDeliveryGrowth > 5:
        parts.append(
            f"Failed deliveries increasing {m.failedDeliveryGrowth:.1f}% — service quality and cost risk."
        )
    
    if utilization < 60:
        parts.append(f"Fleet utilization at {utilization:.0f}% — vehicles are underutilized.")
    
    if len(parts) == 0:
        return f"Ghost Growth Index at {score} — operations are in healthy balance. Revenue growth is supported by real operational density."
    
    return ' '.join(parts)


def generate_recommendations(level, m, utilization):
    """Generate recommendations based on ghost growth level."""
    recs = []
    
    if level == 'Safe':
        recs.append('Maintain current operational density strategy.')
        recs.append('Monitor fuel costs and failed delivery rates weekly.')
        return recs
    
    if level == 'Warning':
        recs.append('Freeze fleet expansion until utilization exceeds 70%.')
        recs.append('Audit cost per shipment trends over last 4 weeks.')
        recs.append('Review zone density — consolidate low-density routes.')
    
    if level == 'Critical':
        recs.append('⚠ Immediate fleet expansion freeze.')
        recs.append('Reduce vehicle count in low-density zones by 15-20%.')
        recs.append('Implement mandatory route optimization within 7 days.')
        recs.append('Review driver productivity — terminate underperforming contracts.')
        recs.append('Negotiate fuel contracts or switch to fuel-efficient routing.')
    
    if level == 'Collapse':
        recs.append('🚨 EMERGENCY: Operational collapse risk detected.')
        recs.append('Cut fleet by 25-30% immediately.')
        recs.append('Consolidate all operations to top 3 highest-density zones.')
        recs.append('Pause all non-essential spending for 30 days.')
        recs.append('Initiate emergency liquidity preservation protocol.')
        recs.append('Contact financial advisor — bankruptcy probability elevated.')
    
    if m.fuelCostGrowth > 3:
        recs.append('Fuel cost escalation: switch to fuel-efficient routing and bulk purchasing.')
    
    if m.failedDeliveryGrowth > 5:
        recs.append('Failed delivery spike: audit driver performance and zone assignments.')
    
    if utilization < 60:
        recs.append(f"Low fleet utilization ({utilization:.0f}%): reduce idle vehicles or increase shipment volume per vehicle.")
    
    return recs


def generate_history(current_score: int):
    """Generate mock history for the ghost growth index."""
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    history = []
    rng = seeded_random(current_score)
    
    for i in range(len(months) - 1, -1, -1):
        base = current_score - (rng() * 15 - 5) * (len(months) - i)
        history.append({
            'date': months[i],
            'index': min(max(round(base), 0), 100)
        })
    
    # Ensure current month matches
    history[-1]['index'] = current_score
    return history
