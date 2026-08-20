'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { FinancialInput, FinancialOutput } from '@/lib/types';
import { runMonteCarlo, MonteCarloResult } from '@/lib/riskEngine';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Calculator,
  
  Zap,
} from 'lucide-react';

// ─── Props ───

interface MonteCarloPanelProps {
  input: FinancialInput;
  output: FinancialOutput;
}

// ─── Formatting ───

function formatSAR(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')}`;
}


// ─── Percentile helpers ───

function percentile(sorted: number[], p: number): number {
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

// ─── Metric Card ───

function MetricCard({
  label,
  value,
  interpretation,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  interpretation: string;
  accent: string;
  icon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <div className="border border-[#2a2a33] rounded bg-[#0a0a0b] p-4 hover:border-[#3d3d4a] transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: accent, display: 'flex' }}>
          <Icon size={14} />
        </span>
        <span className="text-[10px] text-[#71717a] uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-mono-data text-xl font-bold text-[#e4e4e7]" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-[10px] text-[#52525b] mt-1 leading-relaxed">{interpretation}</div>
    </div>
  );
}

// ─── Stat Cell ───

function StatCell({ label, value, color, suffix }: { label: string; value: string; color: string; suffix?: string }) {
  return (
    <div className="bg-[#0a0a0b] rounded p-2.5 border border-[#2a2a33]/50 text-center">
      <div className="text-[9px] text-[#52525b] uppercase mb-0.5">{label}</div>
      <div className="font-mono-data text-sm font-bold" style={{ color }}>
        {value}{suffix && <span className="text-[10px] ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}

// ─── SVG Histogram ───

function HistogramChart({
  distribution,
  marginP10,
  marginP50,
  marginP90,
  
}: {
  distribution: MonteCarloResult['distribution'];
  marginP10: number;
  marginP50: number;
  marginP90: number;
  collapseProb: number;
}) {
  const width = 620;
  const height = 200;
  const padding = { top: 10, right: 20, bottom: 30, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const { bins, counts, p5, p95 } = distribution;
  const maxCount = Math.max(...counts, 1);
  const binCount = counts.length;
  const barWidth = chartW / binCount;

  // X-axis range
  const xStart = bins[0];
  const xEnd = bins[bins.length - 1] + (bins[1] - bins[0]);

  // Y axis ticks
  const yTicks = 5;

  // Map a value to x pixel position
  const xPos = (val: number): number => {
    return padding.left + ((val - xStart) / (xEnd - xStart)) * chartW;
  };

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="min-w-[500px]">
        {/* Grid lines */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const y = padding.top + (chartH * i) / yTicks;
          return (
            <g key={`grid-${i}`}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + chartW}
                y2={y}
                stroke="#2a2a33"
                strokeWidth="0.5"
                strokeDasharray="2 2"
              />
            </g>
          );
        })}

        {/* Bars */}
        {counts.map((count, i) => {
          const barH = (count / maxCount) * chartH;
          const x = padding.left + i * barWidth;
          const y = padding.top + chartH - barH;
          const isPositiveBin = bins[i] >= 0;
          const color = isPositiveBin ? '#22c55e' : '#ef4444';

          return (
            <g key={`bar-${i}`}>
              <rect
                x={x + 1}
                y={y}
                width={Math.max(barWidth - 1, 1)}
                height={barH}
                fill={color}
                opacity={0.7}
                rx="1"
              />
            </g>
          );
        })}

        {/* P10 Marker */}
        <line
          x1={xPos(marginP10)}
          y1={padding.top}
          x2={xPos(marginP10)}
          y2={padding.top + chartH}
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeDasharray="6 3"
          opacity={0.8}
        />
        <text
          x={xPos(marginP10)}
          y={padding.top - 3}
          textAnchor="middle"
          fill="#3b82f6"
          fontSize="9"
          fontWeight="bold"
        >
          P10
        </text>

        {/* P50 Marker */}
        <line
          x1={xPos(marginP50)}
          y1={padding.top}
          x2={xPos(marginP50)}
          y2={padding.top + chartH}
          stroke="#eab308"
          strokeWidth="1.5"
          strokeDasharray="6 3"
          opacity={0.8}
        />
        <text
          x={xPos(marginP50)}
          y={padding.top - 3}
          textAnchor="middle"
          fill="#eab308"
          fontSize="9"
          fontWeight="bold"
        >
          P50
        </text>

        {/* P90 Marker */}
        <line
          x1={xPos(marginP90)}
          y1={padding.top}
          x2={xPos(marginP90)}
          y2={padding.top + chartH}
          stroke="#f97316"
          strokeWidth="1.5"
          strokeDasharray="6 3"
          opacity={0.8}
        />
        <text
          x={xPos(marginP90)}
          y={padding.top - 3}
          textAnchor="middle"
          fill="#f97316"
          fontSize="9"
          fontWeight="bold"
        >
          P90
        </text>

        {/* Zero line if visible */}
        {xStart <= 0 && xEnd >= 0 && (
          <line
            x1={xPos(0)}
            y1={padding.top}
            x2={xPos(0)}
            y2={padding.top + chartH}
            stroke="#71717a"
            strokeWidth="1"
            opacity={0.5}
          />
        )}

        {/* X Axis */}
        <line
          x1={padding.left}
          y1={padding.top + chartH}
          x2={padding.left + chartW}
          y2={padding.top + chartH}
          stroke="#3f3f46"
          strokeWidth="0.5"
        />

        {/* X Axis Labels */}
        {[p5, distribution.median, p95].map((val, i) => (
          <text
            key={`xlabel-${i}`}
            x={xPos(val)}
            y={padding.top + chartH + 14}
            textAnchor="middle"
            fill="#52525b"
            fontSize="9"
          >
            {val.toFixed(1)}%
          </text>
        ))}

        {/* Y Axis Labels */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const val = Math.round((maxCount * i) / yTicks);
          const y = padding.top + chartH - (chartH * i) / yTicks;
          return (
            <text
              key={`ylabel-${i}`}
              x={padding.left - 6}
              y={y + 3}
              textAnchor="end"
              fill="#52525b"
              fontSize="8"
            >
              {val}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════
//  MonteCarloPanel
// ═══════════════════════════════════════════

export default function MonteCarloPanel({ input }: MonteCarloPanelProps) {
  const [simCount, setSimCount] = useState(1000);
  const [isRunning, setIsRunning] = useState(false);
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);

  const runSimulation = useCallback(() => {
    setIsRunning(true);
    setTimeout(() => {
      const result = runMonteCarlo(input, simCount);
      setMcResult(result);
      setIsRunning(false);
    }, 50);
  }, [input, simCount]);

  // Auto-run on mount
  useEffect(() => {
    // Deliberate initial simulation for this read-only analysis panel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runSimulation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed percentiles ──

  const costPercentiles = useMemo(() => {
    if (!mcResult) return null;
    const totalMonthlyShipments = input.providers.filter((p) => p.enabled).reduce((s, p) => s + p.shipmentsPerDay, 0) * 26;
    const totalCosts = mcResult.results.costPerShipment.map((c) => c * totalMonthlyShipments);
    const sorted = [...totalCosts].sort((a, b) => a - b);
    return {
      p10: percentile(sorted, 0.1),
      p50: percentile(sorted, 0.5),
      p90: percentile(sorted, 0.9),
    };
  }, [mcResult, input.providers]);

  const marginPercentiles = useMemo(() => {
    if (!mcResult) return null;
    const sorted = [...mcResult.results.netMargin].sort((a, b) => a - b);
    return {
      p10: percentile(sorted, 0.1),
      p50: percentile(sorted, 0.5),
      p90: percentile(sorted, 0.9),
    };
  }, [mcResult]);

  const collapseProb = mcResult?.results.collapseProbability ?? 0;

  return (
    <div className="space-y-4">
      {/* ─── Controls ─── */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-[11px]">
          <Calculator size={13} className="text-[#71717a]" />
          <span className="text-[#71717a]">Simulations:</span>
          <select
            value={simCount}
            onChange={(e) => setSimCount(Number(e.target.value))}
            className="bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1 text-xs font-mono-data text-[#e4e4e7] focus:border-[#22c55e] focus:outline-none cursor-pointer"
          >
            <option value={250}>250</option>
            <option value={500}>500</option>
            <option value={1000}>1,000</option>
            <option value={2000}>2,000</option>
            <option value={5000}>5,000</option>
          </select>
        </div>
        <button
          onClick={runSimulation}
          disabled={isRunning}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
            isRunning
              ? 'bg-[#2a2a33] text-[#52525b] cursor-not-allowed'
              : 'bg-[#22c55e]/90 text-[#0a0a0b] hover:bg-[#22c55e]'
          }`}
        >
          {isRunning ? (
            <>
              <Activity size={12} className="animate-spin" />
              Running...
            </>
          ) : (
            <>
              <BarChart3 size={12} />
              Run Simulation
            </>
          )}
        </button>
        {mcResult && (
          <span className="text-[10px] text-[#52525b] font-mono-data">
            {mcResult.scenarios.length.toLocaleString()} scenarios computed
          </span>
        )}
      </div>

      {mcResult && costPercentiles && marginPercentiles && (
        <>
          {/* ─── P10 / P50 / P90 Cost Scenarios ─── */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              label="P10 · Optimistic"
              value={`SAR ${formatSAR(costPercentiles.p10)}`}
              interpretation="10th percentile — only 10% of scenarios beat this cost. Best-case operational efficiency."
              accent="#22c55e"
              icon={TrendingDown}
            />
            <MetricCard
              label="P50 · Baseline"
              value={`SAR ${formatSAR(costPercentiles.p50)}`}
              interpretation="50th percentile — median expected total cost. Most likely scenario at current parameters."
              accent="#3b82f6"
              icon={Activity}
            />
            <MetricCard
              label="P90 · Worst-Case"
              value={`SAR ${formatSAR(costPercentiles.p90)}`}
              interpretation="90th percentile — 10% chance costs exceed this. Stress scenario requiring contingency reserves."
              accent="#ef4444"
              icon={TrendingUp}
            />
          </div>

          {/* ─── Histogram Chart ─── */}
          <div className="border border-[#2a2a33] rounded bg-[#0a0a0b] p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={14} className="text-[#a1a1aa]" />
              <span className="text-[10px] text-[#71717a] uppercase tracking-wider">
                Net Margin Distribution · {mcResult.scenarios.length.toLocaleString()} Scenarios
              </span>
            </div>

            <HistogramChart
              distribution={mcResult.distribution}
              marginP10={marginPercentiles.p10}
              marginP50={marginPercentiles.p50}
              marginP90={marginPercentiles.p90}
              collapseProb={collapseProb}
            />

            {/* Legend */}
            <div className="flex items-center gap-6 mt-3 text-[9px] text-[#52525b]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[#22c55e] opacity-70" />
                <span>Positive Margin</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[#ef4444] opacity-70" />
                <span>Negative Margin</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 border-t border-dashed border-[#3b82f6]" />
                <span>P10</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 border-t border-dashed border-[#eab308]" />
                <span>P50</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 border-t border-dashed border-[#f97316]" />
                <span>P90</span>
              </div>
            </div>
          </div>

          {/* ─── Stats Grid ─── */}
          <div className="grid grid-cols-4 gap-2">
            <StatCell
              label="Mean Margin"
              value={`${mcResult.distribution.mean.toFixed(1)}%`}
              color={mcResult.distribution.mean >= 0 ? '#22c55e' : '#ef4444'}
            />
            <StatCell
              label="Median Margin"
              value={`${mcResult.distribution.median.toFixed(1)}%`}
              color={mcResult.distribution.median >= 0 ? '#22c55e' : '#ef4444'}
            />
            <StatCell
              label="Std Deviation"
              value={`${mcResult.distribution.stdDev.toFixed(1)}%`}
              color={mcResult.distribution.stdDev > 8 ? '#f97316' : '#a1a1aa'}
            />
            <StatCell
              label="Collapse Probability"
              value={`${(collapseProb * 100).toFixed(1)}`}
              suffix="%"
              color={collapseProb > 0.1 ? '#ef4444' : collapseProb > 0.05 ? '#f97316' : '#22c55e'}
            />
          </div>

          {/* ─── AI Insight ─── */}
          <div className="bg-[#0a0a0b] border border-[#2a2a33] rounded p-3">
            <div className="flex items-start gap-2">
              <Zap size={13} className="mt-0.5 shrink-0 text-[#a855f7]" />
              <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                {collapseProb > 0.15 ? (
                  <>
                    <span className="text-[#ef4444] font-bold">🚨 High Risk —</span>{' '}
                    {(collapseProb * 100).toFixed(0)}% of scenarios result in negative margins.
                    This operation has significant systemic risk. Consider reducing fleet size or
                    increasing shipment density immediately.
                  </>
                ) : collapseProb > 0.05 ? (
                  <>
                    <span className="text-[#f97316] font-bold">⚠ Moderate Tail Risk —</span>{' '}
                    {(collapseProb * 100).toFixed(0)}% chance of negative margins. Monitor fuel
                    costs and failed deliveries closely. Maintain at least 6 months liquidity
                    reserve.
                  </>
                ) : (
                  <>
                    <span className="text-[#22c55e] font-bold">✅ Strong Resilience —</span>{' '}
                    Only {(collapseProb * 100).toFixed(1)}% of scenarios show negative margins.
                    Current strategy is sustainable. Cost range:{' '}
                    {costPercentiles
                      ? `SAR ${formatSAR(costPercentiles.p10)} → SAR ${formatSAR(costPercentiles.p90)}`
                      : ''}
                    .
                  </>
                )}
              </p>
            </div>
          </div>
        </>
      )}

      {!mcResult && (
        <div className="text-center py-12 text-[#52525b] text-sm flex flex-col items-center gap-3">
          <Activity size={24} className="animate-spin" />
          Running Monte Carlo simulation...
        </div>
      )}
    </div>
  );
}
