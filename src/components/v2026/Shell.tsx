'use client';

import { ReactNode } from 'react';

export function Section({ title, subtitle, actions, children, scroll = true }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode; scroll?: boolean }) {
  return (
    <div className={`p-4 ${scroll ? 'overflow-y-auto' : ''} flex-1`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider">{title}</h2>
          {subtitle && <p className="text-[10px] text-[#52525b] mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function StatCard({ label, value, unit, color = '#3b82f6', sub }: { label: string; value: string | number; unit?: string; color?: string; sub?: string }) {
  return (
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg p-3">
      <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-1">{label}</div>
      <div className="font-mono-data text-xl font-bold" style={{ color }}>
        {value}{unit && <span className="text-xs text-[#a1a1aa] ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-[9px] text-[#52525b] mt-1">{sub}</div>}
    </div>
  );
}

export function Badge({ children, color = '#71717a', bg }: { children: ReactNode; color?: string; bg?: string }) {
  return (
    <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ color, backgroundColor: bg ?? `${color}22` }}>
      {children}
    </span>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-[#18181c] border border-[#2a2a33] rounded-lg p-4 ${className}`}>
      {children}
    </div>
  );
}

export function PanelTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider">{children}</h3>
      {action}
    </div>
  );
}

export function Bar({ value, max, color = '#3b82f6', height = 6 }: { value: number; max: number; color?: string; height?: number }) {
  const pct = max === 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-full bg-[#0a0a0b] rounded-full overflow-hidden" style={{ height }}>
      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}
