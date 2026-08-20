// Feasibility Study Engine for Startup Risk Assessment
// Provides comprehensive financial modeling and risk management for new logistics ventures

export interface FeasibilityInput {
  initialFleetSize: number;
  vanPurchasePrice: number;
  monthlyFixedCosts: number;
  monthlyVariableCostPerVan: number;
  revenuePerDelivery: number;
  deliveriesPerVanPerDay: number;
  workingDaysPerMonth: number;
  projectionMonths: number;
  startupCapital: number;
  targetMargin: number; // %
}

export interface RiskFactor {
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number; // 0-1
  impact: number; // 0-1
  mitigation: string;
}

export interface FeasibilityOutput {
  breakEvenMonths: number;
  paybackPeriod: number;
  projectedMonthlyProfit: number;
  projectedAnnualProfit: number;
  profitabilityScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  cashFlowProjection: Array<{
    month: number;
    revenue: number;
    costs: number;
    profit: number;
    cumulativeCash: number;
  }>;
  riskFactors: RiskFactor[];
  recommendations: string[];
  startupCapitalRequired: number;
  bufferCapital: number; // 20% safety margin
}

export const DEFAULT_FEASIBILITY_INPUT: FeasibilityInput = {
  initialFleetSize: 5,
  vanPurchasePrice: 95000,
  monthlyFixedCosts: 22000,
  monthlyVariableCostPerVan: 8500,
  revenuePerDelivery: 22,
  deliveriesPerVanPerDay: 35,
  workingDaysPerMonth: 22,
  projectionMonths: 24,
  startupCapital: 500000,
  targetMargin: 15,
};

export function calculateFeasibility(input: FeasibilityInput): FeasibilityOutput {
  const monthlyRevenuePerVan =
    input.deliveriesPerVanPerDay *
    input.revenuePerDelivery *
    input.workingDaysPerMonth;

  const monthlyTotalRevenue = monthlyRevenuePerVan * input.initialFleetSize;
  const monthlyTotalCosts =
    input.monthlyFixedCosts +
    input.monthlyVariableCostPerVan * input.initialFleetSize;

  const monthlyProfit = monthlyTotalRevenue - monthlyTotalCosts;
  const profitMargin = (monthlyProfit / monthlyTotalRevenue) * 100;

  const totalInvestment_local = input.initialFleetSize * input.vanPurchasePrice;
  const initialCash = input.startupCapital - totalInvestment_local;
  const breakEvenMonths =
    monthlyProfit > 0
      ? Math.max(0, Math.ceil(Math.max(0, -initialCash) / monthlyProfit))
      : Math.ceil(input.projectionMonths * 1.5);

  // Payback period
  const totalInvestment = input.initialFleetSize * input.vanPurchasePrice;
  const paybackPeriod =
    monthlyProfit > 0 ? totalInvestment / monthlyProfit : Infinity;

  // Cash flow projection
  const cashFlowProjection: FeasibilityOutput['cashFlowProjection'] = [];
  let cumulativeCash = input.startupCapital - totalInvestment;

  for (let month = 1; month <= input.projectionMonths; month++) {
    const revenue = monthlyTotalRevenue;
    const costs = monthlyTotalCosts;
    const profit = revenue - costs;
    cumulativeCash += profit;

    cashFlowProjection.push({
      month,
      revenue,
      costs,
      profit,
      cumulativeCash,
    });
  }

  // Risk assessment
  const riskFactors = assessRisks(input, profitMargin, paybackPeriod);
  const riskLevel = calculateRiskLevel(riskFactors);
  const profitabilityScore = calculateProfitabilityScore(
    profitMargin,
    paybackPeriod,
    input.targetMargin
  );

  // Recommendations
  const recommendations = generateRecommendations(
    input,
    profitMargin,
    paybackPeriod,
    riskFactors
  );

  // Capital requirements
  const startupCapitalRequired =
    totalInvestment + input.monthlyFixedCosts * 3; // 3 months buffer
  const bufferCapital = startupCapitalRequired * 0.2;

  return {
    breakEvenMonths,
    paybackPeriod,
    projectedMonthlyProfit: monthlyProfit,
    projectedAnnualProfit: monthlyProfit * 12,
    profitabilityScore,
    riskLevel,
    cashFlowProjection,
    riskFactors,
    recommendations,
    startupCapitalRequired,
    bufferCapital,
  };
}

function assessRisks(
  input: FeasibilityInput,
  profitMargin: number,
  paybackPeriod: number
): RiskFactor[] {
  const risks: RiskFactor[] = [];

  // Market demand risk
  if (input.deliveriesPerVanPerDay < 30) {
    risks.push({
      name: 'Market Demand Risk',
      severity: 'high',
      probability: 0.6,
      impact: 0.8,
      mitigation:
        'Conduct market research and secure pre-contracts with customers',
    });
  }

  // Profitability risk
  if (profitMargin < 10) {
    risks.push({
      name: 'Low Profitability',
      severity: 'high',
      probability: 0.7,
      impact: 0.9,
      mitigation: 'Optimize operational costs and increase delivery rates',
    });
  }

  // Payback period risk
  if (paybackPeriod > 24) {
    risks.push({
      name: 'Extended Payback Period',
      severity: 'medium',
      probability: 0.5,
      impact: 0.7,
      mitigation: 'Increase fleet utilization and revenue per delivery',
    });
  }

  // Capital risk
  if (input.startupCapital < input.initialFleetSize * input.vanPurchasePrice * 1.3) {
    risks.push({
      name: 'Insufficient Capital Reserve',
      severity: 'critical',
      probability: 0.8,
      impact: 1.0,
      mitigation: 'Secure additional funding or lease vehicles instead of purchasing',
    });
  }

  // Operational risk
  risks.push({
    name: 'Driver Availability & Retention',
    severity: 'medium',
    probability: 0.5,
    impact: 0.6,
    mitigation: 'Offer competitive salaries and implement driver retention programs',
  });

  // Market competition risk
  risks.push({
    name: 'Market Competition',
    severity: 'medium',
    probability: 0.7,
    impact: 0.5,
    mitigation: 'Differentiate through service quality and technology adoption',
  });

  // Regulatory risk
  risks.push({
    name: 'Regulatory Changes',
    severity: 'low',
    probability: 0.3,
    impact: 0.4,
    mitigation: 'Stay updated with TGA regulations and maintain compliance',
  });

  return risks;
}

function calculateRiskLevel(
  riskFactors: RiskFactor[]
): 'low' | 'medium' | 'high' | 'critical' {
  const criticalRisks = riskFactors.filter(
    (r) => r.severity === 'critical' && r.probability * r.impact > 0.5
  );
  const highRisks = riskFactors.filter(
    (r) => r.severity === 'high' && r.probability * r.impact > 0.4
  );

  if (criticalRisks.length > 0) return 'critical';
  if (highRisks.length > 1) return 'high';
  if (highRisks.length > 0) return 'medium';
  return 'low';
}

function calculateProfitabilityScore(
  profitMargin: number,
  paybackPeriod: number,
  targetMargin: number
): number {
  let score = 50; // Base score

  // Margin contribution (0-30 points)
  const marginScore = Math.min(30, (profitMargin / targetMargin) * 30);
  score += marginScore;

  // Payback period contribution (0-20 points)
  const paybackScore = Math.max(0, 20 - paybackPeriod);
  score += paybackScore;

  return Math.min(100, Math.max(0, score));
}

function generateRecommendations(
  input: FeasibilityInput,
  profitMargin: number,
  paybackPeriod: number,
  riskFactors: RiskFactor[]
): string[] {
  const recommendations: string[] = [];

  if (profitMargin < 10) {
    recommendations.push(
      `Increase revenue per delivery from SAR ${input.revenuePerDelivery} to SAR ${(input.revenuePerDelivery * 1.15).toFixed(1)}`
    );
    recommendations.push(
      'Reduce operational costs by optimizing routes and reducing fuel consumption'
    );
  }

  if (input.deliveriesPerVanPerDay < 30) {
    recommendations.push(
      'Focus on market penetration to increase delivery volume per van'
    );
    recommendations.push(
      'Consider zone-based operations to maximize delivery density'
    );
  }

  if (paybackPeriod > 24) {
    recommendations.push(
      'Consider leasing vehicles instead of purchasing to reduce upfront capital'
    );
    recommendations.push(
      'Implement a phased fleet expansion strategy starting with 3-4 vans'
    );
  }

  recommendations.push(
    'Establish partnerships with e-commerce platforms for guaranteed volume'
  );
  recommendations.push(
    'Implement real-time tracking and optimization software to improve efficiency'
  );
  recommendations.push(
    'Maintain a 6-month operating expense reserve for business continuity'
  );

  const criticalRisks = riskFactors.filter((r) => r.severity === 'critical');
  if (criticalRisks.length > 0) {
    recommendations.push(
      'Address critical risks before launch: ' +
        criticalRisks.map((r) => r.name).join(', ')
    );
  }

  return recommendations;
}

export function generateRiskManagementPlan(
  riskFactors: RiskFactor[]
): string {
  let plan = '# Risk Management Plan\n\n';

  const criticalRisks = riskFactors.filter((r) => r.severity === 'critical');
  const highRisks = riskFactors.filter((r) => r.severity === 'high');
  const mediumRisks = riskFactors.filter((r) => r.severity === 'medium');

  if (criticalRisks.length > 0) {
    plan += '## Critical Risks (Immediate Action Required)\n\n';
    criticalRisks.forEach((risk) => {
      plan += `### ${risk.name}\n`;
      plan += `- **Probability:** ${(risk.probability * 100).toFixed(0)}%\n`;
      plan += `- **Impact:** ${(risk.impact * 100).toFixed(0)}%\n`;
      plan += `- **Mitigation:** ${risk.mitigation}\n\n`;
    });
  }

  if (highRisks.length > 0) {
    plan += '## High Risks (Develop Contingency Plans)\n\n';
    highRisks.forEach((risk) => {
      plan += `### ${risk.name}\n`;
      plan += `- **Probability:** ${(risk.probability * 100).toFixed(0)}%\n`;
      plan += `- **Impact:** ${(risk.impact * 100).toFixed(0)}%\n`;
      plan += `- **Mitigation:** ${risk.mitigation}\n\n`;
    });
  }

  if (mediumRisks.length > 0) {
    plan += '## Medium Risks (Monitor and Manage)\n\n';
    mediumRisks.forEach((risk) => {
      plan += `### ${risk.name}\n`;
      plan += `- **Probability:** ${(risk.probability * 100).toFixed(0)}%\n`;
      plan += `- **Impact:** ${(risk.impact * 100).toFixed(0)}%\n`;
      plan += `- **Mitigation:** ${risk.mitigation}\n\n`;
    });
  }

  return plan;
}
