// VEGA Logistics OS — Simulated Real-time Data Hook
// Live simulation jitter for KPIs/ghost-growth, plus operational-state patches
// for vehicle classes, providers, drivers, and maintenance.

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  FinancialInput,
  FinancialOutput,
  GhostGrowthResult,
  VehicleLocation,
  ZoneDensity,
  KPIData,
  VehicleClass,
  Provider,
  DriverRecord,
  MaintenanceEntry,
} from '@/lib/types';
import {
  defaultFinancialInput,
  defaultGhostMetrics,
  getKPIData,
  getVehicles,
  getZoneDensity,
} from '@/lib/mockData';
import { calculateFinancials, applyOperationalPatch } from '@/lib/calculations';
import { calculateGhostGrowthIndex } from '@/lib/ghostGrowth';

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export function useSimulatedData() {
  const [financialInput, setFinancialInput] = useLocalStorage<FinancialInput>('vega-financialInput-v2', defaultFinancialInput);
  const [financialOutput, setFinancialOutput] = useState<FinancialOutput>(() => calculateFinancials(defaultFinancialInput));
  const [ghostGrowth, setGhostGrowth] = useState<GhostGrowthResult>(() =>
    calculateGhostGrowthIndex(defaultGhostMetrics, calculateFinancials(defaultFinancialInput).fleetUtilization)
  );
  const [kpis, setKpis] = useState<KPIData[]>(() => getKPIData());
  const [vehicles] = useLocalStorage<VehicleLocation[]>('vega-vehicles', getVehicles());
  const [zones] = useLocalStorage<ZoneDensity[]>('vega-zones', getZoneDensity());
  const [lastUpdate] = useState<Date>(new Date());

  const inputRef = useRef(defaultFinancialInput);
  const userOverrideRef = useRef(false);

  const recompute = useCallback((next: FinancialInput) => {
    const output = calculateFinancials(next);
    setFinancialOutput(output);
    setGhostGrowth(calculateGhostGrowthIndex(defaultGhostMetrics, output.fleetUtilization));
    setKpis(getKPIData(next));
  }, []);

  // Sync derived states when persisted financialInput is restored on mount
  useEffect(() => {
    inputRef.current = financialInput;
    // The persisted local-storage value must hydrate derived calculations once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recompute(financialInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Generic patch: any top-level field of FinancialInput. */
  const updateFinancialInput = useCallback((patch: Partial<FinancialInput>) => {
    const next = applyOperationalPatch(inputRef.current, patch);
    inputRef.current = next;
    userOverrideRef.current = true;
    setFinancialInput(next);
    recompute(next);
  }, [recompute, setFinancialInput]);

  /** Replace the entire vehicle class list. */
  const setVehicleClasses = useCallback(
    (updater: (prev: VehicleClass[]) => VehicleClass[]) => {
      const next = applyOperationalPatch(inputRef.current, { vehicleClasses: updater(inputRef.current.vehicleClasses) });
      inputRef.current = next;
      userOverrideRef.current = true;
      setFinancialInput(next);
      recompute(next);
    },
    [recompute, setFinancialInput]
  );

  /** Replace the entire provider list. */
  const setProviders = useCallback(
    (updater: (prev: Provider[]) => Provider[]) => {
      const next = applyOperationalPatch(inputRef.current, { providers: updater(inputRef.current.providers) });
      inputRef.current = next;
      userOverrideRef.current = true;
      setFinancialInput(next);
      recompute(next);
    },
    [recompute, setFinancialInput]
  );

  /** Replace the entire maintenance list. */
  const setMaintenance = useCallback(
    (updater: (prev: MaintenanceEntry[]) => MaintenanceEntry[]) => {
      const next = applyOperationalPatch(inputRef.current, { maintenance: updater(inputRef.current.maintenance) });
      inputRef.current = next;
      userOverrideRef.current = true;
      setFinancialInput(next);
      recompute(next);
    },
    [recompute, setFinancialInput]
  );

  /** Replace the entire financial input — used by scenario load and backup import. */
  const applyFinancialInput = useCallback(
    (next: FinancialInput) => {
      inputRef.current = next;
      userOverrideRef.current = true;
      setFinancialInput(next);
      recompute(next);
    },
    [recompute, setFinancialInput]
  );

  /** Replace the entire drivers list. */
  const setDrivers = useCallback(
    (updater: (prev: DriverRecord[]) => DriverRecord[]) => {
      const next = applyOperationalPatch(inputRef.current, { drivers: updater(inputRef.current.drivers) });
      inputRef.current = next;
      userOverrideRef.current = true;
      setFinancialInput(next);
      recompute(next);
    },
    [recompute, setFinancialInput]
  );

  const addVehicleClass = useCallback(() => {
    setVehicleClasses((prev) => [
      ...prev,
      { id: newId('vc'), name: 'New Class', quantity: 0, monthlyRent: 0, variableCost: 0, enabled: true, driverSalary: 4000, fuelType: 'diesel', fuelEfficiency: 10, avgDailyDistance: 100, purchasePrice: 0, depreciationMonths: 0 },
    ]);
  }, [setVehicleClasses]);

  const addProvider = useCallback(() => {
    setProviders((prev) => [
      ...prev,
      { id: newId('prv'), name: `Provider ${prev.length + 1}`, shipmentsPerDay: 0, pricePerShipment: 0, enabled: true },
    ]);
  }, [setProviders]);

  const addMaintenance = useCallback(
    (vehicleClassId: string) => {
      setMaintenance((prev) => [
        ...prev,
        {
          id: newId('mt'),
          vehicleClassId,
          type: 'routine',
          costPerEvent: 0,
          frequency: 1,
          enabled: true,
        },
      ]);
    },
    [setMaintenance]
  );

  const addDriver = useCallback(() => {
    setDrivers((prev) => [
      ...prev,
      {
        id: newId('drv'),
        fullName: 'New Driver',
        phone: '',
        nationalId: '',
        assignedVehicle: prev[0]?.assignedVehicle ?? 'Van',
        status: 'active',
      },
    ]);
  }, [setDrivers]);

  return {
    financialInput,
    financialOutput,
    ghostGrowth,
    kpis,
    vehicles,
    zones,
    lastUpdate,
    updateFinancialInput,
    applyFinancialInput,
    setVehicleClasses,
    setProviders,
    setMaintenance,
    setDrivers,
    addVehicleClass,
    addProvider,
    addMaintenance,
    addDriver,
  };
}
