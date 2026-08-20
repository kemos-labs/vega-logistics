'use client';

import { useState, useMemo } from 'react';
import { FinancialInput, FinancialOutput } from '@/lib/types';
import {
  runFMEA,
  calculateVaR,
  calculateSCRS,
  FMEAResult,
  VaRResult,
  SCRSResult,
} from '@/lib/advancedRisk';
import MonteCarloPanel from './MonteCarloPanel';
import {
  AlertTriangle,
  TrendingDown,
  Shield,
  ChevronRight,
  
  
  Activity,
  
  Target,
  
  Dice5,
} from 'lucide-react';

// ─── Props ───

interface AdvancedRiskPanelProps {
  input: FinancialInput;
  output: FinancialOutput;
}

type TabId = 'montecarlo' | 'fmea' | 'var' | 'scrs';

// ─── Shared utilities ───

function formatSAR(value: number): string {
  return `SAR ${Math.round(value).toLocaleString('en-US')}`;
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 50) return '#eab308';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

function getScoreLabel(score: number): string {
  if (score >= 70) return 'Strong';
  if (score >= 50) return 'Adequate';
  if (score >= 30) return 'Vulnerable';
  return 'Critical';
}

// ─── Tab Button ───

function TabButton({
  
  label,
  icon: Icon,
  active,
  onClick,
}: {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium tracking-wide uppercase transition-colors border-b-2 whitespace-nowrap ${
        active
          ? 'border-[#22c55e] text-[#e4e4e7] bg-[#18181c]/80'
          : 'border-transparent text-[#52525b] hover:text-[#a1a1aa] hover:border-[#3f3f46]'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

// ─── FMEA Tab ───

function FMEATab({ data }: { data: FMEAResult }) {
  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-6 text-[12px]">
        <div className="flex items-center gap-2">
          <span className="text-[#52525b]">Total Items:</span>
          <span className="font-mono-data text-[#e4e4e7]">{data.items.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#52525b]">Total RPN:</span>
          <span className="font-mono-data text-[#e4e4e7]">{data.totalRPN.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-[#ef4444]" />
          <span className="text-[#52525b]">Critical Items (RPN &gt; 200):</span>
          <span className="font-mono-data text-[#ef4444] font-bold">{data.criticalItems.length}</span>
        </div>
      </div>

      {/* FMEA Table */}
      <div className="overflow-x-auto border border-[#2a2a33] rounded">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-[#0a0a0b] text-[#71717a] uppercase tracking-wider">
              <th className="text-left px-3 py-2 w-[100px]">Node</th>
              <th className="text-left px-3 py-2">Failure Mode</th>
              <th className="text-center px-3 py-2 w-[50px]">S</th>
              <th className="text-center px-3 py-2 w-[50px]">O</th>
              <th className="text-center px-3 py-2 w-[50px]">D</th>
              <th className="text-center px-3 py-2 w-[70px]">RPN</th>
              <th className="text-center px-3 py-2 w-[70px]">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => {
              const rpn = item.severity * item.occurrence * item.detectability;
              const isCritical = rpn > 200;
              return (
                <tr
                  key={idx}
                  className={`border-t border-[#1a1a1f] transition-colors ${
                    isCritical
                      ? 'bg-[#7f1d1d]/15 hover:bg-[#7f1d1d]/25'
                      : 'hover:bg-[#18181c]/60'
                  }`}
                >
                  <td className="px-3 py-2 text-[#a1a1aa] font-medium">{item.node}</td>
                  <td className="px-3 py-2 text-[#d4d4d8]">{item.failureMode}</td>
                  <td className="px-3 py-2 text-center font-mono-data text-[#e4e4e7]">{item.severity}</td>
                  <td className="px-3 py-2 text-center font-mono-data text-[#e4e4e7]">{item.occurrence}</td>
                  <td className="px-3 py-2 text-center font-mono-data text-[#e4e4e7]">{item.detectability}</td>
                  <td className="px-3 py-2 text-center font-mono-data font-bold">
                    <span className={isCritical ? 'text-[#ef4444]' : 'text-[#e4e4e7]'}>
                      {rpn}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {isCritical ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[#ef4444]/20 text-[#f87171] font-medium">
                        <AlertTriangle size={10} />
                        CRITICAL
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#52525b]">OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Auto-Suggestions */}
      {data.suggestions.length > 0 && (
        <div>
          <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-2">
            Mitigation Suggestions ({data.suggestions.length})
          </div>
          <div className="space-y-1.5">
            {data.suggestions.map((s, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-[11px] text-[#a1a1aa] bg-[#0a0a0b] border border-[#1a1a1f] rounded px-3 py-2"
              >
                <ChevronRight size={12} className="mt-0.5 text-[#22c55e] shrink-0" />
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── VaR Tab ───

function VaRTab({ data }: { data: VaRResult; revenue: number }) {
  const pct95 = data.monthlyRevenue > 0 ? ((data.confidence95 / data.monthlyRevenue) * 100).toFixed(1) : '0';
  const pct99 = data.monthlyRevenue > 0 ? ((data.confidence99 / data.monthlyRevenue) * 100).toFixed(1) : '0';

  // Simple bar chart values for visualization
  const barMax = data.confidence99 * 1.3;

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* 95% Card */}
        <div className="border border-[#2a2a33] rounded bg-[#0a0a0b] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-[#71717a] uppercase tracking-wider">VaR @ 95% Confidence</span>
            <span className="text-[10px] text-[#eab308] bg-[#eab308]/10 px-1.5 py-0.5 rounded font-medium">
              Z = 1.645
            </span>
          </div>
          <div className="text-2xl font-mono-data font-bold text-[#e4e4e7]">
            {formatSAR(data.confidence95)}
          </div>
          <div className="text-[11px] text-[#a1a1aa] mt-1">
            {pct95}% of monthly revenue
          </div>
          <div className="text-[10px] text-[#f97316] mt-2">
            5% probability of exceeding this loss in any month
          </div>
        </div>

        {/* 99% Card */}
        <div className="border border-[#2a2a33] rounded bg-[#0a0a0b] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-[#71717a] uppercase tracking-wider">VaR @ 99% Confidence</span>
            <span className="text-[10px] text-[#ef4444] bg-[#ef4444]/10 px-1.5 py-0.5 rounded font-medium">
              Z = 2.326
            </span>
          </div>
          <div className="text-2xl font-mono-data font-bold text-[#ef4444]">
            {formatSAR(data.confidence99)}
          </div>
          <div className="text-[11px] text-[#a1a1aa] mt-1">
            {pct99}% of monthly revenue
          </div>
          <div className="text-[10px] text-[#ef4444] mt-2">
            1% probability — &quot;once in 8 years&quot; scenario
          </div>
        </div>
      </div>

      {/* Loss Range Bar Chart */}
      <div className="border border-[#2a2a33] rounded bg-[#0a0a0b] p-4">
        <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-3">
          Potential Loss at Risk (SAR)
        </div>
        <div className="space-y-2">
          {/* 95% Bar */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[#a1a1aa] w-16 text-right shrink-0">95% VaR</span>
            <div className="flex-1 h-5 bg-[#18181c] rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-all duration-700"
                style={{
                  width: `${(data.confidence95 / barMax) * 100}%`,
                  backgroundColor: '#eab308',
                }}
              />
            </div>
            <span className="text-[11px] font-mono-data text-[#e4e4e7] w-24 text-right shrink-0">
              {formatSAR(data.confidence95)}
            </span>
          </div>
          {/* 99% Bar */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[#a1a1aa] w-16 text-right shrink-0">99% VaR</span>
            <div className="flex-1 h-5 bg-[#18181c] rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-all duration-700"
                style={{
                  width: `${(data.confidence99 / barMax) * 100}%`,
                  backgroundColor: '#ef4444',
                }}
              />
            </div>
            <span className="text-[11px] font-mono-data text-[#ef4444] w-24 text-right shrink-0">
              {formatSAR(data.confidence99)}
            </span>
          </div>
        </div>
      </div>

      {/* Interpretation */}
      <div className="border border-[#2a2a33] rounded bg-[#0a0a0b] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity size={14} className="text-[#22c55e]" />
          <span className="text-[10px] text-[#71717a] uppercase tracking-wider">Interpretation</span>
        </div>
        <p className="text-[12px] text-[#d4d4d8] leading-relaxed">{data.interpretation}</p>
      </div>
    </div>
  );
}

// ─── Radar Chart (SVG) ───

function RadarChart({
  data,
  size = 220,
}: {
  data: { category: string; score: number }[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const levels = 5;
  const totalAxes = data.length;
  const angleStep = (2 * Math.PI) / totalAxes;

  // Map score (0-100) to radius fraction
  const getPoint = (index: number, value: number): { x: number; y: number } => {
    const angle = angleStep * index - Math.PI / 2; // Start from top
    const r = (value / 100) * radius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  // Build grid polygons
  const gridPolygons = Array.from({ length: levels }, (_, level) => {
    const r = ((level + 1) / levels) * radius;
    const points = Array.from({ length: totalAxes }, (_, i) => {
      const angle = angleStep * i - Math.PI / 2;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(' ');
    return <polygon key={level} points={points} fill="none" stroke="#2a2a33" strokeWidth="0.5" />;
  });

  // Build axis lines
  const axes = Array.from({ length: totalAxes }, (_, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#2a2a33" strokeWidth="0.5" />;
  });

  // Build data polygon
  const dataPoints = Array.from({ length: totalAxes }, (_, i) => {
    const pt = getPoint(i, data[i].score);
    return `${pt.x},${pt.y}`;
  }).join(' ');

  // Labels
  const labels = Array.from({ length: totalAxes }, (_, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const labelR = radius + 28;
    const x = cx + labelR * Math.cos(angle);
    const y = cy + labelR * Math.sin(angle);
    // Truncate long labels
    const label = data[i].category.length > 16
      ? data[i].category.slice(0, 14) + '…'
      : data[i].category;
    return (
      <text
        key={i}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-[#71717a] text-[8px]"
        style={{ fontSize: '8px' }}
      >
        {label}
      </text>
    );
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="mx-auto"
    >
      {gridPolygons}
      {axes}
      <polygon
        points={dataPoints}
        fill="rgba(34, 197, 94, 0.15)"
        stroke="#22c55e"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {Array.from({ length: totalAxes }, (_, i) => {
        const pt = getPoint(i, data[i].score);
        return (
          <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="#22c55e" stroke="#0a0a0b" strokeWidth="1" />
        );
      })}
      {labels}
    </svg>
  );
}

// ─── SCRS Tab ───

function SCRSTab({ data }: { data: SCRSResult }) {
  const overallColor = getScoreColor(data.overallScore);

  return (
    <div className="space-y-4">
      {/* Overall Score Hero */}
      <div className="border border-[#2a2a33] rounded bg-[#0a0a0b] p-4 flex items-center gap-5">
        <div className="text-center">
          <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-1">SCRS Score</div>
          <div className="text-4xl font-mono-data font-bold" style={{ color: overallColor }}>
            {data.overallScore}
          </div>
          <div className="text-[11px] font-medium mt-1" style={{ color: overallColor }}>
            {data.level}
          </div>
        </div>
        <div className="flex-1 flex justify-center">
          <RadarChart data={data.radarData} size={180} />
        </div>
      </div>

      {/* Factor Cards */}
      <div className="grid grid-cols-2 gap-3">
        {data.factors.map((factor, idx) => {
          const color = getScoreColor(factor.score);
          const level = getScoreLabel(factor.score);
          return (
            <div
              key={idx}
              className="border border-[#2a2a33] rounded bg-[#0a0a0b] p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#d4d4d8] font-medium">{factor.name}</span>
                <span className="text-[10px] font-mono-data font-bold" style={{ color }}>
                  {factor.score}/100
                </span>
              </div>

              {/* Score Bar */}
              <div className="h-2 bg-[#18181c] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${factor.score}%`, backgroundColor: color }}
                />
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${color}15`, color }}
                >
                  {level}
                </span>
              </div>

              <p className="text-[10px] text-[#71717a] leading-relaxed">
                {factor.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="border border-[#2a2a33] rounded bg-[#0a0a0b] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target size={14} className="text-[#22c55e]" />
            <span className="text-[10px] text-[#71717a] uppercase tracking-wider">
              Recommendations ({data.recommendations.length})
            </span>
          </div>
          <div className="space-y-2">
            {data.recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-[11px] text-[#a1a1aa]"
              >
                <ChevronRight size={11} className="mt-0.5 text-[#22c55e] shrink-0" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  Main Panel
// ═══════════════════════════════════════════

export default function AdvancedRiskPanel({ input, output }: AdvancedRiskPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('montecarlo');

  // Compute all data once — memoized
  const fmeaData = useMemo(() => runFMEA(), []);
  const varData = useMemo(
    () => calculateVaR(output.totalRevenue, 15), // 15% volatility assumption
    [output.totalRevenue]
  );
  const scrsData = useMemo(() => calculateSCRS(), []);

  return (
    <div className="border border-[#2a2a33] rounded bg-[#0d0d10] overflow-hidden">
      {/* Tab Header */}
      <div className="flex border-b border-[#2a2a33] bg-[#0a0a0b]/50 overflow-x-auto">
        <TabButton
          id="montecarlo"
          label="Monte Carlo"
          icon={Dice5}
          active={activeTab === 'montecarlo'}
          onClick={() => setActiveTab('montecarlo')}
        />
        <TabButton
          id="fmea"
          label="FMEA"
          icon={AlertTriangle}
          active={activeTab === 'fmea'}
          onClick={() => setActiveTab('fmea')}
        />
        <TabButton
          id="var"
          label="Value at Risk"
          icon={TrendingDown}
          active={activeTab === 'var'}
          onClick={() => setActiveTab('var')}
        />
        <TabButton
          id="scrs"
          label="SCRS Resilience"
          icon={Shield}
          active={activeTab === 'scrs'}
          onClick={() => setActiveTab('scrs')}
        />
      </div>

      {/* Tab Content */}
      <div className="p-4 max-h-[700px] overflow-y-auto">
        {activeTab === 'montecarlo' && <MonteCarloPanel input={input} output={output} />}
        {activeTab === 'fmea' && <FMEATab data={fmeaData} />}
        {activeTab === 'var' && <VaRTab data={varData} revenue={output.totalRevenue} />}
        {activeTab === 'scrs' && <SCRSTab data={scrsData} />}
      </div>
    </div>
  );
}
