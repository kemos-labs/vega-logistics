# VEGA Logistics OS — Financial Calculation Engine (Python version for testing)
# Simplified legacy interface for backward compatibility with tests

import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.types import FinancialInput, FinancialOutput, CostBreakdown, RevenueBreakdown

WORKING_DAYS = 26


def calculateFinancials(input: FinancialInput) -> FinancialOutput:
    """
    Calculate financials from legacy FinancialInput.
    This is a simplified version that matches the test interface.
    """
    # Extract input values
    vehicle_count = input.vehicleCount
    lease_cost_per_vehicle = input.leaseCostPerVehicle
    fuel_price_per_liter = input.fuelPricePerLiter
    avg_fuel_consumption = input.avgFuelConsumptionPerVehicle  # liters per 100km
    driver_salary = input.driverSalary
    freelancer_driver_count = input.freelancerDriverCount
    freelancer_cost_per_shipment = input.freelancerCostPerShipment
    warehouse_rent = input.warehouseRent
    insurance_per_vehicle = input.insurancePerVehicle
    maintenance_per_vehicle = input.maintenancePerVehicle
    daily_shipment_volume = input.dailyShipmentVolume
    avg_revenue_per_shipment = input.avgRevenuePerShipment
    failed_delivery_rate = input.failedDeliveryRate  # percentage
    return_rate = input.returnRate  # percentage
    client_payment_delay = input.clientPaymentDelay  # days
    express_shipment_ratio = input.expressShipmentRatio  # percentage
    internet_cost = input.internetCost
    electricity_cost = input.electricityCost
    ops_team_count = input.opsTeamCount
    ops_team_avg_salary = input.opsTeamAvgSalary
    sales_team_count = input.salesTeamCount
    sales_team_base_salary = input.salesTeamBaseSalary
    sales_commission_percent = input.salesCommissionPercent
    packaging_cost_per_unit = input.packagingCostPerUnit
    pick_pack_labor_per_order = input.pickPackLaborPerOrder
    technology_saas = input.technologySaaS
    cargo_insurance = input.cargoInsurance
    fulfillment_revenue = input.fulfillmentRevenue
    subcontracting_revenue = input.subcontractingRevenue

    # Monthly calculations
    monthly_shipment_volume = daily_shipment_volume * WORKING_DAYS
    
    # Revenue calculations
    # Base shipment revenue
    shipment_revenue = daily_shipment_volume * WORKING_DAYS * avg_revenue_per_shipment
    
    # Express premium (additional revenue from express shipments)
    express_shipment_count = daily_shipment_volume * (express_shipment_ratio / 100)
    express_premium_revenue = express_shipment_count * WORKING_DAYS * avg_revenue_per_shipment * 0.2  # 20% premium
    
    total_revenue = shipment_revenue + express_premium_revenue + fulfillment_revenue + subcontracting_revenue
    
    # Cost calculations
    
    # Lease cost
    lease = vehicle_count * lease_cost_per_vehicle
    
    # Fuel cost: vehicles consume fuel based on average consumption
    # Assuming average distance per vehicle per day
    avg_distance_per_vehicle = 100  # km per day (default assumption)
    fuel_cost = (vehicle_count * 
                (avg_distance_per_vehicle / 100) * 
                avg_fuel_consumption * 
                fuel_price_per_liter * 
                WORKING_DAYS)
    
    # Driver salaries (assuming one driver per vehicle for company drivers)
    # Freelancer drivers are handled separately
    company_driver_count = vehicle_count - freelancer_driver_count
    driver_salaries = company_driver_count * driver_salary
    
    # Freelancer costs
    freelancers = freelancer_driver_count * daily_shipment_volume * freelancer_cost_per_shipment * WORKING_DAYS
    
    # Warehouse costs
    warehouse = warehouse_rent
    
    # Insurance
    insurance = vehicle_count * insurance_per_vehicle
    
    # Maintenance
    maintenance = vehicle_count * maintenance_per_vehicle
    
    # Failed deliveries cost
    failed_deliveries = monthly_shipment_volume * (failed_delivery_rate / 100) * avg_revenue_per_shipment
    
    # Returns cost
    returns = monthly_shipment_volume * (return_rate / 100) * avg_revenue_per_shipment * 0.5  # 50% of revenue lost
    
    # Utilities
    utilities = internet_cost + electricity_cost
    
    # Operations team
    ops_team = ops_team_count * ops_team_avg_salary
    
    # Sales team (base + commission)
    sales_team_base = sales_team_count * sales_team_base_salary
    sales_commission = (shipment_revenue + express_premium_revenue) * (sales_commission_percent / 100)
    sales_team = sales_team_base + sales_commission
    
    # Packaging
    packaging = monthly_shipment_volume * packaging_cost_per_unit
    
    # Pick-pack labor
    pick_pack = monthly_shipment_volume * pick_pack_labor_per_order
    
    # Technology
    technology = technology_saas
    
    # Cargo insurance
    cargo_insurance_cost = cargo_insurance
    
    # Total cost
    total_cost = (lease + fuel_cost + driver_salaries + freelancers + 
                  warehouse + insurance + maintenance + failed_deliveries + 
                  returns + utilities + ops_team + sales_team + packaging + 
                  pick_pack + technology + cargo_insurance_cost)
    
    cost_per_shipment = total_cost / monthly_shipment_volume if monthly_shipment_volume > 0 else 0
    
    # Profitability
    net_margin = total_revenue - total_cost
    net_margin_percent = (net_margin / total_revenue * 100) if total_revenue > 0 else 0
    
    burn_rate = abs(net_margin) if net_margin < 0 else 0
    cash_reserves = total_revenue * 2
    cash_runway = min(99, (cash_reserves / burn_rate) if burn_rate > 0 else 99)
    
    # Operational breakeven (shipments per day needed to break even)
    operational_breakeven = round(total_cost / (WORKING_DAYS * avg_revenue_per_shipment)) if avg_revenue_per_shipment > 0 else 0
    
    # Fleet utilization (assuming each vehicle can handle up to 12 shipments per day)
    fleet_utilization = min(100, max(0, (daily_shipment_volume / (vehicle_count * 12)) * 100)) if vehicle_count > 0 else 0
    
    # Per-vehicle profitability
    per_vehicle_profitability = net_margin / vehicle_count if vehicle_count > 0 else 0
    
    # Daily metrics
    daily_revenue = total_revenue / WORKING_DAYS
    daily_cost = total_cost / WORKING_DAYS
    
    # Cost and revenue breakdowns
    cost_breakdown = CostBreakdown(
        lease=lease,
        fuel=fuel_cost,
        driverSalaries=driver_salaries,
        freelancers=freelancers,
        warehouse=warehouse,
        insurance=insurance,
        maintenance=maintenance,
        failedDeliveries=failed_deliveries,
        returns=returns,
        utilities=utilities,
        opsTeam=ops_team,
        salesTeam=sales_team,
        packaging=packaging,
        pickPack=pick_pack,
        technology=technology,
        cargoInsurance=cargo_insurance_cost
    )
    
    revenue_breakdown = RevenueBreakdown(
        shipmentRevenue=shipment_revenue,
        expressPremium=express_premium_revenue,
        fulfillment=fulfillment_revenue,
        subcontracting=subcontracting_revenue
    )
    
    return FinancialOutput(
        totalRevenue=total_revenue,
        totalCost=total_cost,
        netMargin=net_margin,
        netMarginPercent=net_margin_percent,
        costPerShipment=cost_per_shipment,
        burnRate=burn_rate,
        cashRunway=cash_runway,
        operationalBreakeven=operational_breakeven,
        totalDailyShipments=daily_shipment_volume,
        totalMonthlyShipments=monthly_shipment_volume,
        avgRevenuePerShipment=avg_revenue_per_shipment,
        fleetUtilization=fleet_utilization,
        perVehicleProfitability=per_vehicle_profitability,
        dailyRevenue=daily_revenue,
        dailyCost=daily_cost,
        costBreakdown=cost_breakdown,
        revenueBreakdown=revenue_breakdown
    )


def applyOperationalPatch(input: FinancialInput, patch: dict) -> FinancialInput:
    """Patch the operational state"""
    input_dict = input.__dict__.copy()
    input_dict.update(patch)
    return FinancialInput(**input_dict)
