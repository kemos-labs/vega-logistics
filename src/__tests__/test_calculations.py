import pytest
import sys
sys.path.insert(0, 'src')

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

class TestCalculateFinancials:
    def test_basic_output_structure(self):
        inp = make_input()
        result = calculateFinancials(inp)
        assert result.totalRevenue > 0
        assert result.totalCost > 0
        assert result.costPerShipment > 0
        assert result.netMarginPercent is not None

    def test_profitable_scenario(self):
        inp = make_input({'dailyShipmentVolume': 500, 'avgRevenuePerShipment': 50})
        result = calculateFinancials(inp)
        assert result.netMargin > 0
        assert result.netMarginPercent > 0

    def test_loss_scenario(self):
        inp = make_input({'dailyShipmentVolume': 10, 'avgRevenuePerShipment': 5})
        result = calculateFinancials(inp)
        assert result.netMargin < 0
        assert result.burnRate > 0

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
        assert abs(total_from_breakdown - result.totalCost) < 1

    def test_revenue_breakdown_sum(self):
        inp = make_input()
        result = calculateFinancials(inp)
        total_from_breakdown = sum([
            result.revenueBreakdown.shipmentRevenue,
            result.revenueBreakdown.expressPremium,
            result.revenueBreakdown.fulfillment,
            result.revenueBreakdown.subcontracting,
        ])
        assert abs(total_from_breakdown - result.totalRevenue) < 1

    def test_fleet_utilization_range(self):
        inp = make_input()
        result = calculateFinancials(inp)
        assert 0 <= result.fleetUtilization <= 100

    def test_cash_runway(self):
        inp = make_input({'dailyShipmentVolume': 10, 'avgRevenuePerShipment': 5})
        result = calculateFinancials(inp)
        assert result.cashRunway <= 99
        assert result.cashRunway >= 0

    def test_per_vehicle_profitability(self):
        inp = make_input()
        result = calculateFinancials(inp)
        assert result.perVehicleProfitability == result.netMargin / inp.vehicleCount

    def test_daily_values(self):
        inp = make_input()
        result = calculateFinancials(inp)
        days = 30
        assert abs(result.dailyRevenue * days - result.totalRevenue) < 1
        assert abs(result.dailyCost * days - result.totalCost) < 1
