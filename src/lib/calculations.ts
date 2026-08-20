// VEGA Logistics OS — Financial Calculation Engine
// Multi-provider aggregation · editable vehicle classes · editable maintenance · freelancer P&L

import {
  CostBreakdown,
  CostLineKey,
  FinancialInput,
  FinancialOutput,
  ProviderEvaluation,
  ProviderRating,
  RevenueBreakdown,
} from './types';

const WORKING_DAYS = 26;

function enabled<T extends { enabled?: boolean }>(arr: T[] | undefined): T[] {
  return (arr ?? []).filter((x) => x.enabled !== false);
}

function isOn(toggles: FinancialInput['costToggles'], key: CostLineKey): boolean {
  // Default ON if no entry. Default OFF for fulfillment/subcontracting
  // (they are revenue lines, opt-in).
  if (toggles[key] === undefined) {
    return key !== 'fulfillment' && key !== 'subcontracting';
  }
  return !!toggles[key];
}

export function calculateFinancials(input: FinancialInput): FinancialOutput {
  const enabledClasses = enabled(input.vehicleClasses);
  const enabledProviders = enabled(input.providers);
  const enabledMaintenance = enabled(input.maintenance);

  const totalVehicleCount = enabledClasses.reduce((sum, c) => sum + (c.quantity || 0), 0);

  // ─── Revenue: aggregated from providers ───────────────────────────────
  const totalDailyShipments = enabledProviders.reduce(
    (sum, p) => sum + (p.shipmentsPerDay || 0),
    0
  );
  const totalMonthlyShipments = totalDailyShipments * WORKING_DAYS;

  const providerMonthlyRevenue = enabledProviders.reduce(
    (sum, p) => sum + (p.shipmentsPerDay || 0) * WORKING_DAYS * (p.pricePerShipment || 0),
    0
  );

  const weightedAvgRevenue = totalMonthlyShipments > 0
    ? (providerMonthlyRevenue * (1 - Math.min(1, Math.max(0, input.failedDeliveryRate) / 100))) / totalMonthlyShipments
    : 0;

  // ─── Provider evaluation (Good / Average / Bad) ───────────────────────
  const totalShare = enabledProviders.reduce((sum, p) => sum + p.shipmentsPerDay, 0);
  const providerEvaluations: ProviderEvaluation[] = input.providers.map((p) => {
    const volumeShare = totalShare > 0 ? p.shipmentsPerDay / totalShare : 0;
    const priceVsAverage = weightedAvgRevenue > 0 ? p.pricePerShipment / weightedAvgRevenue : 1;

    // Score: high volume share + low price = "good" for us (we get cheaper shipments)
    // We rate providers on a blended metric — this is a client-side heuristic, not magic.
    const volumeScore = volumeShare * 100;            // 0-100, higher is better
    const priceScore = Math.max(0, 100 - (priceVsAverage - 0.5) * 100); // lower price -> higher score
    const blended = volumeScore * 0.5 + priceScore * 0.5;

    let rating: ProviderRating;
    if (blended >= 60) rating = 'good';
    else if (blended >= 35) rating = 'average';
    else rating = 'bad';

    return {
      id: p.id,
      name: p.name,
      shipmentsPerDay: p.shipmentsPerDay,
      pricePerShipment: p.pricePerShipment,
      volumeShare,
      priceVsAverage,
      rating,
      enabled: p.enabled !== false,
      monthlyRevenue: p.shipmentsPerDay * WORKING_DAYS * p.pricePerShipment * (1 - Math.min(1, Math.max(0, input.failedDeliveryRate) / 100)),
    };
  });

  // ─── Vehicle ownership (rent OR depreciation for owned assets) ────────
  const leaseCost =
    isOn(input.costToggles, 'lease')
      ? enabledClasses.reduce((s, c) => s + c.quantity * c.monthlyRent, 0)
      : 0;
  const depreciationCost =
    enabledClasses.reduce((s, c) => {
      if (c.purchasePrice && c.depreciationMonths) {
        return s + c.quantity * (c.purchasePrice / c.depreciationMonths);
      }
      return s;
    }, 0);
  // `variableCost` is legacy input data. It is intentionally allocated below
  // into its two supported cost lines instead of being added to ownership and
  // then counted again as insurance/maintenance.
  const financing =
    isOn(input.costToggles, 'financing') ? 0 : 0;

  const vehicleOwnership = leaseCost + depreciationCost + financing;

  // ─── Vehicle running ─────────────────────────────────────────────────
  const fuelCost = isOn(input.costToggles, 'fuel')
    ? enabledClasses.reduce((s, c) => {
        const eff = c.fuelEfficiency || input.fuelEfficiencyL100km;
        const dist = c.avgDailyDistance || input.avgDistancePerVehiclePerDay;
        return s + c.quantity * (dist / 100) * eff * input.fuelPricePerLiter * WORKING_DAYS;
      }, 0)
    : 0;

  const vehicleInsurance = isOn(input.costToggles, 'vehicleInsurance')
    ? enabledClasses.reduce((s, c) => s + c.quantity * (c.variableCost * 0.4), 0) // insurance lives inside variableCost; we treat a 40% slice as the toggleable insurance line
    : 0;

  const maintenanceFromFleet = isOn(input.costToggles, 'maintenance')
    ? enabledClasses.reduce((s, c) => s + c.quantity * (c.variableCost * 0.6), 0)
    : 0;
  const maintenanceFromEntries = enabledMaintenance.reduce(
    (s, e) => {
      const vc = enabledClasses.find((c) => c.id === e.vehicleClassId);
      if (!vc) return s;
      return s + vc.quantity * e.frequency * e.costPerEvent;
    },
    0
  );
  const maintenanceCost = maintenanceFromFleet + maintenanceFromEntries;

  const tolls = isOn(input.costToggles, 'tolls') ? 0 : 0;
  const fines = isOn(input.costToggles, 'fines') ? 0 : 0;

  const telematics = isOn(input.costToggles, 'telematics')
    ? totalVehicleCount * (input.gpsTelematics || 0)
    : 0;
  const dashcam = isOn(input.costToggles, 'dashcam') ? input.dashcamSubscription : 0;
  const fuelCard = isOn(input.costToggles, 'fuelCard') ? input.fuelCardFee : 0;

  const vehicleRunning = fuelCost + vehicleInsurance + maintenanceCost + tolls + fines + telematics + dashcam + fuelCard;

  // ─── People (excludes freelancers — they are a P&L pass-through) ─────
  const companyDriverCount = input.companyDriverCount ?? enabledClasses.reduce((s, c) => s + c.quantity, 0);
  const driverSalaryCost = isOn(input.costToggles, 'driverSalary')
    ? companyDriverCount * input.driverSalary
    : 0;
  const activeDriverCount = input.drivers.filter((d) => d.status === 'active').length;
  const totalEmployeeCount =
    companyDriverCount + input.opsTeamCount + input.salesTeamCount + input.warehouseStaff;
  const opsTeamCost = isOn(input.costToggles, 'opsTeam')
    ? input.opsTeamCount * input.opsTeamAvgSalary
    : 0;
  const salesTeamCost = isOn(input.costToggles, 'salesTeam')
    ? input.salesTeamCount * input.salesTeamBaseSalary
    : 0;
  const salesCommissionCost = isOn(input.costToggles, 'salesCommission')
    ? (providerMonthlyRevenue * (1 - Math.min(1, Math.max(0, input.failedDeliveryRate) / 100)) * input.salesCommissionPercent) / 100
    : 0;
  const warehouseStaffCost = isOn(input.costToggles, 'warehouseStaff')
    ? input.warehouseStaff * input.warehouseStaffSalary
    : 0;
  const healthInsuranceCost = isOn(input.costToggles, 'healthInsurance')
    ? totalEmployeeCount * input.healthInsurancePerEmployee
    : 0;

  const people = driverSalaryCost + opsTeamCost + salesTeamCost + salesCommissionCost + warehouseStaffCost + healthInsuranceCost;

  // ─── Facilities ──────────────────────────────────────────────────────
  const facilities =
    (isOn(input.costToggles, 'warehouseRent') ? input.warehouseRent : 0) +
    (isOn(input.costToggles, 'warehouseUtils') ? input.warehouseUtilities : 0) +
    (isOn(input.costToggles, 'officeRent') ? input.officeRent : 0) +
    (isOn(input.costToggles, 'internet') ? input.internetCost : 0) +
    (isOn(input.costToggles, 'electricity') ? input.electricityCost : 0);

  // ─── Per-shipment variable ──────────────────────────────────────────
  const packaging = isOn(input.costToggles, 'packaging')
    ? totalMonthlyShipments * input.packagingCostPerUnit
    : 0;
  const pickPack = isOn(input.costToggles, 'pickPack')
    ? totalMonthlyShipments * input.pickPackLaborPerOrder
    : 0;
  const labelsDocs = isOn(input.costToggles, 'labelsAndDocs')
    ? totalMonthlyShipments * input.labelsAndDocs
    : 0;
  const returnLog = isOn(input.costToggles, 'returnLogistics')
    ? totalMonthlyShipments * (input.returnRate / 100) * input.returnLogisticsCost
    : 0;
  const failedDeliveryHandling = isOn(input.costToggles, 'failedDeliveries')
    ? totalMonthlyShipments * (Math.max(0, input.failedDeliveryRate) / 100) * (input.failedDeliveryCost ?? input.returnLogisticsCost)
    : 0;

  const perShipment = packaging + pickPack + labelsDocs + returnLog + failedDeliveryHandling;

  // ─── Other ──────────────────────────────────────────────────────────
  const other =
    (isOn(input.costToggles, 'marketing') ? input.marketingBudget : 0) +
    (isOn(input.costToggles, 'accountingLegal') ? input.accountingLegal : 0) +
    (isOn(input.costToggles, 'technologySaaS') ? input.technologySaaS : 0) +
    (isOn(input.costToggles, 'cargoInsurance') ? input.cargoInsurance : 0) +
    (isOn(input.costToggles, 'liabilityInsurance') ? input.liabilityInsurance : 0) +
    (isOn(input.costToggles, 'misc') ? input.miscExpenses : 0);

  // ─── Total cost (excludes freelancer — that's a P&L pass-through) ───
  const totalCost = vehicleOwnership + vehicleRunning + people + facilities + perShipment + other;
  const costPerShipment = totalMonthlyShipments > 0 ? totalCost / totalMonthlyShipments : 0;

  // ─── Total revenue (includes opt-in fulfillment/subcontracting) ─────
  // A failed delivery is not assumed to be billable. This keeps the model
  // conservative and makes failed-delivery scenarios affect revenue as well
  // as handling cost.
  const failedRate = Math.min(1, Math.max(0, input.failedDeliveryRate) / 100);
  const realizedProviderRevenue = providerMonthlyRevenue * (1 - failedRate);
  const fulfillment = isOn(input.costToggles, 'fulfillment') ? input.fulfillmentRevenue : 0;
  const subcontracting = isOn(input.costToggles, 'subcontracting') ? input.subcontractingRevenue : 0;
  const totalRevenue = realizedProviderRevenue + fulfillment + subcontracting;

  const netMargin = totalRevenue - totalCost;
  const netMarginPercent = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;
  const burnRate = netMargin < 0 ? Math.abs(netMargin) : 0;
  const cashReserves = totalRevenue * 2;
  // Payment delay reduces cash collected during the current operating month.
  // This is a planning approximation, not an accounts-receivable ledger.
  const collectionFactor = Math.min(1, Math.max(0, 1 - Math.max(0, input.clientPaymentDelay) / WORKING_DAYS));
  const cashCollected = totalRevenue * collectionFactor;
  const cashBurn = Math.max(0, totalCost - cashCollected);
  const cashRunway = cashBurn > 0 ? cashReserves / cashBurn : 99;
  const operationalBreakeven = Math.round(totalCost / Math.max(1, weightedAvgRevenue) / WORKING_DAYS);
  const fleetUtilization = totalVehicleCount > 0
    ? Math.min(100, Math.max(0, (totalDailyShipments / (totalVehicleCount * 12)) * 100))
    : 0;

  // ─── Freelancer P&L (separate from fleet cost totals) ────────────────
  // Providers send us shipments; we route a configurable share to freelancers
  // who use their own car. We pay (providerPrice - 0.50) per shipment and keep 0.50 SAR.
  const freelancerIncluded = isOn(input.costToggles, 'freelancer');
  const freelancerProviderPrice = Math.max(0, input.freelancerProviderPrice);
  const freelancerRate = Math.min(Math.max(0, input.freelancerRate), Math.max(0, freelancerProviderPrice - 0.01));
  const freelancerMonthlyVolume = freelancerIncluded
    ? Math.min(totalMonthlyShipments, Math.max(0, input.freelancerMonthlyVolume ?? totalMonthlyShipments))
    : 0;
  const freelancerMonthlyRevenue = freelancerMonthlyVolume * freelancerProviderPrice;
  const freelancerMonthlyPayout = freelancerMonthlyVolume * freelancerRate;
  const freelancerMonthlyProfit = freelancerMonthlyVolume * (freelancerProviderPrice - freelancerRate);

  const costBreakdown: CostBreakdown = {
    vehicleOwnership,
    vehicleRunning,
    people,
    facilities,
    perShipment,
    other,
    costPerShipment,
    total: totalCost,
  };

  const revenueBreakdown: RevenueBreakdown = {
    providerRevenue: realizedProviderRevenue,
    fulfillment,
    subcontracting,
    total: totalRevenue,
  };

  return {
    totalRevenue,
    totalCost,
    netMargin,
    netMarginPercent,
    costPerShipment,
    burnRate,
    cashRunway: Math.min(cashRunway, 99),
    operationalBreakeven,
    totalDailyShipments,
    totalMonthlyShipments,
    avgRevenuePerShipment: weightedAvgRevenue,
    providerEvaluations,
    companyDriverCount,
    activeDriverCount,
    fleetUtilization,
    fleetMonthlyCost: vehicleOwnership + vehicleRunning,
    fuelMonthlyCost: fuelCost,
    maintenanceMonthlyCost: maintenanceCost,
    freelancerMonthlyVolume,
    freelancerMonthlyRevenue,
    freelancerMonthlyPayout,
    freelancerMonthlyProfit,
    costBreakdown,
    revenueBreakdown,
  };
}

/**
 * Patch the operational state. Drivers/vehicleClasses/providers/maintenance
 * are immutable lists, so callers replace them with the updated array.
 */
export function applyOperationalPatch(
  input: FinancialInput,
  patch: Partial<FinancialInput>
): FinancialInput {
  const next = { ...input, ...patch };
  if (patch.companyDriverCount !== undefined && patch.companyDriverCount !== input.drivers.length) {
    const diff = patch.companyDriverCount - input.drivers.length;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        next.drivers = [
          ...next.drivers,
          {
            id: `drv-${Date.now().toString(36)}-${i}`,
            fullName: `Driver ${next.drivers.length + 1}`,
            phone: '',
            nationalId: '',
            assignedVehicle: 'Van',
            status: 'active',
          },
        ];
      }
    } else {
      next.drivers = next.drivers.slice(0, patch.companyDriverCount);
    }
  }
  return next;
}
