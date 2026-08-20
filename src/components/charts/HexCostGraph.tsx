'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';

export interface CostItem {
  label: string;
  value: number;
  color: string;
  perVan?: number;
  detail?: string;
}

function hexPoint(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

interface Props {
  items: CostItem[];
  total: number;
  title?: string;
  editable?: boolean;
  onItemsChange?: (items: CostItem[]) => void;
  totalVans?: number;
  /** Optimization targets — shown when editable */
  targets?: { label: string; key: string; value: number; max: number; suffix: string }[];
  onTargetChange?: (key: string, value: number) => void;
}

export default function HexCostGraph({ items, total, title, editable, onItemsChange, totalVans, targets, onTargetChange }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const svgW = 520, svgH = 420;
  const cx = svgW / 2, cy = svgH / 2 - 10;
  const hexR = Math.min(cx, cy) - 30;
  const labelR = hexR * 0.62;

  const hexVerts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return hexPoint(cx, cy, hexR, a);
  });
  const hexPointsAttr = hexVerts.map(p => `${p.x},${p.y}`).join(' ');

  type Sector = typeof sorted[number] & { path: string; midX: number; midY: number; pct: number; midAngle: number };
  const sectors = sorted.reduce<{ total: number; sectors: Sector[] }>((acc, item) => {
    const startAngle = (acc.total / Math.max(total, 1)) * 2 * Math.PI - Math.PI / 2;
    const cumulative = acc.total + item.value;
    const endAngle = (cumulative / Math.max(total, 1)) * 2 * Math.PI - Math.PI / 2;
    const midAngle = (startAngle + endAngle) / 2;
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const x1 = cx + hexR * Math.cos(startAngle);
    const y1 = cy + hexR * Math.sin(startAngle);
    const x2 = cx + hexR * Math.cos(endAngle);
    const y2 = cy + hexR * Math.sin(endAngle);
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${hexR} ${hexR} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    const midX = cx + labelR * Math.cos(midAngle);
    const midY = cy + labelR * Math.sin(midAngle);
    const pct = total > 0 ? ((item.value / total) * 100) : 0;
    return { total: cumulative, sectors: [...acc.sectors, { ...item, path, midX, midY, pct, midAngle }] };
  }, { total: 0, sectors: [] }).sectors;

  const updateItemValue = (idx: number, newValue: number) => {
    if (!onItemsChange) return;
    const updated = [...items];
    updated[idx] = { ...updated[idx], value: Math.max(0, newValue) };
    onItemsChange(updated);
  };

  return (
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-4">
      {title && (
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] text-[#71717a] uppercase tracking-wider">{title}</h3>
          {editable && <Settings className="w-3 h-3 text-[#52525b]" />}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hexagon column */}
        <div className="lg:col-span-2">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ maxHeight: 380 }}>
            <defs>
              <clipPath id="hexClip">
                <polygon points={hexPointsAttr} />
              </clipPath>
            </defs>
            <polygon points={hexPointsAttr} fill="none" stroke="#2a2a33" strokeWidth={1} />
            <g clipPath="url(#hexClip)">
              {sectors.map((s, i) => (
                <path key={i} d={s.path}
                  fill={hoverIdx === i ? s.color + '80' : s.color + '50'}
                  stroke={s.color} strokeWidth={hoverIdx === i ? 2.5 : 1.5}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                />
              ))}
            </g>
            {/* Center label */}
            <text x={cx} y={cy - 2} textAnchor="middle" className="fill-[#e4e4e7] font-bold"
              style={{ fontSize: 18, pointerEvents: 'none' }}>
              {total > 0 ? `SAR ${Math.round(total / 1000)}K` : '—'}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" className="fill-[#71717a]"
              style={{ fontSize: 9, pointerEvents: 'none' }}>total monthly</text>
            {totalVans && totalVans > 0 && (
              <text x={cx} y={cy + 28} textAnchor="middle" className="fill-[#52525b]"
                style={{ fontSize: 9, pointerEvents: 'none' }}>
                SAR {Math.round(total / totalVans).toLocaleString()}/van
              </text>
            )}
            {/* Sector labels */}
            {sectors.map((s, i) => {
              if (s.pct < 3.5) return null;
              return (
                <g key={`lbl-${i}`}>
                  <text x={s.midX} y={s.midY - 7} textAnchor="middle"
                    className="fill-[#e4e4e7] font-bold" style={{ fontSize: 10, pointerEvents: 'none' }}>
                    {s.label.length > 10 ? s.label.slice(0, 9) + '..' : s.label}
                  </text>
                  <text x={s.midX} y={s.midY + 6} textAnchor="middle"
                    className="fill-[#a1a1aa] font-mono-data" style={{ fontSize: 9, pointerEvents: 'none' }}>
                    {s.pct.toFixed(1)}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Cost breakdown + editable inputs column */}
        <div className="space-y-2">
          <div className="text-[9px] text-[#52525b] uppercase tracking-wider mb-1">Cost Breakdown</div>
          {sorted.map((item, i) => {
            const origIdx = items.findIndex(it => it.label === item.label);
            return (
              <div key={i} className="flex items-center gap-2 text-[10px] group">
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-[#a1a1aa] flex-1 truncate">{item.label}</span>
                {editable && onItemsChange ? (
                  <input type="number" min={0} step={1000}
                    value={Math.round(item.value)}
                    onChange={e => updateItemValue(origIdx, Number(e.target.value))}
                    className="w-20 text-right bg-[#0a0a0b] border border-[#2a2a33] rounded px-1.5 py-0.5 text-[10px] text-[#e4e4e7] font-mono-data focus:outline-none focus:border-[#3b82f6]"
                  />
                ) : (
                  <span className="font-mono-data text-[#e4e4e7]">
                    SAR {Math.round(item.value).toLocaleString()}
                  </span>
                )}
                <span className="text-[#52525b] font-mono-data w-8 text-right">{total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'}%</span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 text-[10px] pt-1 border-t border-[#2a2a33] mt-1">
            <span className="flex-1 text-[#71717a] font-semibold">Total</span>
            <span className="font-mono-data text-[#e4e4e7] font-bold">
              SAR {Math.round(total).toLocaleString()}
            </span>
            <span className="text-[#52525b] font-mono-data w-8 text-right">100%</span>
          </div>

          {/* Per-van stats */}
          {totalVans && totalVans > 0 && (
            <div className="mt-2 pt-2 border-t border-[#2a2a33] space-y-1">
              <div className="text-[9px] text-[#52525b] uppercase tracking-wider">Per Van</div>
              {sorted.filter(it => (it.value / totalVans) > 0).slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-[#71717a] flex-1 truncate">{item.label}</span>
                  <span className="font-mono-data text-[#a1a1aa]">
                    SAR {Math.round(item.value / totalVans).toLocaleString()}/van
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Optimization targets */}
          {editable && targets && onTargetChange && (
            <div className="mt-2 pt-2 border-t border-[#2a2a33] space-y-2">
              <div className="text-[9px] text-[#a855f7] uppercase tracking-wider flex items-center gap-1">
                <Settings className="w-2.5 h-2.5" /> Optimization Targets
              </div>
              {targets.map(t => (
                <div key={t.key} className="flex items-center gap-2 text-[10px]">
                  <span className="text-[#a1a1aa] flex-1">{t.label}</span>
                  <div className="flex items-center gap-1">
                    <input type="range" min={0} max={t.max} step={1}
                      value={t.value} onChange={e => onTargetChange(t.key, Number(e.target.value))}
                      className="w-16 h-1 accent-[#a855f7]" />
                    <span className="font-mono-data text-[#e4e4e7] w-10 text-right">{t.value}{t.suffix}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
