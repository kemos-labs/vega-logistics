'use client';

import { useEffect, useState, memo } from 'react';
import dynamic from 'next/dynamic';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { KPIData } from '@/lib/types';

const Sparkline = dynamic(() => import('./Sparkline'), { ssr: false });

interface KPICardProps {
  kpi: KPIData;
  index: number;
}

function formatValue(kpi: KPIData): string {
  const val = kpi.value;
  switch (kpi.format) {
    case 'currency':
      return `${kpi.prefix || ''} ${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    case 'percentage':
      return `${val.toFixed(1)}${kpi.suffix || '%'}`;
    case 'time':
      return `${val.toFixed(1)}${kpi.suffix || ''}`;
    case 'ratio':
      return `${val.toFixed(2)}`;
    default:
      return `${val.toLocaleString()}${kpi.suffix || ''}`;
  }
}

const KPICard = memo(function KPICard({ kpi, index }: KPICardProps) {
  const [animate, setAnimate] = useState(false);
  const TrendIcon = kpi.trend > 1 ? TrendingUp : kpi.trend < -1 ? TrendingDown : Minus;
  const trendColor = kpi.isGood
    ? kpi.trendDirection === 'up'
      ? 'text-emerald-400'
      : 'text-red-400'
    : kpi.trendDirection === 'up'
      ? 'text-red-400'
      : 'text-emerald-400';

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), index * 60);
    return () => clearTimeout(timer);
  }, [index]);

  const sparkData = kpi.sparkline.map((v, i) => ({ i, v }));

  return (
    <div
      className={`bg-[#18181c] border border-[#2a2a33] rounded-lg p-4 hover:border-[#3d3d4a] transition-all duration-300 cursor-pointer group ${animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-[#52525b] group-hover:text-[#a1a1aa] transition-colors" />
          <span className="text-[11px] font-medium text-[#a1a1aa] uppercase tracking-wider">
            {kpi.label}
          </span>
        </div>
        <div className={`flex items-center gap-1 text-[11px] ${trendColor}`}>
          <TrendIcon className="w-3 h-3" />
          <span className="font-mono-data">{Math.abs(kpi.trend).toFixed(1)}%</span>
        </div>
      </div>
      <div className="font-mono-data text-2xl font-bold text-[#e4e4e7] mb-1 tracking-tight">
        {formatValue(kpi)}
      </div>
      <Sparkline
        data={sparkData}
        color={kpi.isGood && kpi.trendDirection === 'up' ? '#22c55e' : kpi.trendDirection === 'down' && kpi.isGood ? '#ef4444' : '#3b82f6'}
      />
      <div className="mt-1 text-[10px] text-[#52525b] truncate group-hover:text-[#a1a1aa] transition-colors">
        {kpi.description}
      </div>
    </div>
  );
});

export default KPICard;
