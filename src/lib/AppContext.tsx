'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  RentedFleetInput, MCResult, ZoneData, DriverData,
  DEFAULT_RENTED, DEFAULT_ZONES, DEFAULT_DRIVERS,
} from '@/lib/rentedFleetEngine';
import {
  SaudiCostInput, MonteCarloSimResult,
  DEFAULT_SAUDI_INPUT,
} from '@/lib/saudiLogisticsEngine';
import {
  FeasibilityInput,
  DEFAULT_FEASIBILITY_INPUT,
} from '@/lib/feasibilityEngine';

interface AutoclawState {
  input: RentedFleetInput;
  zones: ZoneData[];
  drivers: DriverData[];
  mcRuns: number;
  mcResult: MCResult | null;
  mcRunning: boolean;
  askQ: string;
  invQA: string;
  recs: { title: string; detail: string; priority: string; impact: string }[];
}

interface SaudiFleetState {
  input: SaudiCostInput;
  mcRuns: number;
  mcResult: MonteCarloSimResult | null;
  mcRunning: boolean;
  enabled: boolean;
}

interface RentedFleetState {
  input: RentedFleetInput;
  zones: ZoneData[];
  drivers: DriverData[];
  mcRuns: number;
  mcResult: MCResult | null;
  mcRunning: boolean;
  askQ: string;
  askA: string;
  recs: { title: string; detail: string; priority: string; impact: string }[];
}

interface FeasibilityState {
  input: FeasibilityInput;
}

interface AppContextType {
  autoclaw: AutoclawState;
  setAutoclaw: (s: Partial<AutoclawState> | ((prev: AutoclawState) => AutoclawState)) => void;
  saudiFleet: SaudiFleetState;
  setSaudiFleet: (s: Partial<SaudiFleetState> | ((prev: SaudiFleetState) => SaudiFleetState)) => void;
  rentedFleet: RentedFleetState;
  setRentedFleet: (s: Partial<RentedFleetState> | ((prev: RentedFleetState) => RentedFleetState)) => void;
  feasibility: FeasibilityState;
  setFeasibility: (s: Partial<FeasibilityState> | ((prev: FeasibilityState) => FeasibilityState)) => void;
}

const defaultAutoclaw: AutoclawState = {
  input: DEFAULT_RENTED,
  zones: DEFAULT_ZONES,
  drivers: DEFAULT_DRIVERS,
  mcRuns: 1000,
  mcResult: null,
  mcRunning: false,
  askQ: '',
  invQA: '',
  recs: [],
};

const defaultSaudiFleet: SaudiFleetState = {
  input: DEFAULT_SAUDI_INPUT,
  mcRuns: 1000,
  mcResult: null,
  mcRunning: false,
  enabled: true,
};

const defaultRentedFleet: RentedFleetState = {
  input: DEFAULT_RENTED,
  zones: DEFAULT_ZONES,
  drivers: DEFAULT_DRIVERS,
  mcRuns: 1000,
  mcResult: null,
  mcRunning: false,
  askQ: '',
  askA: '',
  recs: [],
};

const defaultFeasibility: FeasibilityState = {
  input: DEFAULT_FEASIBILITY_INPUT,
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [autoclaw, _setAutoclaw] = useLocalStorage<AutoclawState>('vega-autoclaw', defaultAutoclaw);
  const [saudiFleet, _setSaudiFleet] = useLocalStorage<SaudiFleetState>('vega-saudiFleet', defaultSaudiFleet);
  const [rentedFleet, _setRentedFleet] = useLocalStorage<RentedFleetState>('vega-rentedFleet', defaultRentedFleet);
  const [feasibility, _setFeasibility] = useLocalStorage<FeasibilityState>('vega-feasibility', defaultFeasibility);

  const setAutoclaw = (s: Partial<AutoclawState> | ((prev: AutoclawState) => AutoclawState)) => {
    _setAutoclaw(prev => typeof s === 'function' ? s(prev) : { ...prev, ...s });
  };
  const setSaudiFleet = (s: Partial<SaudiFleetState> | ((prev: SaudiFleetState) => SaudiFleetState)) => {
    _setSaudiFleet(prev => typeof s === 'function' ? s(prev) : { ...prev, ...s });
  };
  const setRentedFleet = (s: Partial<RentedFleetState> | ((prev: RentedFleetState) => RentedFleetState)) => {
    _setRentedFleet(prev => typeof s === 'function' ? s(prev) : { ...prev, ...s });
  };
  const setFeasibility = (s: Partial<FeasibilityState> | ((prev: FeasibilityState) => FeasibilityState)) => {
    _setFeasibility(prev => typeof s === 'function' ? s(prev) : { ...prev, ...s });
  };

  return (
    <AppContext.Provider value={{
      autoclaw, setAutoclaw,
      saudiFleet, setSaudiFleet,
      rentedFleet, setRentedFleet,
      feasibility, setFeasibility,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
