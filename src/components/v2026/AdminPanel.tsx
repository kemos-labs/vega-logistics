'use client';

import { useState } from 'react';
import { Section, StatCard, Badge, Panel, PanelTitle } from './Shell';
import { useApp50, ROLE_LABELS } from '@/lib/AppContext50';
import {    Database, Building, Lock, Bell, Zap } from 'lucide-react';
import { FleetRole } from '@/lib/types2026';

const ROLE_PERMISSIONS: Record<FleetRole, string[]> = {
  super_admin: ['*'],
  fleet_manager: ['fleet.*', 'driver.*', 'maintenance.*', 'compliance.*', 'analytics.view'],
  dispatcher: ['dispatch.*', 'fleet.view', 'customer.*'],
  driver: ['driver.self', 'job.self', 'pod.create', 'dvir.create'],
  warehouse_operator: ['warehouse.*', 'inventory.*', 'picklist.*', 'loadplan.*'],
  maintenance_tech: ['maintenance.*', 'parts.*', 'workorder.*'],
  customer_support: ['customer.*', 'shipment.*', 'pod.view'],
  executive: ['*', 'billing.view'],
};

const ROLES: FleetRole[] = ['super_admin', 'fleet_manager', 'dispatcher', 'driver', 'warehouse_operator', 'maintenance_tech', 'customer_support', 'executive'];

export default function AdminPanel() {
  const { auth, switchRole } = useApp50();
  const [tab, setTab] = useState<'users' | 'roles' | 'system' | 'integrations'>('users');

  return (
    <Section
      title="Admin Panel"
      subtitle="Role-based access · system settings · integrations"
      actions={
        <div className="flex items-center gap-1 bg-[#18181c] border border-[#2a2a33] rounded p-0.5">
          {(['users', 'roles', 'system', 'integrations'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`text-[10px] px-3 py-1 rounded capitalize ${tab === t ? 'bg-[#3b82f6] text-white' : 'text-[#a1a1aa] hover:text-[#e4e4e7]'}`}>
              {t}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatCard label="Active User" value={auth.fullName} color="#a855f7" sub={auth.role.replace('_', ' ')} />
        <StatCard label="Total Roles" value={ROLES.length} color="#3b82f6" />
        <StatCard label="System Health" value="99.9%" color="#22c55e" sub="Uptime" />
        <StatCard label="Audit Events" value="1.2k" color="#eab308" sub="Last 24h" />
      </div>

      {tab === 'users' && (
        <div className="grid grid-cols-2 gap-4">
          <Panel>
            <PanelTitle>Sign in as Role (Demo)</PanelTitle>
            <p className="text-[10px] text-[#71717a] mb-3">In production this would be OIDC/SSO. For the demo, switch the active user.</p>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => {
                const def = ROLE_LABELS[r];
                const active = auth.role === r;
                return (
                  <button
                    key={r}
                    onClick={() => switchRole(r)}
                    className={`p-2.5 rounded border text-left transition-colors ${active ? 'bg-[#1c1c21] border-[#3b82f6]' : 'bg-[#0a0a0b] border-[#2a2a33] hover:border-[#3d3d4a]'}`}
                  >
                    <div className="text-base mb-0.5">{def.icon}</div>
                    <div className="text-[11px] font-semibold text-[#e4e4e7]">{def.en}</div>
                    <div className="text-[9px] text-[#71717a] mt-0.5">{ROLE_PERMISSIONS[r].slice(0, 3).join(', ')}{ROLE_PERMISSIONS[r].length > 3 ? '…' : ''}</div>
                  </button>
                );
              })}
            </div>
          </Panel>
          <Panel>
            <PanelTitle>Current Session</PanelTitle>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: auth.avatarColor }}>
                {auth.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[#e4e4e7]">{auth.fullName}</div>
                <div className="text-[10px] text-[#71717a]">{auth.email}</div>
              </div>
            </div>
            <div className="space-y-1.5 text-[10px]">
              <Row k="Role" v={ROLE_LABELS[auth.role].en} />
              <Row k="Tenant" v={auth.tenantId} />
              <Row k="Permissions" v={ROLE_PERMISSIONS[auth.role].join(', ')} />
            </div>
            <div className="mt-3 pt-3 border-t border-[#2a2a33]">
              <div className="text-[9px] text-[#71717a] uppercase mb-2">What this role can see in the sidebar</div>
              <div className="space-y-1 text-[10px] text-[#a1a1aa]">
                {auth.role === 'driver' && <div>• Today&apos;s Jobs · POD Capture · DVIR · My Vehicle</div>}
                {auth.role === 'dispatcher' && <div>• Live Map · Dispatch Board · Customers · Driver Roster</div>}
                {auth.role === 'fleet_manager' && <div>• Live Map · Drivers · Maintenance · Fuel · Compliance · Analytics</div>}
                {auth.role === 'maintenance_tech' && <div>• Work Orders · Parts · Predictive Maintenance</div>}
                {auth.role === 'warehouse_operator' && <div>• Warehouses · Inventory · Pick Lists · Load Plans</div>}
                {auth.role === 'customer_support' && <div>• Customers · Shipment Tracking · Notifications</div>}
                {auth.role === 'executive' && <div>• Everything (read-only) · Analytics · Reports</div>}
                {auth.role === 'super_admin' && <div>• Everything (full access) · Admin Panel</div>}
              </div>
            </div>
          </Panel>
        </div>
      )}

      {tab === 'roles' && (
        <Panel>
          <PanelTitle>Role × Permission Matrix</PanelTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-[#71717a]">
                  <th className="text-left p-2">Role</th>
                  <th className="text-center p-2">Fleet</th>
                  <th className="text-center p-2">Dispatch</th>
                  <th className="text-center p-2">Drivers</th>
                  <th className="text-center p-2">Maint</th>
                  <th className="text-center p-2">Fuel</th>
                  <th className="text-center p-2">Compliance</th>
                  <th className="text-center p-2">Customer</th>
                  <th className="text-center p-2">WMS</th>
                  <th className="text-center p-2">Safety</th>
                  <th className="text-center p-2">Analytics</th>
                  <th className="text-center p-2">Admin</th>
                </tr>
              </thead>
              <tbody>
                {ROLES.map((r) => {
                  const perms = ROLE_PERMISSIONS[r];
                  const has = (p: string) => perms.includes('*') || perms.some((x) => x === p || x.startsWith(p));
                  return (
                    <tr key={r} className="border-t border-[#2a2a33]">
                      <td className="p-2 text-[#e4e4e7] font-semibold flex items-center gap-2">
                        <span>{ROLE_LABELS[r].icon}</span>{ROLE_LABELS[r].en}
                      </td>
                      {['fleet', 'dispatch', 'driver', 'maintenance', 'fuel', 'compliance', 'customer', 'warehouse', 'safety', 'analytics', 'admin'].map((m) => (
                        <td key={m} className="p-2 text-center">
                          {has(m) ? <Badge color="#22c55e">✓</Badge> : <span className="text-[#52525b]">—</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'system' && (
        <div className="grid grid-cols-2 gap-4">
          <Panel>
            <PanelTitle>System</PanelTitle>
            <div className="space-y-1.5 text-[10px]">
              <SystemRow icon={Database} label="Database" value="PostgreSQL 15 · 2.4 GB used" status="ok" />
              <SystemRow icon={Zap} label="Cache" value="Redis 7 · 92% hit rate" status="ok" />
              <SystemRow icon={Bell} label="Notifications" value="Twilio + FCM · 24ms avg" status="ok" />
              <SystemRow icon={Lock} label="Auth" value="OIDC + MFA · 2FA enforced" status="ok" />
              <SystemRow icon={Building} label="Multi-tenant" value="Enabled · row-level security" status="ok" />
            </div>
          </Panel>
          <Panel>
            <PanelTitle>Feature Flags</PanelTitle>
            <div className="space-y-1.5 text-[10px]">
              <Flag label="AI Dashcam" enabled />
              <Flag label="Predictive Maintenance" enabled />
              <Flag label="ZATCA e-Invoicing" enabled />
              <Flag label="WhatsApp Notify" enabled />
              <Flag label="Digital Twin Simulator" enabled />
              <Flag label="RL Route Optimizer" enabled />
              <Flag label="Multi-Agent AI" enabled />
            </div>
          </Panel>
        </div>
      )}

      {tab === 'integrations' && (
        <Panel>
          <PanelTitle>API & Integrations</PanelTitle>
          <div className="grid grid-cols-3 gap-2">
            {[
              { name: 'ZATCA', desc: 'E-invoicing clearance API', status: 'connected', color: '#22c55e' },
              { name: 'STC Pay', desc: 'Payment gateway', status: 'connected', color: '#22c55e' },
              { name: 'Twilio', desc: 'SMS + WhatsApp', status: 'connected', color: '#22c55e' },
              { name: 'Teltonika', desc: 'GPS device telemetry', status: 'connected', color: '#22c55e' },
              { name: 'Odoo ERP', desc: 'Accounting + Inventory', status: 'connected', color: '#22c55e' },
              { name: 'Salesforce', desc: 'CRM', status: 'pending', color: '#eab308' },
              { name: 'Saudia Cargo', desc: 'Air freight', status: 'available', color: '#71717a' },
              { name: 'Aramex', desc: 'Cross-border', status: 'available', color: '#71717a' },
              { name: 'Naft Fuel API', desc: 'Card transactions', status: 'connected', color: '#22c55e' },
            ].map((i) => (
              <div key={i.name} className="p-3 rounded bg-[#0a0a0b] border border-[#2a2a33]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-[#e4e4e7]">{i.name}</span>
                  <Badge color={i.color}>{i.status}</Badge>
                </div>
                <div className="text-[10px] text-[#71717a]">{i.desc}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </Section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-2"><span className="text-[#71717a]">{k}</span><span className="font-mono-data text-[#e4e4e7] text-right truncate">{v}</span></div>;
}

function SystemRow({ icon: Icon, label, value, status }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; status: 'ok' | 'warn' }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded bg-[#0a0a0b] border border-[#2a2a33]">
      <Icon className="w-3.5 h-3.5 text-[#3b82f6]" />
      <div className="flex-1">
        <div className="text-[10px] text-[#e4e4e7]">{label}</div>
        <div className="text-[9px] text-[#71717a]">{value}</div>
      </div>
      <Badge color={status === 'ok' ? '#22c55e' : '#eab308'}>{status === 'ok' ? 'OK' : 'WARN'}</Badge>
    </div>
  );
}

function Flag({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between p-2 rounded bg-[#0a0a0b] border border-[#2a2a33]">
      <span className="text-[10px] text-[#e4e4e7]">{label}</span>
      <div className={`w-8 h-4 rounded-full relative cursor-pointer ${enabled ? 'bg-[#22c55e]' : 'bg-[#52525b]'}`}>
        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full ${enabled ? 'left-4' : 'left-0.5'}`} />
      </div>
    </div>
  );
}
