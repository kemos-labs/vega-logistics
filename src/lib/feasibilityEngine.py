# Feasibility Study Engine for Startup Risk Assessment (Python version for testing)

import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.types import (
    FeasibilityInput, FeasibilityOutput, RiskFactor,
    DEFAULT_FEASIBILITY_INPUT
)


def calculateFeasibility(input: FeasibilityInput) -> FeasibilityOutput:
    """Calculate feasibility metrics for a logistics startup."""

    # Convert input dict to object if needed
    if isinstance(input, dict):
        input = FeasibilityInput(**input)

    working_days = input.workingDaysPerMonth
    monthly_revenue_per_van = (
        input.deliveriesPerVanPerDay *
        input.revenuePerDelivery *
        working_days
    )

    monthly_total_revenue = monthly_revenue_per_van * input.initialFleetSize
    monthly_total_costs = (
        input.monthlyFixedCosts +
        input.monthlyVariableCostPerVan * input.initialFleetSize
    )

    monthly_profit = monthly_total_revenue - monthly_total_costs
    profit_margin = (monthly_profit / monthly_total_revenue * 100) if monthly_total_revenue > 0 else 0

    # Break-even analysis
    total_investment = input.initialFleetSize * input.vanPurchasePrice
    initial_cash = input.startupCapital - total_investment

    if monthly_profit > 0:
        break_even_months = max(0, -initial_cash / monthly_profit)
        if break_even_months > 0:
            break_even_months = round(break_even_months)
    else:
        break_even_months = round(input.projectionMonths * 1.5)

    # Payback period
    if monthly_profit > 0:
        payback_period = total_investment / monthly_profit
    else:
        payback_period = float('inf')

    # Cash flow projection
    cash_flow_projection = []
    cumulative_cash = input.startupCapital - total_investment

    for month in range(1, input.projectionMonths + 1):
        revenue = monthly_total_revenue
        costs = monthly_total_costs
        profit = revenue - costs
        cumulative_cash += profit

        cash_flow_projection.append({
            'month': month,
            'revenue': revenue,
            'costs': costs,
            'profit': profit,
            'cumulativeCash': cumulative_cash
        })

    # Risk assessment
    risk_factors = assess_risks(input, profit_margin, payback_period)
    risk_level = calculate_risk_level(risk_factors)
    profitability_score = calculate_profitability_score(
        profit_margin, payback_period, input.targetMargin
    )

    # Recommendations
    recommendations = generate_recommendations(
        input, profit_margin, payback_period, risk_factors
    )

    # Capital requirements
    startup_capital_required = total_investment + input.monthlyFixedCosts * 3  # 3 months buffer
    buffer_capital = startup_capital_required * 0.2

    return FeasibilityOutput(
        breakEvenMonths=break_even_months,
        paybackPeriod=payback_period,
        projectedMonthlyProfit=monthly_profit,
        projectedAnnualProfit=monthly_profit * 12,
        profitabilityScore=profitability_score,
        riskLevel=risk_level,
        cashFlowProjection=cash_flow_projection,
        riskFactors=risk_factors,
        recommendations=recommendations,
        startupCapitalRequired=startup_capital_required,
        bufferCapital=buffer_capital
    )


def assess_risks(input, profit_margin, payback_period):
    """Assess various risk factors for the business."""
    risks = []

    # Market demand risk
    if input.deliveriesPerVanPerDay < 30:
        risks.append(RiskFactor(
            name='Market Demand Risk',
            severity='high',
            probability=0.6,
            impact=0.8,
            mitigation='Conduct market research and secure pre-contracts with customers'
        ))

    # Profitability risk
    if profit_margin < 10:
        risks.append(RiskFactor(
            name='Low Profitability',
            severity='high',
            probability=0.7,
            impact=0.9,
            mitigation='Optimize operational costs and increase delivery rates'
        ))

    # Payback period risk
    if payback_period > 24:
        risks.append(RiskFactor(
            name='Extended Payback Period',
            severity='medium',
            probability=0.5,
            impact=0.7,
            mitigation='Increase fleet utilization and revenue per delivery'
        ))

    # Capital risk
    if input.startupCapital < input.initialFleetSize * input.vanPurchasePrice * 1.3:
        risks.append(RiskFactor(
            name='Insufficient Capital Reserve',
            severity='critical',
            probability=0.8,
            impact=1.0,
            mitigation='Secure additional funding or lease vehicles instead of purchasing'
        ))

    # Operational risk (always included)
    risks.append(RiskFactor(
        name='Driver Availability & Retention',
        severity='medium',
        probability=0.5,
        impact=0.6,
        mitigation='Offer competitive salaries and implement driver retention programs'
    ))

    # Market competition risk (always included)
    risks.append(RiskFactor(
        name='Market Competition',
        severity='medium',
        probability=0.7,
        impact=0.5,
        mitigation='Differentiate through service quality and technology adoption'
    ))

    # Regulatory risk (always included)
    risks.append(RiskFactor(
        name='Regulatory Changes',
        severity='low',
        probability=0.3,
        impact=0.4,
        mitigation='Stay updated with TGA regulations and maintain compliance'
    ))

    return risks


def calculate_risk_level(risk_factors):
    """Calculate overall risk level from individual risk factors."""
    critical_risks = [
        r for r in risk_factors
        if r.severity == 'critical' and r.probability * r.impact > 0.5
    ]
    high_risks = [
        r for r in risk_factors
        if r.severity == 'high' and r.probability * r.impact > 0.4
    ]

    if len(critical_risks) > 0:
        return 'critical'
    if len(high_risks) > 1:
        return 'high'
    if len(high_risks) > 0:
        return 'medium'
    return 'low'


def calculate_profitability_score(profit_margin, payback_period, target_margin):
    """Calculate profitability score (0-100)."""
    score = 50  # Base score

    # Margin contribution (0-30 points)
    margin_score = min(30, (profit_margin / target_margin) * 30) if target_margin > 0 else 0
    score += margin_score

    # Payback period contribution (0-20 points)
    payback_score = max(0, 20 - payback_period)
    score += payback_score

    return min(100, max(0, round(score)))


def generate_recommendations(input, profit_margin, payback_period, risk_factors):
    """Generate actionable recommendations."""
    recommendations = []

    if profit_margin < 10:
        recommendations.append(
            f"Increase revenue per delivery from SAR {input.revenuePerDelivery} to SAR {input.revenuePerDelivery * 1.15:.1f}"
        )
        recommendations.append(
            'Reduce operational costs by optimizing routes and reducing fuel consumption'
        )

    if input.deliveriesPerVanPerDay < 30:
        recommendations.append(
            'Focus on market penetration to increase delivery volume per van'
        )
        recommendations.append(
            'Consider zone-based operations to maximize delivery density'
        )

    if payback_period > 24:
        recommendations.append(
            'Consider leasing vehicles instead of purchasing to reduce upfront capital'
        )
        recommendations.append(
            'Implement a phased fleet expansion strategy starting with 3-4 vans'
        )

    recommendations.append(
        'Establish partnerships with e-commerce platforms for guaranteed volume'
    )
    recommendations.append(
        'Implement real-time tracking and optimization software to improve efficiency'
    )
    recommendations.append(
        'Maintain a 6-month operating expense reserve for business continuity'
    )

    critical_risks = [r for r in risk_factors if r.severity == 'critical']
    if len(critical_risks) > 0:
        recommendations.append(
            'Address critical risks before launch: ' +
            ', '.join(r.name for r in critical_risks)
        )

    return recommendations


def generateRiskManagementPlan(risk_factors) -> str:
    """Generate a comprehensive risk management plan."""
    plan = '# Risk Management Plan\n\n'

    critical_risks = [r for r in risk_factors if r.severity == 'critical']
    high_risks = [r for r in risk_factors if r.severity == 'high']
    medium_risks = [r for r in risk_factors if r.severity == 'medium']

    if len(critical_risks) > 0:
        plan += '## Critical Risks (Immediate Action Required)\n\n'
        for risk in critical_risks:
            plan += f'### {risk.name}\n'
            plan += f'- **Probability:** {(risk.probability * 100):.0f}%\n'
            plan += f'- **Impact:** {(risk.impact * 100):.0f}%\n'
            plan += f'- **Mitigation:** {risk.mitigation}\n\n'

    if len(high_risks) > 0:
        plan += '## High Risks (Develop Contingency Plans)\n\n'
        for risk in high_risks:
            plan += f'### {risk.name}\n'
            plan += f'- **Probability:** {(risk.probability * 100):.0f}%\n'
            plan += f'- **Impact:** {(risk.impact * 100):.0f}%\n'
            plan += f'- **Mitigation:** {risk.mitigation}\n\n'

    if len(medium_risks) > 0:
        plan += '## Medium Risks (Monitor and Manage)\n\n'
        for risk in medium_risks:
            plan += f'### {risk.name}\n'
            plan += f'- **Probability:** {(risk.probability * 100):.0f}%\n'
            plan += f'- **Impact:** {(risk.impact * 100):.0f}%\n'
            plan += f'- **Mitigation:** {risk.mitigation}\n\n'

    return plan
