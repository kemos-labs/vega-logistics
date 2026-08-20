import pytest
import sys
sys.path.insert(0, 'src')

from lib.feasibilityEngine import calculateFeasibility, DEFAULT_FEASIBILITY_INPUT, generateRiskManagementPlan

def make_input(overrides=None):
    base = dict(DEFAULT_FEASIBILITY_INPUT)
    if overrides:
        base.update(overrides)
    return base

class TestFeasibilityEngine:
    def test_basic_output(self):
        result = calculateFeasibility(make_input())
        assert result.breakEvenMonths >= 0
        assert result.paybackPeriod > 0
        assert 0 <= result.profitabilityScore <= 100
        assert result.riskLevel in ('low', 'medium', 'high', 'critical')

    def test_cash_flow_projection_length(self):
        inp = make_input({'projectionMonths': 12})
        result = calculateFeasibility(inp)
        assert len(result.cashFlowProjection) == 12

    def test_cash_flow_projection_24(self):
        inp = make_input({'projectionMonths': 24})
        result = calculateFeasibility(inp)
        assert len(result.cashFlowProjection) == 24

    def test_profitable_scenario(self):
        inp = make_input({
            'initialFleetSize': 20,
            'revenuePerDelivery': 50,
            'deliveriesPerVanPerDay': 60,
        })
        result = calculateFeasibility(inp)
        assert result.projectedMonthlyProfit > 0
        assert result.profitabilityScore >= 50

    def test_loss_scenario(self):
        inp = make_input({
            'initialFleetSize': 1,
            'revenuePerDelivery': 5,
            'deliveriesPerVanPerDay': 1,
            'monthlyFixedCosts': 100000,
        })
        result = calculateFeasibility(inp)
        assert result.projectedMonthlyProfit < 0
        assert result.profitabilityScore < 50

    def test_risk_factors(self):
        inp = make_input()
        result = calculateFeasibility(inp)
        assert len(result.riskFactors) >= 3

    def test_recommendations(self):
        inp = make_input()
        result = calculateFeasibility(inp)
        assert len(result.recommendations) >= 3

    def test_capital_requirements(self):
        inp = make_input({'initialFleetSize': 10, 'vanPurchasePrice': 100000})
        result = calculateFeasibility(inp)
        expected_base = 10 * 100000 + inp['monthlyFixedCosts'] * 3
        assert result.startupCapitalRequired == expected_base
        assert result.bufferCapital == expected_base * 0.2

    def test_risk_management_plan(self):
        inp = make_input()
        result = calculateFeasibility(inp)
        plan = generateRiskManagementPlan(result.riskFactors)
        assert 'Risk Management Plan' in plan

    def test_payback_period_infinite(self):
        inp = make_input({
            'initialFleetSize': 1,
            'monthlyFixedCosts': 999999,
            'revenuePerDelivery': 1,
        })
        result = calculateFeasibility(inp)
        assert result.paybackPeriod == float('inf') or result.paybackPeriod > 999
