'use client';

import { GhostGrowthResult } from '@/lib/types';
import { AlertTriangle, Shield, Siren, Flame, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface GhostGrowthEngineProps {
  data: GhostGrowthResult;
}

const levelConfig = {
  Safe: {
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.2)',
    icon: Shield,
    label: 'SAFE',
  },
  Warning: {
    color: '#eab308',
    bgColor: 'rgba(234, 179, 8, 0.08)',
    borderColor: 'rgba(234, 179, 8, 0.2)',
    icon: AlertTriangle,
    label: 'WARNING',
  },
  Critical: {
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.08)',
    borderColor: 'rgba(249, 115, 22, 0.2)',
    icon: Siren,
    label: 'CRITICAL',
  },
  Collapse: {
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
    icon: Flame,
    label: 'COLLAPSE RISK',
  },
};

export default function GhostGrowthEngine({ data }: GhostGrowthEngineProps) {
  const { t } = useTranslation();
  const config = levelConfig[data.level];
  const Icon = config.icon;
  const [gaugeRotation, setGaugeRotation] = useState(-90);

  useEffect(() => {
    // Animate gauge: -90 (0%) to +90 (100%)
    const targetRotation = -90 + (data.index / 100) * 180;
    const timer = setTimeout(() => setGaugeRotation(targetRotation), 200);
    return () => clearTimeout(timer);
  }, [data.index]);

  // SVG arc for the gauge


  return (
    <div
      className="bg-[#18181c] border rounded-lg p-5 transition-all duration-500"
      style={{ borderColor: config.borderColor, backgroundColor: config.bgColor }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" style={{ color: config.color }} />
          <h3 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider">
            {t('ghostGrowth.title')}
          </h3>
        </div>
        <div
          className="text-xs font-mono-data font-bold px-3 py-1 rounded-full"
          style={{ color: config.color, backgroundColor: config.borderColor }}
        >
          {config.label}
        </div>
      </div>

      {/* Gauge + Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Gauge */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-44 h-24 overflow-hidden">
            <svg viewBox="0 0 160 90" className="w-full">
              {/* Background arc */}
              <path
                d="M 10 80 A 70 70 0 0 1 150 80"
                fill="none"
                stroke="#2a2a33"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Colored segments */}
              <path
                d="M 10 80 A 70 70 0 0 1 45 35"
                fill="none"
                stroke="#22c55e"
                strokeWidth="12"
                strokeLinecap="round"
                opacity={0.6}
              />
              <path
                d="M 45 35 A 70 70 0 0 1 80 29"
                fill="none"
                stroke="#eab308"
                strokeWidth="12"
                strokeLinecap="round"
                opacity={0.6}
              />
              <path
                d="M 80 29 A 70 70 0 0 1 115 35"
                fill="none"
                stroke="#f97316"
                strokeWidth="12"
                strokeLinecap="round"
                opacity={0.6}
              />
              <path
                d="M 115 35 A 70 70 0 0 1 150 80"
                fill="none"
                stroke="#ef4444"
                strokeWidth="12"
                strokeLinecap="round"
                opacity={0.6}
              />
              {/* Active indicator dot */}
              <circle
                cx={10 + 70 + 70 * Math.cos((gaugeRotation * Math.PI) / 180)}
                cy={80 + 70 * Math.sin((gaugeRotation * Math.PI) / 180)}
                r="6"
                fill={config.color}
                className="gauge-pulse"
              />
            </svg>
          </div>
          <div className="font-mono-data text-4xl font-bold -mt-2" style={{ color: config.color }}>
            {data.index}
          </div>
          <div className="text-[10px] text-[#52525b] uppercase tracking-wider">{t('ghostGrowth.indexScore')}</div>
        </div>

        {/* Key Metrics */}
        <div className="space-y-2">
          <MetricBadge
            label={t('ghostGrowth.revenueGrowth')}
            value={`${data.metrics.revenueGrowth > 0 ? '+' : ''}${data.metrics.revenueGrowth.toFixed(1)}%`}
            alert={data.metrics.revenueGrowth > 5 && data.metrics.marginDecay < -1}
          />
          <MetricBadge
            label={t('ghostGrowth.marginDecay')}
            value={`${data.metrics.marginDecay > 0 ? '+' : ''}${data.metrics.marginDecay.toFixed(1)}%`}
            alert={data.metrics.marginDecay < -2}
            invert
          />
          <MetricBadge
            label={t('ghostGrowth.fleetGrowth')}
            value={`${data.metrics.fleetGrowthRate > 0 ? '+' : ''}${data.metrics.fleetGrowthRate.toFixed(1)}%`}
            alert={data.metrics.fleetGrowthRate > 5}
          />
          <MetricBadge
            label={t('ghostGrowth.shipmentDensity')}
            value={`${data.metrics.shipmentDensity.toFixed(1)}/km²`}
            alert={data.metrics.shipmentDensity < 10}
            invert
          />
          <MetricBadge
            label={t('ghostGrowth.fuelCostGrowth')}
            value={`${data.metrics.fuelCostGrowth > 0 ? '+' : ''}${data.metrics.fuelCostGrowth.toFixed(1)}%`}
            alert={data.metrics.fuelCostGrowth > 3}
          />
          <MetricBadge
            label={t('ghostGrowth.failedDeliveryGrowth')}
            value={`${data.metrics.failedDeliveryGrowth > 0 ? '+' : ''}${data.metrics.failedDeliveryGrowth.toFixed(1)}%`}
            alert={data.metrics.failedDeliveryGrowth > 5}
          />
        </div>
      </div>

      {/* AI Explanation */}
      <div className="bg-[#0a0a0b] border border-[#2a2a33] rounded p-3 mb-3">
        <div className="flex items-start gap-2">
          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: config.color }} />
          <p className="text-xs text-[#a1a1aa] leading-relaxed">
            {data.explanation}
          </p>
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-1.5">
        {data.recommendations.map((rec, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: config.color }} />
            <span className="text-[#a1a1aa]">{rec}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricBadge({
  label,
  value,
  alert,
  
}: {
  label: string;
  value: string;
  alert: boolean;
  invert?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-[#2a2a33]/50 last:border-0">
      <span className="text-[11px] text-[#71717a]">{label}</span>
      <span
        className={`text-[11px] font-mono-data font-medium ${
          alert ? 'text-[#f97316]' : 'text-[#a1a1aa]'
        }`}
      >
        {value}
        {alert && <span className="ml-1 text-[#f97316]">⚠</span>}
      </span>
    </div>
  );
}
