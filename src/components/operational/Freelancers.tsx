'use client';

import { Section, StatCard, Badge, Panel, PanelTitle, Bar } from '@/components/v2026/Shell';
import { Briefcase, DollarSign, Car } from 'lucide-react';

interface FreelancersProps {
  enabled: boolean;
  providerPrice: number;     // SAR received from the provider per shipment
  freelancerRate: number;    // SAR paid to the freelancer per shipment (must be < providerPrice)
  monthlyVolume: number;
  monthlyRevenue: number;
  monthlyPayout: number;
  monthlyProfit: number;
  workingDays: number;
  onToggle: (enabled: boolean) => void;
  onUpdateProviderPrice: (v: number) => void;
  onUpdateFreelancerRate: (v: number) => void;
  onUpdateMonthlyVolume: (v: number) => void;
}


export default function Freelancers({
  enabled,
  providerPrice,
  freelancerRate,
  monthlyVolume,
  monthlyRevenue,
  monthlyPayout,
  monthlyProfit,
  workingDays,
  onToggle,
  onUpdateProviderPrice,
  onUpdateFreelancerRate,
  onUpdateMonthlyVolume,
}: FreelancersProps) {
  const dailyVolume = workingDays > 0 ? monthlyVolume / workingDays : 0;
  const validRate = Math.min(Math.max(0, freelancerRate), Math.max(0, providerPrice - 0.01));
  const profitPerShipment = providerPrice - validRate;
  const rateValidation = freelancerRate >= providerPrice
    ? { ok: false, msg: 'Freelancer rate must be below provider price' }
    : profitPerShipment <= 0
    ? { ok: false, msg: 'Profit per shipment must be > 0' }
    : { ok: true, msg: 'Profitable margin' };

  return (
    <Section
      title="Freelancer Model"
      subtitle="Provider hands us a shipment at price X · we pay the freelancer (X − 0.50 SAR) · we keep 0.50 SAR profit. Freelancers use their own car — we pay zero for vehicle, fuel, or maintenance. Excluded from fleet cost totals."
    >
      <div className="grid grid-cols-5 gap-3 mb-4">
        <StatCard
          label="Active"
          value={enabled ? 'Yes' : 'No'}
          color={enabled ? '#22c55e' : '#71717a'}
          sub="Toggle on to include"
        />
        <StatCard label="Monthly Volume" value={monthlyVolume.toLocaleString()} color="#3b82f6" sub={`${dailyVolume.toFixed(0)} / day`} />
        <StatCard label="Revenue from Provider" value={`SAR ${monthlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} color="#22c55e" sub={`${providerPrice} SAR × ${monthlyVolume.toLocaleString()}`} />
        <StatCard label="Payout to Freelancer" value={`SAR ${monthlyPayout.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} color="#f97316" sub={`${validRate.toFixed(2)} SAR × ${monthlyVolume.toLocaleString()}`} />
        <StatCard label="Our Profit" value={`SAR ${monthlyProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} color="#a855f7" sub={`${profitPerShipment.toFixed(2)} SAR × ${monthlyVolume.toLocaleString()}`} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Panel>
          <div className="flex items-center justify-between mb-3">
            <PanelTitle>Enable / Disable</PanelTitle>
            <Badge color={enabled ? '#22c55e' : '#71717a'}>{enabled ? 'Active' : 'Off'}</Badge>
          </div>
          <button
            onClick={() => onToggle(!enabled)}
            className={`w-full py-2 rounded text-xs font-medium transition-all ${
              enabled ? 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40 hover:bg-[#ef4444]/30' : 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/40 hover:bg-[#22c55e]/30'
            }`}
          >
            {enabled ? 'Disable freelancer flow' : 'Enable freelancer flow'}
          </button>
          <p className="text-[10px] text-[#52525b] mt-2 leading-relaxed">
            When enabled, the configured monthly volume routes through freelancers. We earn SAR {profitPerShipment.toFixed(2)} per shipment with no vehicle or fuel cost on our side.
          </p>
        </Panel>

        <Panel>
          <PanelTitle>Three Editable Fields</PanelTitle>
          <div className="space-y-3">
            <NumberField
              icon={<DollarSign className="w-3 h-3 text-[#22c55e]" />}
              label="Provider Price (SAR)"
              hint="What the provider pays us per shipment"
              value={providerPrice}
              step={0.5}
              onChange={onUpdateProviderPrice}
            />
            <NumberField
              icon={<Briefcase className="w-3 h-3 text-[#f97316]" />}
              label="Freelancer Rate (SAR)"
              hint="What we pay the freelancer per shipment"
              value={validRate}
              step={0.25}
              onChange={onUpdateFreelancerRate}
              warning={!rateValidation.ok ? rateValidation.msg : null}
            />
            <NumberField
              icon={<Car className="w-3 h-3 text-[#3b82f6]" />}
              label="Monthly Volume"
              hint="Shipments routed to freelancers per month"
              value={monthlyVolume}
              step={50}
              onChange={onUpdateMonthlyVolume}
            />
          </div>
        </Panel>

        <Panel>
          <PanelTitle action={<Badge color={rateValidation.ok ? '#22c55e' : '#ef4444'}>{rateValidation.ok ? 'Profitable' : 'Invalid'}</Badge>}>
            Per-Shipment Math
          </PanelTitle>
          <div className="space-y-2 text-[11px] font-mono-data">
            <Row k="Provider Price" v={`SAR ${providerPrice.toFixed(2)}`} color="#22c55e" />
            <Row k="− Freelancer Rate" v={`SAR ${validRate.toFixed(2)}`} color="#f97316" />
            <div className="border-t border-[#2a2a33] my-2"></div>
            <Row k="= Profit / Shipment" v={`SAR ${profitPerShipment.toFixed(2)}`} color="#a855f7" bold />
            <Row k="× Monthly Volume" v={`${monthlyVolume.toLocaleString()}`} color="#3b82f6" />
            <div className="border-t border-[#2a2a33] my-2"></div>
            <Row k="= Monthly Profit" v={`SAR ${monthlyProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} color="#a855f7" bold />
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[9px] text-[#71717a] mb-0.5">
              <span>Margin per shipment</span>
              <span className="font-mono-data">{providerPrice > 0 ? ((profitPerShipment / providerPrice) * 100).toFixed(1) : 0}%</span>
            </div>
            <Bar value={providerPrice > 0 ? (profitPerShipment / providerPrice) * 100 : 0} max={100} color="#a855f7" height={6} />
          </div>
        </Panel>
      </div>

      <div className="mt-3">
        <Panel>
          <PanelTitle>What we DON&apos;T pay (freelancer covers it)</PanelTitle>
          <div className="grid grid-cols-4 gap-3 mt-2">
            <NotPaid label="Vehicle cost" />
            <NotPaid label="Fuel" />
            <NotPaid label="Maintenance" />
            <NotPaid label="Depreciation" />
          </div>
          <p className="text-[10px] text-[#52525b] mt-3 leading-relaxed">
            Freelancers run their own cars, so the entire Vehicle Ownership and Vehicle Running cost lines exclude their volume. The freelancer payout shows up as a pass-through — net effect on our cost base is the SAR {profitPerShipment.toFixed(2)} per shipment margin.
          </p>
        </Panel>
      </div>
    </Section>
  );
}

function NumberField({
  icon,
  label,
  hint,
  value,
  step,
  onChange,
  warning,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
  warning?: string | null;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] text-[#71717a] uppercase tracking-wider mb-1">
        {icon}
        {label}
      </div>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
        className="w-full bg-[#0a0a0b] border border-[#2a2a33] rounded px-2 py-1.5 text-sm font-mono-data text-[#e4e4e7] focus:outline-none focus:border-[#3b82f6]"
      />
      {hint && <div className="text-[9px] text-[#52525b] mt-0.5">{hint}</div>}
      {warning && <div className="text-[9px] text-[#ef4444] mt-0.5">{warning}</div>}
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

function NotPaid({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded bg-[#0a0a0b] border border-[#2a2a33]">
      <div className="w-6 h-6 rounded-full bg-[#71717a]/20 flex items-center justify-center">
        <span className="text-[#71717a] text-[10px]">✗</span>
      </div>
      <div className="text-[10px] text-[#a1a1aa]">{label}</div>
    </div>
  );
}
