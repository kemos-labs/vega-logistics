# VEGA Logistics OS — Core Types (Python version for testing)
# Legacy interface for backward compatibility with existing tests

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

# Cost line enable toggle
CostLineKey = str

# Provider evaluation rating
ProviderRating = str  # 'good' | 'average' | 'bad'

GhostGrowthLevel = str  # 'Safe' | 'Warning' | 'Critical' | 'Collapse'


@dataclass
class CostBreakdown:
    lease: float = 0.0
    fuel: float = 0.0
    driverSalaries: float = 0.0
    freelancers: float = 0.0
    warehouse: float = 0.0
    insurance: float = 0.0
    maintenance: float = 0.0
    failedDeliveries: float = 0.0
    returns: float = 0.0
    utilities: float = 0.0
    opsTeam: float = 0.0
    salesTeam: float = 0.0
    packaging: float = 0.0
    pickPack: float = 0.0
    technology: float = 0.0
    cargoInsurance: float = 0.0


@dataclass
class RevenueBreakdown:
    shipmentRevenue: float = 0.0
    expressPremium: float = 0.0
    fulfillment: float = 0.0
    subcontracting: float = 0.0


# Legacy FinancialInput for backward compatibility with tests
@dataclass
class FinancialInput:
    # Core fleet and cost parameters
    vehicleCount: int = 0
    leaseCostPerVehicle: float = 0.0
    fuelPricePerLiter: float = 0.0
    avgFuelConsumptionPerVehicle: float = 0.0
    
    # Driver costs
    driverSalary: float = 0.0
    freelancerDriverCount: int = 0
    freelancerCostPerShipment: float = 0.0
    
    # Facility costs
    warehouseRent: float = 0.0
    insurancePerVehicle: float = 0.0
    maintenancePerVehicle: float = 0.0
    
    # Shipment volume and revenue
    dailyShipmentVolume: int = 0
    avgRevenuePerShipment: float = 0.0
    
    # Operational metrics
    failedDeliveryRate: float = 0.0
    returnRate: float = 0.0
    clientPaymentDelay: int = 0
    expressShipmentRatio: float = 0.0
    
    # Office and utilities
    internetCost: float = 0.0
    electricityCost: float = 0.0
    
    # Team costs
    opsTeamCount: int = 0
    opsTeamAvgSalary: float = 0.0
    salesTeamCount: int = 0
    salesTeamBaseSalary: float = 0.0
    salesCommissionPercent: float = 0.0
    
    # Per-shipment costs
    packagingCostPerUnit: float = 0.0
    pickPackLaborPerOrder: float = 0.0
    
    # Technology and insurance
    technologySaaS: float = 0.0
    cargoInsurance: float = 0.0
    
    # Additional revenue streams
    fulfillmentRevenue: float = 0.0
    subcontractingRevenue: float = 0.0


@dataclass
class FinancialOutput:
    totalRevenue: float = 0.0
    totalCost: float = 0.0
    netMargin: float = 0.0
    netMarginPercent: float = 0.0
    costPerShipment: float = 0.0
    burnRate: float = 0.0
    cashRunway: float = 0.0
    operationalBreakeven: float = 0.0
    
    totalDailyShipments: int = 0
    totalMonthlyShipments: int = 0
    avgRevenuePerShipment: float = 0.0
    
    fleetUtilization: float = 0.0
    perVehicleProfitability: float = 0.0
    
    dailyRevenue: float = 0.0
    dailyCost: float = 0.0
    
    costBreakdown: CostBreakdown = field(default_factory=CostBreakdown)
    revenueBreakdown: RevenueBreakdown = field(default_factory=RevenueBreakdown)


@dataclass
class GhostGrowthMetrics:
    revenueGrowth: float = 0.0
    marginDecay: float = 0.0
    fleetGrowthRate: float = 0.0
    shipmentDensity: float = 0.0
    fuelCostGrowth: float = 0.0
    failedDeliveryGrowth: float = 0.0


@dataclass
class GhostGrowthResult:
    index: int = 0
    level: GhostGrowthLevel = "Safe"
    metrics: GhostGrowthMetrics = field(default_factory=GhostGrowthMetrics)
    explanation: str = ""
    recommendations: List[str] = field(default_factory=list)
    history: List[Dict[str, Any]] = field(default_factory=list)


# Feasibility Engine types
@dataclass 
class FeasibilityInput:
    initialFleetSize: int = 5
    vanPurchasePrice: float = 95000.0
    monthlyFixedCosts: float = 22000.0
    monthlyVariableCostPerVan: float = 8500.0
    revenuePerDelivery: float = 22.0
    deliveriesPerVanPerDay: int = 35
    workingDaysPerMonth: int = 22
    projectionMonths: int = 24
    startupCapital: float = 500000.0
    targetMargin: float = 15.0


@dataclass
class RiskFactor:
    name: str = ""
    severity: str = "low"
    probability: float = 0.0
    impact: float = 0.0
    mitigation: str = ""


@dataclass
class FeasibilityOutput:
    breakEvenMonths: float = 0.0
    paybackPeriod: float = 0.0
    projectedMonthlyProfit: float = 0.0
    projectedAnnualProfit: float = 0.0
    profitabilityScore: int = 0
    riskLevel: str = "low"
    cashFlowProjection: List[Dict[str, Any]] = field(default_factory=list)
    riskFactors: List[RiskFactor] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    startupCapitalRequired: float = 0.0
    bufferCapital: float = 0.0


# Default feasibility input
DEFAULT_FEASIBILITY_INPUT = {
    'initialFleetSize': 5,
    'vanPurchasePrice': 95000,
    'monthlyFixedCosts': 22000,
    'monthlyVariableCostPerVan': 8500,
    'revenuePerDelivery': 22,
    'deliveriesPerVanPerDay': 35,
    'workingDaysPerMonth': 22,
    'projectionMonths': 24,
    'startupCapital': 500000,
    'targetMargin': 15,
}
