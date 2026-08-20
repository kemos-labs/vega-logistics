'use client';

import { createContext, useContext, ReactNode, useMemo, useCallback, useEffect, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { AuthUser, Driver, FleetRole, Job, JobPriority } from './types2026';
import { generateFleetSnapshot, FleetSnapshot } from './engines/mockData50';
import { calculateFleetKPIs, FleetKPIs } from './engines/kpi50';
import { createOperationsApiDataSource, DataMode, simulationFreshness } from './platform/data-source';

interface AppContext50 {
  auth: AuthUser;
  switchRole: (role: FleetRole) => void;
  snapshot: FleetSnapshot;
  kpis: FleetKPIs;
  refreshKey: number;
  dataMode: DataMode;
  freshness: ReturnType<typeof simulationFreshness>;
  plan: FleetPlan;
  updatePlan: (patch: Partial<FleetPlan>) => void;
  addDriver: (input: NewDriverInput) => void;
  updateDriver: (id: string, patch: Partial<Driver>) => void;
  addJob: (input: { customerId?: string; priority?: JobPriority; pieces?: number }) => void;
  updateJob: (id: string, patch: Partial<Job>) => void;
  refresh: () => void;
}

export interface FleetPlan {
  fleetSize: number;
  dailyDeliveryTarget: number;
  revenuePerDelivery: number;
  fuelPricePerLiter: number;
  activeDriverTarget: number;
}

export type NewDriverInput = Pick<Driver, 'fullName' | 'phone' | 'iqamaNo' | 'licenseNo'>;

const ROLE_PRESETS: Record<FleetRole, AuthUser> = {
  super_admin: { id: 'u-admin', email: 'admin@vega.sa', fullName: 'Yousef Al-Otaibi', role: 'super_admin', tenantId: 'tenant-vega', avatarColor: '#a855f7' },
  fleet_manager: { id: 'u-fm', email: 'fleet.mgr@vega.sa', fullName: 'Faisal Al-Harbi', role: 'fleet_manager', tenantId: 'tenant-vega', avatarColor: '#3b82f6' },
  dispatcher: { id: 'u-disp', email: 'dispatch@vega.sa', fullName: 'Nasser Al-Dosari', role: 'dispatcher', tenantId: 'tenant-vega', avatarColor: '#06b6d4' },
  driver: { id: 'u-drv-001', email: 'driver@vega.sa', fullName: 'Ahmed Al-Rashid', role: 'driver', tenantId: 'tenant-vega', avatarColor: '#22c55e' },
  warehouse_operator: { id: 'u-wh', email: 'warehouse@vega.sa', fullName: 'Khalid Al-Qahtani', role: 'warehouse_operator', tenantId: 'tenant-vega', avatarColor: '#f97316' },
  maintenance_tech: { id: 'u-mt', email: 'maintenance@vega.sa', fullName: 'Mohammed Al-Shammari', role: 'maintenance_tech', tenantId: 'tenant-vega', avatarColor: '#eab308' },
  customer_support: { id: 'u-cs', email: 'support@vega.sa', fullName: 'Sultan Al-Ghamdi', role: 'customer_support', tenantId: 'tenant-vega', avatarColor: '#06b6d4' },
  executive: { id: 'u-exec', email: 'ceo@vega.sa', fullName: 'Bandar Al-Anazi', role: 'executive', tenantId: 'tenant-vega', avatarColor: '#a855f7' },
};

const Ctx = createContext<AppContext50 | null>(null);

const DEFAULT_PLAN: FleetPlan = {
  fleetSize: 50,
  dailyDeliveryTarget: 500,
  revenuePerDelivery: 8,
  fuelPricePerLiter: 2.18,
  activeDriverTarget: 50,
};

export function AppProvider50({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useLocalStorage<AuthUser>('vega-auth', ROLE_PRESETS.executive);
  const [refreshKey, setRefreshKey] = useLocalStorage<number>('vega-refreshKey', 0);
  const [plan, setPlan] = useLocalStorage<FleetPlan>('vega-plan-v1', DEFAULT_PLAN);
  const [driverPatches, setDriverPatches] = useLocalStorage<Record<string, Partial<Driver>>>('vega-driver-patches-v1', {});
  const [addedDrivers, setAddedDrivers] = useLocalStorage<Driver[]>('vega-added-drivers-v1', []);
  const [jobPatches, setJobPatches] = useLocalStorage<Record<string, Partial<Job>>>('vega-job-patches-v1', {});
  const [addedJobs, setAddedJobs] = useLocalStorage<Job[]>('vega-added-jobs-v1', []);
  const dataMode: DataMode = 'simulation';
  const [freshness, setFreshness] = useState(() => simulationFreshness());
  const [apiSnapshot, setApiSnapshot] = useState<FleetSnapshot | null>(null);
  const operationsSource = useMemo(
    () => createOperationsApiDataSource<FleetSnapshot, FleetKPIs>(`/api/v1/operations/snapshot?seed=${42 + refreshKey}`, 'simulation'),
    [refreshKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    operationsSource.getSnapshot(controller.signal)
      .then((model) => {
        setApiSnapshot(model.snapshot);
        setFreshness(model.freshness);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFreshness(simulationFreshness());
      });
    return () => controller.abort();
  }, [operationsSource]);

  const snapshot = useMemo(() => {
    const generated = apiSnapshot ?? generateFleetSnapshot(42 + refreshKey);
    const drivers = [
      ...generated.drivers.map((driver) => ({ ...driver, ...(driverPatches[driver.id] ?? {}) })),
      ...addedDrivers,
    ];
    return {
      ...generated,
      vehicles: generated.vehicles.slice(0, Math.max(1, Math.min(50, Math.round(plan.fleetSize)))),
      drivers,
      jobs: [
        ...generated.jobs.map((job) => ({ ...job, ...(jobPatches[job.id] ?? {}) })),
        ...addedJobs,
      ],
    };
  }, [apiSnapshot, refreshKey, plan.fleetSize, driverPatches, addedDrivers, jobPatches, addedJobs]);
  const kpis = useMemo(() => calculateFleetKPIs(snapshot), [snapshot]);

  const switchRole = useCallback((role: FleetRole) => {
    setAuth(ROLE_PRESETS[role]);
  }, [setAuth]);

  const updatePlan = useCallback((patch: Partial<FleetPlan>) => {
    setPlan((current) => ({ ...current, ...patch }));
  }, [setPlan]);

  const addDriver = useCallback((input: NewDriverInput) => {
    const id = `DRV-DEMO-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const newDriver: Driver = {
      id,
      fullName: input.fullName.trim() || 'New driver',
      phone: input.phone.trim(),
      iqamaNo: input.iqamaNo.trim(),
      licenseNo: input.licenseNo.trim(),
      iqamaExpiry: new Date(Date.now() + 180 * 86400000).toISOString(),
      licenseExpiry: new Date(Date.now() + 180 * 86400000).toISOString(),
      licenseClass: 'B',
      status: 'available',
      depotId: 'DEPOT-RYD-01',
      hireDate: now,
      photoColor: '#b8e34b',
      rating: 0,
      totalTrips: 0,
      safetyScore: 100,
      onTimeRate: 1,
      fuelEfficiencyScore: 100,
      totalKmThisMonth: 0,
      totalHoursThisMonth: 0,
    };
    setAddedDrivers((current) => [newDriver, ...current]);
  }, [setAddedDrivers]);

  const updateDriver = useCallback((id: string, patch: Partial<Driver>) => {
    setAddedDrivers((current) => current.map((driver) => driver.id === id ? { ...driver, ...patch } : driver));
    setDriverPatches((current) => ({ ...current, [id]: { ...(current[id] ?? {}), ...patch } }));
  }, [setAddedDrivers, setDriverPatches]);

  const addJob = useCallback((input: { customerId?: string; priority?: JobPriority; pieces?: number }) => {
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 90 * 60 * 1000);
    const id = `JOB-DEMO-${Date.now().toString(36)}`;
    const job: Job = {
      id,
      ref: `JOB-SIM-${String(Date.now()).slice(-6)}`,
      customerId: input.customerId ?? 'CUS-001',
      type: 'delivery',
      status: 'unassigned',
      priority: input.priority ?? 'normal',
      weightKg: 1,
      volumeM3: 0.02,
      pieces: Math.max(1, input.pieces ?? 1),
      serviceWindowStart: start.toISOString(),
      serviceWindowEnd: end.toISOString(),
      totalDistanceKm: 12,
      totalDurationMin: 35,
      estimatedCostSar: 18,
      notes: 'Created in local simulation',
      requiresColdChain: false,
      requiresSignature: true,
      specialHandling: [],
      createdAt: now.toISOString(),
      createdBy: 'simulation-user',
    };
    setAddedJobs((current) => [job, ...current]);
  }, [setAddedJobs]);

  const updateJob = useCallback((id: string, patch: Partial<Job>) => {
    setAddedJobs((current) => current.map((job) => job.id === id ? { ...job, ...patch } : job));
    setJobPatches((current) => ({ ...current, [id]: { ...(current[id] ?? {}), ...patch } }));
  }, [setAddedJobs, setJobPatches]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setFreshness(simulationFreshness());
  }, [setRefreshKey]);

  return (
    <Ctx.Provider value={{ auth, switchRole, snapshot, kpis, refreshKey, dataMode, freshness, plan, updatePlan, addDriver, updateDriver, addJob, updateJob, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp50(): AppContext50 {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp50 must be used within AppProvider50');
  return c;
}

export const ROLE_LABELS: Record<FleetRole, { en: string; ar: string; icon: string }> = {
  super_admin: { en: 'Super Admin', ar: 'مدير عام', icon: '⚡' },
  fleet_manager: { en: 'Fleet Manager', ar: 'مدير الأسطول', icon: '🚚' },
  dispatcher: { en: 'Dispatcher', ar: 'منسق', icon: '📋' },
  driver: { en: 'Driver', ar: 'سائق', icon: '👤' },
  warehouse_operator: { en: 'Warehouse', ar: 'مخزن', icon: '📦' },
  maintenance_tech: { en: 'Maintenance', ar: 'صيانة', icon: '🔧' },
  customer_support: { en: 'Support', ar: 'دعم', icon: '🎧' },
  executive: { en: 'Executive', ar: 'تنفيذي', icon: '💼' },
};
