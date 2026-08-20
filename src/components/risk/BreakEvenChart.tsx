'use client';

import { useMemo } from 'react';
import { FinancialInput, FinancialOutput } from '@/lib/types';
import {  Zap, Target, TrendingUp, TrendingDown } from 'lucide-react';

interface BreakEvenChartProps {
  input: FinancialInput;
  output: FinancialOutput;
}

interface Recommendation {
  type: 'revenue' | 'cost' | 'mixed';
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  impact: string;
  feasibility: 'High' | 'Medium' | 'Low';
  color: string;
}

export default function BreakEvenChart({ input, output }: BreakEvenChartProps) {
  const workingDays = 26;
  const totalFixedCosts = output.costBreakdown
    ? output.costBreakdown.vehicleOwnership + output.costBreakdown.facilities + output.costBreakdown.people * 0.7
    : output.totalCost * 0.5;

  const monthlyShipments = output.totalMonthlyShipments || input.providers.filter((p) => p.enabled).reduce((s, p) => s + p.shipmentsPerDay, 0) * workingDays;
  const dailyShipments = monthlyShipments / workingDays;
  const variablePerUnit = output.costPerShipment - (totalFixedCosts / Math.max(1, monthlyShipments));
  const revenuePerUnit = output.avgRevenuePerShipment;
  const contributionPerUnit = revenuePerUnit - variablePerUnit;

  const breakEvenUnits = contributionPerUnit > 0
    ? Math.ceil(totalFixedCosts / contributionPerUnit)
    : Infinity;

  const breakEvenDaily = Math.ceil(breakEvenUnits / workingDays);
  const currentMonthlyUnits = monthlyShipments;
  const isProfitable = output.netMargin > 0;

  // Generate Z-chart data
  const maxVolume = Math.max(currentMonthlyUnits * 1.5, breakEvenUnits * 1.2, 1000);
  const steps = 50;
  const chartData = Array.from({ length: steps }, (_, i) => {
    const units = Math.round((i / (steps - 1)) * maxVolume);
    const revenue = units * revenuePerUnit;
    const cost = totalFixedCosts + units * variablePerUnit;
    return { units, revenue, cost };
  });

  // Find break-even intersection
  const bePoint = chartData.find(d => d.revenue >= d.cost);

  // Recommendations
  const recommendations: Recommendation[] = useMemo(() => {
    if (isProfitable) return [];
    const recs: Recommendation[] = [];

    // Revenue lever
    const neededRevenueIncrease = Math.abs(output.netMargin);
    const priceIncrease = (neededRevenueIncrease / currentMonthlyUnits).toFixed(0);
    const volumeIncrease = Math.ceil(neededRevenueIncrease / contributionPerUnit);
    recs.push({
      type: 'revenue',
      icon: TrendingUp,
      title: 'Revenue Lever',
      description: `Increase avg price by SAR ${priceIncrease}/shipment OR add ${volumeIncrease} more shipments/month`,
      impact: `+SAR ${neededRevenueIncrease.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo`,
      feasibility: Number(priceIncrease) <= 3 ? 'High' : Number(priceIncrease) <= 8 ? 'Medium' : 'Low',
      color: '#22c55e',
    });

    // Cost lever
    const costGap = Math.abs(output.netMargin);
    const costReductionPct = ((costGap / output.totalCost) * 100).toFixed(1);
    recs.push({
      type: 'cost',
      icon: TrendingDown,
      title: 'Cost Reduction',
      description: `Reduce total costs by ${costReductionPct}% — target variable costs and renegotiate fixed commitments`,
      impact: `Save SAR ${costGap.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo`,
      feasibility: Number(costReductionPct) <= 5 ? 'High' : Number(costReductionPct) <= 12 ? 'Medium' : 'Low',
      color: '#f97316',
    });

    // Mixed strategy
    recs.push({
      type: 'mixed',
      icon: Zap,
      title: 'Mixed Strategy',
      description: `Raise price by SAR ${(Number(priceIncrease) * 0.5).toFixed(0)} AND cut costs by ${(Number(costReductionPct) * 0.5).toFixed(1)}%`,
      impact: `Combined SAR ${neededRevenueIncrease.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo impact`,
      feasibility: 'High',
      color: '#a855f7',
    });

    return recs;
  }, [isProfitable, output.netMargin, output.totalCost, currentMonthlyUnits, contributionPerUnit]);

  const maxY = Math.max(
    chartData[chartData.length - 1].revenue,
    chartData[chartData.length - 1].cost
  );

  return (
    <div className="space-y-4">
      {/* Z-Chart */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-[#eab308]" />
          <h3 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider">
            Break-Even Analysis
          </h3>
        </div>

        {/* Chart */}
        <div className="relative h-48 mb-3">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-6 w-12 flex flex-col justify-between text-[9px] text-[#52525b]">
            <span>SAR {(maxY / 1000).toFixed(0)}k</span>
            <span>SAR {(maxY / 2000).toFixed(0)}k</span>
            <span>0</span>
          </div>

          {/* Chart area */}
          <div className="ml-14 h-[calc(100%-24px)] relative border-b border-l border-[#2a2a33]">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75].map((pct) => (
              <div
                key={pct}
                className="absolute left-0 right-0 border-t border-[#2a2a33]/30"
                style={{ bottom: `${pct * 100}%` }}
              />
            ))}

            {/* Revenue line (green) */}
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
              <polyline
                points={chartData.map((d, i) =>
                  `${(i / (steps - 1)) * 100},${100 - (d.revenue / maxY) * 100}`
                ).join(' ')}
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <polyline
                points={chartData.map((d, i) =>
                  `${(i / (steps - 1)) * 100},${100 - (d.cost / maxY) * 100}`
                ).join(' ')}
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="4,2"
              />
            </svg>

            {/* Break-even marker */}
            {bePoint && (
              <div
                className="absolute w-0.5 h-full bg-[#eab308]/60"
                style={{
                  left: `${(bePoint.units / maxVolume) * 100}%`,
                }}
              >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-mono-data text-[#eab308] whitespace-nowrap">
                  B/E: {bePoint.units.toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {/* X-axis labels */}
          <div className="ml-14 flex justify-between text-[9px] text-[#52525b] mt-1">
            <span>0</span>
            <span>{(maxVolume / 2).toFixed(0)}</span>
            <span>{maxVolume.toFixed(0)} shipments</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] mb-3">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#22c55e] inline-block" /> Revenue
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#ef4444] inline-block" style={{ borderTop: '1px dashed #ef4444' }} /> Cost
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#eab308] inline-block" /> Break-Even
          </span>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-2">
          <BreakEvenStat
            label="Break-Even"
            value={`${breakEvenDaily} /day`}
            sub={`${breakEvenUnits} /month`}
            color="#eab308"
          />
          <BreakEvenStat
            label="Contribution"
            value={`SAR ${contributionPerUnit.toFixed(1)}`}
            sub="per shipment"
            color="#22c55e"
          />
          <BreakEvenStat
            label="Fixed Costs"
            value={`SAR ${(totalFixedCosts / 1000).toFixed(1)}k`}
            sub="per month"
            color="#3b82f6"
          />
          <BreakEvenStat
            label="Current Vol."
            value={`${Math.round(dailyShipments)} /day`}
            sub={`${isProfitable ? 'Above B/E ✓' : `${(breakEvenDaily - dailyShipments)} below B/E`}`}
            color={isProfitable ? '#22c55e' : '#ef4444'}
          />
        </div>
      </div>

      {/* Recommendations */}
      {!isProfitable && recommendations.length > 0 && (
        <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-[#a855f7]" />
            <h3 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider">
              How to Reach Break-Even
            </h3>
          </div>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div key={i} className="bg-[#0a0a0b] border border-[#2a2a33] rounded p-3 hover:border-[#3d3d4a] transition-all">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span style={{ color: rec.color }}><rec.icon className="w-4 h-4" /></span>
                    <span className="text-xs font-semibold text-[#e4e4e7]">{rec.title}</span>
                  </div>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                      rec.feasibility === 'High'
                        ? 'bg-[#22c55e]/20 text-[#22c55e]'
                        : rec.feasibility === 'Medium'
                        ? 'bg-[#eab308]/20 text-[#eab308]'
                        : 'bg-[#ef4444]/20 text-[#ef4444]'
                    }`}
                  >
                    {rec.feasibility} Feasibility
                  </span>
                </div>
                <p className="text-[11px] text-[#a1a1aa] mb-1">{rec.description}</p>
                <p className="text-[10px] font-mono-data" style={{ color: rec.color }}>
                  Impact: {rec.impact}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BreakEvenStat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-[#0a0a0b] rounded p-2 border border-[#2a2a33]/50 text-center">
      <div className="text-[9px] text-[#52525b] uppercase mb-0.5">{label}</div>
      <div className="font-mono-data text-xs font-bold" style={{ color }}>{value}</div>
      <div className="text-[8px] text-[#52525b] mt-0.5">{sub}</div>
    </div>
  );
}
