'use client';

import { useState } from 'react';
import { FinancialOutput } from '@/lib/types';
import { Layers } from 'lucide-react';

interface CostCompositionProps {
  output: FinancialOutput;
}

const CATEGORIES: { key: 'fixed' | 'team' | 'fulfillment' | 'risk'; label: string; color: string; sourceKey: keyof FinancialOutput['costBreakdown'] }[] = [
  { key: 'fixed', label: 'Fixed', color: '#3b82f6', sourceKey: 'vehicleOwnership' },
  { key: 'fixed', label: 'Fixed', color: '#3b82f6', sourceKey: 'facilities' },
  { key: 'fulfillment', label: 'Fulfillment', color: '#f97316', sourceKey: 'vehicleRunning' },
  { key: 'fulfillment', label: 'Fulfillment', color: '#f97316', sourceKey: 'perShipment' },
  { key: 'team', label: 'Team', color: '#22c55e', sourceKey: 'people' },
  { key: 'risk', label: 'Risk-Adjusted', color: '#ef4444', sourceKey: 'other' },
];

const SOURCE_LABELS: Record<keyof FinancialOutput['costBreakdown'], string> = {
  vehicleOwnership: 'Vehicle Ownership (rent only — fleet is rented)',
  vehicleRunning: 'Vehicle Running (fuel, insurance, maintenance, GPS, dashcam)',
  people: 'People (drivers, ops, sales, warehouse, health insurance)',
  facilities: 'Facilities (warehouse, office, utilities)',
  perShipment: 'Per-Shipment (packaging, labels, returns)',
  other: 'Other (marketing, insurance, SaaS, misc)',
  costPerShipment: '',
  total: '',
};

export default function CostComposition({ output }: CostCompositionProps) {
  const [viewMode, setViewMode] = useState<'monthly' | 'annual'>('monthly');
  if (!output.costBreakdown) return null;

  const multiplier = viewMode === 'annual' ? 12 : 1;
  const total = output.totalCost * multiplier;

  return (
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#f97316]" />
          <h3 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider">Cost Composition</h3>
        </div>
        <div className="flex bg-[#0a0a0b] rounded border border-[#2a2a33] overflow-hidden">
          <button onClick={() => setViewMode('monthly')} className={`px-2.5 py-1 text-[10px] font-medium transition-all ${viewMode === 'monthly' ? 'bg-[#3b82f6] text-white' : 'text-[#71717a] hover:text-[#a1a1aa]'}`}>Monthly</button>
          <button onClick={() => setViewMode('annual')} className={`px-2.5 py-1 text-[10px] font-medium transition-all ${viewMode === 'annual' ? 'bg-[#3b82f6] text-white' : 'text-[#71717a] hover:text-[#a1a1aa]'}`}>Annual</button>
        </div>
      </div>

      <div className="space-y-2">
        {(['vehicleOwnership', 'vehicleRunning', 'people', 'facilities', 'perShipment', 'other'] as const).map((key) => {
          const value = output.costBreakdown![key] * multiplier;
          const pct = total > 0 ? (value / total) * 100 : 0;
          const cat = CATEGORIES.find((c) => c.sourceKey === key)!;
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="text-[#e4e4e7]">{SOURCE_LABELS[key]}</span>
                <span className="font-mono-data text-[#e4e4e7]">SAR {(value / 1000).toFixed(1)}k <span className="text-[#52525b]">({pct.toFixed(0)}%)</span></span>
              </div>
              <div className="h-2.5 bg-[#0a0a0b] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: cat.color }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#2a2a33]">
        <span className="text-[11px] font-semibold text-[#e4e4e7] uppercase">Total {viewMode === 'monthly' ? 'Monthly' : 'Annual'} Cost</span>
        <span className="font-mono-data text-sm font-bold text-[#f97316]">SAR {total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
      </div>
    </div>
  );
}
