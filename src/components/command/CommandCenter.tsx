'use client';

import { useMemo } from 'react';
import { useAppState } from '@/lib/AppContext';
import { useSimulatedData } from '@/hooks/useSimulatedData';
import { calculateRentedFleet } from '@/lib/rentedFleetEngine';
import { calculateSaudiCosts } from '@/lib/saudiLogisticsEngine';
import { calculateAdvancedKPIs, getAdvancedKPIData } from '@/lib/advancedKPIs';

import KPICard from '@/components/dashboard/KPICard';
import GhostGrowthEngine from '@/components/ghost/GhostGrowthEngine';

export default function CommandCenter() {
  const { autoclaw, saudiFleet } = useAppState();
  const {
    financialInput,
    financialOutput,
    ghostGrowth,
    kpis,
    vehicles,
  } = useSimulatedData();

  const advancedKpis = useMemo(() => {
    try {
      const akpi = calculateAdvancedKPIs(financialInput, financialOutput);
      if (!akpi?.otif) return [];
      return getAdvancedKPIData(akpi);
    } catch { return []; }
  }, [financialInput, financialOutput]);

  const rentedCosts = useMemo(() => calculateRentedFleet(autoclaw.input), [autoclaw.input]);
  const saudiCosts = useMemo(() => calculateSaudiCosts(saudiFleet.input), [saudiFleet.input]);

  const totalFleetSize = autoclaw.input.fleetSize + saudiFleet.input.fleetSize;
  const totalActive = rentedCosts.activeVans + saudiCosts.activeVans;
  const totalCost = (rentedCosts?.totalCost ?? 0) + (saudiCosts?.totalMonthlyCost ?? 0);
  const totalDelCapacity = rentedCosts.delPerDay + saudiCosts.deliveriesPerDay;

  return (
    <div className="p-4 space-y-4 overflow-y-auto flex-1">
      {/* Real fleet data cards */}
      <div className="grid grid-cols-4 gap-3">
        {kpis.slice(0, 4).map((kpi, i) => (
          <KPICard key={kpi.id} kpi={kpi} index={i} />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-3">
        {advancedKpis.slice(0, 4).map((kpi, i) => (
          <KPICard key={kpi.id} kpi={kpi} index={i + 8} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <GhostGrowthEngine data={ghostGrowth} />
        <div className="space-y-3">
          {/* Financial Snapshot */}
          <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
            <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">Financial Snapshot</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-[10px] text-[#52525b] uppercase mb-1">Revenue</div>
                <div className="font-mono-data text-lg font-bold text-[#3b82f6]">
                  SAR {financialOutput.totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-[#52525b] uppercase mb-1">Cost</div>
                <div className="font-mono-data text-lg font-bold text-[#f97316]">
                  SAR {financialOutput.totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-[#52525b] uppercase mb-1">Margin</div>
                <div className={`font-mono-data text-lg font-bold ${
                  financialOutput.netMarginPercent >= 20 ? 'text-[#22c55e]' : financialOutput.netMarginPercent >= 10 ? 'text-[#eab308]' : 'text-[#ef4444]'
                }`}>
                  {financialOutput.netMarginPercent.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Fleet Status — now uses real user-entered fleet data */}
          <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
            <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider mb-3">Fleet Status</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a1a1aa]">Active Vehicles</span>
                <span className="font-mono-data text-[#22c55e]">{totalActive} / {totalFleetSize}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a1a1aa]">Utilization</span>
                <span className="font-mono-data text-[#e4e4e7]">
                  {totalFleetSize > 0 ? ((totalActive / totalFleetSize) * 100).toFixed(0) : 0}%
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a1a1aa]">Monthly Fleet Cost</span>
                <span className="font-mono-data text-[#f97316]">
                  SAR {totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a1a1aa]">Delivery Capacity</span>
                <span className="font-mono-data text-[#3b82f6]">{totalDelCapacity.toLocaleString()} / day</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a1a1aa]">Sim Vehicles</span>
                <span className="font-mono-data text-[#a1a1aa]">{vehicles.length} on map</span>
              </div>
            </div>
            <div className="mt-3 h-1.5 bg-[#0a0a0b] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{
                width: `${totalFleetSize > 0 ? ((totalActive / totalFleetSize) * 100) : 0}%`,
                backgroundColor: totalActive / Math.max(1, totalFleetSize) >= 0.75 ? '#22c55e' : totalActive / Math.max(1, totalFleetSize) >= 0.5 ? '#eab308' : '#ef4444',
              }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
