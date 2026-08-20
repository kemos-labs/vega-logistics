'use client';

import { useState, useEffect } from 'react';
import { FinancialInput, FinancialOutput } from '@/lib/types';
import { runMonteCarlo, calculateRiskScores, RiskScores, MonteCarloResult } from '@/lib/riskEngine';
import { Shield, Zap, BarChart3 } from 'lucide-react';

interface RiskCalculatorProps {
  input: FinancialInput;
  output: FinancialOutput;
}

function RiskBar({ label, score, level, color }: { label: string; score: number; level: string; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[#a1a1aa]">{label}</span>
        <span className="font-mono-data" style={{ color }}>
          {score}/100 <span className="text-[10px]">· {level}</span>
        </span>
      </div>
      <div className="h-1.5 bg-[#0a0a0b] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function DistributionChart({ mc }: { mc: MonteCarloResult }) {
  const maxCount = Math.max(...mc.distribution.counts);
  return (
    <div className="mt-3">
      <div className="text-[10px] text-[#52525b] uppercase tracking-wider mb-2">
        Net Margin Distribution ({mc.distribution.bins.length} scenarios)
      </div>
      <div className="flex items-end gap-[1px] h-20">
        {mc.distribution.counts.map((count, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: `${(count / maxCount) * 100}%`,
                backgroundColor: mc.distribution.bins[i] >= 0 ? '#22c55e' : '#ef4444',
                opacity: 0.7,
              }}
              title={`Bin ${mc.distribution.bins[i].toFixed(1)}%: ${count} scenarios`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-[#52525b] mt-1">
        <span>{mc.distribution.p5.toFixed(1)}% (P5)</span>
        <span>{mc.distribution.median.toFixed(1)}% (Median)</span>
        <span>{mc.distribution.p95.toFixed(1)}% (P95)</span>
      </div>
    </div>
  );
}

export default function RiskCalculator({ input, output }: RiskCalculatorProps) {
  const [simCount, setSimCount] = useState(500);
  const [isRunning, setIsRunning] = useState(false);
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [riskScores, setRiskScores] = useState<RiskScores>(() => calculateRiskScores(input, output));

  const runSimulation = () => {
    setIsRunning(true);
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      const result = runMonteCarlo(input, simCount);
      setMcResult(result);
      setRiskScores(calculateRiskScores(input, output, result));
      setIsRunning(false);
    }, 100);
  };

  // Auto-run on mount
  useEffect(() => {
    // Deliberate initial simulation for this read-only analysis panel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runSimulation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* Risk Score Card */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4" style={{ color: riskScores.overallRisk.color }} />
          <h3 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider">
            Risk Assessment
          </h3>
          <div
            className="ml-auto text-xs font-mono-data font-bold px-3 py-1 rounded-full"
            style={{
              color: riskScores.overallRisk.color,
              backgroundColor: `${riskScores.overallRisk.color}20`,
            }}
          >
            {riskScores.overallRisk.level} · {riskScores.overallRisk.score}/100
          </div>
        </div>

        <div className="space-y-3">
          <RiskBar label="Liquidity Risk" {...riskScores.liquidityRisk} />
          <RiskBar label="Operational Risk" {...riskScores.operationalRisk} />
          <RiskBar label="Strategic Risk" {...riskScores.strategicRisk} />
          <RiskBar label="Market Risk" {...riskScores.marketRisk} />
        </div>
      </div>

      {/* Monte Carlo */}
      <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-[#3b82f6]" />
          <h3 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider">
            Monte Carlo Simulation
          </h3>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-[#71717a]">Simulations:</span>
            <select
              value={simCount}
              onChange={(e) => setSimCount(Number(e.target.value))}
              className="bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1 text-xs font-mono-data text-[#e4e4e7] focus:border-[#3b82f6] focus:outline-none"
            >
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1,000</option>
              <option value={2000}>2,000</option>
            </select>
          </div>
          <button
            onClick={runSimulation}
            disabled={isRunning}
            className={`px-3 py-1 rounded text-xs font-medium transition-all ${
              isRunning
                ? 'bg-[#2a2a33] text-[#52525b] cursor-not-allowed'
                : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
            }`}
          >
            {isRunning ? 'Running...' : 'Run Simulation'}
          </button>
        </div>

        {mcResult && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              <StatCell label="Mean Margin" value={`${mcResult.distribution.mean.toFixed(1)}%`} color="#3b82f6" />
              <StatCell label="Median" value={`${mcResult.distribution.median.toFixed(1)}%`} color="#a1a1aa" />
              <StatCell label="Worst Case (P5)" value={`${mcResult.distribution.p5.toFixed(1)}%`} color="#ef4444" />
              <StatCell label="Best Case (P95)" value={`${mcResult.distribution.p95.toFixed(1)}%`} color="#22c55e" />
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <StatCell
                label="Collapse Probability"
                value={`${(mcResult.results.collapseProbability * 100).toFixed(1)}%`}
                color={mcResult.results.collapseProbability > 0.1 ? '#ef4444' : '#22c55e'}
              />
              <StatCell
                label="Volatility (σ)"
                value={`${mcResult.distribution.stdDev.toFixed(1)}%`}
                color={mcResult.distribution.stdDev > 8 ? '#f97316' : '#a1a1aa'}
              />
              <StatCell
                label="Margin Range"
                value={`${(mcResult.distribution.p95 - mcResult.distribution.p5).toFixed(1)}%`}
                color="#a855f7"
              />
            </div>

            <DistributionChart mc={mcResult} />

            {/* AI Insight */}
            <div className="mt-3 bg-[#0a0a0b] border border-[#2a2a33] rounded p-2.5">
              <div className="flex items-start gap-2">
                <Zap className="w-3 h-3 mt-0.5 flex-shrink-0 text-[#a855f7]" />
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  {mcResult.results.collapseProbability > 0.15
                    ? `🚨 ${(mcResult.results.collapseProbability * 100).toFixed(0)}% of scenarios result in negative margins. This operation has significant systemic risk. Consider reducing fleet size or increasing shipment density immediately.`
                    : mcResult.results.collapseProbability > 0.05
                    ? `⚠ Moderate tail risk — ${(mcResult.results.collapseProbability * 100).toFixed(0)}% chance of negative margins. Monitor fuel costs and failed deliveries closely. Maintain at least 6 months liquidity reserve.`
                    : `✅ Strong operational resilience. Only ${(mcResult.results.collapseProbability * 100).toFixed(1)}% of scenarios show negative margins. Current strategy is sustainable.`}
                </p>
              </div>
            </div>
          </>
        )}

        {!mcResult && (
          <div className="text-center py-8 text-[#52525b] text-sm">
            {isRunning ? 'Running Monte Carlo simulation...' : 'Click "Run Simulation" to analyze risk'}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#0a0a0b] rounded p-2 border border-[#2a2a33]/50 text-center">
      <div className="text-[9px] text-[#52525b] uppercase mb-0.5">{label}</div>
      <div className="font-mono-data text-sm font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
