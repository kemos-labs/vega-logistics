'use client';

import { useMemo, useRef, useState , useEffect} from 'react';
import { AlertTriangle, BarChart3, Building2, CalendarDays, Check, CircleDollarSign, ClipboardList, Download, FileText, Languages, Layers, Menu, Plus, RotateCcw, Search, Settings2, Trash2, Truck, Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useSimulatedData } from '@/hooks/useSimulatedData';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { DriverRecord, FinancialInput, Provider, VehicleClass } from '@/lib/types';
import { resizeVehicleFleet } from '@/lib/fleetModel';
import { calculateFinancials } from '@/lib/calculations';
import { buildMonthlyRollup, buildProjection, calculateDailyMetrics, migrateDailyRecords, toDateString, FAILURE_REASON_KEYS, type DailyRecord, type FailureReasonKey } from '@/lib/operationsReporting';
import { buildReportModel, type ReportKind, type ReportModel } from '@/lib/reportEngine';
import { exportBusinessModelExcel, exportDailyReportPdf } from '@/lib/reportExport';
import ProReport, { buildReportLabels } from '@/components/rebuild/ProReport';
import RecoveryBoard from '@/components/rebuild/RecoveryBoard';
import ServiceWorkerRegistrar from '@/components/rebuild/ServiceWorkerRegistrar';
import { buildWeeklyRecoveryTrend, validateRecoveryEntries, type RecoveryEntry, type RecoverySummary } from '@/lib/recoveryBoard';
import { resolveTelematicsProvider } from '@/lib/platform/telematics';

type View = 'summary' | 'drivers' | 'fleet' | 'customers' | 'costs' | 'daily' | 'risks' | 'recovery' | 'actions' | 'scenarios';
type RecoveryOpenRow = { id: string; createdAt: string; shipments: number; owner: string; status: 'pending' | 'recovered' | 'written_off' };
import { applyBackupMerge, applyLegacyScopedRestore, buildBackup, commitBundle, parseBackup, replaceWithBackup, type BackupFileV2, type FollowUpAction, type PersistResult } from '@/lib/backup';
import { BACKUP_REMINDER_DAYS, BACKUP_REMINDER_KEY, dismissForToday, evaluateBackupReminder, isDismissedToday, markBackedUpNow } from '@/lib/backupReminder';
import { createScenario, type Scenario } from '@/lib/scenarios';
type NumberField = keyof Pick<FinancialInput,
  'companyDriverCount' | 'driverSalary' | 'opsTeamCount' | 'opsTeamAvgSalary' | 'salesTeamCount' |
  'salesTeamBaseSalary' | 'warehouseStaff' | 'warehouseStaffSalary' | 'warehouseRent' |
  'warehouseUtilities' | 'officeRent' | 'internetCost' | 'electricityCost' | 'technologySaaS' |
  'marketingBudget' | 'accountingLegal' | 'miscExpenses' | 'packagingCostPerUnit' |
  'pickPackLaborPerOrder' | 'labelsAndDocs' | 'returnLogisticsCost' | 'failedDeliveryRate' |
  'failedDeliveryCost' | 'returnRate' | 'clientPaymentDelay' | 'fuelPricePerLiter'
>;
type RiskLevel = 'critical' | 'high' | 'controlled';
interface RiskItem { level: RiskLevel; titleKey: string; value: string; detail: string; }

// Latin digits even in Arabic — standard in Saudi business tooling.
const localeOf = (language?: string) => (language && language.startsWith('ar') ? 'ar-SA-u-nu-latn' : 'en-SA');
const fmtMoney = (locale: string, value: number, digits = 0) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'SAR', maximumFractionDigits: digits }).format(value);
const fmtNum = (locale: string, value: number) => new Intl.NumberFormat(locale).format(Math.round(value));
const fmtDateMedium = (locale: string, date: Date | string | number) => {
  const parsed = typeof date === 'string' && !date.includes('T') ? `${date}T12:00:00` : date;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(parsed));
};
const fmtDateTime = (locale: string, iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
const fmtMoneyCompact = (locale: string, value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'SAR', notation: 'compact', maximumFractionDigits: 1 }).format(value);

export default function BusinessModelApp() {
  const { t, i18n } = useTranslation();
  const lng = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  const locale = localeOf(i18n.language);
  const money = (value: number, digits = 0) => fmtMoney(locale, value, digits);
  const { financialInput: input, financialOutput: output, updateFinancialInput, applyFinancialInput, setVehicleClasses, setProviders, setDrivers, addVehicleClass, addProvider } = useSimulatedData();
  const [view, setView] = useState<View>('summary');
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState('');
  const [rawDailyRecords, setDailyRecords] = useLocalStorage<Record<string, DailyRecord>>('vega-daily-reports-v2', {});
  // v2 records stored fuel as litres; drivers now log cash — convert on read.
  const dailyRecords = useMemo(() => migrateDailyRecords(rawDailyRecords, input.fuelPricePerLiter), [rawDailyRecords, input.fuelPricePerLiter]);
  const [scenarios, setScenarios] = useLocalStorage<Scenario[]>('vega-scenarios-v1', []);
  const [rawRecoveryEntries, setRecoveryEntries] = useLocalStorage<RecoveryEntry[]>('vega-recovery-board-v1', []);
  const recoveryEntries = useMemo(() => validateRecoveryEntries(rawRecoveryEntries), [rawRecoveryEntries]);
  const pendingRecoveries = recoveryEntries.filter(entry => entry.status === 'pending').length;
  // Telematics seam: the demo simulator answers until a vendor is configured.
  const telematicsProvider = useMemo(() => resolveTelematicsProvider(input.vehicleClasses.map(vehicle => vehicle.name)), [input.vehicleClasses]);
  const recoverySummary: RecoverySummary = useMemo(() => {
    let pendingShipments = 0, recoveredShipments = 0, writtenOffShipments = 0, pendingEntries = 0;
    for (const entry of recoveryEntries) {
      if (entry.status === 'pending') { pendingEntries += 1; pendingShipments += entry.shipments; }
      else if (entry.status === 'recovered') recoveredShipments += entry.shipments;
      else writtenOffShipments += entry.shipments;
    }
    const closed = recoveredShipments + writtenOffShipments;
    return { pendingEntries, pendingShipments, recoveredShipments, writtenOffShipments, closeRatePercent: closed > 0 ? Math.round(recoveredShipments / closed * 100) : 0, oldestPendingDays: 0, overdueSharePercent: 0 };
  }, [recoveryEntries]);
  const defaultActions = useMemo(() => [
    { id: 1, text: 'Validate each customer price against cost per shipment', owner: 'Commercial', done: false },
    { id: 2, text: 'Confirm actual monthly payroll and headcount', owner: 'Finance', done: false },
    { id: 3, text: 'Reconcile vehicle rent and fuel assumptions', owner: 'Operations', done: false },
  ], []);
  const [actions, setActions] = useLocalStorage<typeof defaultActions>('vega-followup-actions-v1', defaultActions);
  // Backup-age reminder (contract G2): device metadata key is deliberately
  // OUTSIDE backup files; stamp updates only when a download is initiated.
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => {
    try { return localStorage.getItem(BACKUP_REMINDER_KEY); } catch { return null; }
  });
  // Clock lives in state (event-driven bumps keep render pure); a slow
  // interval re-checks dismissal expiry without cascading renders.
  const [reminderNowMs, setReminderNowMs] = useState(() => Date.now());
  const bumpReminderClock = () => setReminderNowMs(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setReminderNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const hasMeaningfulData = Object.keys(dailyRecords).length > 0 || scenarios.length > 0 || recoveryEntries.length > 0;
  const backupReminder = useMemo(() => evaluateBackupReminder(reminderNowMs, lastBackupAt, hasMeaningfulData), [reminderNowMs, lastBackupAt, hasMeaningfulData]);
  const bannerDismissed = useMemo(() => isDismissedToday(reminderNowMs as never), [reminderNowMs]);
  const [reportKind, setReportKind] = useState<ReportKind>('daily');
  const [reportLang, setReportLang] = useState<'en' | 'ar' | 'both'>(lng);
  const [proModel, setProModel] = useState<ReportModel | null>(null);

  const NAV = [
    { id: 'summary' as const, label: t('businessModel.nav.summary'), icon: BarChart3 },
    { id: 'fleet' as const, label: t('businessModel.nav.fleet'), icon: Truck },
    { id: 'customers' as const, label: t('businessModel.nav.customers'), icon: Building2 },
    { id: 'costs' as const, label: t('businessModel.nav.costs'), icon: CircleDollarSign },
    { id: 'daily' as const, label: t('businessModel.nav.daily'), icon: CalendarDays },
    { id: 'risks' as const, label: t('businessModel.nav.risks'), icon: AlertTriangle },
    { id: 'scenarios' as const, label: t('businessModel.nav.scenarios'), icon: Layers },
    { id: 'recovery' as const, label: t('businessModel.nav.recovery'), icon: RotateCcw },
    { id: 'actions' as const, label: t('businessModel.nav.actions'), icon: ClipboardList },
  ];

  const switchLanguage = () => {
    const next = lng === 'ar' ? 'en' : 'ar';
    try { localStorage.setItem('language', next); } catch { /* private mode */ }
    void i18n.changeLanguage(next);
    window.dispatchEvent(new CustomEvent('vega:set-language', { detail: next }));
  };

  const fleetCount = input.vehicleClasses.filter(item => item.enabled).reduce((sum, item) => sum + item.quantity, 0);
  const driverGap = input.companyDriverCount - fleetCount;
  const contribution = output.avgRevenuePerShipment - output.costBreakdown.perShipment / Math.max(1, output.totalMonthlyShipments);
  // Cheap rule-based flags — recomputed each render (memoization not worth
  // the react-compiler interaction with translated deps).
  const risks: RiskItem[] = [
    {
      level: output.netMargin < 0 ? 'critical' : 'controlled',
      titleKey: 'profitability',
      value: t('businessModel.risks.profitValue', { value: output.netMarginPercent.toFixed(1) }),
      detail: output.netMargin < 0
        ? t('businessModel.risks.lossDetail', { amount: fmtMoney(locale, Math.abs(output.netMargin)) })
        : t('businessModel.risks.profitDetail', { amount: fmtMoney(locale, output.netMargin) }),
    },
    {
      level: driverGap < 0 ? 'high' : 'controlled',
      titleKey: 'driverCoverage',
      value: t('businessModel.risks.coverageValue', { drivers: input.companyDriverCount, vehicles: fleetCount }),
      detail: driverGap < 0
        ? t('businessModel.risks.missingDetail', { count: Math.abs(driverGap) })
        : t('businessModel.risks.spareDetail', { count: driverGap }),
    },
    {
      level: output.avgRevenuePerShipment < output.costPerShipment ? 'critical' : 'controlled',
      titleKey: 'unitEconomics',
      value: t('businessModel.risks.unitValue', { revenue: fmtMoney(locale, output.avgRevenuePerShipment, 2), cost: fmtMoney(locale, output.costPerShipment, 2) }),
      detail: t('businessModel.risks.unitDetail'),
    },
    {
      level: input.clientPaymentDelay > 30 ? 'high' : 'controlled',
      titleKey: 'cashCollection',
      value: t('businessModel.risks.cashValue', { days: input.clientPaymentDelay }),
      detail: t('businessModel.risks.cashDetail', { months: output.cashRunway.toFixed(1) }),
    },
  ];
  const levelLabel: Record<RiskLevel, string> = {
    critical: t('businessModel.risks.levelCritical'),
    high: t('businessModel.risks.levelHigh'),
    controlled: t('businessModel.risks.levelControlled'),
  };

  const setNumber = (field: NumberField, raw: string) => updateFinancialInput({ [field]: Math.max(0, Number(raw) || 0) });
  // Compute the next fleet list outside the setter so the synchronized driver
  // count never depends on when (or whether) the updater runs.
  const enabledTotal = (rows: VehicleClass[]) => rows.reduce((sum, row) => row.enabled ? sum + row.quantity : sum, 0);
  const changeVehicle = (id: string, patch: Partial<VehicleClass>) => {
    const next = input.vehicleClasses.map(row => row.id === id ? { ...row, ...patch } : row);
    setVehicleClasses(() => next);
    updateFinancialInput({ companyDriverCount: enabledTotal(next) });
  };
  const changeProvider = (id: string, patch: Partial<Provider>) => setProviders(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row));
  const changeDriver = (id: string, patch: Partial<DriverRecord>) => setDrivers(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row));
  const removeVehicle = (id: string) => {
    const next = input.vehicleClasses.filter(item => item.id !== id);
    setVehicleClasses(() => next);
    updateFinancialInput({ companyDriverCount: enabledTotal(next) });
  };
  const removeProvider = (id: string) => setProviders(rows => rows.filter(item => item.id !== id));
  const setFleetCount = (raw: string) => {
    const target = Math.max(0, Math.round(Number(raw) || 0));
    setVehicleClasses(rows => resizeVehicleFleet(rows, target));
    updateFinancialInput({ companyDriverCount: target });
  };
  const selectView = (next: View) => { setView(next === 'drivers' ? 'fleet' : next); setMobileNav(false); };
  const goToBackupSection = () => {
    selectView('scenarios');
    requestAnimationFrame(() => {
      document.getElementById('bm-backup-card')?.focus();
    });
  };

  return <div className="bm-app">
    <datalist id="bm-vehicle-names">{[...new Set(input.vehicleClasses.map(vehicle => vehicle.name))].map(name => <option key={name} value={name} />)}</datalist>
    <a className="bm-skip" href="#bm-main">{t('businessModel.a11y.skipToMain')}</a>
    {mobileNav && <button className="bm-scrim" aria-label={t('businessModel.a11y.closeNavigation')} onClick={() => setMobileNav(false)} />}
    <aside className={`bm-sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="bm-brand"><div><strong>VEGA</strong><span>{t('businessModel.brand.subtitle')}</span></div><button aria-label={t('businessModel.a11y.closeNavigation')} onClick={() => setMobileNav(false)}><X size={18} /></button></div>
      <nav aria-label={t('businessModel.a11y.sectionsNav')}>{NAV.map(item => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? 'active' : ''} aria-current={view === item.id ? 'page' : undefined} onClick={() => selectView(item.id)}><Icon size={16} /><span>{item.label}</span>{item.id === 'risks' && <em>{risks.filter(r => r.level !== 'controlled').length}</em>}{item.id === 'recovery' && pendingRecoveries > 0 && <em>{pendingRecoveries}</em>}</button>; })}</nav>
      <div className="bm-source"><span>{t('businessModel.sidebar.savedLocal')}</span><small>{t(telematicsProvider.isLive ? 'businessModel.sidebar.noConnections' : 'businessModel.sidebar.telemetryDemo')}</small></div>
    </aside>

    <div className="bm-shell">
      <header className="bm-top"><button className="bm-menu" aria-label={t('businessModel.a11y.openNavigation')} onClick={() => setMobileNav(true)}><Menu size={19} /></button><div><strong>{NAV.find(item => item.id === view)?.label}</strong><span>{t('businessModel.header.subtitle')}</span></div><div className="bm-search"><Search size={14}/><input aria-label={t('businessModel.search.placeholder')} placeholder={t('businessModel.search.placeholder')} value={search} onChange={event=>setSearch(event.target.value)}/>{search&&<div className="bm-search-results">{NAV.filter(item=>item.label.toLowerCase().includes(search.toLowerCase())).map(item=><button key={item.id} onClick={()=>{selectView(item.id);setSearch('');}}>{item.label}</button>)}{input.drivers.filter(driver=>driver.fullName.toLowerCase().includes(search.toLowerCase())).map(driver=><button key={driver.id} onClick={()=>{selectView('fleet');setSearch('');}}>{t('businessModel.search.driverResult',{name:driver.fullName})}</button>)}{input.providers.filter(provider=>provider.name.toLowerCase().includes(search.toLowerCase())).map(provider=><button key={provider.id} onClick={()=>{selectView('customers');setSearch('');}}>{t('businessModel.search.customerResult',{name:provider.name})}</button>)}</div>}</div><button className="bm-lang" onClick={switchLanguage} aria-label={lng === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}><Languages size={14}/>{lng === 'ar' ? 'English' : 'العربية'}</button><div className="bm-status"><i /> {t('businessModel.status.localModel')}</div></header>
        {backupReminder.visible && !bannerDismissed && (
          <BackupBanner
            reason={backupReminder.reason}
            days={backupReminder.daysSince ?? BACKUP_REMINDER_DAYS}
            onCta={goToBackupSection}
            onDismiss={() => { dismissForToday(); bumpReminderClock(); }}
          />
        )}
      <main id="bm-main" className="bm-main">
        {view === 'summary' && <CoreSummary output={output} input={input} fleetCount={fleetCount} driverGap={driverGap} contribution={contribution} risks={risks} onNavigate={selectView} dailyRecords={dailyRecords} />}
        {view === 'fleet' && <Page title={t('businessModel.fleet.title')} description={t('businessModel.fleet.desc')}><div className="bm-form-card bm-combined-count"><NumberInput label={t('businessModel.fleet.carsDrivers')} value={fleetCount} onChange={setFleetCount} suffix={t('businessModel.fleet.suffixTotal')} /><Readout label={t('businessModel.fleet.payrollReadout')} value={money(fleetCount * input.driverSalary)} /></div><EditableTable columns={[t('businessModel.fleet.colVehicleType'),t('businessModel.fleet.colQuantity'),t('businessModel.fleet.colRentMonth'),t('businessModel.fleet.colInsurance'),t('businessModel.fleet.colFuelEfficiency'),t('businessModel.fleet.colDistanceDay'),'']}>
          {input.vehicleClasses.map(row => <div className="bm-table-row bm-fleet-row" key={row.id}><TextInput ariaLabel={`${row.name}`} value={row.name} onChange={value => changeVehicle(row.id,{name:value})} /><CellNumber ariaLabel={`${row.name} ${t('businessModel.fleet.colQuantity')}`} value={row.quantity} onChange={value => changeVehicle(row.id,{quantity:value})} /><CellNumber ariaLabel={`${row.name} ${t('businessModel.fleet.colRentMonth')}`} value={row.monthlyRent} onChange={value => changeVehicle(row.id,{monthlyRent:value})} /><CellNumber ariaLabel={`${row.name} ${t('businessModel.fleet.colInsurance')}`} value={row.variableCost} onChange={value => changeVehicle(row.id,{variableCost:value})} /><CellNumber ariaLabel={`${row.name} ${t('businessModel.fleet.colFuelEfficiency')}`} value={row.fuelEfficiency} onChange={value => changeVehicle(row.id,{fuelEfficiency:value})} /><CellNumber ariaLabel={`${row.name} ${t('businessModel.fleet.colDistanceDay')}`} value={row.avgDailyDistance} onChange={value => changeVehicle(row.id,{avgDailyDistance:value})} /><button className="bm-remove" aria-label={`${t('businessModel.common.remove')} ${row.name}`} onClick={() => removeVehicle(row.id)}>{t('businessModel.common.remove')}</button></div>)}
        </EditableTable><button className="bm-add" onClick={addVehicleClass}><Plus size={15}/> {t('businessModel.common.addVehicleType')}</button><div className="bm-inline-total"><span>{t('businessModel.fleet.syncTotal')}</span><strong>{t('businessModel.fleet.totals',{cars:fleetCount,drivers:input.companyDriverCount})}</strong><span>{t('businessModel.fleet.monthlyFleetCost')}</span><strong>{money(output.fleetMonthlyCost)}</strong></div><div className="bm-roster"><div className="bm-roster-head"><h2>{t('businessModel.fleet.rosterTitle')}</h2><span>{t('businessModel.fleet.rosterCount',{count:input.drivers.length})}</span></div><EditableTable columns={[t('businessModel.fleet.colDriverName'),t('businessModel.fleet.colPhone'),t('businessModel.fleet.colAssignedVehicle'),t('businessModel.fleet.colStatus')]}>{input.drivers.map(driver => <div className="bm-table-row bm-driver-row" key={driver.id}><TextInput ariaLabel={`${driver.fullName} ${t('businessModel.fleet.colDriverName')}`} value={driver.fullName} onChange={value => changeDriver(driver.id,{fullName:value})} /><TextInput ariaLabel={`${driver.fullName} ${t('businessModel.fleet.colPhone')}`} value={driver.phone} onChange={value => changeDriver(driver.id,{phone:value})} /><input aria-label={`${driver.fullName} ${t('businessModel.fleet.colAssignedVehicle')}`} list="bm-vehicle-names" value={driver.assignedVehicle} onChange={event => changeDriver(driver.id,{assignedVehicle:event.target.value})} /><select aria-label={`${driver.fullName} ${t('businessModel.fleet.colStatus')}`} value={driver.status} onChange={event => changeDriver(driver.id,{status:event.target.value as DriverRecord['status']})}><option value="active">{t('businessModel.common.active')}</option><option value="inactive">{t('businessModel.common.inactive')}</option></select></div>)}</EditableTable></div></Page>}
        {view === 'customers' && <Page title={t('businessModel.customers.title')} description={t('businessModel.customers.desc')}><EditableTable columns={[t('businessModel.customers.colCustomer'),t('businessModel.customers.colShipmentsDay'),t('businessModel.customers.colPriceShipment'),t('businessModel.customers.colMonthlyRevenue'),'']}>
          {input.providers.map(row => { const evaluation = output.providerEvaluations.find(item => item.id === row.id); return <div className="bm-table-row bm-customer-row" key={row.id}><TextInput ariaLabel={t('businessModel.customers.colCustomer')} value={row.name} onChange={value => changeProvider(row.id,{name:value})} /><CellNumber ariaLabel={`${row.name} ${t('businessModel.customers.colShipmentsDay')}`} value={row.shipmentsPerDay} onChange={value => changeProvider(row.id,{shipmentsPerDay:value})} /><CellNumber ariaLabel={`${row.name} ${t('businessModel.customers.colPriceShipment')}`} value={row.pricePerShipment} onChange={value => changeProvider(row.id,{pricePerShipment:value})} step="0.1" /><strong>{money(evaluation?.monthlyRevenue ?? 0)}</strong><button className="bm-remove" aria-label={`${t('businessModel.common.remove')} ${row.name}`} onClick={() => removeProvider(row.id)}>{t('businessModel.common.remove')}</button></div>})}
        </EditableTable><button className="bm-add" onClick={addProvider}><Plus size={15}/> {t('businessModel.common.addCustomer')}</button></Page>}
        {view === 'costs' && <Page title={t('businessModel.costs.title')} description={t('businessModel.costs.desc')}><CostSections input={input} output={output} setNumber={setNumber} changeVehicle={changeVehicle} /></Page>}
        {view === 'daily' && <DailyReport input={input} output={output} records={dailyRecords} setRecords={setDailyRecords} reportKind={reportKind} setReportKind={setReportKind} onOpenPro={setProModel} lng={lng} reportLang={reportLang} setReportLang={setReportLang} openActions={actions.filter(action => !action.done).slice(0, 5)} recoverySummary={recoverySummary} recoveryAll={recoveryEntries} recoveryOpen={recoveryEntries.filter(entry => entry.status === 'pending').slice(0, 8).map(({ id, createdAt, shipments, owner, status }) => ({ id, createdAt, shipments, owner, status }))} />}
        {view === 'risks' && <Page title={t('businessModel.risks.title')} description={t('businessModel.risks.desc')}><div className="bm-risk-table"><div className="bm-risk-head"><span>{t('businessModel.risks.thStatus')}</span><span>{t('businessModel.risks.thRisk')}</span><span>{t('businessModel.risks.thValue')}</span><span>{t('businessModel.risks.thReason')}</span></div>{risks.map(risk => <div className="bm-risk-row" key={risk.titleKey}><span className={risk.level === 'controlled' ? 'ok' : 'bad'}>{levelLabel[risk.level]}</span><strong>{t(`businessModel.risks.${risk.titleKey}`)}</strong><span>{risk.value}</span><p>{risk.detail}</p></div>)}</div></Page>}
        {view === 'scenarios' && <ScenarioView input={input} output={output} scenarios={scenarios} setScenarios={setScenarios} dailyRecords={dailyRecords} setDailyRecords={setDailyRecords} recoveryEntries={recoveryEntries} setRecoveryEntries={setRecoveryEntries} actions={actions} setActions={setActions} applyFinancialInput={applyFinancialInput} onBackedUp={() => { const iso = new Date().toISOString(); markBackedUpNow(); setLastBackupAt(iso); bumpReminderClock(); }} />}
        {view === 'recovery' && <Page title={t('businessModel.recovery.recovery')} description={t('businessModel.recovery.recoveryDesc')}><RecoveryBoard entries={recoveryEntries} setEntries={setRecoveryEntries} /></Page>}
        {view === 'actions' && <Page title={t('businessModel.actionsPage.title')} description={t('businessModel.actionsPage.desc')}><div className="bm-actions">{actions.map(action => <div className={action.done ? 'done' : ''} key={action.id}><button aria-label={action.done ? action.text : action.text} onClick={() => setActions(rows => rows.map(row => row.id === action.id ? {...row,done:!row.done,updatedAt:new Date().toISOString()}:row))}>{action.done ? <Check size={15}/> : null}</button><span><strong>{action.text}</strong><small>{action.owner}</small></span></div>)}</div></Page>}
      </main>
    </div>
    {proModel && <ProReport model={proModel} onClose={() => setProModel(null)} />}
    <ServiceWorkerRegistrar />
  </div>;
}

function Page({ title, description, children }: { title:string; description:string; children:React.ReactNode }) { return <><div className="bm-page-head"><h1>{title}</h1><p>{description}</p></div>{children}</>; }
function CoreSummary({ output,input,fleetCount,driverGap,contribution,risks,onNavigate,dailyRecords }: { output:ReturnType<typeof useSimulatedData>['financialOutput']; input:FinancialInput; fleetCount:number; driverGap:number; contribution:number; risks:RiskItem[]; onNavigate:(view:View)=>void; dailyRecords:Record<string,DailyRecord> }) {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const money = (value: number, digits = 0) => fmtMoney(locale, value, digits);
  const num = (value: number) => fmtNum(locale, value);
  const trend=buildProjection(output,14,dailyRecords);
  const categories=Object.entries(output.costBreakdown).filter(([key])=>!['costPerShipment','total'].includes(key)) as [string,number][];
  const shipmentsPerCar=output.totalDailyShipments/Math.max(1,fleetCount);
  return <><div className="bm-page-head bm-summary-head"><div><h1>{t('businessModel.summary.title')}</h1><p>{t('businessModel.summary.subtitle')}</p></div><div className="bm-head-actions"><button onClick={()=>onNavigate('daily')}><FileText size={15}/> {t('businessModel.summary.recordToday')}</button><button onClick={()=>onNavigate('costs')}><Settings2 size={15}/> {t('businessModel.summary.editCosts')}</button></div></div>
    <section className="bm-kpis bm-decision-kpis"><Kpi label={t('businessModel.summary.kpiRevenue')} value={money(output.totalRevenue)} /><Kpi label={t('businessModel.summary.kpiProfitLoss')} value={money(output.netMargin)} tone={output.netMargin<0?'bad':'good'} /><Kpi label={t('businessModel.summary.kpiMargin')} value={`${output.netMarginPercent.toFixed(1)}%`} tone={output.netMargin<0?'bad':'good'} /><Kpi label={t('businessModel.summary.kpiBreakeven')} value={`${num(output.operationalBreakeven)} ${t('businessModel.summary.perMonth')}`} /></section>
    <div className="bm-dashboard-grid"><TrendChart data={trend}/><section className="bm-panel bm-unit-card"><div className="bm-panel-head"><div><span>{t('businessModel.summary.unitTag')}</span><h2>{t('businessModel.summary.unitHead')}</h2></div></div><div className="bm-unit-values"><Metric label={t('businessModel.summary.revPerShipment')} value={money(output.avgRevenuePerShipment,2)}/><Metric label={t('businessModel.summary.costPerShipment')} value={money(output.costPerShipment,2)}/><Metric label={t('businessModel.summary.profitPerShipment')} value={money(output.avgRevenuePerShipment-output.costPerShipment,2)} tone={output.avgRevenuePerShipment<output.costPerShipment?'bad':'good'}/><Metric label={t('businessModel.summary.shipmentsPerCar')} value={shipmentsPerCar.toFixed(1)}/></div><button className="bm-link-button" onClick={()=>onNavigate('customers')}>{t('businessModel.summary.reviewPricing')}</button></section></div>
    <div className="bm-dashboard-grid"><CustomerChart output={output}/><CostChart categories={categories} total={output.totalCost}/></div>
    <div className="bm-dashboard-grid"><Waterfall output={output}/><CapacityGauges output={output} fleetCount={fleetCount}/></div>
    <SensitivityGrid input={input}/>
    <MonthlyTotals input={input} output={output} fleetCount={fleetCount}/><details className="bm-detail-model"><summary>{t('businessModel.summary.detailToggle')}</summary><Summary output={output} input={input} fleetCount={fleetCount} driverGap={driverGap} contribution={contribution} risks={risks} onNavigate={onNavigate}/></details></>;
}
function MonthlyVariance({records,output}:{records:Record<string,DailyRecord>;output:ReturnType<typeof useSimulatedData>['financialOutput']}) {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const money = (value: number, digits = 0) => fmtMoney(locale, value, digits);
  const num = (value: number) => fmtNum(locale, value);
  const rollups=useMemo(()=>buildMonthlyRollup(records,output),[records,output]); if(rollups.length===0) return null;
  return <section className="bm-panel"><div className="bm-panel-head"><div><span>{t('businessModel.daily.varianceTag')}</span><h2>{t('businessModel.daily.varianceHead')}</h2></div></div><div className="bm-table-wrap"><div className="bm-table"><div className="bm-table-head"><span>{t('businessModel.daily.thMonth')}</span><span>{t('businessModel.daily.thDaysRecorded')}</span><span>{t('businessModel.daily.thCompleted')}</span><span>{t('businessModel.daily.thFailed')}</span><span>{t('businessModel.daily.thCompletion')}</span><span>{t('businessModel.daily.thActualRevenue')}</span><span>{t('businessModel.daily.thPlannedRevenue')}</span><span>{t('businessModel.daily.thVariance')}</span></div>{rollups.map(r=><div className="bm-table-row" key={r.month}><strong>{r.month}</strong><span>{r.recordedDays}</span><span>{num(r.completedShipments)}</span><span>{num(r.failedShipments)}</span><span>{r.completionRate.toFixed(1)}%</span><span>{money(r.actualRevenue)}</span><span>{money(r.plannedRevenue)}</span><span className={r.variancePercent>=0?'':'text-bad'}>{r.variancePercent>=0?'+':''}{r.variancePercent.toFixed(1)}%</span></div>)}</div></div></section>; }
function TrendChart({data}:{data:ReturnType<typeof buildProjection>}) {
  const { t } = useTranslation();
  const width=680,height=230,pad=34; const max=Math.max(...data.flatMap(item=>[item.revenue,item.cost]),1); const point=(value:number,index:number)=>`${pad+index*(width-pad*2)/Math.max(1,data.length-1)},${height-pad-value/max*(height-pad*2)}`; const revenue=data.map((item,index)=>point(item.revenue,index)).join(' '); const cost=data.map((item,index)=>point(item.cost,index)).join(' '); const costY=point(data[0]?.cost??0,0).split(',')[1];
  return <section className="bm-panel bm-trend"><div className="bm-panel-head"><div><span>{t('businessModel.summary.trendTag')}</span><h2>{t('businessModel.summary.trendHead')}</h2></div><div className="bm-legend"><i className="revenue"/> {t('businessModel.summary.legendRevenue')} <i className="cost"/> {t('businessModel.summary.legendCost')}</div></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('businessModel.summary.trendAria')}><line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad}/><line x1={pad} y1={pad} x2={pad} y2={height-pad}/><line className="breakeven" x1={pad} x2={width-pad} y1={costY} y2={costY}/><polyline className="cost" points={cost}/><polyline className="revenue" points={revenue}/>{data.map((item,index)=><circle key={item.date} className={item.recorded?'recorded':'projected'} cx={point(item.revenue,index).split(',')[0]} cy={point(item.revenue,index).split(',')[1]} r="3"/>)}</svg><div className="bm-axis-labels"><span>{data[0]?.label}</span><span>{data.at(-1)?.label}</span></div><p>{t('businessModel.summary.trendNote')}</p></section>; }
function CostChart({categories,total}:{categories:[string,number][];total:number}) {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const money = (value: number, digits = 0) => fmtMoney(locale, value, digits);
  const catLabels:Record<string,string>={vehicleOwnership:t('businessModel.summary.catVehicleRent'),vehicleRunning:t('businessModel.summary.catFuelRunning'),people:t('businessModel.summary.catPeople'),facilities:t('businessModel.summary.catFacilities'),perShipment:t('businessModel.summary.catPerShipment'),other:t('businessModel.summary.catOther')};
  return <section className="bm-panel bm-cost-chart"><div className="bm-panel-head"><div><span>{t('businessModel.summary.costTag')}</span><h2>{t('businessModel.summary.costHead',{amount:fmtMoney(locale,total)})}</h2></div></div><div className="bm-stacked-bar" aria-label={catLabels.vehicleOwnership}>{categories.map(([key,value],index)=><i key={key} className={`c${index}`} style={{width:`${value/Math.max(1,total)*100}%`}} title={`${catLabels[key]}: ${money(value)}`}/>)}</div><div className="bm-cost-legend">{categories.map(([key,value],index)=><div key={key}><i className={`c${index}`}/><span>{catLabels[key]}</span><strong>{money(value)}</strong><small>{(value/Math.max(1,total)*100).toFixed(1)}%</small></div>)}</div></section>; }
function CustomerChart({output}:{output:ReturnType<typeof useSimulatedData>['financialOutput']}) {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const money = (value: number, digits = 0) => fmtMoney(locale, value, digits);
  const B='businessModel.charts.';
  const customers=output.providerEvaluations.filter(p=>p.enabled!==false).sort((a,b)=>b.monthlyRevenue-a.monthlyRevenue);
  const top=customers.slice(0,8);
  const maxRev=Math.max(1,...top.map(c=>c.monthlyRevenue));
  const total=output.totalRevenue;
  return <section className="bm-panel">
    <div className="bm-panel-head"><div><span>{t(B+'customersTag')}</span><h2>{t(B+'customersHead')}</h2></div></div>
    {top.length===0 ? <p className="bm-empty-note">{t(B+'noCustomers')}</p> : <div className="bm-cust-list">{top.map(c=>(
      <div key={c.id} className="bm-cust-row" title={`${c.name}: ${money(c.monthlyRevenue)}`}>
        <span className="name">{c.name}</span>
        <i><b className={c.rating} style={{width:`${Math.max(2,c.monthlyRevenue/maxRev*100)}%`}}/></i>
        <strong>{money(c.monthlyRevenue)}</strong>
        <small>{total>0?(c.monthlyRevenue/total*100).toFixed(0):0}%</small>
      </div>))}
      {customers.length>8 && <p className="bm-more">{t(B+'moreCustomers',{count:customers.length-8})}</p>}
    </div>}
    {top.length>0 && <div className="bm-rating-legend"><i className="good"/><span>{t(B+'ratingGood')}</span><i className="average"/><span>{t(B+'ratingAverage')}</span><i className="bad"/><span>{t(B+'ratingBad')}</span></div>}
  </section>;
}

const waterfallSteps = (output:ReturnType<typeof useSimulatedData>['financialOutput']) => {
  const cb=output.costBreakdown;
  return [
    { key:'stepRevenue', delta: output.totalRevenue, type:'total' as const },
    { key:'stepFleet', delta: -(cb.vehicleOwnership+cb.vehicleRunning), type:'cost' as const },
    { key:'stepPeople', delta: -cb.people, type:'cost' as const },
    { key:'stepFacilities', delta: -cb.facilities, type:'cost' as const },
    { key:'stepPerShipment', delta: -cb.perShipment, type:'cost' as const },
    { key:'stepOther', delta: -cb.other, type:'cost' as const },
    { key:'stepNet', delta: output.netMargin, type:'net' as const },
  ];
};

function Waterfall({output}:{output:ReturnType<typeof useSimulatedData>['financialOutput']}) {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const fmt=(v:number)=>fmtMoneyCompact(locale,v);
  const B='businessModel.charts.';
  const steps=waterfallSteps(output);
  const width=680,height=240,pad=30,n=steps.length;
  const slot=(width-pad*2)/n, barW=Math.min(56,slot*0.62);
  // Running level after each step; bars float between previous and new level.
  // Built with reduce so nothing mutates render-scope variables (React Compiler-safe).
  type WfBar = typeof steps[number] & { start:number; end:number; x:number };
  const bars:WfBar[] = steps.reduce<{acc:WfBar[]; running:number}>((state, step, index) => {
    const x = pad + index * slot + (slot - barW) / 2;
    if (step.type === 'total') {
      state.running = step.delta;
      state.acc.push({ ...step, start: 0, end: Math.max(0, step.delta), x });
    } else {
      const start = state.running;
      state.running += step.delta;
      state.acc.push({ ...step, start: Math.min(start, state.running), end: Math.max(start, state.running), x });
    }
    return state;
  }, { acc: [], running: 0 }).acc;
  const maxLevel=Math.max(...bars.map(b=>b.end),1);
  const y=(level:number)=>height-pad-(level/maxLevel)*(height-pad*2);
  const labelY=(bar:(typeof bars)[number])=>y(bar.end)-6;
  return <section className="bm-panel bm-waterfall">
    <div className="bm-panel-head"><div><span>{t(B+'waterfallTag')}</span><h2>{t(B+'waterfallHead')}</h2></div></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t(B+'waterfallAria')}>
      <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad}/>
      {bars.map(bar=>{
        const top=y(bar.end), bottom=y(Math.max(0,bar.start));
        const cls=bar.type==='cost'?'cost':bar.delta>=0?'gain':'loss';
        return <g key={bar.key}>
          <rect className={`wf-${cls}`} x={bar.x} y={top} width={barW} height={Math.max(2,bottom-top)} rx="3"/>
          <text className="wf-value" x={bar.x+barW/2} y={labelY(bar)} textAnchor="middle">{fmt(bar.delta)}</text>
          <text className="wf-label" x={bar.x+barW/2} y={height-pad+14} textAnchor="middle">{t(B+bar.key)}</text>
        </g>;
      })}
    </svg>
  </section>;
}

function CapacityGauges({output,fleetCount}:{output:ReturnType<typeof useSimulatedData>['financialOutput'];fleetCount:number}) {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const num=(v:number)=>fmtNum(locale,v);
  const B='businessModel.charts.';
  const volumePct=Math.min(100,output.totalDailyShipments/Math.max(1,output.operationalBreakeven)*100);
  const aboveBreakEven=output.netMargin>=0;
  const runwayPct=Math.min(100,output.cashRunway/12*100);
  const utilizationPct=Math.min(100,output.fleetUtilization);
  return <section className="bm-panel">
    <div className="bm-panel-head"><div><span>{t(B+'gaugeTag')}</span><h2>{t(B+'gaugeHead')}</h2></div></div>
    <div className="bm-gauge-list">
      <div className={`bm-gauge ${aboveBreakEven?'':'bad'}`}>
        <div><span>{t(B+'gaugeVolume')}</span><strong>{num(output.totalDailyShipments)} / {num(output.operationalBreakeven)}</strong></div>
        <i><b style={{width:`${volumePct}%`}}/></i>
        <small>{aboveBreakEven?t(B+'gaugeSafe'):t(B+'gaugeShort')} · {t(B+'gaugeOfBreakeven',{current:num(output.totalDailyShipments),breakeven:num(output.operationalBreakeven)})}</small>
      </div>
      <div className={`bm-gauge ${output.cashRunway>=6?'':'bad'}`}>
        <div><span>{t(B+'gaugeRunway')}</span><strong>{t(B+'gaugeMonths',{months:output.cashRunway.toFixed(1)})}</strong></div>
        <i><b style={{width:`${runwayPct}%`}}/></i>
        <small>{fleetCount} cars · {num(output.totalMonthlyShipments)} shipments/mo</small>
      </div>
      <div className={`bm-gauge ${utilizationPct>=50?'':'bad'}`}>
        <div><span>{t(B+'gaugeUtilization')}</span><strong>{utilizationPct.toFixed(0)}%</strong></div>
        <i><b style={{width:`${utilizationPct}%`}}/></i>
      </div>
    </div>
  </section>;
}

const SENS_FACTORS=[-0.2,-0.1,0,0.1,0.2];
const sensFactorLabel=(f:number)=>`${f>0?'+':f<0?'−':''}${Math.abs(f*100).toFixed(0)}%`;

function SensitivityGrid({input}:{input:FinancialInput}) {
  const { t } = useTranslation();
  const B='businessModel.charts.';
  const grid=useMemo(()=>SENS_FACTORS.map(fuelF=>({
    fuelF,
    cells:SENS_FACTORS.map(volF=>{
      const test=structuredClone(input);
      test.fuelPricePerLiter=input.fuelPricePerLiter*(1+fuelF);
      test.providers=input.providers.map(p=>({...p,shipmentsPerDay:p.shipmentsPerDay*(1+volF)}));
      const out=calculateFinancials(test);
      return out.totalRevenue>0?out.netMarginPercent:null;
    }),
  })),[input]);
  const cellStyle=(value:number|null)=>{
    if(value===null) return undefined;
    const clamped=Math.max(-20,Math.min(20,value));
    const alpha=0.12+(Math.abs(clamped)/20)*0.55;
    return { background:value>=0?`rgba(71,116,93,${alpha})`:`rgba(173,64,56,${alpha})`, color:value>=0&&alpha<0.5?'#173428':'inherit' };
  };
  return <section className="bm-panel bm-sens">
    <div className="bm-panel-head"><div><span>{t(B+'sensTag')}</span><h2>{t(B+'sensHead')}</h2></div></div>
    <table>
      <thead><tr><th scope="col">{t(B+'sensFuelAxis')} ↓ · {t(B+'sensVolumeAxis')} →</th>{SENS_FACTORS.map(f=><th key={f} scope="col">{sensFactorLabel(f)}</th>)}</tr></thead>
      <tbody>{grid.map(row=>(
        <tr key={row.fuelF}><th scope="row">{sensFactorLabel(row.fuelF)}</th>
          {row.cells.map((cell,i)=><td key={i} style={cellStyle(cell)}>{cell===null?t(B+'sensNoRevenue'):`${cell>=0?'+':''}${cell.toFixed(1)}%`}</td>)}
        </tr>))}
      </tbody>
    </table>
    <p className="bm-calculation-note">{t(B+'sensNote')}</p>
  </section>;
}

function Metric({label,value,tone}:{label:string;value:string;tone?:string}) { return <div className={tone??''}><span>{label}</span><strong>{value}</strong></div>; }
function DailyReport({input,output,records,setRecords,reportKind,setReportKind,onOpenPro,lng,reportLang,setReportLang,openActions:pendingActions,recoverySummary,recoveryOpen,recoveryAll}:{input:FinancialInput;output:ReturnType<typeof useSimulatedData>['financialOutput'];records:Record<string,DailyRecord>;setRecords:(value:Record<string,DailyRecord>|((previous:Record<string,DailyRecord>)=>Record<string,DailyRecord>))=>void;reportKind:ReportKind;setReportKind:(kind:ReportKind)=>void;onOpenPro:(model:ReportModel)=>void;lng:'en'|'ar';reportLang:'en'|'ar'|'both';setReportLang:(lang:'en'|'ar'|'both')=>void;openActions:Array<{id:number;text:string;owner:string}>;recoverySummary:{pendingEntries:number;pendingShipments:number;recoveredShipments:number;closeRatePercent:number;overdueSharePercent:number};recoveryOpen:RecoveryOpenRow[];recoveryAll:RecoveryEntry[]}) {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const labels = useMemo(() => buildReportLabels(key => t(key)), [t]);
  const labelsAr = useMemo(() => buildReportLabels(key => t(key, { lng: 'ar' })), [t]);
  const money = (value: number, digits = 0) => fmtMoney(locale, value, digits);
  const num = (value: number) => fmtNum(locale, value);
  const today=toDateString(new Date());
  const empty=(date:string):DailyRecord=>({date,completedShipments:0,failedShipments:0,fuelCost:Number((output.fuelMonthlyCost/26).toFixed(2)),driversPresent:input.companyDriverCount,notes:'',updatedAt:'',failureReasons:{},extraCosts:0,newCustomerVisits:0,recoveredShipments:0,safetyIncidents:0,codShipments:0,prepaidShipments:0,cashCollectedSar:0,cashRemittedSar:0,driverName:'',carNumber:'',plateNumber:'',weatherCondition:'clear',tomorrowNote:'',customerBreakdown:{},podStatus:undefined});
  const [selectedDate,setSelectedDate]=useState(today);
  const [draft,setDraft]=useState<DailyRecord>(()=>records[today]??empty(today));
  const [message,setMessage]=useState('');
  const metrics=calculateDailyMetrics(draft,input,output);
  const update=(patch:Partial<DailyRecord>)=>setDraft(current=>({...current,...patch}));
  const changeReason=(key:FailureReasonKey,raw:string)=>setDraft(current=>({...current,failureReasons:{...current.failureReasons,[key]:Math.max(0,Number(raw)||0)}}));
  const setCustomerCell=(providerId:string,field:'delivered'|'missed',value:number)=>{
    setDraft(current=>({...current,customerBreakdown:{...current.customerBreakdown,[providerId]:{delivered:0,missed:0,...current.customerBreakdown?.[providerId],[field]:value}}}));
  };
  const enabledProviders=input.providers.filter(provider=>provider.enabled!==false);
  const attributedToday=enabledProviders.reduce((sum,provider)=>sum+(draft.customerBreakdown?.[provider.id]?.delivered??0),0);
  const podLabels={complete:t('businessModel.report.podComplete'),partial:t('businessModel.report.podPartial'),none:t('businessModel.report.podNone')} as const;
  const reasonsSum=FAILURE_REASON_KEYS.reduce((sum,key)=>sum+(draft.failureReasons?.[key]??0),0);
  const reasonsMismatch=draft.failedShipments>0&&reasonsSum!==draft.failedShipments;
  // Cross-field logic — surfaced live in the day scoreboard
  const attemptsToday=draft.completedShipments+draft.failedShipments;
  const targetProgress=Math.min(100,Math.round(draft.completedShipments/Math.max(1,metrics.plannedShipments)*100));
  const paymentsAttributed=(draft.codShipments??0)+(draft.prepaidShipments??0);
  const cashOutstanding=(draft.cashCollectedSar??0)-(draft.cashRemittedSar??0);
  const coverageShort=input.companyDriverCount-draft.driversPresent;
  const dayChecks=[
    {ok:!reasonsMismatch,label:t('businessModel.daily.checkReasons'),detail:`${reasonsSum}/${draft.failedShipments}`},
    {ok:paymentsAttributed===0||paymentsAttributed<=draft.completedShipments,label:t('businessModel.daily.checkPayments'),detail:`${paymentsAttributed}/${draft.completedShipments}`},
    {ok:!(attributedToday>0&&attributedToday>draft.completedShipments),label:t('businessModel.daily.checkAttribution'),detail:`${num(attributedToday)}/${num(draft.completedShipments)}`},
    {ok:coverageShort<=0,label:t('businessModel.daily.checkCoverage'),detail:`${num(draft.driversPresent)}/${num(input.companyDriverCount)}`},
  ];
  const selectDate=(date:string)=>{setSelectedDate(date);setDraft(records[date]??empty(date));setMessage('');};
  const save=()=>{const saved={...draft,date:selectedDate,updatedAt:new Date().toISOString()};setRecords(current=>({...current,[selectedDate]:saved}));setDraft(saved);setMessage(t('businessModel.daily.savedMessage'));};
  const quickPdf=async()=>{
    setMessage(t('businessModel.daily.preparingPdf'));
    const primary = reportLang === 'both' ? lng : reportLang;
    await exportDailyReportPdf({...draft,date:selectedDate},input,output,{
      locale:primary,
      bilingual:reportLang==='both',
      labels:primary==='ar'?labelsAr:labels,
      labelsAlt:labelsAr,
    });
    setMessage(t('businessModel.daily.pdfDownloaded'));
  };
  const openPro=()=>{
    // The engine runs on what is inserted right now: the live draft joins the
    // saved history so unsaved edits appear in charts immediately.
    const effective={...records,[selectedDate]:{...draft,date:selectedDate}};
    const model = buildReportModel({kind:'pro',locale:lng,record:{...draft,date:selectedDate},records:effective,input,output,focusDate:new Date(`${selectedDate}T12:00:00`)});
    onOpenPro({
      ...model,
      openActions: pendingActions,
      recoveryBoard: { ...recoverySummary },
      openRecoveryEntries: recoveryOpen,
      recoveryTrend: buildWeeklyRecoveryTrend(recoveryAll, 4),
    });
  };
  const generateReport=()=>{ if(reportKind==='pro') openPro(); else void quickPdf(); };
  const downloadExcel=async()=>{setMessage(t('businessModel.daily.preparingExcel'));await exportBusinessModelExcel({...draft,date:selectedDate},input,output,{records:{...records,[selectedDate]:{...draft,date:selectedDate}},recoveryEntries:recoveryAll});setMessage(t('businessModel.daily.excelDownloaded'));};;
  return <><div className="bm-page-head bm-summary-head"><div><h1>{t('businessModel.daily.title')}</h1><p>{t('businessModel.daily.desc')}</p></div><label className="bm-date"><span>{t('businessModel.daily.reportDate')}</span><input aria-label={t('businessModel.daily.reportDate')} type="date" value={selectedDate} onChange={event=>selectDate(event.target.value)}/></label></div>
    <div className="bm-report-status"><span className={draft.updatedAt?'saved':'draft'}>{draft.updatedAt?t('businessModel.daily.recorded'):t('businessModel.daily.draft')}</span>{draft.updatedAt&&<small>{t('businessModel.daily.lastSaved',{value:fmtDateTime(locale,draft.updatedAt)})}</small>}</div>
    <section className="bm-panel bm-report-kind-card">
      <div className="bm-report-kind-copy"><span>{t('businessModel.summary.trendTag')}</span><h2>{reportKind==='pro'?t('businessModel.report.kindPro'):t('businessModel.report.kindDaily')}</h2><p>{t('businessModel.report.kindDesc')}</p></div>
      <div className="bm-report-kind-actions">
        <div className="bm-segmented" role="radiogroup" aria-label={t('businessModel.report.kindDesc')}>
          <button type="button" role="radio" aria-checked={reportKind==='daily'} className={reportKind==='daily'?'active':''} onClick={()=>setReportKind('daily')}>{t('businessModel.report.kindDaily')}</button>
          <button type="button" role="radio" aria-checked={reportKind==='pro'} className={reportKind==='pro'?'active':''} onClick={()=>setReportKind('pro')}>{t('businessModel.report.kindPro')}</button>
        </div>
        <div className="bm-segmented bm-lang-mini" role="radiogroup" aria-label={t('businessModel.report.language')}>
          <button type="button" role="radio" aria-checked={reportLang==='en'} className={reportLang==='en'?'active':''} onClick={()=>setReportLang('en')}>EN</button>
          <button type="button" role="radio" aria-checked={reportLang==='ar'} className={reportLang==='ar'?'active':''} onClick={()=>setReportLang('ar')}>ع</button>
          <button type="button" role="radio" aria-checked={reportLang==='both'} className={reportLang==='both'?'active':''} onClick={()=>setReportLang('both')}>EN+ع</button>
        </div>
        <button className="bm-primary" onClick={generateReport}>{reportKind==='pro'?<><FileText size={15}/> {t('businessModel.report.openPro')}</>:<><Download size={15}/> {t('businessModel.report.quickPdf')}</>}</button>
      </div>
    </section>
    <div className="bm-day-layout">
      <div className="bm-day-main">
        <section className="bm-form-card bm-day-card">
          <h2><span>{t('businessModel.daily.cardIdentity')}</span></h2>
          <div className="bm-form-grid">
            <label className="bm-field"><span>{t('businessModel.daily.driverName')}</span><div><input aria-label={t('businessModel.daily.driverName')} value={draft.driverName??''} onChange={event=>update({driverName:event.target.value})}/></div></label>
            <label className="bm-field"><span>{t('businessModel.daily.carNumber')}</span><div><input aria-label={t('businessModel.daily.carNumber')} value={draft.carNumber??''} onChange={event=>update({carNumber:event.target.value})}/></div></label>
            <label className="bm-field"><span>{t('businessModel.daily.plateNumber')}</span><div><input aria-label={t('businessModel.daily.plateNumber')} value={draft.plateNumber??''} onChange={event=>update({plateNumber:event.target.value})}/></div></label>
          </div>
        </section>

        <section className="bm-form-card bm-day-card">
          <h2><span>{t('businessModel.daily.cardResults')}</span></h2>
          <div className="bm-form-grid">
            <NumberInput label={t('businessModel.daily.completedShipments')} value={draft.completedShipments} onChange={value=>update({completedShipments:Number(value)})} suffix={t('businessModel.daily.unitShipments')}/>
            <NumberInput label={t('businessModel.daily.failedShipments')} value={draft.failedShipments} onChange={value=>update({failedShipments:Number(value)})} suffix={t('businessModel.daily.unitShipments')}/>
            <Readout label={t('businessModel.daily.attempts')} value={num(attemptsToday)} />
            <NumberInput label={t('businessModel.daily.driversPresent')} value={draft.driversPresent} onChange={value=>update({driversPresent:Number(value)})} suffix={t('businessModel.daily.ofCount',{count:input.companyDriverCount})}/>
            <NumberInput label={t('businessModel.report.recoveredShipments')} help={t('businessModel.report.recoveredShipmentsHint')} value={draft.recoveredShipments??0} onChange={value=>update({recoveredShipments:Number(value)})} suffix={t('businessModel.daily.unitShipments')}/>
          </div>
          <div className="bm-progress-row"><i><b style={{width:`${targetProgress}%`}}/></i><small>{t('businessModel.daily.targetProgress',{percent:targetProgress})}</small></div>
        </section>

        <section className="bm-form-card bm-day-card">
          <h2><span>{t('businessModel.daily.cardPayments')}</span></h2>
          <div className="bm-form-grid">
            <NumberInput label={t('businessModel.report.codShipments')} help={t('businessModel.report.codHint')} value={draft.codShipments??0} onChange={value=>update({codShipments:Number(value)})} suffix={t('businessModel.daily.unitShipments')}/>
            <NumberInput label={t('businessModel.report.prepaidShipments')} value={draft.prepaidShipments??0} onChange={value=>update({prepaidShipments:Number(value)})} suffix={t('businessModel.daily.unitShipments')}/>
            <NumberInput label={t('businessModel.report.cashCollected')} help={t('businessModel.report.cashHint')} value={draft.cashCollectedSar??0} onChange={value=>update({cashCollectedSar:Number(value)})} suffix="SAR"/>
            <NumberInput label={t('businessModel.report.cashRemitted')} value={draft.cashRemittedSar??0} onChange={value=>update({cashRemittedSar:Number(value)})} suffix="SAR"/>
          </div>
          {cashOutstanding!==0 && <span className={`bm-recon ${cashOutstanding>0?'bad':'ok'}`} style={{marginTop:10}}>{t('businessModel.report.cashOutstanding')}: {money(cashOutstanding)}</span>}
          <div className="bm-field" style={{marginTop:12}}><span>{t('businessModel.report.podStatus')}</span>
            <div className="bm-segmented bm-pod-switch" role="radiogroup" aria-label={t('businessModel.report.podStatus')}>
              {(['complete','partial','none'] as const).map(option=>(
                <button key={option} type="button" role="radio" aria-checked={(draft.podStatus??'')===option} className={(draft.podStatus??'')===option?'active':''} onClick={()=>update({podStatus:draft.podStatus===option?undefined:option})}>{podLabels[option]}</button>
              ))}
            </div>
          </div>
        </section>

        <section className="bm-form-card bm-day-card">
          <h2><span>{t('businessModel.daily.cardContext')}</span></h2>
          <div className="bm-form-grid">
            <NumberInput label={t('businessModel.daily.fuelSpent')} value={draft.fuelCost} onChange={value=>update({fuelCost:Number(value)})} suffix="SAR"/>
            <NumberInput label={t('businessModel.report.extraCosts')} help={t('businessModel.report.extraCostsHint')} value={draft.extraCosts??0} onChange={value=>update({extraCosts:Number(value)})} suffix="SAR"/>
            <NumberInput label={t('businessModel.report.safetyIncidents')} help={t('businessModel.report.safetyIncidentsHint')} value={draft.safetyIncidents??0} onChange={value=>update({safetyIncidents:Number(value)})} suffix={t('businessModel.daily.unitShipments')}/>
            <NumberInput label={t('businessModel.report.newCustomerVisits')} help={t('businessModel.report.newCustomerVisitsHint')} value={draft.newCustomerVisits??0} onChange={value=>update({newCustomerVisits:Number(value)})} suffix={t('businessModel.daily.unitShipments')}/>
            <label className="bm-field"><span>{t('businessModel.report.weather')}</span><select aria-label={t('businessModel.report.weather')} value={draft.weatherCondition??'clear'} onChange={event=>update({weatherCondition:event.target.value as DailyRecord['weatherCondition']})}>{(['clear','rain','fog','sand'] as const).map(option=><option key={option} value={option}>{t(`businessModel.report.weather${option.charAt(0).toUpperCase()+option.slice(1)}`)}</option>)}</select></label>
          </div>
        </section>

        <section className="bm-form-card bm-day-card bm-notes-card">
          <h2><span>{t('businessModel.daily.cardNotes')}</span></h2>
          <label className="bm-notes"><span>{t('businessModel.daily.notes')}</span><textarea aria-label={t('businessModel.daily.notes')} value={draft.notes} onChange={event=>update({notes:event.target.value})} placeholder={t('businessModel.daily.notesPlaceholder')}/></label>
          <label className="bm-notes bm-tomorrow"><span>{t('businessModel.report.nextDayFocus')}</span><textarea aria-label={t('businessModel.report.nextDayFocus')} value={draft.tomorrowNote??''} onChange={event=>update({tomorrowNote:event.target.value})} placeholder={t('businessModel.report.nextDayFocusPlaceholder')}/></label>
          <button className="bm-primary" onClick={save}><Check size={15}/> {t('businessModel.daily.saveReport')}</button>
        </section>
      </div>

      <aside className="bm-day-side">
        <section className="bm-panel bm-scoreboard">
          <div className="bm-panel-head"><div><span>{t('businessModel.daily.scoreboardTag')}</span><h2>{t('businessModel.daily.scoreboardHead')}</h2></div></div>
          <strong className={`bm-score-big ${metrics.completionRate>=95?'good':metrics.recordedAttempts>0?'bad':''}`}>{metrics.completionRate.toFixed(1)}%</strong>
          <span className="bm-score-cap">{t('businessModel.daily.kpiCompletionRate')}</span>
          <div className="bm-progress-row"><i><b style={{width:`${targetProgress}%`}}/></i><small>{t('businessModel.daily.targetProgress',{percent:targetProgress})}</small></div>
          <dl className="bm-facts bm-facts-plain" style={{marginTop:14}}>
            <div><dt>{t('businessModel.daily.kpiPlanned')}</dt><dd>{num(metrics.plannedShipments)}</dd></div>
            <div><dt>{t('businessModel.daily.attempts')}</dt><dd>{num(attemptsToday)}</dd></div>
            <div><dt>{t('businessModel.daily.factRevenue')}</dt><dd>{money(metrics.revenue)}</dd></div>
            <div><dt>{t('businessModel.daily.factAllocatedCost')}</dt><dd>{money(metrics.allocatedCost)}</dd></div>
            <div><dt>{t('businessModel.daily.factFuelCost')}</dt><dd>{money(metrics.fuelCost)}</dd></div>
            <div><dt>{t('businessModel.daily.factProfitLoss')}</dt><dd className={metrics.profit<0?'text-bad':''}>{money(metrics.profit)}</dd></div>
          </dl>
          <p className="bm-calculation-note">{t('businessModel.daily.allocationNote')}</p>
        </section>
        <section className="bm-panel bm-checklist">
          <div className="bm-panel-head"><div><span>{t('businessModel.daily.scoreboardTag')}</span><h2>{dayChecks.filter(check=>check.ok).length}/{dayChecks.length}</h2></div></div>
          {dayChecks.map(check=>(
            <div key={check.label} className={`bm-check ${check.ok?'ok':'warn'}`}>
              <b>{check.ok?'✓':'⚠'}</b>
              <span>{check.label}<small>{check.detail}</small></span>
            </div>
          ))}
        </section>
      </aside>
    </div>
        {enabledProviders.length>0&&<section className="bm-panel bm-cust-breakdown">
      <div className="bm-panel-head"><div><h2>{t('businessModel.report.customerBreakdownTitle')}</h2><p className="bm-calculation-note">{t('businessModel.report.customerBreakdownDesc')}</p></div>
        <span className={`bm-recon ${attributedToday>draft.completedShipments?'bad':'ok'}`}>{t('businessModel.summary.shipmentsDay')}: {num(attributedToday)} / {num(draft.completedShipments)}</span></div>
      <div className="bm-table-wrap"><div className="bm-table bm-cust-break-table">
        <div className="bm-table-head"><span>{t('businessModel.customers.colCustomer')}</span><span>{t('businessModel.report.kpiDelivered')}</span><span>{t('businessModel.report.kpiMissed')}</span><span>{t('businessModel.report.colShare')}</span></div>
        {enabledProviders.map(provider=>{
          const cell=draft.customerBreakdown?.[provider.id];
          const attempts=(cell?.delivered??0)+(cell?.missed??0);
          return <div className="bm-table-row bm-cust-break-row" key={provider.id}>
            <strong>{provider.name}</strong>
            <CellNumber ariaLabel={`${provider.name} ${t('businessModel.report.kpiDelivered')}`} value={cell?.delivered??0} onChange={value=>setCustomerCell(provider.id,'delivered',value)}/>
            <CellNumber ariaLabel={`${provider.name} ${t('businessModel.report.kpiMissed')}`} value={cell?.missed??0} onChange={value=>setCustomerCell(provider.id,'missed',value)}/>
            <span className="bm-computed">{attempts>0?`${Math.round((cell?.delivered??0)/attempts*100)}%`:'—'}</span>
          </div>;})}
      </div></div>
    </section>}
    <section className="bm-panel bm-reasons-card">
      <div className="bm-panel-head"><div><span>{t('businessModel.risks.title')}</span><h2>{t('businessModel.report.missReasonsTitle')}</h2><p className="bm-calculation-note">{t('businessModel.report.missReasonsDesc')}</p></div>
        <span className={`bm-recon ${reasonsMismatch?'bad':'ok'}`} aria-live="polite">{reasonsSum} / {draft.failedShipments}{!reasonsMismatch&&draft.failedShipments>0?` ✓`:''}</span></div>
      <div className="bm-form-grid bm-reason-grid">
        {FAILURE_REASON_KEYS.map(key=><NumberInput key={key} label={t(`businessModel.report.${key}`)} value={draft.failureReasons?.[key]??0} onChange={value=>changeReason(key,value)} suffix={t('businessModel.daily.unitShipments')}/>)}
      </div>
      <p className={reasonsMismatch?'bm-calculation-note text-bad':'bm-calculation-note'}>{reasonsMismatch?t('businessModel.report.reasonsMismatch',{count:draft.failedShipments,sum:reasonsSum}):t('businessModel.report.reasonsOk')}</p>
    </section>
    <section className="bm-panel bm-export-card"><div><span>{t('businessModel.daily.exportTag')}</span><h2>{t('businessModel.daily.exportHead')}</h2><p>{t('businessModel.daily.exportDesc')}</p></div><div><button onClick={downloadExcel}><Download size={15}/> {t('businessModel.daily.exportExcel')}</button></div>{message&&<output aria-live="polite">{message}</output>}</section>
    <section className="bm-panel bm-report-history"><div className="bm-panel-head"><div><span>{t('businessModel.daily.historyTag')}</span><h2>{t('businessModel.daily.historyHead')}</h2></div></div>{Object.values(records).length?<div>{Object.values(records).sort((a,b)=>b.date.localeCompare(a.date)).map(record=><button key={record.date} onClick={()=>selectDate(record.date)}><span>{fmtDateMedium(locale,record.date)}</span><strong>{t('businessModel.daily.completedCount',{count:record.completedShipments})}</strong><small>{t('businessModel.daily.failedCount',{count:record.failedShipments})}</small></button>)}</div>:<p>{t('businessModel.daily.noHistory')}</p>}</section>
    <MonthlyVariance records={records} output={output} /></>;
}
function MonthlyTotals({input,output,fleetCount}:{input:FinancialInput;output:ReturnType<typeof useSimulatedData>['financialOutput'];fleetCount:number}) {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const money = (value: number, digits = 0) => fmtMoney(locale, value, digits);
  const num = (value: number) => fmtNum(locale, value);
  const s = t.bind(null);
  const driverPayroll=fleetCount*input.driverSalary; const opsPayroll=input.opsTeamCount*input.opsTeamAvgSalary; const salesPayroll=input.salesTeamCount*input.salesTeamBaseSalary; const warehousePayroll=input.warehouseStaff*input.warehouseStaffSalary; const otherPeople=Math.max(0,output.costBreakdown.people-driverPayroll-opsPayroll-salesPayroll-warehousePayroll); const vehicleNonFuel=Math.max(0,output.fleetMonthlyCost-output.fuelMonthlyCost);
  const B='businessModel.summary.';
  const rows=[{label:s(B+'rDrivers'),formula:`${fleetCount} × ${money(input.driverSalary)}`,total:driverPayroll},{label:s(B+'rOpsTeam'),formula:`${input.opsTeamCount} × ${money(input.opsTeamAvgSalary)}`,total:opsPayroll},{label:s(B+'rSalesTeam'),formula:`${input.salesTeamCount} × ${money(input.salesTeamBaseSalary)}`,total:salesPayroll},{label:s(B+'rWarehouse'),formula:`${input.warehouseStaff} × ${money(input.warehouseStaffSalary)}`,total:warehousePayroll},{label:s(B+'rOtherPeople'),formula:s(B+'rOtherPeopleFormula'),total:otherPeople},{label:s(B+'rFuel'),formula:s(B+'rFuelFormula',{fleet:fleetCount,price:money(input.fuelPricePerLiter,2)}),total:output.fuelMonthlyCost},{label:s(B+'rVehicles'),formula:s(B+'rVehiclesFormula',{fleet:fleetCount}),total:vehicleNonFuel},{label:s(B+'rFacilities'),formula:s(B+'rFacilitiesFormula'),total:output.costBreakdown.facilities},{label:s(B+'rPerShipment'),formula:s(B+'rPerShipmentFormula',{count:num(output.totalMonthlyShipments)}),total:output.costBreakdown.perShipment},{label:s(B+'rOther'),formula:s(B+'rOtherFormula'),total:output.costBreakdown.other}];
  return <section className="bm-panel bm-monthly-totals"><div className="bm-panel-head"><div><span>{s(B+'totalsTag')}</span><h2>{s(B+'totalsHead')}</h2></div><strong>{money(output.totalCost)}</strong></div><div className="bm-total-rows">{rows.map(row=><div key={row.label}><span><strong>{row.label}</strong><small>{row.formula}</small></span><b>{money(row.total)}</b></div>)}</div><div className="bm-total-result"><span><small>{s(B+'totalRevenue')}</small><strong>{money(output.totalRevenue)}</strong></span><span><small>{s(B+'totalCost')}</small><strong>{money(output.totalCost)}</strong></span><span className={output.netMargin<0?'bad':'good'}><small>{s(B+'totalProfitLoss')}</small><strong>{money(output.netMargin)}</strong></span></div></section>; }
function Summary({ output,input,fleetCount,driverGap,contribution,risks,onNavigate }: { output:ReturnType<typeof useSimulatedData>['financialOutput']; input:FinancialInput; fleetCount:number; driverGap:number; contribution:number; risks:RiskItem[]; onNavigate:(view:View)=>void }) {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const money = (value: number, digits = 0) => fmtMoney(locale, value, digits);
  const num = (value: number) => fmtNum(locale, value);
  const B='businessModel.';
  const categories = Object.entries(output.costBreakdown).filter(([key]) => !['costPerShipment','total'].includes(key)) as [string,number][];
  const catLabels:Record<string,string>={vehicleOwnership:t(B+'summary.catVehicleOwnership'),vehicleRunning:t(B+'summary.catVehicleRunning'),people:t(B+'summary.catPeople'),facilities:t(B+'summary.catFacilities'),perShipment:t(B+'summary.catPerShipment'),other:t(B+'summary.catOther')};
  return <><div className="bm-page-head bm-summary-head"><div><h1>{t(B+'summary.bizTitle')}</h1><p>{t(B+'summary.bizSubtitle')}</p></div><button onClick={() => onNavigate('costs')}><Settings2 size={15}/> {t(B+'summary.editAssumptions')}</button></div><section className="bm-kpis"><Kpi label={t(B+'summary.kpiRevenue')} value={money(output.totalRevenue)} /><Kpi label={t(B+'summary.kpiCost')} value={money(output.totalCost)} /><Kpi label={t(B+'summary.kpNetResult')} value={money(output.netMargin)} tone={output.netMargin < 0 ? 'bad':'good'} /><Kpi label={t(B+'summary.kpiCostShipment')} value={money(output.costPerShipment,2)} /></section><div className="bm-two-col"><section className="bm-panel"><h2>{t(B+'summary.opModel')}</h2><dl className="bm-facts"><div><dt>{t(B+'summary.drivers')}</dt><dd><button onClick={() => onNavigate('drivers')}>{input.companyDriverCount}</button></dd></div><div><dt>{t(B+'summary.vehicles')}</dt><dd><button onClick={() => onNavigate('fleet')}>{fleetCount}</button></dd></div><div><dt>{t(B+'summary.shipmentsDay')}</dt><dd><button onClick={() => onNavigate('customers')}>{num(output.totalDailyShipments)}</button></dd></div><div><dt>{t(B+'summary.revPerShipment')}</dt><dd>{money(output.avgRevenuePerShipment,2)}</dd></div><div><dt>{t(B+'summary.variableContribution')}</dt><dd>{money(contribution,2)}</dd></div><div><dt>{t(B+'summary.driverCoverage')}</dt><dd className={driverGap < 0 ? 'text-bad':''}>{driverGap < 0 ? t(B+'summary.short',{count:Math.abs(driverGap)}) : t(B+'summary.spare',{count:driverGap})}</dd></div></dl></section><section className="bm-panel"><h2>{t(B+'summary.costBreakdown')}</h2><div className="bm-cost-bars">{categories.map(([key,value]) => <div key={key}><span>{catLabels[key]}</span><i><b style={{width:`${Math.max(2,value/Math.max(1,output.totalCost)*100)}%`}} /></i><strong>{money(value)}</strong></div>)}</div></section></div><section className="bm-panel bm-summary-risks"><div className="bm-panel-head"><h2>{t(B+'summary.problemsToFix')}</h2><button onClick={() => onNavigate('risks')}>{t(B+'summary.viewRiskDetails')}</button></div>{risks.filter(r => r.level !== 'controlled').map(risk => <div key={risk.titleKey}><span>{t(`businessModel.risks.level${risk.level.charAt(0).toUpperCase()}${risk.level.slice(1)}`)}</span><strong>{t(`businessModel.risks.${risk.titleKey}`)}</strong><p>{risk.detail}</p></div>)}</section></>; }
function Kpi({label,value,tone}:{label:string;value:string;tone?:string}) { return <article className={tone ?? ''}><span>{label}</span><strong>{value}</strong></article>; }
// Draft-holding inputs: a null draft means "not editing" so the field always
// mirrors the external value (fleet-sync updates can never go stale). While
// the user is mid-edit their text wins until blur commits it.
function NumberInput({label,value,onChange,suffix,help}:{label:string;value:number;onChange:(value:string)=>void;suffix:string;help?:string}) { const [draft,setDraft]=useState<string|null>(null); const commit=()=>{if(draft===null)return;const parsed=Math.max(0,Number(draft)||0);onChange(String(parsed));setDraft(null);}; return <label className="bm-field"><span>{label}</span><div><input name={label.toLowerCase().replaceAll(' ','-')} type="number" min="0" inputMode="decimal" value={draft??String(value)} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}} /><em>{suffix}</em></div>{help&&<small>{help}</small>}</label>; }
function Readout({label,value,tone}:{label:string;value:string;tone?:string}) { return <div className={`bm-readout ${tone??''}`}><span>{label}</span><strong>{value}</strong></div>; }
function EditableTable({columns,children}:{columns:string[];children:React.ReactNode}) { return <div className="bm-table-wrap"><div className="bm-table"><div className="bm-table-head">{columns.map((column,index)=><span key={`${column}-${index}`}>{column}</span>)}</div>{children}</div></div>; }
function TextInput({ariaLabel,value,onChange}:{ariaLabel:string;value:string;onChange:(value:string)=>void}) { return <input className="bm-cell-input" aria-label={ariaLabel} name={ariaLabel.replaceAll(' ','-')} autoComplete="off" value={value} onChange={e=>onChange(e.target.value)} />; }
function CellNumber({ariaLabel,value,onChange,step='1'}:{ariaLabel:string;value:number;onChange:(value:number)=>void;step?:string}) { const [draft,setDraft]=useState<string|null>(null); const commit=()=>{if(draft===null)return;const parsed=Math.max(0,Number(draft)||0);onChange(parsed);setDraft(null);}; return <input className="bm-cell-input number" aria-label={ariaLabel} name={ariaLabel.replaceAll(' ','-')} type="number" min="0" step={step} inputMode="decimal" value={draft??String(value)} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}} />; }
function CostSections({input,output,setNumber,changeVehicle}:{input:FinancialInput;output:ReturnType<typeof useSimulatedData>['financialOutput'];setNumber:(field:NumberField,value:string)=>void;changeVehicle:(id:string,patch:Partial<VehicleClass>)=>void}) {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const money = (value: number, digits = 0) => fmtMoney(locale, value, digits);
  const C='businessModel.costs.';
  const SUFFIX_BY_FIELD: Record<string, string> = { driverSalary: 'sarDriverMonth', opsTeam: 'peopleUnit', salesTeam: 'peopleUnit', warehouseStaff: 'peopleUnit', packaging: 'sarShipment', pickPack: 'sarShipment', labelsDocs: 'sarShipment', returnHandling: 'sarReturn', failedDeliveryCost: 'sarFailure' };
  const rawGroups: { title: string; fields: [string, NumberField, string][] }[] = [
    { title: t(C + 'groupPeople'), fields: [
      ['driverSalary', 'driverSalary', ''], ['opsTeam', 'opsTeamCount', ''], ['opsSalary', 'opsTeamAvgSalary', ''],
      ['salesTeam', 'salesTeamCount', ''], ['salesSalary', 'salesTeamBaseSalary', ''], ['warehouseStaff', 'warehouseStaff', ''], ['warehouseSalary', 'warehouseStaffSalary', ''],
    ] },
    { title: t(C + 'groupFacilities'), fields: [
      ['warehouseRent', 'warehouseRent', ''], ['warehouseUtilities', 'warehouseUtilities', ''], ['officeRent', 'officeRent', ''],
      ['internet', 'internetCost', ''], ['electricity', 'electricityCost', ''], ['software', 'technologySaaS', ''],
    ] },
    { title: t(C + 'groupPerShipment'), fields: [
      ['packaging', 'packagingCostPerUnit', ''], ['pickPack', 'pickPackLaborPerOrder', ''], ['labelsDocs', 'labelsAndDocs', ''],
      ['returnHandling', 'returnLogisticsCost', ''], ['failedDeliveryRate', 'failedDeliveryRate', '%'], ['failedDeliveryCost', 'failedDeliveryCost', ''],
      ['returnRate', 'returnRate', '%'], ['paymentDelay', 'clientPaymentDelay', 'days'],
    ] },
    { title: t(C + 'groupOther'), fields: [
      ['marketing', 'marketingBudget', ''], ['accountingLegal', 'accountingLegal', ''], ['misc', 'miscExpenses', ''],
    ] },
  ];
  const groups = rawGroups.map(group => ({
    title: group.title,
    fields: group.fields.map(([labelKey, field, suffixKey]): [string, NumberField, string] => {
      const suffix = suffixKey === '%' || suffixKey === 'days' ? suffixKey : t(C + (SUFFIX_BY_FIELD[labelKey] ?? 'sarMonth'));
      return [t(C + labelKey), field, suffix];
    }),
  }));
  // Live per-row economics — formulas mirror calculations.ts exactly so the
  // computed columns always reconcile with the model readouts.
  const classFuelSar = (vehicle: VehicleClass): number => {
    const eff = vehicle.fuelEfficiency || input.fuelEfficiencyL100km;
    const dist = vehicle.avgDailyDistance || input.avgDistancePerVehiclePerDay;
    return vehicle.quantity * (dist / 100) * eff * input.fuelPricePerLiter * 26;
  };
  const classTotalSar = (vehicle: VehicleClass): number =>
    vehicle.quantity * vehicle.monthlyRent + vehicle.quantity * vehicle.variableCost + classFuelSar(vehicle);

  return <div className="bm-cost-sections">
    <section className="bm-form-card bm-vehicles-card">
      <div className="bm-panel-head"><h2>{t(C+'groupVehicles')}</h2><span className="bm-vehicles-total">{t('businessModel.summary.totalCost')}: <strong>{money(output.fleetMonthlyCost)}</strong></span></div>
      <p className="bm-calculation-note">{t(C+'computedNote')}</p>
      <div className="bm-form-grid bm-fuel-grid">
        <NumberInput label={t(C+'fuelPrice')} value={input.fuelPricePerLiter} onChange={value=>setNumber('fuelPricePerLiter',value)} suffix={t(C+'sarLitre')} />
        <Readout label={t(C+'fuelCostMonth')} value={money(output.fuelMonthlyCost)} />
        <Readout label={t(C+'totalFleetCost')} value={money(output.fleetMonthlyCost)} tone="good" />
      </div>
      <EditableTable columns={[t('businessModel.fleet.colVehicleType'),t('businessModel.fleet.colQuantity'),t('businessModel.fleet.rentVehicleMonth'),t('businessModel.fleet.colInsurance'),t('businessModel.fleet.fuelUse100'),t('businessModel.fleet.colDistanceDay'),t(C+'colFuelSar'),t(C+'colRowTotal')]}>
        {input.vehicleClasses.map(vehicle=>{
          const fuel=classFuelSar(vehicle);
          return <div className="bm-table-row bm-cost-vehicle-row" key={vehicle.id}>
            <strong>{vehicle.name}</strong>
            <CellNumber ariaLabel={`${vehicle.name} ${t('businessModel.fleet.colQuantity')}`} value={vehicle.quantity} onChange={value=>changeVehicle(vehicle.id,{quantity:value})}/>
            <CellNumber ariaLabel={`${vehicle.name} ${t('businessModel.fleet.rentVehicleMonth')}`} value={vehicle.monthlyRent} onChange={value=>changeVehicle(vehicle.id,{monthlyRent:value})}/>
            <CellNumber ariaLabel={`${vehicle.name} ${t('businessModel.fleet.colInsurance')}`} value={vehicle.variableCost} onChange={value=>changeVehicle(vehicle.id,{variableCost:value})}/>
            <CellNumber ariaLabel={`${vehicle.name} ${t('businessModel.fleet.fuelUse100')}`} value={vehicle.fuelEfficiency} step="0.1" onChange={value=>changeVehicle(vehicle.id,{fuelEfficiency:value})}/>
            <CellNumber ariaLabel={`${vehicle.name} ${t('businessModel.fleet.colDistanceDay')}`} value={vehicle.avgDailyDistance} onChange={value=>changeVehicle(vehicle.id,{avgDailyDistance:value})}/>
            <span className="bm-computed">{money(fuel)}</span>
            <strong className="bm-computed total">{money(classTotalSar(vehicle))}</strong>
          </div>;})}
      </EditableTable>
    </section>{groups.map(group=>{
          const breakdownKey = ({ [t(C+'groupPeople')]: 'people', [t(C+'groupFacilities')]: 'facilities', [t(C+'groupPerShipment')]: 'perShipment', [t(C+'groupOther')]: 'other' } as Record<string,string>)[group.title] ?? 'other';
          const subtotal = output.costBreakdown[breakdownKey as keyof typeof output.costBreakdown] ?? 0;
          const share = output.totalCost > 0 ? subtotal / output.totalCost * 100 : 0;
          return <section className="bm-form-card bm-cost-group" key={group.title}>
            <h2>{group.title}</h2>
            <div className="bm-form-grid">{group.fields.map(([label,field,suffix])=><NumberInput key={field} label={label} value={Number(input[field]??0)} onChange={value=>setNumber(field,value)} suffix={suffix}/>)}</div>
            <div className="bm-group-total">
              <span>{t(C+'sectionTotal')}</span>
              <i><b style={{width:`${Math.max(1.5,Math.min(100,share))}%`}}/></i>
              <strong>{money(subtotal)}</strong>
              <small>{t(C+'ofCosts',{percent:share.toFixed(0)})}</small>
            </div>
          </section>;})}</div>; }
export function BackupBanner({ reason, days, onCta, onDismiss }: { reason: 'never'|'stale'|'invalid'|'future'|'fresh'|'no-data'; days: number|null; onCta: () => void; onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="bm-backup-banner" role="status" aria-live="polite" data-testid="backup-banner" data-reason={reason}>
      <span className="bm-backup-banner-text">
        {reason === 'never'
          ? t('businessModel.daily.bannerBodyNever')
          : reason === 'invalid'
            ? t('businessModel.daily.bannerBodyInvalid')
            : t('businessModel.daily.bannerBodyStale', { days: days ?? 0 })}
      </span>
      <button className="bm-primary" data-testid="banner-cta" onClick={onCta}>{t('businessModel.daily.bannerCta')}</button>
      <button data-testid="banner-dismiss" aria-label={t('businessModel.daily.bannerDismiss')} onClick={onDismiss}>{t('businessModel.daily.bannerDismiss')}</button>
    </div>
  );
}

export function ScenarioView({input,output,scenarios,setScenarios,dailyRecords,setDailyRecords,recoveryEntries,setRecoveryEntries,actions,setActions,applyFinancialInput,onBackedUp}:{input:FinancialInput;output:ReturnType<typeof useSimulatedData>['financialOutput'];scenarios:Scenario[];setScenarios:(value:Scenario[]|((prev:Scenario[])=>Scenario[]))=>void;dailyRecords:Record<string,DailyRecord>;setDailyRecords:(value:Record<string,DailyRecord>|((prev:Record<string,DailyRecord>)=>Record<string,DailyRecord>))=>void;recoveryEntries:RecoveryEntry[];setRecoveryEntries:(value:RecoveryEntry[]|((prev:RecoveryEntry[])=>RecoveryEntry[]))=>void;actions:FollowUpAction[];setActions:(value:FollowUpAction[]|((prev:FollowUpAction[])=>FollowUpAction[]))=>void;applyFinancialInput:(next:FinancialInput)=>void;onBackedUp:()=>void}) {
  const { t, i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  const money = (value: number, digits = 0) => fmtMoney(locale, value, digits);
  const S='businessModel.scenarios.';
  const [name,setName]=useState('');
  const [message,setMessage]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);
  const save=()=>{ setScenarios(prev=>[...prev, createScenario(name,input,prev)]); setName(''); setMessage(t(S+'savedMessage')); };
  const load=(scenario:Scenario)=>{ applyFinancialInput(structuredClone(scenario.input)); setMessage(t(S+'loadedMessage',{name:scenario.name})); };
  const remove=(id:string)=>setScenarios(prev=>prev.filter(s=>s.id!==id));
  const [pendingImport,setPendingImport]=useState<{file:BackupFileV2;migratedFrom?:1;warnings:string[];lossless:boolean;contentLoss?:boolean}|null>(null);
  const bundle={financialInput:input,dailyRecords,scenarios,recoveryEntries,followUpActions:actions};
  const previewStats=useMemo(()=>{
    if(!pendingImport) return null;
    return applyBackupMerge({financialInput:input,dailyRecords,scenarios,recoveryEntries,followUpActions:actions},pendingImport.file).stats;
  },[pendingImport,input,dailyRecords,scenarios,recoveryEntries,actions]);
  const activeLanguage = i18n.language === 'ar' ? 'ar' : 'en';
  const downloadBackup=()=>{
    const backup=buildBackup(bundle,activeLanguage);
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url; anchor.download=`vega-backup-v2-${toDateString(new Date())}.json`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    onBackedUp(); // reminder metadata written here only — never inside backup files
    setMessage(t(S+'backupDownloaded'));
  };
  const importBackup=async(file:File)=>{
    const text=await file.text();
    const parsed=parseBackup(text);
    if(!parsed.ok){ setMessage(t(S+'importFailed')); return; }
    setMessage('');
    setPendingImport({file:parsed.file,migratedFrom:parsed.migratedFrom,warnings:parsed.warnings,lossless:parsed.lossless,contentLoss:parsed.contentLoss});
  };
  // Transactional restore (review contract E-4): storage FIRST via
  // commitBundle (snapshot -> attempt all -> rollback on any failure);
  // React state and language flip ONLY after a fully successful write.
  // On failure the preview stays open so the user can retry or cancel.
  const finishOk=(result:PersistResult,successMessage:string)=>{
    if(result.persistedOk){ setPendingImport(null); setMessage(successMessage); return; }
    if(!result.rollbackOk) setMessage(t(S+'rollbackCriticalMessage',{keys:[...result.failedKeys,...result.rollbackFailedKeys].join(', ')}));
    else setMessage(t(S+'partialFailMessage',{keys:result.failedKeys.join(', ')}));
  };
  const applyState=(next:ReturnType<typeof applyBackupMerge>['next'])=>{
    applyFinancialInput(next.financialInput);
    setDailyRecords(next.dailyRecords); setScenarios(next.scenarios);
    setRecoveryEntries(next.recoveryEntries); setActions(next.followUpActions);
  };
  const switchLanguageIfAny=(lang?:string)=>{ if(lang){ void i18n.changeLanguage(lang); window.dispatchEvent(new CustomEvent('vega:set-language',{detail:lang})); } };
  const doMerge=()=>{
    if(!pendingImport) return;
    const {next}=applyBackupMerge(bundle,pendingImport.file);
    // merge keeps current model inputs AND current language — only the five data keys are written
    const result=commitBundle({financialInput:next.financialInput,dailyRecords:next.dailyRecords,scenarios:next.scenarios,recoveryEntries:next.recoveryEntries,followUpActions:next.followUpActions},undefined,{keys:['financialInput','dailyRecords','scenarios','recoveryEntries','followUpActions']});
    if(!result.persistedOk){ finishOk(result,''); return; }
    applyState(next);
    finishOk(result,t(S+'mergeDoneMessage'));
  };
  const doReplace=()=>{
    if(!pendingImport||!pendingImport.lossless) return;
    const next=replaceWithBackup(bundle,pendingImport.file);
    const lang=pendingImport.file.data.language;
    const result=commitBundle(next,lang);
    if(!result.persistedOk){ finishOk(result,''); return; }
    applyState(next); switchLanguageIfAny(lang);
    finishOk(result,t(S+'replaceDoneMessage',{date:fmtDateMedium(locale,pendingImport.file.exportedAt||new Date().toISOString())}));
  };
  const doLegacyScope=()=>{
    if(!pendingImport||pendingImport.migratedFrom!==1||pendingImport.contentLoss) return;
    const {next}=applyLegacyScopedRestore(bundle,pendingImport.file);
    // adopt ONLY v1 scope: model input, days, scenarios — recovery entries,
    // follow-up actions and language are preserved untouched (E-2)
    const result=commitBundle({financialInput:next.financialInput,dailyRecords:next.dailyRecords,scenarios:next.scenarios},undefined,{keys:['financialInput','dailyRecords','scenarios']});
    if(!result.persistedOk){ finishOk(result,''); return; }
    applyFinancialInput(next.financialInput);
    setDailyRecords(next.dailyRecords); setScenarios(next.scenarios);
    finishOk(result,t(S+'scopedDoneMessage',{days:Object.keys(next.dailyRecords).length}));
  };
  return <><div className="bm-page-head"><h1>{t(S+'title')}</h1><p>{t(S+'desc')}</p></div>
    <section className="bm-form-card bm-scenario-save"><h2>{t(S+'saveHead')}</h2><div className="bm-scenario-save-row"><input aria-label={t(S+'scenarioName')} placeholder={t(S+'namePlaceholder')} value={name} maxLength={60} onChange={event=>setName(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')save();}} /><button className="bm-primary" onClick={save}><Plus size={15}/> {t(S+'saveBtn')}</button></div>{message&&<output aria-live="polite">{message}</output>}</section>
    <section className="bm-panel"><div className="bm-panel-head"><div><span>{t(S+'listTag')}</span><h2>{scenarios.length ? t(S+'snapshots',{count:scenarios.length}) : t(S+'noneYet')}</h2></div></div>
      {scenarios.length>0 && <div className="bm-table-wrap"><div className="bm-table"><div className="bm-table-head"><span>{t(S+'thScenario')}</span><span>{t(S+'thSaved')}</span><span>{t(S+'thRevenueMo')}</span><span>{t(S+'thCostMo')}</span><span>{t(S+'thNetMo')}</span><span>{t(S+'thMargin')}</span><span>{t(S+'thDelta')}</span><span></span></div>
        {scenarios.map(scenario=>{
          const s=calculateFinancials(scenario.input);
          const delta=output.netMargin-s.netMargin;
          return <div className="bm-table-row bm-scenario-row" key={scenario.id}>
            <strong>{scenario.name}</strong>
            <span>{fmtDateMedium(locale,scenario.savedAt)}</span>
            <span>{money(s.totalRevenue)}</span><span>{money(s.totalCost)}</span><span className={s.netMargin<0?'text-bad':''}>{money(s.netMargin)}</span><span>{s.netMarginPercent.toFixed(1)}%</span>
            <span className={delta>=0?'':'text-bad'}>{delta>=0?'+':''}{money(Math.abs(delta))} {delta>=0?t(S+'better'):t(S+'worse')}</span>
            <span className="bm-scenario-actions"><button onClick={()=>load(scenario)}>{t('businessModel.common.load')}</button><button aria-label={t(S+'deleteAria',{name:scenario.name})} onClick={()=>remove(scenario.id)}><Trash2 size={14}/></button></span>
          </div>;})}
      </div></div>}
      {scenarios.length===0 && <p>{t(S+'emptyHint')}</p>}
    </section>
    <section className="bm-panel bm-export-card" id="bm-backup-card" tabIndex={-1}><div><span>{t(S+'backupTag')}</span><h2>{t(S+'backupHead')}</h2><p>{t(S+'backupDesc')}</p></div>
      <div><button onClick={downloadBackup}><Download size={15}/> {t(S+'downloadBackup')}</button><button onClick={()=>fileRef.current?.click()}><Upload size={15}/> {t(S+'importBackup')}</button><input ref={fileRef} type="file" accept="application/json,.json" style={{display:'none'}} aria-label={t(S+'importFileAria')} onChange={event=>{const file=event.target.files?.[0]; if(file) void importBackup(file); event.target.value='';}} /></div>
      {pendingImport&&<div className="bm-import-preview" data-testid="import-preview">
        <h3>{t(S+'previewHead')}</h3>
        {pendingImport.migratedFrom===1&&<p className="bm-import-note" data-testid="legacy-note">{t(S+'legacyNote')}</p>}
        {pendingImport.migratedFrom===1&&pendingImport.contentLoss&&<p className="bm-import-warning" data-testid="corrupt-legacy-warning">{t(S+'corruptLegacyWarning')}</p>}
        {!pendingImport.lossless&&<p className="bm-import-warning" data-testid="import-warning">{t(S+'droppedWarning')}</p>}
        <dl className="bm-import-counts">
          <div><dt>{t(S+'countDays')}</dt><dd>{Object.keys(pendingImport.file.data.dailyRecords).length}</dd></div>
          <div><dt>{t(S+'countScenarios')}</dt><dd>{pendingImport.file.data.scenarios.length}</dd></div>
          <div><dt>{t(S+'countRecovery')}</dt><dd>{pendingImport.file.data.recoveryEntries.length}</dd></div>
          <div><dt>{t(S+'countActions')}</dt><dd>{pendingImport.file.data.followUpActions.length}</dd></div>
        </dl>
        <p className="bm-import-note">{t(S+'keptInputsNote')}</p>
        <div className="bm-import-choices">
          <button className="bm-primary" data-testid="import-merge" onClick={doMerge}>{t(S+'mergeBtn')}</button>
          <button data-testid="import-replace" onClick={doReplace} disabled={!pendingImport.lossless} title={!pendingImport.lossless?t(S+'droppedWarning'):undefined}>{t(S+'replaceBtn')}</button>
          {pendingImport.migratedFrom===1&&<button data-testid="import-legacy" onClick={doLegacyScope} disabled={!!pendingImport.contentLoss}>{t(S+'legacyScopeBtn')}</button>}
          <button data-testid="import-cancel" onClick={()=>{setPendingImport(null);setMessage('');}}>{t(S+'cancelBtn')}</button>
        </div>
        {previewStats&&<p className="bm-import-stats">{t(S+'previewStats',{added:previewStats.added,updated:previewStats.updated,conflicts:previewStats.conflicts})}</p>}
      </div>}
    </section></>;
}
