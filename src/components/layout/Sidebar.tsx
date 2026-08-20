'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import {
  LayoutDashboard, Truck, Map, TrendingUp, Shield,
  ChevronLeft, ChevronRight, Brain, Box, Leaf, Wrench, Eye, Route,
  Users, ClipboardList, Fuel, FileCheck, Package, Warehouse, Activity, Lock,
  Globe,
} from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import { useApp50, ROLE_LABELS } from '@/lib/AppContext50';
import { FleetRole } from '@/lib/types2026';
import { Module } from '@/lib/types';

interface SidebarProps {
  activeModule: Module;
  onModuleChange: (module: Module) => void;
}

interface NavItem {
  id: Module;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  shortcut?: string;
  accent?: string;
}

const ROLE_ACCESS: Record<FleetRole, Module[]> = {
  super_admin: ['command-center', 'live-map', 'dispatch', 'drivers', 'maintenance', 'fuel', 'compliance', 'delivery', 'customer', 'wms', 'safety', 'analytics50', 'admin', 'ai-agents', 'digital-twin', 'carbon', 'rl-route', 'predictive-maintenance', 'computer-vision', 'providers', 'freelancers', 'fleet-vehicles'],
  fleet_manager: ['command-center', 'live-map', 'drivers', 'maintenance', 'fuel', 'compliance', 'safety', 'analytics50', 'carbon', 'predictive-maintenance', 'providers', 'freelancers', 'fleet-vehicles'],
  dispatcher: ['command-center', 'live-map', 'dispatch', 'drivers', 'customer', 'rl-route', 'providers'],
  driver: ['command-center', 'delivery', 'drivers', 'fleet', 'compliance'],
  warehouse_operator: ['command-center', 'wms', 'delivery'],
  maintenance_tech: ['command-center', 'maintenance', 'predictive-maintenance', 'fuel', 'fleet-vehicles'],
  customer_support: ['command-center', 'customer', 'delivery', 'analytics50'],
  executive: ['command-center', 'live-map', 'analytics50', 'carbon', 'digital-twin', 'ai-agents', 'customer', 'safety', 'compliance', 'providers', 'freelancers', 'fleet-vehicles'],
};

const NAV_LABEL_KEYS: Partial<Record<Module, string>> = {
  'command-center': 'navigation.commandCenter',
  'live-map': 'navigation.liveMap',
  'dispatch': 'navigation.dispatch',
  'drivers': 'navigation.drivers',
  'delivery': 'navigation.delivery',
  'customer': 'navigation.customer',
  'maintenance': 'navigation.predictiveMaintenance',
  'fuel': 'navigation.fuel',
  'wms': 'navigation.wms',
  'compliance': 'navigation.compliance',
  'analytics50': 'navigation.analytics50',
  'safety': 'navigation.safety',
  'ai-agents': 'navigation.aiAgents',
  'digital-twin': 'navigation.digitalTwin',
  'rl-route': 'navigation.rlRoute',
  'predictive-maintenance': 'navigation.predictiveMaintenance',
  'computer-vision': 'navigation.computerVision',
  'carbon': 'navigation.carbon',
  'admin': 'navigation.admin',
  'autoclaw': 'navigation.nexusFleet',
  'ghost-growth': 'navigation.ghostGrowth',
  'fleet': 'navigation.fleetMap',
  'risk': 'navigation.riskManager',
  'analytics': 'navigation.analytics',
  'feasibility': 'tabs.feasibility',
  'providers': 'navigation.providers',
  'freelancers': 'navigation.freelancers',
  'fleet-vehicles': 'navigation.fleetVehicles',
};

const ALL_ITEMS: { group: string; items: NavItem[] }[] = [
  {
    group: 'Operations',
    items: [
      { id: 'command-center', label: 'Command Center', icon: LayoutDashboard, shortcut: '⌘1' },
      { id: 'live-map', label: 'Live Fleet Map', icon: Map, shortcut: '⌘2', accent: '#22c55e' },
      { id: 'dispatch', label: 'Dispatch Board', icon: ClipboardList, shortcut: '⌘3', accent: '#3b82f6' },
      { id: 'drivers', label: 'Drivers', icon: Users, shortcut: '⌘4', accent: '#06b6d4' },
      { id: 'delivery', label: 'Delivery & POD', icon: Package, shortcut: '⌘5', accent: '#22c55e' },
      { id: 'customer', label: 'Customer Portal', icon: Eye, shortcut: '⌘6', accent: '#3b82f6' },
    ],
  },
  {
    group: 'Assets',
    items: [
      { id: 'fleet-vehicles', label: 'Fleet & Vehicles', icon: Truck, accent: '#3b82f6' },
      { id: 'maintenance', label: 'Maintenance', icon: Wrench, accent: '#f97316' },
      { id: 'fuel', label: 'Fuel & Cost', icon: Fuel, accent: '#f97316' },
      { id: 'wms', label: 'Warehouse', icon: Warehouse, accent: '#a855f7' },
      { id: 'compliance', label: 'Compliance', icon: FileCheck, accent: '#a855f7' },
    ],
  },
  {
    group: 'Network',
    items: [
      { id: 'providers', label: 'Shipment Providers', icon: Package, accent: '#22c55e' },
      { id: 'freelancers', label: 'Freelancers', icon: Users, accent: '#a855f7' },
    ],
  },
  {
    group: 'Intelligence',
    items: [
      { id: 'analytics50', label: 'Analytics', icon: TrendingUp, accent: '#3b82f6' },
      { id: 'safety', label: 'AI Safety', icon: Shield, accent: '#ef4444' },
      { id: 'ai-agents', label: 'AI Agents', icon: Brain, accent: '#a855f7' },
      { id: 'digital-twin', label: 'Digital Twin', icon: Box, accent: '#06b6d4' },
      { id: 'rl-route', label: 'RL Routes', icon: Route, accent: '#a855f7' },
      { id: 'predictive-maintenance', label: 'Pred. Maint.', icon: Activity, accent: '#f97316' },
      { id: 'computer-vision', label: 'Vision AI', icon: Eye, accent: '#3b82f6' },
      { id: 'carbon', label: 'Carbon ESG', icon: Leaf, accent: '#22c55e' },
    ],
  },
  {
    group: 'Admin',
    items: [
      { id: 'admin', label: 'Admin Panel', icon: Lock, accent: '#a855f7' },
    ],
  },
];

export default function Sidebar({ activeModule, onModuleChange }: SidebarProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const { auth, switchRole } = useApp50();
  const accessible = useMemo(() => new Set(ROLE_ACCESS[auth.role]), [auth.role]);

  return (
    <div
      className={`h-screen bg-[#0c0c0f] border-r border-[#2a2a33] flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#2a2a33]">
        <div className="w-9 h-9 rounded bg-gradient-to-br from-[#22c55e] to-[#3b82f6] flex items-center justify-center flex-shrink-0">
          <Truck className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#e4e4e7] tracking-tight truncate">{t('app.name')}</div>
            <div className="text-[9px] text-[#52525b] uppercase tracking-[0.15em] truncate">{t('app.tagline')}</div>
          </div>
        )}
      </div>

      {/* User / Role switcher */}
      {!collapsed && (
        <div className="px-3 py-2 border-b border-[#2a2a33]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0" style={{ backgroundColor: auth.avatarColor }}>
              {auth.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-[#e4e4e7] truncate font-medium">{auth.fullName}</div>
              <select
                value={auth.role}
                onChange={(e) => switchRole(e.target.value as FleetRole)}
                className="text-[9px] bg-transparent text-[#71717a] border-none outline-none cursor-pointer hover:text-[#a1a1aa] w-full"
              >
                {(['super_admin', 'fleet_manager', 'dispatcher', 'driver', 'warehouse_operator', 'maintenance_tech', 'customer_support', 'executive'] as FleetRole[]).map((r) => (
                  <option key={r} value={r} className="bg-[#0c0c0f]">{ROLE_LABELS[r][i18n.language === 'ar' ? 'ar' : 'en']}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Live indicator */}
      <div className={`px-4 py-2 border-b border-[#2a2a33] ${collapsed ? 'flex justify-center' : ''}`}>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          {!collapsed && <span className="text-[10px] text-[#52525b] uppercase tracking-wider">{t('status.systemLive')} · 50</span>}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {ALL_ITEMS.map((group) => {
          const items = group.items.filter((it) => accessible.has(it.id));
          if (items.length === 0) return null;
          return (
            <div key={group.group}>
              {!collapsed && (
                <div className="px-4 py-1 mt-2 text-[9px] text-[#3d3d4a] uppercase tracking-[0.15em]">{group.group}</div>
              )}
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;
                const accent = item.accent ?? '#3b82f6';
                const labelKey = NAV_LABEL_KEYS[item.id];
                const label = labelKey ? t(labelKey, item.label) : item.label;
                return (
                  <button
                    key={item.id}
                    onClick={() => onModuleChange(item.id)}
                    aria-label={label}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-xs transition-all duration-200 group ${
                      isActive ? 'bg-[#1c1c21] text-[#e4e4e7] border-r-2' : 'text-[#71717a] hover:text-[#a1a1aa] hover:bg-[#111114]'
                    }`}
                    style={isActive ? { borderRightColor: accent } : undefined}
                    title={collapsed ? label : undefined}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isActive ? (accent ?? '#3b82f6') : undefined }} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left truncate">{label}</span>
                        {item.shortcut && <span className="text-[9px] text-[#3d3d4a] group-hover:text-[#52525b] font-mono-data">{item.shortcut}</span>}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Version + Language + Collapse */}
      <div className="px-4 py-3 border-t border-[#2a2a33] flex items-center gap-2">
        {!collapsed && (
          <>
            <span className="text-[9px] text-[#3d3d4a] font-mono-data flex-1">{t('app.version')} · 50 vehicles</span>
            <LanguageSwitcher />
          </>
        )}
        {collapsed && (
          <button
            onClick={() => {
              const newLang = i18n.language === 'ar' ? 'en' : 'ar';
              localStorage.setItem('language', newLang);
              document.documentElement.lang = newLang;
              document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
              window.location.reload();
            }}
            className="text-[#52525b] hover:text-[#a1a1aa] transition-colors flex-1 flex justify-center"
            title={i18n.language === 'ar' ? 'English' : 'العربية'}
          >
            <Globe className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="text-[#52525b] hover:text-[#a1a1aa] transition-colors">
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
