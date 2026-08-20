'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Calculator,
  ChevronRight,
  CircleDollarSign,
  FileBarChart,
  Gauge,
  Package,
  Settings2,
  Shield,
  Truck,
  Users,
} from 'lucide-react';
import FinancialEngine from '@/components/financial/FinancialEngine';
import FeasibilityStudy from '@/components/feasibility/FeasibilityStudy';
import RiskCalculator from '@/components/risk/RiskCalculator';
import Drivers from '@/components/operational/Drivers';
import FleetVehicles from '@/components/operational/FleetVehicles';
import Freelancers from '@/components/operational/Freelancers';
import Providers from '@/components/operational/Providers';
import { useSimulatedData } from '@/hooks/useSimulatedData';

type PlanningView = 'overview' | 'financial' | 'fleet' | 'drivers' | 'providers' | 'freelancers' | 'risk' | 'feasibility';

type PlanningWorkspaceProps = { onOpenOperations: () => void };

const NAV: { id: PlanningView; label: string; description: string; icon: typeof Calculator }[] = [
  { id: 'overview', label: 'Plan overview', description: 'Economics at a glance', icon: Gauge },
  { id: 'financial', label: 'Financial engine', description: 'Cost lines & outputs', icon: Calculator },
  { id: 'fleet', label: 'Fleet & vehicles', description: 'Classes and ownership', icon: Truck },
  { id: 'drivers', label: 'Drivers', description: 'Editable roster', icon: Users },
  { id: 'providers', label: 'Providers', description: 'Volume and pricing', icon: Package },
  { id: 'freelancers', label: 'Freelancers', description: 'Pass-through model', icon: BriefcaseBusiness },
  { id: 'risk', label: 'Risk', description: 'Scenario downside', icon: Shield },
  { id: 'feasibility', label: 'Feasibility', description: 'Capital and cash flow', icon: FileBarChart },
];

function money(value: number, digits = 0) {
  return `SAR ${value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
}

function Kpi({ label, value, detail, tone = 'blue' }: { label: string; value: string; detail: string; tone?: 'blue' | 'green' | 'orange' | 'violet' }) {
  return (
    <div className={`planning-kpi planning-kpi-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export default function PlanningWorkspace({ onOpenOperations }: PlanningWorkspaceProps) {
  const [activeView, setActiveView] = useState<PlanningView>('overview');
  const {
    financialInput,
    financialOutput,
    updateFinancialInput,
    setVehicleClasses,
    setProviders,
    setDrivers,
    addVehicleClass,
    addProvider,
    addDriver,
  } = useSimulatedData();

  const activeDrivers = financialInput.drivers.filter((driver) => driver.status === 'active').length;
  const fleetSize = financialInput.vehicleClasses.filter((vehicle) => vehicle.enabled).reduce((sum, vehicle) => sum + vehicle.quantity, 0);
  const vehicleNames = useMemo(() => financialInput.vehicleClasses.map((vehicle) => vehicle.name), [financialInput.vehicleClasses]);
  const freelancerEnabled = financialInput.costToggles.freelancer !== false;
  const applyProfitabilityScenario = () => {
    const baseDrivers = financialInput.drivers;
    const drivers = Array.from({ length: 50 }, (_, index) => baseDrivers[index] ?? {
      id: `scenario-driver-${index + 1}`,
      fullName: `Driver ${index + 1}`,
      phone: '',
      nationalId: '',
      assignedVehicle: 'Van',
      status: 'active' as const,
    });
    const baseVan = financialInput.vehicleClasses[0] ?? {
      id: 'vc-van', name: 'Van', quantity: 50, monthlyRent: 1200, variableCost: 300, enabled: true,
      driverSalary: 3500, fuelType: 'diesel' as const, fuelEfficiency: 9.5, avgDailyDistance: 60,
      purchasePrice: 0, depreciationMonths: 0,
    };
    updateFinancialInput({
      companyDriverCount: 50,
      drivers,
      vehicleClasses: [{ ...baseVan, name: 'Van', quantity: 50, enabled: true, monthlyRent: 1200, variableCost: 300, driverSalary: 3500, avgDailyDistance: 60 }],
      providers: [{ id: 'prv-sar11', name: 'Customer shipments', shipmentsPerDay: 1800, pricePerShipment: 11, enabled: true }],
      driverSalary: 3500,
      packagingCostPerUnit: 0.2,
      pickPackLaborPerOrder: 0,
      labelsAndDocs: 0.1,
      returnLogisticsCost: 1,
      failedDeliveryCost: 2,
      failedDeliveryRate: 2,
      returnRate: 1,
    });
    setActiveView('overview');
  };

  const renderView = () => {
    switch (activeView) {
      case 'financial':
        return <FinancialEngine input={financialInput} output={financialOutput} onUpdate={updateFinancialInput} />;
      case 'fleet':
        return (
          <FleetVehicles
            vehicleClasses={financialInput.vehicleClasses}
            onChange={setVehicleClasses}
            onAdd={addVehicleClass}
            totalVehicles={fleetSize}
            monthlyCost={financialOutput.fleetMonthlyCost}
            activeDriverCount={activeDrivers}
            fuelPricePerLiter={financialInput.fuelPricePerLiter}
          />
        );
      case 'drivers':
        return <Drivers drivers={financialInput.drivers} onChange={setDrivers} onAdd={addDriver} availableVehicles={vehicleNames} />;
      case 'providers':
        return (
          <Providers
            providers={financialInput.providers}
            onChange={setProviders}
            onAdd={addProvider}
            evaluations={financialOutput.providerEvaluations}
            totalDailyShipments={financialOutput.totalDailyShipments}
            totalMonthlyRevenue={financialOutput.revenueBreakdown.providerRevenue}
          />
        );
      case 'freelancers':
        return (
          <Freelancers
            enabled={freelancerEnabled}
            providerPrice={financialInput.freelancerProviderPrice}
            freelancerRate={financialInput.freelancerRate}
            monthlyVolume={financialOutput.freelancerMonthlyVolume}
            monthlyRevenue={financialOutput.freelancerMonthlyRevenue}
            monthlyPayout={financialOutput.freelancerMonthlyPayout}
            monthlyProfit={financialOutput.freelancerMonthlyProfit}
            workingDays={26}
            onToggle={(enabled) => updateFinancialInput({ costToggles: { ...financialInput.costToggles, freelancer: enabled } })}
            onUpdateProviderPrice={(value) => updateFinancialInput({ freelancerProviderPrice: value })}
            onUpdateFreelancerRate={(value) => updateFinancialInput({ freelancerRate: value })}
            onUpdateMonthlyVolume={(value) => updateFinancialInput({ freelancerMonthlyVolume: value })}
          />
        );
      case 'risk':
        return <RiskCalculator input={financialInput} output={financialOutput} />;
      case 'feasibility':
        return <FeasibilityStudy />;
      default:
        return (
          <Overview
            financialInput={financialInput}
            financialOutput={financialOutput}
            fleetSize={fleetSize}
            activeDrivers={activeDrivers}
            onNavigate={setActiveView}
            onOpenOperations={onOpenOperations}
            onApplyScenario={applyProfitabilityScenario}
          />
        );
    }
  };

  return (
    <div className="planning-app">
      <aside className="planning-sidebar" aria-label="Planning navigation">
        <div className="planning-brand">
          <div className="planning-brand-mark"><Truck size={18} /></div>
          <div><strong>VEGA <span>OS</span></strong><small>Plan & economics</small></div>
        </div>
        <div className="planning-mode-note"><CircleDollarSign size={15} /><span><strong>Local simulation</strong><small>Inputs are saved in this browser</small></span></div>
        <nav className="planning-nav">
          <div className="planning-nav-label">Planning workspace</div>
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeView;
            return (
              <button key={item.id} className={`planning-nav-item ${active ? 'is-active' : ''}`} onClick={() => setActiveView(item.id)} aria-current={active ? 'page' : undefined}>
                <Icon size={16} aria-hidden="true" />
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
                {active && <ChevronRight size={14} aria-hidden="true" />}
              </button>
            );
          })}
        </nav>
        <div className="planning-sidebar-foot">
          <button className="planning-nav-item planning-nav-operations" onClick={onOpenOperations}>
            <Activity size={16} /><span><strong>Open operations</strong><small>Dispatch and fleet control</small></span><ArrowRight size={14} />
          </button>
          <div className="planning-freshness"><span className="planning-dot" /> Simulation · manually refreshed</div>
        </div>
      </aside>

      <main className="planning-main">
        <header className="planning-topbar">
          <div><span className="planning-breadcrumb">VEGA OS / Planning</span><strong>{NAV.find((item) => item.id === activeView)?.label}</strong></div>
          <div className="planning-topbar-meta"><Settings2 size={15} /> <span>Saved locally</span><span className="planning-separator" /> <span>Riyadh · UTC+3</span></div>
        </header>
        <div className="planning-content">
          <div className="planning-page-head">
            <div><span className="planning-eyebrow">Planning / {activeView}</span><h1>{NAV.find((item) => item.id === activeView)?.label}</h1><p>Change an assumption once, then trace its effect through the operating model.</p></div>
            <div className="planning-head-status"><span className="planning-dot" /> Simulation mode <small>Not connected to production services</small></div>
          </div>
          {renderView()}
        </div>
      </main>
    </div>
  );
}

function Overview({ financialInput, financialOutput, fleetSize, activeDrivers, onNavigate, onOpenOperations, onApplyScenario }: {
  financialInput: ReturnType<typeof useSimulatedData>['financialInput'];
  financialOutput: ReturnType<typeof useSimulatedData>['financialOutput'];
  fleetSize: number;
  activeDrivers: number;
  onNavigate: (view: PlanningView) => void;
  onOpenOperations: () => void;
  onApplyScenario: () => void;
}) {
  const marginTone = financialOutput.netMarginPercent >= 20 ? 'green' : financialOutput.netMarginPercent >= 10 ? 'orange' : 'violet';
  return (
    <div className="planning-overview">
      <section className="planning-kpi-grid" aria-label="Financial summary">
        <Kpi label="Monthly revenue" value={money(financialOutput.totalRevenue)} detail="Realized after failed delivery assumption" tone="green" />
        <Kpi label="Monthly cost" value={money(financialOutput.totalCost)} detail="All enabled cost lines" tone="orange" />
        <Kpi label="Net margin" value={`${financialOutput.netMarginPercent.toFixed(1)}%`} detail={money(financialOutput.netMargin)} tone={marginTone} />
        <Kpi label="Cost / shipment" value={money(financialOutput.costPerShipment, 2)} detail={`${financialOutput.totalMonthlyShipments.toLocaleString()} shipments / month`} tone="blue" />
      </section>

      <div className="planning-overview-grid">
        <section className="planning-card planning-summary-card">
          <div className="planning-card-head"><div><span className="planning-eyebrow">Model status</span><h2>What the model is saying</h2></div><BarChart3 size={18} /></div>
          <div className="planning-summary-row"><span>Fleet coverage</span><strong>{activeDrivers} active drivers / {fleetSize} vehicles</strong></div>
          <div className="planning-summary-row"><span>Provider volume</span><strong>{financialOutput.totalDailyShipments.toLocaleString()} shipments / day</strong></div>
          <div className="planning-summary-row"><span>Cash runway</span><strong>{financialOutput.cashRunway.toFixed(1)} months</strong></div>
          <div className="planning-summary-row"><span>Payment delay</span><strong>{financialInput.clientPaymentDelay} days</strong></div>
          <div className="planning-trace"><Activity size={15} /><span>Outputs are recalculated from the editable FinancialInput model. No live telematics or accounting connection is active.</span></div>
        </section>
        <section className="planning-card planning-action-card">
          <div className="planning-card-head"><div><span className="planning-eyebrow">Next actions</span><h2>Make the next decision</h2></div><Gauge size={18} /></div>
          <button onClick={() => onNavigate('fleet')}><span><strong>Review fleet mix</strong><small>Change quantity, rent, driver cost or fuel assumptions</small></span><ArrowRight size={16} /></button>
          <button onClick={() => onNavigate('providers')}><span><strong>Test provider economics</strong><small>Adjust volume and price to see realized revenue</small></span><ArrowRight size={16} /></button>
          <button onClick={() => onNavigate('risk')}><span><strong>Run downside scenarios</strong><small>Use the current model as the simulation baseline</small></span><ArrowRight size={16} /></button>
          <button className="planning-action-primary" onClick={onApplyScenario}><span><strong>Apply 50-driver / SAR 11 plan</strong><small>1,800 shipments/day · lean cost assumptions · local scenario</small></span><ArrowRight size={16} /></button>
          <button onClick={onOpenOperations}><span><strong>Open daily operations</strong><small>Move from planning assumptions to dispatch control</small></span><ArrowRight size={16} /></button>
        </section>
      </div>

      <section className="planning-card planning-model-note"><Shield size={17} /><div><strong>Prototype honesty</strong><p>This workspace is deterministic/local simulation. The scenario button uses 50 drivers, SAR 11 realized rate, 1,800 shipments/day and explicitly lean operating-cost assumptions. Validate those assumptions against your actual contracts before relying on the margin.</p></div></section>
    </div>
  );
}
