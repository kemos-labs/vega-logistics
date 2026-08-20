// VEGA Logistics OS — Advanced Risk Frameworks
// FMEA · VaR · SCRS calculation engines
// All monetary values in SAR. Riyadh logistics context.

// ─── FMEA Types ───

export interface FMEAItem {
  node: string;
  failureMode: string;
  severity: number; // 1-10
  occurrence: number; // 1-10
  detectability: number; // 1-10
}

export interface FMEAResult {
  items: FMEAItem[];
  totalRPN: number;
  criticalItems: FMEAItem[];
  suggestions: string[];
}

// ─── VaR Types ───

export interface VaRResult {
  confidence95: number;
  confidence99: number;
  interpretation: string;
  monthlyRevenue: number;
}

// ─── SCRS Types ───

export interface SCRSFactor {
  name: string;
  score: number; // 0-100
  description: string;
}

export interface SCRSResult {
  overallScore: number;
  level: string;
  factors: SCRSFactor[];
  radarData: { category: string; score: number }[];
  recommendations: string[];
}

// ═══════════════════════════════════════════
//  FMEA: Failure Mode & Effects Analysis
// ═══════════════════════════════════════════

/**
 * Riyadh logistics FMEA — maps every node in the supply chain
 * to realistic failure modes with S/O/D scores.
 * RPN = Severity × Occurrence × Detectability.
 * Items with RPN > 200 are flagged as Critical.
 */
export function runFMEA(): FMEAResult {
  const items: FMEAItem[] = [
    // ── Supplier Node ──
    {
      node: 'Supplier',
      failureMode: 'Raw material shortage due to port congestion at King Abdulaziz Port',
      severity: 8,
      occurrence: 5,
      detectability: 6,
    },
    {
      node: 'Supplier',
      failureMode: 'Supplier quality batch rejected — non-compliance with SASO standards',
      severity: 7,
      occurrence: 4,
      detectability: 4,
    },
    {
      node: 'Supplier',
      failureMode: 'Supplier payment dispute delays order release',
      severity: 6,
      occurrence: 3,
      detectability: 7,
    },

    // ── Warehouse Node ──
    {
      node: 'Warehouse',
      failureMode: 'Temperature excursion in cold chain storage (40°C+ Riyadh summer)',
      severity: 9,
      occurrence: 6,
      detectability: 5,
    },
    {
      node: 'Warehouse',
      failureMode: 'Inventory misplacement — WMS system sync failure',
      severity: 7,
      occurrence: 5,
      detectability: 5,
    },
    {
      node: 'Warehouse',
      failureMode: 'Picking/packing error — wrong SKU dispatched',
      severity: 5,
      occurrence: 6,
      detectability: 3,
    },

    // ── Transit Node ──
    {
      node: 'Transit',
      failureMode: 'Route delay due to Riyadh Ring Road congestion (peak hour gridlock)',
      severity: 7,
      occurrence: 8,
      detectability: 3,
    },
    {
      node: 'Transit',
      failureMode: 'Vehicle breakdown in desert corridor — no nearby service station',
      severity: 8,
      occurrence: 4,
      detectability: 7,
    },
    {
      node: 'Transit',
      failureMode: 'Cargo theft during overnight transit on Highway 40',
      severity: 10,
      occurrence: 2,
      detectability: 8,
    },

    // ── Last-Mile Node ──
    {
      node: 'Last-Mile',
      failureMode: 'Address not found — incomplete/non-standard Saudi addressing',
      severity: 6,
      occurrence: 8,
      detectability: 4,
    },
    {
      node: 'Last-Mile',
      failureMode: 'Customer not available — delivery attempt after Maghrib prayer',
      severity: 4,
      occurrence: 7,
      detectability: 2,
    },
    {
      node: 'Last-Mile',
      failureMode: 'Access denied in gated compound — security clearance delay',
      severity: 5,
      occurrence: 5,
      detectability: 5,
    },

    // ── Customer Node ──
    {
      node: 'Customer',
      failureMode: 'Refused delivery — product damage not detected at earlier checkpoints',
      severity: 8,
      occurrence: 4,
      detectability: 6,
    },
    {
      node: 'Customer',
      failureMode: 'COD payment failure — customer disputes charges on delivery',
      severity: 7,
      occurrence: 5,
      detectability: 4,
    },
  ];


  const totalRPN = items.reduce((sum, i) => sum + i.severity * i.occurrence * i.detectability, 0);

  const criticalItems = items.filter(
    (i) => i.severity * i.occurrence * i.detectability > 200
  );

  // Auto-generate mitigation suggestions from critical items
  const suggestions: string[] = [];

  for (const item of criticalItems) {
    const rpn = item.severity * item.occurrence * item.detectability;

    if (item.failureMode.includes('cold chain')) {
      suggestions.push(
        `[${item.node}] Install redundant IoT temperature sensors with real-time alerts and backup generator for cold storage (RPN=${rpn}).`
      );
    }
    if (item.failureMode.includes('theft')) {
      suggestions.push(
        `[${item.node}] Deploy GPS trackers with geofencing, driver panic buttons, and 24/7 monitored CCTV on Highway 40 routes (RPN=${rpn}).`
      );
    }
    if (item.failureMode.includes('congestion')) {
      suggestions.push(
        `[${item.node}] Implement dynamic route optimization with real-time traffic data from Riyadh Traffic Management Center (RPN=${rpn}).`
      );
    }
    if (item.failureMode.includes('SASO')) {
      suggestions.push(
        `[${item.node}] Mandate pre-shipment SASO inspection at source and dual-source critical raw materials (RPN=${rpn}).`
      );
    }
    if (item.failureMode.includes('addressing')) {
      suggestions.push(
        `[${item.node}] Integrate Saudi National Address (Wasel) API for address validation and geocoding at order intake (RPN=${rpn}).`
      );
    }
    if (item.failureMode.includes('COD')) {
      suggestions.push(
        `[${item.node}] Offer digital pre-payment incentives (STC Pay / Apple Pay) and route COD orders through trusted senior drivers only (RPN=${rpn}).`
      );
    }
    if (item.failureMode.includes('breakdown')) {
      suggestions.push(
        `[${item.node}] Establish preventive maintenance schedule every 5,000 km and station recovery vehicles at midpoint depots along desert corridors (RPN=${rpn}).`
      );
    }
  }

  // Deduplicate suggestions
  const uniqueSuggestions = [...new Set(suggestions)];

  return {
    items,
    totalRPN,
    criticalItems,
    suggestions: uniqueSuggestions,
  };
}

// ═══════════════════════════════════════════
//  VaR: Parametric Value at Risk
// ═══════════════════════════════════════════

const Z_SCORE_95 = 1.645;
const Z_SCORE_99 = 2.326;

/**
 * Calculate parametric Value at Risk for monthly logistics revenue.
 *
 * Formula: VaR = monthlyRevenue × zScore × volatilityPercent
 *
 * @param monthlyRevenue  Total monthly revenue in SAR
 * @param volatilityPercent  Expected volatility as a percentage (e.g. 15 means 15%)
 * @returns VaRResult with both 95% and 99% confidence levels plus interpretation
 */
export function calculateVaR(
  monthlyRevenue: number,
  volatilityPercent: number
): VaRResult {
  const volDecimal = volatilityPercent / 100;

  const var95 = monthlyRevenue * Z_SCORE_95 * volDecimal;
  const var99 = monthlyRevenue * Z_SCORE_99 * volDecimal;

  const formatSAR = (v: number): string =>
    `SAR ${Math.round(v).toLocaleString('en-US')}`;

  const loss95 = formatSAR(var95);
  const loss99 = formatSAR(var99);

  const interpretation = [
    `There is a 5% chance of losing more than ${loss95} in a given month.`,
    `At 99% confidence, losses could exceed ${loss99} — this is the "once in 8 years" scenario.`,
    volDecimal > 0.20
      ? '⚠️ High volatility detected — consider hedging fuel costs and diversifying revenue streams.'
      : volDecimal > 0.10
        ? 'Moderate volatility — maintain a cash buffer of at least 2× the 95% VaR.'
        : 'Low volatility — current risk exposure is well-contained.',
  ].join(' ');

  return {
    confidence95: Math.round(var95),
    confidence99: Math.round(var99),
    interpretation,
    monthlyRevenue,
  };
}

// ═══════════════════════════════════════════
//  SCRS: Supply Chain Resilience Score
// ═══════════════════════════════════════════

/**
 * Six-factor Supply Chain Resilience Score (0-100 each).
 * Weighted average determines the overall resilience level.
 *
 * Levels: Strong (70+) · Adequate (50-69) · Vulnerable (30-49) · Critical (<30)
 */
export function calculateSCRS(): SCRSResult {
  // ── Factor 1: Supplier Diversification ──
  // Riyadh logistics: 4 active suppliers, 2 backup → moderate diversification
  const supplierCount = 4;
  const backupSuppliers = 2;
  const supplierDiversificationScore = Math.min(
    100,
    (supplierCount * 15) + (backupSuppliers * 20) // 4×15 + 2×20 = 100
  );

  // ── Factor 2: Lead Time Buffer ──
  // Safety stock covers 14 days of operations — moderate buffer
  const safetyStockDays = 14;
  const leadTimeBufferScore = Math.min(100, safetyStockDays * 5 + 30); // 14×5+30 = 100

  // ── Factor 3: Demand Forecast Accuracy ──
  // MAPE of 12% → decent accuracy
  const mape = 12; // Mean Absolute Percentage Error
  const forecastAccuracyScore = Math.max(0, 100 - mape * 3); // 100 - 36 = 64

  // ── Factor 4: Inventory Days on Hand ──
  // 28 days coverage — above average
  const inventoryDaysOnHand = 28;
  const inventoryScore = Math.min(100, inventoryDaysOnHand * 2.5); // 28×2.5 = 70

  // ── Factor 5: Geographic Risk ──
  // Single main warehouse in Riyadh + 1 satellite in Dammam → moderate risk
  const warehouseLocations: number = 2;
  const singleLocationRisk = warehouseLocations === 1 ? 30 : warehouseLocations <= 2 ? 20 : 10;
  const geographicRiskScore = 100 - singleLocationRisk; // 100 - 20 = 80

  // ── Factor 6: Single Point of Failure ──
  // 3 critical nodes with 2 having backups → moderate dependency
  const criticalNodes = 3;
  const backedUpNodes = 2;
  const spofScore = Math.min(100, ((backedUpNodes / criticalNodes) * 70) + 30); // (2/3)×70 + 30 = 76.7

  // ── Compile Factors ──
  const factors: SCRSFactor[] = [
    {
      name: 'Supplier Diversification',
      score: supplierDiversificationScore,
      description: `${supplierCount} active + ${backupSuppliers} backup suppliers. Dual-sourcing key materials reduces disruption exposure.`,
    },
    {
      name: 'Lead Time Buffer',
      score: leadTimeBufferScore,
      description: `${safetyStockDays} days of safety stock buffer. Absorbs upstream delays before impacting last-mile delivery.`,
    },
    {
      name: 'Demand Forecast Accuracy',
      score: forecastAccuracyScore,
      description: `MAPE of ${mape}% — predictions are within a reasonable margin. Seasonal Ramadan spikes are partially modeled.`,
    },
    {
      name: 'Inventory Days on Hand',
      score: inventoryScore,
      description: `${inventoryDaysOnHand} days of coverage. Sufficient to survive a 3-week supply disruption without stockout.`,
    },
    {
      name: 'Geographic Risk',
      score: geographicRiskScore,
      description: `${warehouseLocations} warehouse locations. Multi-city distribution reduces exposure to a single-region event.`,
    },
    {
      name: 'Single Point of Failure',
      score: Math.round(spofScore),
      description: `${backedUpNodes}/${criticalNodes} critical nodes have redundancy. Remaining single points require contingency plans.`,
    },
  ];

  // ── Weighted Overall Score ──
  const weights = [0.20, 0.20, 0.15, 0.15, 0.15, 0.15];
  const overallScore = Math.round(
    factors.reduce((sum, f, i) => sum + f.score * weights[i], 0)
  );

  // ── Level Classification ──
  let level: string;
  if (overallScore >= 70) level = 'Strong';
  else if (overallScore >= 50) level = 'Adequate';
  else if (overallScore >= 30) level = 'Vulnerable';
  else level = 'Critical';

  // ── Radar Chart Data ──
  const radarData = factors.map((f) => ({
    category: f.name,
    score: f.score,
  }));

  // ── Recommendations ──
  const recommendations: string[] = [];
  for (const f of factors) {
    if (f.score < 50) {
      switch (f.name) {
        case 'Supplier Diversification':
          recommendations.push(
            '🔴 Onboard 2-3 additional suppliers from Dammam and Jeddah industrial zones. Target 6+ active suppliers with multi-source contracts.'
          );
          break;
        case 'Lead Time Buffer':
          recommendations.push(
            '🔴 Increase safety stock to 21+ days. Negotiate vendor-managed inventory (VMI) with top 3 suppliers for auto-replenishment.'
          );
          break;
        case 'Demand Forecast Accuracy':
          recommendations.push(
            '🔴 Implement machine-learning demand forecasting with seasonality decomposition. Integrate Ramadan, Hajj, and back-to-school cycles.'
          );
          break;
        case 'Inventory Days on Hand':
          recommendations.push(
            '🔴 Build to 30+ days coverage for critical SKUs. Use ABC analysis to prioritize high-value items with low turnover.'
          );
          break;
        case 'Geographic Risk':
          recommendations.push(
            '🔴 Establish a second major distribution hub in Dammam or Jeddah. Split inventory 60/40 between locations.'
          );
          break;
        case 'Single Point of Failure':
          recommendations.push(
            '🔴 Conduct dependency mapping for all critical nodes. Implement hot-standby redundancy for WMS, TMS, and dispatch systems.'
          );
          break;
      }
    } else if (f.score < 70) {
      switch (f.name) {
        case 'Supplier Diversification':
          recommendations.push(
            '🟡 Pre-qualify 2 additional backup suppliers. Negotiate flexible capacity agreements to scale up during peak demand.'
          );
          break;
        case 'Lead Time Buffer':
          recommendations.push(
            '🟡 Track lead time variability weekly. Set dynamic buffer levels based on supplier reliability scores.'
          );
          break;
        case 'Demand Forecast Accuracy':
          recommendations.push(
            '🟡 Conduct weekly forecast vs. actual reviews. Refine models with customer-level purchase history and return patterns.'
          );
          break;
        case 'Inventory Days on Hand':
          recommendations.push(
            '🟡 Increase high-turnover SKU coverage to 35 days. Reduce slow-moving inventory through promotional bundling.'
          );
          break;
        case 'Geographic Risk':
          recommendations.push(
            '🟡 Evaluate micro-fulfillment centers in north and west Riyadh for same-day delivery zones.'
          );
          break;
        case 'Single Point of Failure':
          recommendations.push(
            '🟡 Document runbooks for all single points of failure. Cross-train staff on backup procedures for each critical node.'
          );
          break;
      }
    }
  }

  // If overall score is strong, add a positive note
  if (recommendations.length === 0 && overallScore >= 70) {
    recommendations.push(
      '✅ All resilience factors are within strong thresholds. Continue quarterly SCRS reviews and monitor leading indicators for early warning signs.'
    );
  }

  return {
    overallScore,
    level,
    factors,
    radarData,
    recommendations,
  };
}
