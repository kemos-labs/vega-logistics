'use client';

import { useState, useCallback } from 'react';
import {
  SaudiCostInput,
  SaudiCostOutput,
  MonteCarloSimResult,
  calculateSaudiCosts,
  runSaudiMonteCarlo,
  DEFAULT_SAUDI_INPUT,
} from '@/lib/saudiLogisticsEngine';
import {
  
  
  Activity,
  
  
  Zap,
  
  
  
  
  
  Target,
} from 'lucide-react';

type SaudiTab = 'overview' | 'costs' | 'monte-carlo' | 'recommendations';

export default function SaudiFleetPlanner() {
  const [tab, setTab] = useState<SaudiTab>('overview');
  const [input, setInput] = useState<SaudiCostInput>(DEFAULT_SAUDI_INPUT);
  const [mcRuns, setMcRuns] = useState(1000);
  const [mcResult, setMcResult] = useState<MonteCarloSimResult | null>(null);
  const [mcRunning, setMcRunning] = useState(false);

  const costs = calculateSaudiCosts(input);

  const updateInput = useCallback(
    (key: keyof SaudiCostInput) => (val: number) => {
      setInput((prev) => ({ ...prev, [key]: val }));
    },
    []
  );

  const runMC = () => {
    setMcRunning(true);
    setTimeout(() => {
      setMcResult(runSaudiMonteCarlo(input, costs, mcRuns));
      setMcRunning(false);
    }, 50);
  };

  const isProfitable = costs.monthlyProfit >= 0;
  const gapToBreakEven = Math.round(costs.breakEvenDeliveriesPerDay - costs.deliveriesPerDay);

  return (
    <div className="p-4 overflow-y-auto flex-1 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#e4e4e7]">Autoclaw — Saudi Fleet Planner</h2>
          <p className="text-xs text-[#71717a] mt-0.5">Last-Mile · Small Vans · Saudi Arabia</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-[#71717a]">Fleet</label>
            <input
              type="number"
              min={1}
              max={100}
              value={input.fleetSize}
              onChange={(e) => updateInput('fleetSize')(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-14 bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1 text-xs font-mono-data text-[#e4e4e7] text-center focus:border-[#3b82f6] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-[#71717a]">Util.</label>
            <input
              type="range"
              min={50}
              max={100}
              value={input.vanUtilization}
              onChange={(e) => updateInput('vanUtilization')(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-xs font-mono-data text-[#e4e4e7] w-8">{input.vanUtilization}%</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#2a2a33]">
        {(['overview', 'costs', 'monte-carlo', 'recommendations'] as SaudiTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs font-medium capitalize transition-all ${
              tab === t
                ? 'text-[#e4e4e7] border-b-2 border-[#3b82f6]'
                : 'text-[#71717a] border-b-2 border-transparent hover:text-[#a1a1aa]'
            }`}
          >
            {t === 'monte-carlo' ? 'Monte Carlo' : t}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Metric Cards */}
          <div className="grid grid-cols-4 gap-3">
            <MetricCard label="Monthly Revenue" value={`SAR ${Math.round(costs.monthlyRevenue / 1000)}K`} sub={`${costs.deliveriesPerDay} deliveries/day`} />
            <MetricCard label="Monthly Cost" value={`SAR ${Math.round(costs.totalMonthlyCost / 1000)}K`} sub={`SAR ${Math.round(costs.costPerDelivery)}/delivery`} />
            <MetricCard
              label="Net Profit"
              value={`SAR ${Math.round(costs.monthlyProfit / 1000)}K`}
              sub={`${costs.marginPercent.toFixed(1)}% margin`}
              accent={isProfitable ? '#22c55e' : '#ef4444'}
            />
            <MetricCard
              label="Break-Even"
              value={`${Math.round(costs.breakEvenDeliveriesPerDay)}/day`}
              sub={`Benchmark: ${input.breakEvenBenchmark}`}
              accent={costs.deliveriesPerDay >= costs.breakEvenDeliveriesPerDay ? '#22c55e' : '#ef4444'}
            />
          </div>

          {/* Revenue vs Cost Bars */}
          <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
            <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">Cost Structure</h3>
            {[
              { label: 'Variable (vans + drivers)', val: costs.totalVariableCost, color: '#378ADD' },
              { label: 'Fixed (warehouse, admin)', val: costs.totalFixedCost, color: '#7F77DD' },
              { label: 'Revenue', val: costs.monthlyRevenue, color: '#1D9E75' },
            ].map((item) => (
              <div key={item.label} className="mb-2.5">
                <div className="flex justify-between text-[11px] text-[#a1a1aa] mb-1">
                  <span>{item.label}</span>
                  <span className="font-mono-data text-[#e4e4e7]">SAR {Math.round(item.val).toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-[#0a0a0b] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (item.val / Math.max(costs.monthlyRevenue, costs.totalMonthlyCost)) * 100)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Status Alert */}
          <div className={`rounded-lg p-3 ${isProfitable ? 'bg-[#22c55e]/10 border border-[#22c55e]/20' : 'bg-[#ef4444]/10 border border-[#ef4444]/20'}`}>
            <p className={`text-xs font-medium ${isProfitable ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {isProfitable
                ? `✓ Operating above break-even by ${Math.abs(gapToBreakEven)} deliveries/day. Margin is ${costs.marginPercent.toFixed(1)}%.`
                : `⚠ You need ${gapToBreakEven} more deliveries/day to break even. Currently at ${Math.round((costs.deliveriesPerDay / costs.breakEvenDeliveriesPerDay) * 100)}% of break-even.`}
            </p>
          </div>
        </div>
      )}

      {/* Tab: Costs */}
      {tab === 'costs' && (
        <div className="grid grid-cols-2 gap-4">
          <CostSection title="Van Costs" input={input} updateInput={updateInput} fields={[
            { key: 'vanPurchasePrice', label: 'Purchase Price', unit: 'SAR', step: 1000 },
            { key: 'vanLifespanYears', label: 'Lifespan', unit: 'yrs', step: 1 },
            { key: 'fuelPriceLiter', label: 'Fuel Price/L', unit: 'SAR', step: 0.01 },
            { key: 'fuelConsumptionPer100km', label: 'Consumption', unit: 'L/100km', step: 0.5 },
            { key: 'kmPerVanPerDay', label: 'KM/Day', unit: 'km', step: 5 },
            { key: 'oilChangeCostPer5000km', label: 'Oil/5,000km', unit: 'SAR', step: 10 },
            { key: 'tiresPerYear', label: 'Tires/Year', unit: 'SAR', step: 100 },
            { key: 'otherMaintenancePerMonth', label: 'Maint/Month', unit: 'SAR', step: 50 },
          ]} footnote={`Depreciation SAR ${Math.round(costs.depreciationPerVanPerMonth)}/mo · Oil SAR ${Math.round(costs.oilPerVanPerMonth)}/mo · Fuel SAR ${Math.round(costs.fuelPerVanPerMonth)}/mo`} />

          <CostSection title="People" input={input} updateInput={updateInput} fields={[
            { key: 'driverSalaryPerMonth', label: 'Driver Salary', unit: 'SAR', step: 100 },
            { key: 'driverBenefitsPercent', label: 'Benefits', unit: '%', step: 1 },
          ]} />

          <CostSection title="Fixed Overhead" input={input} updateInput={updateInput} fields={[
            { key: 'warehouseRentPerMonth', label: 'Warehouse Rent', unit: 'SAR', step: 500 },
            { key: 'utilitiesPerMonth', label: 'Utilities', unit: 'SAR', step: 100 },
            { key: 'adminSalariesPerMonth', label: 'Admin Salaries', unit: 'SAR', step: 500 },
            { key: 'softwarePerMonth', label: 'Software', unit: 'SAR', step: 50 },
            { key: 'communicationPerMonth', label: 'Communication', unit: 'SAR', step: 50 },
          ]} />

          <CostSection title="Operations" input={input} updateInput={updateInput} fields={[
            { key: 'deliveriesPerVanPerDay', label: 'Deliveries/Van/Day', unit: 'del', step: 1 },
            { key: 'revenuePerDelivery', label: 'Revenue/Delivery', unit: 'SAR', step: 0.5 },
            { key: 'breakEvenBenchmark', label: 'Industry B/E', unit: 'del/day', step: 5 },
          ]} />
        </div>
      )}

      {/* Tab: Monte Carlo */}
      {tab === 'monte-carlo' && (
        <div className="space-y-4">
          <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-[#3b82f6]" />
              <h3 className="text-sm font-semibold text-[#e4e4e7]">Monte Carlo Simulation</h3>
            </div>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Runs {mcRuns.toLocaleString()} scenarios with demand drops (−15% to +15%), cost spikes (+10%), and fuel variation (−10% to +15%). Shows realistic outcomes, not just the best case.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] text-[#71717a]">Simulations:</span>
            {[500, 1000, 5000].map((n) => (
              <button
                key={n}
                onClick={() => setMcRuns(n)}
                className={`px-3 py-1 rounded text-xs border transition-all ${
                  mcRuns === n
                    ? 'bg-[#3b82f6]/20 border-[#3b82f6] text-[#3b82f6]'
                    : 'border-[#2a2a33] text-[#71717a] hover:text-[#a1a1aa]'
                }`}
              >
                {n.toLocaleString()}
              </button>
            ))}
            <button
              onClick={runMC}
              disabled={mcRunning}
              className={`px-4 py-1.5 rounded text-xs font-medium ${
                mcRunning
                  ? 'bg-[#2a2a33] text-[#52525b] cursor-wait'
                  : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
              }`}
            >
              {mcRunning ? 'Running...' : 'Run Simulation ↗'}
            </button>
          </div>

          {mcResult && (
            <>
              {/* Result Cards */}
              <div className="grid grid-cols-4 gap-3">
                <MetricCard
                  label="Loss Risk"
                  value={`${Math.round(mcResult.riskPercent)}%`}
                  sub="of scenarios unprofitable"
                  accent={mcResult.riskPercent > 50 ? '#ef4444' : mcResult.riskPercent > 30 ? '#f97316' : '#22c55e'}
                />
                <MetricCard label="Worst 10%" value={`SAR ${Math.round(mcResult.p10 / 1000)}K`} sub="monthly profit" accent={mcResult.p10 < 0 ? '#ef4444' : '#22c55e'} />
                <MetricCard label="Median" value={`SAR ${Math.round(mcResult.p50 / 1000)}K`} sub="monthly profit" />
                <MetricCard label="Best 10%" value={`SAR ${Math.round(mcResult.p90 / 1000)}K`} sub="monthly profit" accent="#22c55e" />
              </div>

              {/* Histogram */}
              <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
                <h3 className="text-xs text-[#a1a1aa] mb-3">
                  Profit distribution — {mcRuns.toLocaleString()} simulations
                </h3>
                <div className="flex items-end gap-[2px] h-24">
                  {mcResult.buckets.map((count, i) => {
                    const bucketMid = mcResult.min + (i + 0.5) * ((mcResult.max - mcResult.min) / 20);
                    const isLoss = bucketMid < 0;
                    const maxCount = Math.max(...mcResult.buckets);
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm"
                        style={{
                          height: `${Math.max(4, (count / maxCount) * 96)}%`,
                          backgroundColor: isLoss ? '#ef4444' : '#22c55e',
                          opacity: 0.8,
                        }}
                        title={`SAR ${Math.round(bucketMid / 1000)}K: ${count} scenarios`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-[9px] text-[#52525b] mt-1">
                  <span>SAR {Math.round(mcResult.min / 1000)}K</span>
                  <span>SAR 0</span>
                  <span>SAR {Math.round(mcResult.max / 1000)}K</span>
                </div>
              </div>

              {/* Risk Mitigation Tips */}
              <div className={`rounded-lg p-4 ${mcResult.riskPercent > 50 ? 'bg-[#ef4444]/10 border border-[#ef4444]/20' : 'bg-[#22c55e]/10 border border-[#22c55e]/20'}`}>
                <h3 className={`text-xs font-semibold mb-3 ${mcResult.riskPercent > 50 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                  How to Reduce Risk Below 50%
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      action: `Add ${Math.max(1, Math.round(costs.breakEvenDeliveriesPerDay / costs.activeVans - input.deliveriesPerVanPerDay) + 3)} more deliveries/van/day`,
                      impact: 'Biggest lever',
                    },
                    {
                      action: `Raise price to SAR ${(input.revenuePerDelivery + 2).toFixed(1)}/delivery`,
                      impact: `+SAR ${Math.round((costs.deliveriesPerMonth * 2) / 1000)}K/mo`,
                    },
                    {
                      action: `Increase utilization to ${Math.min(95, input.vanUtilization + 5)}%`,
                      impact: `+${Math.round(input.fleetSize * 0.05)} active vans`,
                    },
                    {
                      action: 'Reduce warehouse cost 10%',
                      impact: `Save SAR ${Math.round(input.warehouseRentPerMonth * 0.1)}/mo`,
                    },
                  ].map((tip, i) => (
                    <div key={i} className="bg-[#0a0a0b] rounded p-2.5">
                      <p className="text-xs font-medium text-[#e4e4e7] mb-0.5">{tip.action}</p>
                      <p className="text-[10px] text-[#71717a]">{tip.impact}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Recommendations */}
      {tab === 'recommendations' && (
        <div className="space-y-4">
          {/* Investor Metrics */}
          <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-[#eab308]" />
              <h3 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider">
                Investor Metrics
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <InvestorMetric
                label="Payback Period"
                value={costs.paybackMonths === Infinity ? 'N/A' : `${Math.round(costs.paybackMonths)} months`}
                sub={costs.paybackMonths < 18 ? 'Strong (<18 mo)' : costs.paybackMonths < 24 ? 'Acceptable' : 'Needs improvement'}
                color={costs.paybackMonths < 18 ? '#22c55e' : costs.paybackMonths < 24 ? '#eab308' : '#ef4444'}
              />
              <InvestorMetric
                label="EBITDA Margin"
                value={`${costs.ebitdaMargin.toFixed(1)}%`}
                sub="Target: 8-15%"
                color={costs.ebitdaMargin >= 8 ? '#22c55e' : costs.ebitdaMargin >= 5 ? '#eab308' : '#ef4444'}
              />
              <InvestorMetric
                label="Fleet ROI"
                value={`${costs.fleetROI.toFixed(1)}%`}
                sub="Target: >20% annually"
                color={costs.fleetROI >= 20 ? '#22c55e' : costs.fleetROI >= 10 ? '#eab308' : '#ef4444'}
              />
              <InvestorMetric
                label="Cost / Delivery"
                value={`SAR ${costs.costPerDelivery.toFixed(1)}`}
                sub="Benchmark: SAR 14-18"
                color={costs.costPerDelivery <= 18 ? '#22c55e' : costs.costPerDelivery <= 22 ? '#eab308' : '#ef4444'}
              />
              <InvestorMetric
                label="Revenue / Van"
                value={`SAR ${Math.round(costs.revenuePerVanPerMonth / 1000)}K/mo`}
                sub={`${input.deliveriesPerVanPerDay} del/day`}
                color="#3b82f6"
              />
              <InvestorMetric
                label="Net Contribution"
                value={`SAR ${Math.round((costs.monthlyProfit / costs.activeVans) / 1000)}K/van`}
                sub={isProfitable ? 'Positive' : 'Negative'}
                color={isProfitable ? '#22c55e' : '#ef4444'}
              />
            </div>
          </div>

          {/* Operational Recommendations */}
          <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-[#a855f7]" />
              <h3 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider">
                Priority Actions
              </h3>
            </div>
            <div className="space-y-2">
              {generateRecs(costs, input, gapToBreakEven, isProfitable).map((rec, i) => (
                <div key={i} className="bg-[#0a0a0b] border border-[#2a2a33] rounded p-3">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xs font-semibold text-[#e4e4e7]">{i + 1}. {rec.title}</span>
                    <span
                      className="text-[9px] px-2 py-0.5 rounded font-medium"
                      style={{
                        color: rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#f97316' : '#22c55e',
                        backgroundColor:
                          rec.priority === 'high' ? '#ef444420' : rec.priority === 'medium' ? '#f9731620' : '#22c55e20',
                      }}
                    >
                      {rec.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#a1a1aa] mb-1">{rec.detail}</p>
                  <p className="text-[10px] font-mono-data text-[#22c55e]">Impact: {rec.impact}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ───

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  return (
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3 hover:border-[#3d3d4a] transition-colors">
      <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-1">{label}</div>
      <div className="font-mono-data text-xl font-bold" style={{ color: accent || '#e4e4e7' }}>
        {value}
      </div>
      <div className="text-[10px] text-[#52525b] mt-0.5">{sub}</div>
    </div>
  );
}

function InvestorMetric({
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
    <div className="bg-[#0a0a0b] rounded p-3 border border-[#2a2a33]/50">
      <div className="text-[9px] text-[#52525b] uppercase tracking-wider mb-0.5">{label}</div>
      <div className="font-mono-data text-sm font-bold" style={{ color }}>{value}</div>
      <div className="text-[9px] text-[#52525b] mt-0.5">{sub}</div>
    </div>
  );
}

function CostSection({
  title,
  input,
  updateInput,
  fields,
  footnote,
}: {
  title: string;
  input: SaudiCostInput;
  updateInput: (key: keyof SaudiCostInput) => (val: number) => void;
  fields: { key: keyof SaudiCostInput; label: string; unit: string; step: number }[];
  footnote?: string;
}) {
  return (
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
      <h3 className="text-xs font-semibold text-[#e4e4e7] mb-3">{title}</h3>
      {fields.map(({ key, label, unit, step }) => (
        <div key={key} className="flex items-center justify-between py-1.5 border-b border-[#2a2a33]/50 last:border-0">
          <span className="text-[11px] text-[#a1a1aa]">{label}</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={input[key]}
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                if (!isNaN(n)) updateInput(key)(n);
              }}
              step={step}
              min={0}
              className="w-20 bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-0.5 text-xs font-mono-data text-[#e4e4e7] text-right focus:border-[#3b82f6] focus:outline-none"
            />
            <span className="text-[10px] text-[#52525b] w-10">{unit}</span>
          </div>
        </div>
      ))}
      {footnote && (
        <div className="mt-2 p-2 bg-[#0a0a0b] rounded text-[10px] text-[#52525b]">{footnote}</div>
      )}
    </div>
  );
}

// ─── Recommendation Generator ───

function generateRecs(
  c: SaudiCostOutput,
  input: SaudiCostInput,
  gap: number,
  profitable: boolean
) {
  const recs: { title: string; detail: string; impact: string; priority: 'high' | 'medium' | 'low' }[] = [];

  if (!profitable) {
    recs.push({
      title: `Increase deliveries to ${Math.round(c.breakEvenDeliveriesPerDay)}/day`,
      detail: `You need ${Math.abs(gap)} more deliveries/day to reach break-even. Each additional van at ${input.deliveriesPerVanPerDay} deliveries adds ${input.deliveriesPerVanPerDay} deliveries. Consider adding ${Math.max(1, Math.ceil(Math.abs(gap) / input.deliveriesPerVanPerDay))} van(s) in high-density zones or increasing per-van productivity.`,
      impact: `Reach SAR 0 net profit at ${Math.round(c.breakEvenDeliveriesPerDay)} deliveries/day`,
      priority: 'high',
    });
  }

  if (c.costPerDelivery > input.revenuePerDelivery * 0.8) {
    recs.push({
      title: 'Cost per delivery too close to revenue',
      detail: `Your cost of SAR ${c.costPerDelivery.toFixed(1)}/delivery is ${((c.costPerDelivery / input.revenuePerDelivery) * 100).toFixed(0)}% of revenue (SAR ${input.revenuePerDelivery}). Target is below SAR 18. Reduce variable costs or increase deliveries/van.`,
      impact: `SAR ${Math.round((c.costPerDelivery - 18) * c.deliveriesPerMonth)}/mo at SAR 18/delivery`,
      priority: c.costPerDelivery > 20 ? 'high' : 'medium',
    });
  }

  if (input.vanUtilization < 85) {
    recs.push({
      title: `Increase fleet utilization from ${input.vanUtilization}% to 90%`,
      detail: `${input.fleetSize - c.activeVans} vans are idle daily — pure cost with no revenue. At SAR ${Math.round((c.variableCostPerVan + c.driverTotalPerMonth) / 1000)}K/van/month, idle vans burn cash. Target 90%+ utilization.`,
      impact: `Save SAR ${Math.round((input.fleetSize - c.activeVans) * (c.variableCostPerVan + c.driverTotalPerMonth))}/mo by reducing idle fleet`,
      priority: 'medium',
    });
  }

  if (c.ebitdaMargin < 8) {
    recs.push({
      title: 'EBITDA margin below investor threshold',
      detail: `At ${c.ebitdaMargin.toFixed(1)}%, your EBITDA margin is below the 8-15% investors expect. To improve: increase deliveries/van, renegotiate warehouse rent (currently SAR ${input.warehouseRentPerMonth}/mo), or raise revenue/delivery.`,
      impact: `Reach 8% EBITDA = SAR ${Math.round(c.monthlyRevenue * 0.08)}/mo (currently SAR ${Math.round(c.ebitda)}/mo)`,
      priority: 'high',
    });
  }

  if (input.deliveriesPerVanPerDay < 40) {
    recs.push({
      title: `Push per-van productivity above 40 deliveries/day`,
      detail: `At ${input.deliveriesPerVanPerDay} deliveries/van/day, each van is under-utilized. Industry leaders achieve 45-50 in dense urban zones. Route optimization, zone clustering, and better dispatch can add 5-10 deliveries/van without adding cost.`,
      impact: `+${Math.round(c.activeVans * 5 * input.revenuePerDelivery * 22)} SAR/mo at +5 deliveries/van`,
      priority: 'medium',
    });
  }

  if (input.warehouseRentPerMonth > c.monthlyRevenue * 0.1) {
    recs.push({
      title: 'Warehouse cost exceeds 10% of revenue',
      detail: `At SAR ${input.warehouseRentPerMonth}/mo, warehouse is ${((input.warehouseRentPerMonth / c.monthlyRevenue) * 100).toFixed(1)}% of revenue. Consider subleasing unused space, moving to a smaller facility, or negotiating with the landlord.`,
      impact: `Save SAR ${Math.round(input.warehouseRentPerMonth * 0.2)}/mo with a 20% reduction`,
      priority: 'low',
    });
  }

  // Always add at least one forward-looking rec
  recs.push({
    title: 'Prepare investor-ready metrics for Series A',
    detail: `Your current fleet ROI is ${c.fleetROI.toFixed(1)}% (target: >20%). Payback is ${c.paybackMonths === Infinity ? 'not yet reached' : Math.round(c.paybackMonths) + ' months'}. Before pitching, demonstrate consistent above-break-even operations and a clear path to 200+ deliveries/day. Saudi Vision 2030 logistics sector is growing 12% YoY — frame your growth in this context.`,
    impact: 'Strategic: position for SAR 500K-2M pre-seed/seed round',
    priority: 'medium',
  });

  return recs.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
}
