// VEGA — Named scenario snapshots and full-model backup/restore.
// Pure functions only; persistence happens through useLocalStorage in the UI.

import type { FinancialInput } from '@/lib/types';
import { sanitizeFinancialInput } from '@/lib/calculations';
import type { DailyRecord } from '@/lib/operationsReporting';

export interface Scenario {
  id: string;
  name: string;
  savedAt: string; // ISO timestamp
  input: FinancialInput;
}

export interface ModelBackup {
  version: 1;
  exportedAt: string;
  input: FinancialInput;
  dailyRecords: Record<string, DailyRecord>;
  scenarios?: Scenario[];
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export function createScenario(name: string, input: FinancialInput, existing: Scenario[]): Scenario {
  const trimmed = name.trim();
  const fallback = `Scenario ${existing.length + 1}`;
  return {
    id: newId('scn'),
    name: trimmed.length > 0 ? trimmed.slice(0, 60) : fallback,
    savedAt: new Date().toISOString(),
    input: sanitizeFinancialInput(structuredClone(input)),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Structural check for an imported backup. Returns sanitized input or null. */
export function parseBackup(raw: string): ModelBackup | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.input)) return null;

  const input = parsed.input as Partial<FinancialInput>;
  if (!Array.isArray(input.vehicleClasses) || !Array.isArray(input.providers)) return null;

  const dailyRecords: Record<string, DailyRecord> = {};
  if (isRecord(parsed.dailyRecords)) {
    for (const [date, record] of Object.entries(parsed.dailyRecords)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isRecord(record)) continue;
      // Required numerics must be real finite numbers — null/NaN/string
      // records are corrupt and would skew variance as phantom zero days.
      const nums = [record.completedShipments, record.failedShipments, record.fuelLitres, record.driversPresent];
      if (!nums.every(n => typeof n === 'number' && Number.isFinite(n))) continue;
      dailyRecords[date] = {
        date,
        completedShipments: record.completedShipments as number,
        failedShipments: record.failedShipments as number,
        fuelLitres: record.fuelLitres as number,
        driversPresent: record.driversPresent as number,
        notes: typeof record.notes === 'string' ? record.notes.slice(0, 2000) : '',
        updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
      };
    }
  }

  return {
    version: 1,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    input: sanitizeFinancialInput(input as FinancialInput),
    dailyRecords,
  };
}

export function buildBackup(input: FinancialInput, dailyRecords: Record<string, DailyRecord>, scenarios: Scenario[]): ModelBackup {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    input: structuredClone(input),
    dailyRecords: structuredClone(dailyRecords),
    scenarios: structuredClone(scenarios),
  };
}
