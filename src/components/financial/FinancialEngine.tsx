'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FinancialInput, FinancialOutput, CostLineKey, Provider } from '@/lib/types';
import {
  DollarSign, Truck, Users, Building2, Wrench, Wifi, ShieldAlert, Package, Sparkles, Calculator,
  TrendingUp, Fuel, Link2, Plus, Trash2, Briefcase, BarChart3, Eye, EyeOff,
} from 'lucide-react';

interface FinancialEngineProps {
  input: FinancialInput;
  output: FinancialOutput;
  onUpdate: (patch: Partial<FinancialInput>) => void;
}

const WORKING_DAYS = 26;

type FieldDef = {
  key: keyof FinancialInput;
  label: string;
  suffix?: string;
  step?: string;
  hint?: string;
  type?: 'number' | 'select';
  options?: readonly string[];
  toggleKey?: CostLineKey;
  category: 'fleet' | 'fuel' | 'people' | 'facilities' | 'variable' | 'tech' | 'insurance' | 'other';
};

const FLEET_FIELDS: FieldDef[] = [
  // Editable per-class in Fleet & Vehicles tab — read-only summary displayed below
];

const FUEL_FIELDS: FieldDef[] = [
  { key: 'fuelPricePerLiter', label: 'Fuel', suffix: 'SAR/L', step: '0.01', category: 'fuel', toggleKey: 'fuel' },
  // Per-class efficiency & distance editable in Fleet & Vehicles tab
];

const PEOPLE_FIELDS: FieldDef[] = [
  { key: 'opsTeamCount', label: 'Ops', step: '1', category: 'people', toggleKey: 'opsTeam' },
  { key: 'opsTeamAvgSalary', label: 'Ops Salary', suffix: 'SAR/mo', step: '100', category: 'people', toggleKey: 'opsTeam' },
  { key: 'salesTeamCount', label: 'Sales', step: '1', category: 'people', toggleKey: 'salesTeam' },
  { key: 'salesTeamBaseSalary', label: 'Sales Salary', suffix: 'SAR/mo', step: '100', category: 'people', toggleKey: 'salesTeam' },
  { key: 'salesCommissionPercent', label: 'Commission', suffix: '%', step: '0.5', category: 'people', toggleKey: 'salesCommission' },
  { key: 'warehouseStaff', label: 'Warehouse', step: '1', category: 'people', toggleKey: 'warehouseStaff' },
  { key: 'warehouseStaffSalary', label: 'Staff Salary', suffix: 'SAR/mo', step: '100', category: 'people', toggleKey: 'warehouseStaff' },
];

const FACILITIES_FIELDS: FieldDef[] = [
  { key: 'warehouseRent', label: 'Rent', suffix: 'SAR/mo', step: '500', category: 'facilities', toggleKey: 'warehouseRent' },
  { key: 'warehouseUtilities', label: 'Utils', suffix: 'SAR/mo', step: '100', category: 'facilities', toggleKey: 'warehouseUtils' },
  { key: 'officeRent', label: 'Office', suffix: 'SAR/mo', step: '500', category: 'facilities', toggleKey: 'officeRent' },
  { key: 'internetCost', label: 'Internet', suffix: 'SAR/mo', step: '50', category: 'facilities', toggleKey: 'internet' },
  { key: 'electricityCost', label: 'Electricity', suffix: 'SAR/mo', step: '100', category: 'facilities', toggleKey: 'electricity' },
];

const VARIABLE_FIELDS: FieldDef[] = [
  { key: 'packagingCostPerUnit', label: 'Packaging', suffix: 'SAR', step: '0.1', category: 'variable', toggleKey: 'packaging' },
  { key: 'pickPackLaborPerOrder', label: 'Pick-Pack', suffix: 'SAR', step: '0.1', category: 'variable', toggleKey: 'pickPack' },
  { key: 'labelsAndDocs', label: 'Labels', suffix: 'SAR', step: '0.05', category: 'variable', toggleKey: 'labelsAndDocs' },
  { key: 'returnLogisticsCost', label: 'Returns', suffix: 'SAR/return', step: '0.5', category: 'variable', toggleKey: 'returnLogistics' },
];

const TECH_FIELDS: FieldDef[] = [
  { key: 'technologySaaS', label: 'SaaS', suffix: 'SAR/mo', step: '100', category: 'tech', toggleKey: 'technologySaaS' },
  { key: 'gpsTelematics', label: 'GPS', suffix: 'SAR/veh/mo', step: '5', category: 'tech', toggleKey: 'telematics' },
  { key: 'dashcamSubscription', label: 'Dashcam', suffix: 'SAR/mo', step: '100', category: 'tech', toggleKey: 'dashcam' },
  { key: 'fuelCardFee', label: 'Fuel Card', suffix: 'SAR/mo', step: '50', category: 'tech', toggleKey: 'fuelCard' },
];

const INSURANCE_FIELDS: FieldDef[] = [
  { key: 'cargoInsurance', label: 'Cargo', suffix: 'SAR/mo', step: '100', category: 'insurance', toggleKey: 'cargoInsurance' },
  { key: 'liabilityInsurance', label: 'Liability', suffix: 'SAR/mo', step: '100', category: 'insurance', toggleKey: 'liabilityInsurance' },
  { key: 'healthInsurancePerEmployee', label: 'Health', suffix: 'SAR/mo', step: '50', category: 'insurance', toggleKey: 'healthInsurance' },
];

const OTHER_FIELDS: FieldDef[] = [
  { key: 'marketingBudget', label: 'Marketing', suffix: 'SAR/mo', step: '500', category: 'other', toggleKey: 'marketing' },
  { key: 'accountingLegal', label: 'Legal', suffix: 'SAR/mo', step: '200', category: 'other', toggleKey: 'accountingLegal' },
  { key: 'miscExpenses', label: 'Misc', suffix: 'SAR/mo', step: '100', category: 'other', toggleKey: 'misc' },
  { key: 'fulfillmentRevenue', label: 'Fulfillment', suffix: 'SAR/mo', step: '500', category: 'other', toggleKey: 'fulfillment' },
  { key: 'subcontractingRevenue', label: 'Subcontract', suffix: 'SAR/mo', step: '500', category: 'other', toggleKey: 'subcontracting' },
];

const GROUPS: { id: string; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; color: string; fields: FieldDef[]; description?: string }[] = [
  { id: 'fleet', label: 'Fleet & Vehicles', icon: Truck, color: '#3b82f6', fields: FLEET_FIELDS, description: 'Edit per-class data in Fleet & Vehicles sidebar tab' },
  { id: 'fuel', label: 'Fuel & Driving', icon: Fuel, color: '#f97316', fields: FUEL_FIELDS, description: 'Fuel price is global; efficiency & distance per class in Fleet & Vehicles' },
  { id: 'people', label: 'People', icon: Users, color: '#a855f7', fields: PEOPLE_FIELDS },
  { id: 'facilities', label: 'Warehouse & Office', icon: Building2, color: '#06b6d4', fields: FACILITIES_FIELDS },
  { id: 'variable', label: 'Per-Unit Variable', icon: Wrench, color: '#eab308', fields: VARIABLE_FIELDS },
  { id: 'tech', label: 'Tech & SaaS', icon: Wifi, color: '#06b6d4', fields: TECH_FIELDS },
  { id: 'insurance', label: 'Insurance & Other', icon: ShieldAlert, color: '#ec4899', fields: INSURANCE_FIELDS },
  { id: 'other', label: 'Other Revenue', icon: TrendingUp, color: '#22c55e', fields: OTHER_FIELDS },
];

export default function FinancialEngine({ input, output, onUpdate }: FinancialEngineProps) {
  const { t } = useTranslation();
  const [activeGroup, setActiveGroup] = useState(GROUPS[0].id);
  const [activeSubTab, setActiveSubTab] = useState<'costs' | 'providers' | 'freelancer'>('costs');

  const isOn = (key: CostLineKey) => {
    if (input.costToggles[key] === undefined) return key !== 'fulfillment' && key !== 'subcontracting';
    return !!input.costToggles[key];
  };

  const setToggle = (key: CostLineKey, on: boolean) => {
    onUpdate({ costToggles: { ...input.costToggles, [key]: on } });
  };

  const handleChange = (field: keyof FinancialInput, value: string) => {
    if (field === 'perUnitView') {
      onUpdate({ perUnitView: value === 'true' });
      return;
    }
    const num = parseFloat(value);
    onUpdate({ [field]: isNaN(num) ? 0 : num } as Partial<FinancialInput>);
  };

  const perUnit = input.perUnitView;

  return (
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a2a33] flex-wrap">
        <DollarSign className="w-4 h-4 text-[#22c55e]" />
        <h3 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider">{t('financialEngine.title')}</h3>
        <span className="text-[10px] text-[#52525b]">{t('financialEngine.subtitle')}</span>

        <div className="ml-auto flex items-center gap-2">
          <PerUnitToggle value={perUnit} onChange={(v) => handleChange('perUnitView', String(v))} />
        </div>
      </div>

      {/* Sub-tabs: Costs / Providers / Freelancer */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[#2a2a33] bg-[#0c0c0f]">
        {(['costs', 'providers', 'freelancer'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`text-[10px] px-3 py-1.5 rounded uppercase tracking-wider transition-all ${
              activeSubTab === tab ? 'bg-[#3b82f6] text-white' : 'text-[#71717a] hover:text-[#a1a1aa]'
            }`}
          >
            {tab === 'costs' ? <><Calculator className="w-3 h-3 inline mr-1" />{t('financialEngine.costLines')}</> : null}
            {tab === 'providers' ? <><Package className="w-3 h-3 inline mr-1" />{t('financialEngine.providers')}</> : null}
            {tab === 'freelancer' ? <><Briefcase className="w-3 h-3 inline mr-1" />{t('financialEngine.freelancer')}</> : null}
          </button>
        ))}
        <span className="text-[10px] text-[#52525b] ml-auto">
          {activeSubTab === 'costs' && t('financialEngine.toggleHint')}
          {activeSubTab === 'providers' && t('financialEngine.providersHint')}
          {activeSubTab === 'freelancer' && t('financialEngine.freelancerHint')}
        </span>
      </div>

      {/* Linked bar */}
      <div className="px-4 py-2 border-b border-[#2a2a33] bg-gradient-to-r from-[#0a0a0b] via-[#131316] to-[#0a0a0b]">
        <div className="flex items-center justify-between gap-3 text-[10px] flex-wrap">
          <div className="flex items-center gap-2">
            <Link2 className="w-3 h-3 text-[#3b82f6]" />
            <span className="text-[#71717a] uppercase tracking-wider">Live</span>
          </div>
          <div className="flex items-center gap-3 font-mono-data flex-wrap">
            <LinkChip color="#3b82f6" label={t('financialEngine.providers')} value={input.providers.filter((p) => p.enabled).length} />
            <span className="text-[#52525b]">→</span>
            <LinkChip color="#22c55e" label={t('financialEngine.shipmentsPerDay').split(' / ')[0]} value={output.totalDailyShipments} highlight />
            <span className="text-[#52525b]">×</span>
            <LinkChip color="#eab308" label={t('labels.days')} value={WORKING_DAYS} />
            <span className="text-[#52525b]">=</span>
            <LinkChip color="#f97316" label={t('dashboard.monthly')} value={output.totalMonthlyShipments.toLocaleString()} highlight />
            <span className="text-[#52525b]">·</span>
            <LinkChip color="#a855f7" label={t('financialEngine.perShipment')} value={`SAR ${output.avgRevenuePerShipment.toFixed(2)}`} />
            <span className="text-[#52525b]">·</span>
            <LinkChip color="#06b6d4" label={t('labels.fleet')} value={input.vehicleClasses.filter((c) => c.enabled).reduce((s, c) => s + c.quantity, 0)} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {activeSubTab === 'costs' && (
          <CostLinesView
            input={input}
            activeGroup={activeGroup}
            setActiveGroup={setActiveGroup}
            isOn={isOn}
            setToggle={setToggle}
            handleChange={handleChange}
          />
        )}
        {activeSubTab === 'providers' && (
          <ProvidersView input={input} onUpdate={onUpdate} output={output} />
        )}
        {activeSubTab === 'freelancer' && (
          <FreelancerView input={input} onUpdate={onUpdate} output={output} />
        )}
        {activeSubTab === 'costs' && (
          <OutputPanel input={input} output={output} onUpdate={onUpdate} perUnit={perUnit} />
        )}
      </div>
    </div>
  );
}

function CostLinesView({
  input,
  activeGroup,
  setActiveGroup,
  isOn,
  setToggle,
  handleChange,
}: {
  input: FinancialInput;
  activeGroup: string;
  setActiveGroup: (id: string) => void;
  isOn: (key: CostLineKey) => boolean;
  setToggle: (key: CostLineKey, on: boolean) => void;
  handleChange: (field: keyof FinancialInput, value: string) => void;
}) {
  return (
    <>
      <div className="w-44 border-r border-[#2a2a33] overflow-y-auto bg-[#131316]">
        {GROUPS.map((g) => {
          const Icon = g.icon;
          const active = g.id === activeGroup;
          return (
            <button
              key={g.id}
              onClick={() => setActiveGroup(g.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-wider transition-all border-l-2 ${
                active
                  ? 'bg-[#1c1c21] text-[#e4e4e7] border-l-2'
                  : 'text-[#71717a] hover:bg-[#18181c] hover:text-[#a1a1aa] border-l-2 border-transparent'
              }`}
              style={active ? { borderLeftColor: g.color } : undefined}
            >
              <Icon className="w-3 h-3 flex-shrink-0" style={{ color: active ? g.color : undefined }} />
              <span className="truncate">{g.label}</span>
              <span className="ml-auto text-[9px] text-[#52525b] font-mono-data">{g.fields.length}</span>
            </button>
          );
        })}
      </div>

      <div className="w-1/2 border-r border-[#2a2a33] p-3 overflow-y-auto">
        {(() => {
          const currentGroup = GROUPS.find((g) => g.id === activeGroup) ?? GROUPS[0];
          const GroupIcon = currentGroup.icon;
          return (
            <>
              <div className="flex items-center gap-2 mb-2">
                <GroupIcon className="w-3.5 h-3.5" style={{ color: currentGroup.color }} />
                <div className="text-[10px] text-[#52525b] uppercase tracking-wider">{currentGroup.label}</div>
              </div>
              <div className="space-y-1.5">
                {currentGroup.fields.map(({ key, label, suffix, step, hint, type, options, toggleKey }) => {
                  const enabled = toggleKey ? isOn(toggleKey) : true;
                  return (
                    <div
                      key={key as string}
                      className={`flex items-center gap-2 ${!enabled ? 'opacity-40' : ''}`}
                      title={hint}
                    >
                      {toggleKey ? (
                        <label className="inline-flex items-center cursor-pointer flex-shrink-0" title={enabled ? 'Disable this line' : 'Enable this line'}>
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => setToggle(toggleKey, e.target.checked)}
                            className="w-3.5 h-3.5 accent-[#3b82f6]"
                          />
                        </label>
                      ) : (
                        <span className="w-3.5 h-3.5" />
                      )}
                      <label className="text-[11px] text-[#a1a1aa] w-32 flex-shrink-0 truncate" title={hint}>
                        {label}
                      </label>
                      {type === 'select' && options ? (
                        <select
                          value={String(input[key])}
                          onChange={(e) => handleChange(key, e.target.value)}
                          className="flex-1 bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1 text-xs text-[#e4e4e7] focus:border-[#3b82f6] focus:outline-none"
                        >
                          {options.map((o) => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                        </select>
                      ) : (
                        <input
                          type="number"
                          value={input[key] as number}
                          onChange={(e) => handleChange(key, e.target.value)}
                          step={step || '1'}
                          disabled={!enabled}
                          className="w-24 bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1 text-xs font-mono-data text-right focus:outline-none text-[#e4e4e7] focus:border-[#3b82f6] disabled:cursor-not-allowed"
                        />
                      )}
                      {suffix && <span className="text-[10px] text-[#52525b] w-14 text-right">{suffix}</span>}
                    </div>
                  );
                })}
              </div>

              {activeGroup === 'fuel' && (
                <div className="mt-2 border-t border-[#2a2a33] pt-3">
                  <div className="text-[9px] text-[#52525b] uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Fuel className="w-3 h-3 text-[#f97316]" /> Per-Class Fuel Estimate
                  </div>
                  <div className="space-y-1">
                    {input.vehicleClasses.filter(c => c.enabled).map((c) => {
                      const monthlyFuel = c.quantity * ((c.avgDailyDistance || 100) / 100) * (c.fuelEfficiency || 10) * input.fuelPricePerLiter * 26;
                      return (
                        <div key={c.id} className="flex items-center justify-between text-[10px] px-1 py-1 hover:bg-[#0a0a0b] rounded">
                          <span className="text-[#e4e4e7]">{c.name} <span className="text-[#52525b]">({c.quantity} × {c.fuelEfficiency || 10}L/100km × {c.avgDailyDistance || 100}km/d)</span></span>
                          <span className="font-mono-data text-[#f97316]">SAR {monthlyFuel.toLocaleString()}/mo</span>
                        </div>
                      );
                    })}
                    {input.vehicleClasses.filter(c => c.enabled).length === 0 && (
                      <div className="text-[10px] text-[#52525b] text-center py-2">No enabled vehicle classes</div>
                    )}
                  </div>
                </div>
              )}

              {activeGroup === 'fleet' && (
                <div className="mt-2 border-t border-[#2a2a33] pt-3">
                  <div className="text-[9px] text-[#52525b] uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Truck className="w-3 h-3 text-[#3b82f6]" /> Per-Class Breakdown
                  </div>
                  <div className="space-y-2">
                    {input.vehicleClasses.filter(c => c.enabled).map((c) => {
                      const monthlyPerVeh = c.monthlyRent + c.variableCost + (c.driverSalary || 0);
                      return (
                        <div key={c.id} className="bg-[#0a0a0b] rounded p-2 border border-[#2a2a33]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-[#e4e4e7]">{c.name}</span>
                            <span className="text-[10px] font-mono-data text-[#3b82f6]">{c.quantity} vehicles</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[9px]">
                            <div><span className="text-[#52525b]">Rent</span><div className="font-mono-data text-[#f97316]">SAR {c.monthlyRent}/veh</div></div>
                            <div><span className="text-[#52525b]">Driver</span><div className="font-mono-data text-[#a855f7]">SAR {c.driverSalary || 0}/veh</div></div>
                            <div><span className="text-[#52525b]">Variable</span><div className="font-mono-data text-[#eab308]">SAR {c.variableCost}/veh</div></div>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[9px]">
                            <span className="text-[#52525b]">Fuel: <span className="font-mono-data text-[#06b6d4]">{c.fuelType || 'diesel'}</span> · <span className="font-mono-data text-[#06b6d4]">{c.fuelEfficiency || 10} L/100km</span> · <span className="font-mono-data text-[#eab308]">{c.avgDailyDistance || 100} km/d</span></span>
                            <span className="font-mono-data text-[10px] text-[#22c55e]">SAR {(monthlyPerVeh * c.quantity).toLocaleString()}/mo</span>
                          </div>
                        </div>
                      );
                    })}
                    {input.vehicleClasses.filter(c => c.enabled).length === 0 && (
                      <div className="text-[10px] text-[#52525b] text-center py-2">No enabled vehicle classes</div>
                    )}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </>
  );
}

function ProvidersView({
  input,
  onUpdate,
  output,
}: {
  input: FinancialInput;
  onUpdate: (patch: Partial<FinancialInput>) => void;
  output: FinancialOutput;
}) {
  const providers = input.providers;

  const updateProvider = (id: string, patch: Partial<Provider>) => {
    onUpdate({ providers: providers.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  };

  const deleteProvider = (id: string) => {
    onUpdate({ providers: providers.filter((p) => p.id !== id) });
  };

  const addProvider = () => {
    onUpdate({
      providers: [
        ...providers,
        {
          id: `prv-${Date.now().toString(36)}`,
          name: `Provider ${providers.length + 1}`,
          shipmentsPerDay: 0,
          pricePerShipment: 0,
          enabled: true,
        },
      ],
    });
  };

  return (
    <div className="w-full p-3 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] text-[#71717a] uppercase tracking-wider">Shipment Providers</div>
          <div className="text-[11px] text-[#a1a1aa] mt-0.5">Each entry aggregates into the dashboard. Aggregate: {output.totalDailyShipments.toLocaleString()} / day.</div>
        </div>
        <button
          onClick={addProvider}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors"
        >
          <Plus className="w-3 h-3" /> Add Provider
        </button>
      </div>

      <div className="grid grid-cols-12 gap-2 px-2 py-2 text-[9px] uppercase tracking-wider text-[#52525b] border-b border-[#2a2a33] bg-[#0c0c0f]">
        <div className="col-span-1">On</div>
        <div className="col-span-3">Provider Name</div>
        <div className="col-span-2 text-right">Shipments / Day</div>
        <div className="col-span-2 text-right">Price / Shipment (SAR)</div>
        <div className="col-span-2 text-right">Monthly Revenue</div>
        <div className="col-span-1 text-right">Eval</div>
        <div className="col-span-1 text-right"></div>
      </div>

      <div className="divide-y divide-[#1f1f26]">
        {providers.length === 0 && (
          <div className="p-6 text-center text-[10px] text-[#52525b]">No providers yet. Click &ldquo;Add Provider&rdquo; to start.</div>
        )}
        {providers.map((p) => {
          const monthly = p.shipmentsPerDay * WORKING_DAYS * p.pricePerShipment;
          const ev = output.providerEvaluations.find((e) => e.id === p.id);
          return (
            <div key={p.id} className={`grid grid-cols-12 gap-2 items-center px-2 py-2 hover:bg-[#131316] transition-colors ${p.enabled ? '' : 'opacity-50'}`}>
              <div className="col-span-1">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) => updateProvider(p.id, { enabled: e.target.checked })}
                  className="w-3.5 h-3.5 accent-[#3b82f6]"
                />
              </div>
              <div className="col-span-3">
                <input
                  value={p.name}
                  onChange={(e) => updateProvider(p.id, { name: e.target.value })}
                  className="w-full bg-transparent border-none text-xs text-[#e4e4e7] focus:outline-none focus:bg-[#0a0a0b] focus:px-2 focus:py-1 rounded"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min={0}
                  value={p.shipmentsPerDay}
                  onChange={(e) => updateProvider(p.id, { shipmentsPerDay: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full bg-transparent text-right text-xs font-mono-data text-[#e4e4e7] focus:outline-none focus:bg-[#0a0a0b] focus:px-2 focus:py-1 rounded"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={p.pricePerShipment}
                  onChange={(e) => updateProvider(p.id, { pricePerShipment: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-transparent text-right text-xs font-mono-data text-[#22c55e] focus:outline-none focus:bg-[#0a0a0b] focus:px-2 focus:py-1 rounded"
                />
              </div>
              <div className="col-span-2 text-right font-mono-data text-[10px] text-[#f97316]">
                SAR {monthly.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
              <div className="col-span-1 text-right">
                {ev && (
                  <span
                    className="text-[9px] font-mono-data uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ color: ev.rating === 'good' ? '#22c55e' : ev.rating === 'average' ? '#eab308' : '#ef4444' }}
                  >
                    {ev.rating}
                  </span>
                )}
              </div>
              <div className="col-span-1 text-right">
                <button onClick={() => deleteProvider(p.id)} className="text-[#71717a] hover:text-[#ef4444] transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FreelancerView({
  input,
  onUpdate,
  output,
}: {
  input: FinancialInput;
  onUpdate: (patch: Partial<FinancialInput>) => void;
  output: FinancialOutput;
}) {
  const enabled = input.costToggles['freelancer'] !== false;
  const providerPrice = input.freelancerProviderPrice;
  const maxRate = Math.max(0, providerPrice - 0.01);
  const rate = Math.min(Math.max(0, input.freelancerRate), maxRate);
  const profit = providerPrice - rate;

  return (
    <div className="w-full p-4 overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-2">Three editable fields</div>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-[#a1a1aa] mb-1 flex items-center gap-1.5">
                <DollarSign className="w-3 h-3 text-[#22c55e]" /> Provider Price (SAR / shipment)
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={providerPrice}
                onChange={(e) => onUpdate({ freelancerProviderPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="w-full bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1.5 text-sm font-mono-data text-[#e4e4e7] focus:outline-none focus:border-[#3b82f6]"
              />
              <div className="text-[9px] text-[#52525b] mt-0.5">What the provider pays us per shipment.</div>
            </div>

            <div>
              <label className="text-[11px] text-[#a1a1aa] mb-1 flex items-center gap-1.5">
                <Briefcase className="w-3 h-3 text-[#f97316]" /> Freelancer Rate (SAR / shipment)
              </label>
              <input
                type="number"
                min={0}
                step={0.25}
                value={rate}
                onChange={(e) => onUpdate({ freelancerRate: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="w-full bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1.5 text-sm font-mono-data text-[#e4e4e7] focus:outline-none focus:border-[#3b82f6]"
              />
              <div className="text-[9px] text-[#52525b] mt-0.5">What we pay the freelancer. Must be below provider price.</div>
            </div>

            <div>
              <label className="text-[11px] text-[#a1a1aa] mb-1 flex items-center gap-1.5">
                <BarChart3 className="w-3 h-3 text-[#a855f7]" /> Profit per Shipment
              </label>
              <div className="w-full bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1.5 text-sm font-mono-data text-[#a855f7] flex items-center justify-between">
                <span>SAR {profit.toFixed(2)}</span>
                <span className="text-[9px] text-[#52525b]">auto = Provider − Freelancer</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => onUpdate({ costToggles: { ...input.costToggles, freelancer: e.target.checked } })}
                className="w-3.5 h-3.5 accent-[#3b82f6]"
              />
              <span className="text-[11px] text-[#a1a1aa]">Include freelancers in dashboard</span>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-2">Live P&L</div>
          <div className="space-y-2 text-[11px] font-mono-data">
            <Row k="Monthly volume" v={output.freelancerMonthlyVolume.toLocaleString()} color="#3b82f6" />
            <Row k="Revenue from provider" v={`SAR ${output.freelancerMonthlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} color="#22c55e" />
            <Row k="Payout to freelancer" v={`SAR ${output.freelancerMonthlyPayout.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} color="#f97316" />
            <div className="border-t border-[#2a2a33] my-2"></div>
            <Row k="Net profit (pass-through)" v={`SAR ${output.freelancerMonthlyProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} color="#a855f7" bold />
          </div>
          <div className="mt-4 p-3 rounded bg-[#0a0a0b] border border-[#2a2a33] text-[10px] text-[#71717a] leading-relaxed">
            Freelancers use their own car. We pay zero for vehicle, fuel, or maintenance. This volume is excluded from fleet cost totals and from the Vehicle Ownership and Vehicle Running categories in Command Center.
          </div>
        </div>
      </div>
    </div>
  );
}

function OutputPanel({
  
  output,
  perUnit,
}: {
  input: FinancialInput;
  output: FinancialOutput;
  onUpdate: (patch: Partial<FinancialInput>) => void;
  perUnit: boolean;
}) {
  // When per-unit is on, divide all monthly figures by totalMonthlyShipments
  const divisor = perUnit && output.totalMonthlyShipments > 0 ? output.totalMonthlyShipments : 1;
  const scale = (v: number) => v / divisor;
  const monthlyShipments = output.totalMonthlyShipments;

  return (
    <div className="w-1/2 p-3 overflow-y-auto space-y-2">
      {perUnit && (
        <div className="bg-[#3b82f6]/10 border border-[#3b82f6]/40 rounded p-2 text-[10px] text-[#3b82f6] flex items-center gap-1.5">
          <BarChart3 className="w-3 h-3" />
          <span>Per-Unit view — all figures shown per shipment ({monthlyShipments.toLocaleString()} this month)</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#0a0a0b] rounded-lg p-3 border border-[#22c55e]/30">
          <div className="text-[10px] text-[#52525b] uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-[#22c55e]" />Revenue {perUnit && <span className="text-[#3b82f6]">/ship</span>}
          </div>
          <div className="font-mono-data text-2xl font-bold text-[#22c55e] mt-1">
            {formatSAR(scale(output.totalRevenue))}
          </div>
          <div className="text-[9px] text-[#52525b] mt-0.5">{perUnit ? 'per shipment' : '/ month'}</div>
        </div>
        <div className="bg-[#0a0a0b] rounded-lg p-3 border border-[#f97316]/30">
          <div className="text-[10px] text-[#52525b] uppercase tracking-wider flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-[#f97316]" />Cost {perUnit && <span className="text-[#3b82f6]">/ship</span>}
          </div>
          <div className="font-mono-data text-2xl font-bold text-[#f97316] mt-1">
            {formatSAR(scale(output.totalCost))}
          </div>
          <div className="text-[9px] text-[#52525b] mt-0.5">{perUnit ? 'per shipment' : '/ month'}</div>
        </div>
        <div className={`bg-[#0a0a0b] rounded-lg p-3 border-2 ${output.netMargin >= 0 ? 'border-[#22c55e]/50' : 'border-[#ef4444]/50'}`}>
          <div className="text-[10px] text-[#52525b] uppercase tracking-wider flex items-center gap-1">
            <Sparkles className={`w-3 h-3 ${output.netMargin >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`} />
            {output.netMargin >= 0 ? 'Profit' : 'Loss'}
          </div>
          <div className={`font-mono-data text-2xl font-bold mt-1 ${output.netMargin >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {formatSAR(scale(output.netMargin))}
          </div>
          <div className={`text-[10px] font-mono-data mt-0.5 ${output.netMarginPercent >= 20 ? 'text-[#22c55e]' : output.netMarginPercent >= 10 ? 'text-[#eab308]' : 'text-[#ef4444]'}`}>
            {output.netMarginPercent.toFixed(1)}% margin
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#0a0a0b] to-[#131316] rounded-lg p-3 border border-[#3b82f6]/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-[#52525b] uppercase tracking-wider flex items-center gap-1">
              <Package className="w-3 h-3 text-[#3b82f6]" />
              Cost Per Shipment — the one number that matters
            </div>
            <div className="font-mono-data text-3xl font-bold text-[#e4e4e7] mt-1">
              SAR {output.costPerShipment.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-[#52525b] uppercase">Avg Price / Ship.</div>
            <div className="font-mono-data text-lg font-bold text-[#22c55e]">SAR {output.avgRevenuePerShipment.toFixed(2)}</div>
            <div className={`text-[10px] font-mono-data mt-1 ${
              output.avgRevenuePerShipment > output.costPerShipment ? 'text-[#22c55e]' : 'text-[#ef4444]'
            }`}>
              {output.avgRevenuePerShipment > output.costPerShipment ? '✓ Profitable per unit' : '✗ Losing money per unit'}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#0a0a0b] rounded-lg p-3 border border-[#2a2a33]">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] text-[#71717a] uppercase tracking-wider font-semibold">Where your money goes</div>
          <div className="font-mono-data text-xs text-[#e4e4e7]">{formatSAR(scale(output.totalCost))} {perUnit ? '/ship' : '/ mo'}</div>
        </div>
        <div className="space-y-1.5">
          <CostCategoryBar label="Vehicle Ownership" sub="rent only — fleet is rented" value={scale(output.costBreakdown.vehicleOwnership)} total={scale(output.totalCost)} color="#3b82f6" perUnit={perUnit} />
          <CostCategoryBar label="Vehicle Running" sub="fuel, GPS, dashcam, telematics" value={scale(output.costBreakdown.vehicleRunning)} total={scale(output.totalCost)} color="#f97316" perUnit={perUnit} />
          <CostCategoryBar label="People" sub="drivers, ops, sales, warehouse, health" value={scale(output.costBreakdown.people)} total={scale(output.totalCost)} color="#a855f7" perUnit={perUnit} />
          <CostCategoryBar label="Facilities" sub="warehouse, office, utilities" value={scale(output.costBreakdown.facilities)} total={scale(output.totalCost)} color="#06b6d4" perUnit={perUnit} />
          <CostCategoryBar label="Per-Shipment" sub="packaging, labels, returns" value={scale(output.costBreakdown.perShipment)} total={scale(output.totalCost)} color="#eab308" perUnit={perUnit} />
          <CostCategoryBar label="Other" sub="marketing, insurance, SaaS, misc" value={scale(output.costBreakdown.other)} total={scale(output.totalCost)} color="#71717a" perUnit={perUnit} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#0a0a0b] rounded p-2 border border-[#2a2a33]">
          <div className="text-[9px] text-[#52525b] uppercase">Breakeven</div>
          <div className="font-mono-data text-sm font-bold text-[#e4e4e7]">{output.operationalBreakeven}</div>
          <div className="text-[9px] text-[#52525b]">shipments/day</div>
        </div>
        <div className="bg-[#0a0a0b] rounded p-2 border border-[#2a2a33]">
          <div className="text-[9px] text-[#52525b] uppercase">Cash Runway</div>
          <div className={`font-mono-data text-sm font-bold ${output.cashRunway >= 12 ? 'text-[#22c55e]' : output.cashRunway >= 6 ? 'text-[#eab308]' : 'text-[#ef4444]'}`}>
            {output.cashRunway.toFixed(1)} mo
          </div>
          <div className="text-[9px] text-[#52525b]">at current burn</div>
        </div>
        <div className="bg-[#0a0a0b] rounded p-2 border border-[#2a2a33]">
          <div className="text-[9px] text-[#52525b] uppercase">Freelancer / mo</div>
          <div className="font-mono-data text-sm font-bold text-[#a855f7]">
            SAR {output.freelancerMonthlyProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[9px] text-[#52525b]">{output.freelancerMonthlyVolume.toLocaleString()} shipments</div>
        </div>
      </div>
    </div>
  );
}

function PerUnitToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-1.5 bg-[#0a0a0b] border border-[#2a2a33] rounded p-0.5">
      <button
        onClick={() => onChange(false)}
        className={`text-[9px] px-2 py-1 rounded flex items-center gap-1 ${!value ? 'bg-[#3b82f6] text-white' : 'text-[#71717a] hover:text-[#a1a1aa]'}`}
      >
        <EyeOff className="w-2.5 h-2.5" /> /month
      </button>
      <button
        onClick={() => onChange(true)}
        className={`text-[9px] px-2 py-1 rounded flex items-center gap-1 ${value ? 'bg-[#3b82f6] text-white' : 'text-[#71717a] hover:text-[#a1a1aa]'}`}
      >
        <Eye className="w-2.5 h-2.5" /> Per Unit
      </button>
    </div>
  );
}

function CostCategoryBar({ label, sub, value, total, color }: { label: string; sub: string; value: number; total: number; color: string; perUnit: boolean }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="text-[#e4e4e7] font-medium">{label}</span>
        <span className="font-mono-data text-[#e4e4e7]">{formatSAR(value)} <span className="text-[#52525b]">({pct.toFixed(0)}%)</span></span>
      </div>
      <div className="h-2 bg-[#18181c] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
      <div className="text-[9px] text-[#52525b] mt-0.5">{sub}</div>
    </div>
  );
}

function LinkChip({ label, value, color, highlight }: { label: string; value: string | number; color: string; highlight?: boolean }) {
  return (
    <div
      className={`flex items-center gap-1 px-2 py-0.5 rounded border ${highlight ? 'border-current' : 'border-transparent'}`}
      style={{ color }}
    >
      <span className="text-[9px] text-[#52525b] uppercase tracking-wider">{label}</span>
      <span className={`font-bold ${highlight ? 'text-current' : 'text-[#e4e4e7]'}`}>{value}</span>
    </div>
  );
}

function Row({ k, v, color, bold }: { k: string; v: string; color: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-[#71717a]">{k}</span>
      <span className={`${bold ? 'font-bold' : ''}`} style={{ color }}>
        {v}
      </span>
    </div>
  );
}

function formatSAR(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `SAR ${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `SAR ${(value / 1_000).toFixed(1)}K`;
  return `SAR ${value.toFixed(2)}`;
}
