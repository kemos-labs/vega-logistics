#!/usr/bin/env python3
# Converted from pytest to unittest for compatibility

import unittest
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.calculations import calculateFinancials
from lib.types import FinancialInput


def make_input(overrides=None):
    base = {
        'vehicleCount': 12,
        'leaseCostPerVehicle': 2400,
        'fuelPricePerLiter': 2.18,
        'avgFuelConsumptionPerVehicle': 30,
        'driverSalary': 4000,
        'freelancerDriverCount': 3,
        'freelancerCostPerShipment': 10,
        'warehouseRent': 12000,
        'insurancePerVehicle': 500,
        'maintenancePerVehicle': 350,
        'dailyShipmentVolume': 220,
        'avgRevenuePerShipment': 30,
        'failedDeliveryRate': 5.5,
        'returnRate': 2.8,
        'clientPaymentDelay': 38,
        'expressShipmentRatio': 12,
        'internetCost': 1200,
        'electricityCost': 2500,
        'opsTeamCount': 3,
        'opsTeamAvgSalary': 5500,
        'salesTeamCount': 2,
        'salesTeamBaseSalary': 5000,
        'salesCommissionPercent': 2,
        'packagingCostPerUnit': 1.5,
        'pickPackLaborPerOrder': 2.5,
        'technologySaaS': 3000,
        'cargoInsurance': 2000,
        'fulfillmentRevenue': 18000,
        'subcontractingRevenue': 8000,
    }
    if overrides:
        base.update(overrides)
    return FinancialInput(**base)


class TestCalculateFinancials(unittest.TestCase):

    def test_basic_output_structure(self):
        inp = make_input()
        result = calculateFinancials(inp)
        self.assertGreater(result.totalRevenue, 0)
        self.assertGreater(result.totalCost, 0)
        self.assertGreater(result.costPerShipment, 0)
        self.assertIsNotNone(result.netMarginPercent)

    def test_profitable_scenario(self):
        inp = make_input({'dailyShipmentVolume': 500, 'avgRevenuePerShipment': 50})
        result = calculateFinancials(inp)
        self.assertGreater(result.netMargin, 0)
        self.assertGreater(result.netMarginPercent, 0)

    def test_loss_scenario(self):
        inp = make_input({'dailyShipmentVolume': 10, 'avgRevenuePerShipment': 5})
        result = calculateFinancials(inp)
        self.assertLess(result.netMargin, 0)
        self.assertGreater(result.burnRate, 0)

    def test_cost_breakdown_sum(self):
        inp = make_input()
        result = calculateFinancials(inp)
        total_from_breakdown = sum([
            result.costBreakdown.lease,
            result.costBreakdown.fuel,
            result.costBreakdown.driverSalaries,
            result.costBreakdown.freelancers,
            result.costBreakdown.warehouse,
            result.costBreakdown.insurance,
            result.costBreakdown.maintenance,
            result.costBreakdown.failedDeliveries,
            result.costBreakdown.returns,
            result.costBreakdown.utilities,
            result.costBreakdown.opsTeam,
            result.costBreakdown.salesTeam,
            result.costBreakdown.packaging,
            result.costBreakdown.pickPack,
            result.costBreakdown.technology,
            result.costBreakdown.cargoInsurance,
        ])
        self.assertAlmostEqual(total_from_breakdown, result.totalCost, places=5)

    def test_revenue_breakdown_sum(self):
        inp = make_input()
        result = calculateFinancials(inp)
        total_from_breakdown = sum([
            result.revenueBreakdown.shipmentRevenue,
            result.revenueBreakdown.expressPremium,
            result.revenueBreakdown.fulfillment,
            result.revenueBreakdown.subcontracting,
        ])
        self.assertAlmostEqual(total_from_breakdown, result.totalRevenue, places=5)

    def test_fleet_utilization_range(self):
        inp = make_input()
        result = calculateFinancials(inp)
        self.assertGreaterEqual(result.fleetUtilization, 0)
        self.assertLessEqual(result.fleetUtilization, 100)

    def test_cash_runway(self):
        inp = make_input({'dailyShipmentVolume': 10, 'avgRevenuePerShipment': 5})
        result = calculateFinancials(inp)
        self.assertLessEqual(result.cashRunway, 99)
        self.assertGreaterEqual(result.cashRunway, 0)

    def test_per_vehicle_profitability(self):
        inp = make_input()
        result = calculateFinancials(inp)
        expected = result.netMargin / inp.vehicleCount if inp.vehicleCount > 0 else 0
        self.assertAlmostEqual(result.perVehicleProfitability, expected, places=5)

    def test_daily_values(self):
        inp = make_input()
        result = calculateFinancials(inp)
        days = 26
        self.assertAlmostEqual(result.dailyRevenue * days, result.totalRevenue, places=5)
        self.assertAlmostEqual(result.dailyCost * days, result.totalCost, places=5)


if __name__ == '__main__':
    unittest.main()
