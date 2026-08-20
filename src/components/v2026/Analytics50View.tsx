'use client';

import { useMemo } from 'react';
import { Section, StatCard, Badge, Panel, PanelTitle, Bar } from './Shell';
import { useApp50 } from '@/lib/AppContext50';
import { generateKPITrends, getDriverLeaderboard, getVehicleHealthGrid } from '@/lib/engines/kpi50';


export default function Analytics50View() {
  const { snapshot, kpis } = useApp50();
  const trends = useMemo(() => generateKPITrends(snapshot, 14), [snapshot]);
  const leaderboard = useMemo(() => getDriverLeaderboard(snapshot, 8), [snapshot]);
  const health = useMemo(() => getVehicleHealthGrid(snapshot), [snapshot]);

  const criticalHealth = health.filter((v) => v.health === 'critical').length;
  const attentionHealth = health.filter((v) => v.health === 'attention').length;
  const totalFuel = snapshot.fuelEvents.reduce((s, e) => s + e.costSar, 0);
  const totalMaint = snapshot.workOrders.filter((w) => w.status === 'completed').reduce((s, w) => s + w.totalCostSar, 0);
  const totalRevenue = snapshot.customers.reduce((s, c) => s + c.lifetimeValueSar, 0);

  return (
    <Section title="Analytics & Reporting" subtitle="KPI rollups · trends · cost breakdowns · cross-module insights">
      <div className="grid grid-cols-5 gap-3 mb-4">
        <StatCard label="Fleet Util" value={`${kpis.fleetUtilization.toFixed(0)}%`} color="#22c55e" sub={`${kpis.vehiclesActive}/${kpis.fleetSize} active`} />
        <StatCard label="On-Time" value={`${kpis.onTimeDeliveryRate}%`} color="#3b82f6" sub="Target 92%" />
        <StatCard label="Safety Score" value={kpis.avgSafetyScore} color="#22c55e" sub="Driver avg" />
        <StatCard label="MTTR" value={`${kpis.fleetMTTR}h`} color="#a855f7" sub="Mean time to repair" />
        <StatCard label="Alerts Open" value={kpis.openAlerts} color={kpis.criticalAlerts > 0 ? '#ef4444' : '#eab308'} sub={`${kpis.criticalAlerts} critical`} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2">
          <Panel>
            <PanelTitle>14-Day KPI Trends</PanelTitle>
            <div className="grid grid-cols-3 gap-3">
              <TrendChart title="On-Time Rate (%)" data={trends.onTimeRate} color="#3b82f6" unit="%" />
              <TrendChart title="Fleet Util (%)" data={trends.fleetUtil} color="#22c55e" unit="%" />
              <TrendChart title="Safety Score" data={trends.safetyScore} color="#a855f7" unit="" />
              <TrendChart title="Fuel Eff (L/100km)" data={trends.fuelEff} color="#06b6d4" unit="" inverse />
              <TrendChart title="Cost/km (SAR)" data={trends.costPerKm} color="#f97316" unit="" inverse />
              <TrendChart title="Deliveries" data={trends.deliveries} color="#eab308" unit="" />
            </div>
          </Panel>
        </div>
        <Panel>
          <PanelTitle>Fleet Health (50 vehicles)</PanelTitle>
          <div className="grid grid-cols-5 gap-1 mb-3">
            {health.map((v) => (
              <div
                key={v.vehicleId}
                className="aspect-square rounded flex items-center justify-center text-[9px] font-mono-data font-bold"
                title={`${v.plate}: ${v.score}/100`}
                style={{ backgroundColor: v.health === 'healthy' ? '#22c55e' : v.health === 'attention' ? '#eab308' : '#ef4444', color: '#000', opacity: 0.85 }}
              >
                {v.plate.split(' ')[0].slice(0, 3)}
              </div>
            ))}
          </div>
          <div className="space-y-1.5 text-[10px]">
            <HealthRow label="Healthy" value={health.filter((v) => v.health === 'healthy').length} total={health.length} color="#22c55e" />
            <HealthRow label="Attention" value={attentionHealth} total={health.length} color="#eab308" />
            <HealthRow label="Critical" value={criticalHealth} total={health.length} color="#ef4444" />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <Panel>
          <PanelTitle action={<Badge color="#f97316">SAR</Badge>}>Cost Breakdown (30d)</PanelTitle>
          <div className="space-y-2 text-[10px]">
            <CostBar label="Fuel" value={totalFuel} total={totalFuel + totalMaint} color="#f97316" />
            <CostBar label="Maintenance" value={totalMaint} total={totalFuel + totalMaint} color="#3b82f6" />
            <CostBar label="Total" value={totalFuel + totalMaint} total={totalFuel + totalMaint} color="#a855f7" isTotal />
          </div>
        </Panel>
        <Panel>
          <PanelTitle>Customer Revenue</PanelTitle>
          <div className="space-y-1.5">
            <div>
              <div className="text-[10px] text-[#71717a]">Total LTV</div>
              <div className="text-[18px] font-mono-data font-bold text-[#3b82f6]">SAR {(totalRevenue / 1e6).toFixed(1)}M</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <div className="text-[#71717a] text-[9px]">Active</div>
                <div className="font-mono-data text-[#22c55e]">{kpis.activeCustomers}</div>
              </div>
              <div>
                <div className="text-[#71717a] text-[9px]">Outstanding</div>
                <div className="font-mono-data text-[#f97316]">SAR {Math.round(snapshot.customers.reduce((s, c) => s + c.outstandingSar, 0) / 1000).toLocaleString()}k</div>
              </div>
            </div>
          </div>
        </Panel>
        <Panel>
          <PanelTitle>Work Order Pipeline</PanelTitle>
          <div className="space-y-1.5 text-[10px]">
            {(['open', 'scheduled', 'in_progress', 'awaiting_parts', 'completed'] as const).map((st) => {
              const count = snapshot.workOrders.filter((w) => w.status === st).length;
              return (
                <div key={st} className="flex justify-between">
                  <span className="text-[#a1a1aa] capitalize">{st.replace('_', ' ')}</span>
                  <span className="font-mono-data" style={{ color: count > 0 ? '#3b82f6' : '#52525b' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel>
          <PanelTitle>Safety Events (7d)</PanelTitle>
          <div className="space-y-1.5 text-[10px]">
            {(['low', 'medium', 'high', 'critical'] as const).map((sv) => {
              const count = snapshot.safetyEvents.filter((e) => e.severity === sv).length;
              return (
                <div key={sv} className="flex justify-between">
                  <span className="text-[#a1a1aa] capitalize">{sv}</span>
                  <span className="font-mono-data" style={{ color: sv === 'critical' ? '#ef4444' : sv === 'high' ? '#f97316' : sv === 'medium' ? '#eab308' : '#3b82f6' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Panel>
          <PanelTitle action={<Badge color="#a855f7">Top 8</Badge>}>Top Driver Performance</PanelTitle>
          <div className="space-y-1">
            {leaderboard.map((d, i) => (
              <div key={d.driverId} className="grid grid-cols-12 gap-2 items-center text-[10px] p-1.5 rounded bg-[#0a0a0b]">
                <div className="col-span-1 text-[#71717a] font-mono-data">#{i + 1}</div>
                <div className="col-span-4 text-[#e4e4e7] truncate">{d.name}</div>
                <div className="col-span-3"><Bar value={d.safetyScore} max={100} color="#22c55e" height={3} /></div>
                <div className="col-span-2 text-right font-mono-data text-[#3b82f6]">{d.onTimeRate.toFixed(0)}%</div>
                <div className="col-span-2 text-right font-mono-data text-[#a855f7]">{d.compositeScore}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelTitle>Job Status Mix</PanelTitle>
          <div className="space-y-1.5">
            {(['unassigned', 'planned', 'assigned', 'en_route', 'arrived', 'delivered', 'failed'] as const).map((st) => {
              const count = snapshot.jobs.filter((j) => j.status === st).length;
              const max = Math.max(...['unassigned', 'planned', 'assigned', 'en_route', 'arrived', 'delivered', 'failed'].map((s) => snapshot.jobs.filter((j) => j.status === s).length));
              return (
                <div key={st}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-[#a1a1aa] capitalize">{st.replace('_', ' ')}</span>
                    <span className="font-mono-data text-[#e4e4e7]">{count}</span>
                  </div>
                  <Bar value={count} max={max || 1} color={st === 'delivered' ? '#22c55e' : st === 'failed' ? '#ef4444' : '#3b82f6'} height={6} />
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </Section>
  );
}

function TrendChart({ title, data, color, unit, inverse }: { title: string; data: number[]; color: string; unit: string; inverse?: boolean }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 100, H = 40;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`).join(' ');
  const trendUp = data[data.length - 1] > data[0];
  const trendGood = inverse ? !trendUp : trendUp;
  return (
    <div>
      <div className="flex items-center justify-between text-[9px] mb-1">
        <span className="text-[#71717a] uppercase tracking-wider">{title}</span>
        <span className="font-mono-data" style={{ color: trendGood ? '#22c55e' : '#ef4444' }}>
          {trendUp ? '↑' : '↓'} {Math.abs(data[data.length - 1] - data[0]).toFixed(1)}{unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-12">
        <defs>
          <linearGradient id={`g-${title.replace(/\s/g, '')}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={`0,${H} ${points} ${W},${H}`} fill={`url(#g-${title.replace(/\s/g, '')})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="text-[10px] font-mono-data mt-0.5" style={{ color }}>{data[data.length - 1]}{unit}</div>
    </div>
  );
}

function HealthRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#a1a1aa]">{label}</span>
      <div className="flex items-center gap-2">
        <Bar value={value} max={total} color={color} height={4} />
        <span className="font-mono-data" style={{ color }}>{value}/{total}</span>
      </div>
    </div>
  );
}

function CostBar({ label, value, total, color, isTotal }: { label: string; value: number; total: number; color: string; isTotal?: boolean }) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className={isTotal ? 'text-[#e4e4e7] font-semibold' : 'text-[#a1a1aa]'}>{label}</span>
        <span className="font-mono-data" style={{ color }}>SAR {Math.round(value).toLocaleString()}</span>
      </div>
      <Bar value={value} max={total} color={color} height={isTotal ? 8 : 6} />
    </div>
  );
}
