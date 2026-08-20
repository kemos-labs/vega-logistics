#!/usr/bin/env python3
# Converted from pytest to unittest for compatibility

import unittest
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.feasibilityEngine import calculateFeasibility, DEFAULT_FEASIBILITY_INPUT, generateRiskManagementPlan


def make_input(overrides=None):
    base = dict(DEFAULT_FEASIBILITY_INPUT)
    if overrides:
        base.update(overrides)
    return base


class TestFeasibilityEngine(unittest.TestCase):
    
    def test_basic_output(self):
        result = calculateFeasibility(make_input())
        self.assertGreaterEqual(result.breakEvenMonths, 0)
        self.assertGreater(result.paybackPeriod, 0)
        self.assertGreaterEqual(result.profitabilityScore, 0)
        self.assertLessEqual(result.profitabilityScore, 100)
        self.assertIn(result.riskLevel, ('low', 'medium', 'high', 'critical'))

    def test_cash_flow_projection_length(self):
        inp = make_input({'projectionMonths': 12})
        result = calculateFeasibility(inp)
        self.assertEqual(len(result.cashFlowProjection), 12)

    def test_cash_flow_projection_24(self):
        inp = make_input({'projectionMonths': 24})
        result = calculateFeasibility(inp)
        self.assertEqual(len(result.cashFlowProjection), 24)

    def test_profitable_scenario(self):
        inp = make_input({
            'initialFleetSize': 20,
            'revenuePerDelivery': 50,
            'deliveriesPerVanPerDay': 60,
        })
        result = calculateFeasibility(inp)
        self.assertGreater(result.projectedMonthlyProfit, 0)
        self.assertGreaterEqual(result.profitabilityScore, 50)

    def test_loss_scenario(self):
        inp = make_input({
            'initialFleetSize': 1,
            'revenuePerDelivery': 5,
            'deliveriesPerVanPerDay': 1,
            'monthlyFixedCosts': 100000,
        })
        result = calculateFeasibility(inp)
        self.assertLess(result.projectedMonthlyProfit, 0)
        self.assertLess(result.profitabilityScore, 50)

    def test_risk_factors(self):
        inp = make_input()
        result = calculateFeasibility(inp)
        self.assertGreaterEqual(len(result.riskFactors), 3)

    def test_recommendations(self):
        inp = make_input()
        result = calculateFeasibility(inp)
        self.assertGreaterEqual(len(result.recommendations), 3)

    def test_capital_requirements(self):
        inp = make_input({'initialFleetSize': 10, 'vanPurchasePrice': 100000})
        result = calculateFeasibility(inp)
        expected_base = 10 * 100000 + inp['monthlyFixedCosts'] * 3
        self.assertEqual(result.startupCapitalRequired, expected_base)
        self.assertEqual(result.bufferCapital, expected_base * 0.2)

    def test_risk_management_plan(self):
        inp = make_input()
        result = calculateFeasibility(inp)
        plan = generateRiskManagementPlan(result.riskFactors)
        self.assertIn('Risk Management Plan', plan)

    def test_payback_period_infinite(self):
        inp = make_input({
            'initialFleetSize': 1,
            'monthlyFixedCosts': 999999,
            'revenuePerDelivery': 1,
        })
        result = calculateFeasibility(inp)
        self.assertTrue(result.paybackPeriod == float('inf') or result.paybackPeriod > 999)


if __name__ == '__main__':
    unittest.main()
