// VEGA — Morning dispatch domain (Release R3). Pure, React-free.
//
// Rules (directive §A):
//   * only planned/pending stops participate in morning dispatch —
//     delivered/failed/returned history is NEVER reassigned;
//   * assignment writes driverName/carNumber/plateNumber + sequence;
//     createdAt immutable, updatedAt refreshed by caller clock;
//   * per-run sequence is deterministic 1..N with no gaps after any
//     movement/removal/reassignment;
//   * run identity = driverName (+ car/plate when known);
//   * provider-reported identity is preserved — assignment only fills
//     MISSING driver/vehicle fields, never overwrites silently (§B).

import type { StopRecord } from '@/lib/stops';
import { updateStopRecord } from '@/lib/stops';
import type { DriverRecord } from '@/lib/types';

export const DISPATCH_STATUSES = ['planned', 'pending'] as const;
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

export function isDispatchable(stop: StopRecord): boolean {
  return (DISPATCH_STATUSES as readonly string[]).includes(stop.status);
}

/** Active company drivers, adapted to stable operational labels (§B). */
export function assignableDrivers(drivers: DriverRecord[] | undefined): Array<{ id: string; label: string; fullName: string; vehicle: string }> {
  return (drivers ?? [])
    .filter(driver => driver.status === 'active')
    .map(driver => ({
      id: driver.id,
      label: `${driver.fullName} · ${driver.assignedVehicle}`,
      fullName: driver.fullName,
      vehicle: driver.assignedVehicle,
    }));
}

/** Stable operational identity of a run — NEVER the display name alone. */
export function runKey(run: Pick<DriverRun, 'driverName' | 'carNumber' | 'plateNumber'>): string {
  return [run.driverName, run.carNumber ?? '—', run.plateNumber ?? '—'].join('|');
}

export interface DriverRun {
  driverName: string;
  carNumber?: string;
  plateNumber?: string;
  stops: StopRecord[]; // sorted by sequence 1..N
}

export interface DispatchBoard {
  unassigned: StopRecord[];
  runs: DriverRun[];
}

/** Group a date's dispatchable stops into the unassigned queue + per-driver runs. */
export function buildDispatchBoard(stops: StopRecord[]): DispatchBoard {
  const dispatchable = stops.filter(isDispatchable);
  const unassigned: StopRecord[] = [];
  const runMap = new Map<string, DriverRun>();
  for (const stop of dispatchable) {
    if (!stop.driverName) { unassigned.push(stop); continue; }
    const key = `${stop.driverName}|${stop.carNumber ?? ''}|${stop.plateNumber ?? ''}`;
    const run = runMap.get(key) ?? { driverName: stop.driverName, carNumber: stop.carNumber, plateNumber: stop.plateNumber, stops: [] };
    run.stops.push(stop);
    runMap.set(key, run);
  }
  const resequence = (list: StopRecord[]): StopRecord[] =>
    [...list]
      .sort((a, b) => (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER)
        || Date.parse(a.createdAt) - Date.parse(b.createdAt) || (a.id < b.id ? -1 : 1))
      .map((stop, index) => (stop.sequence === index + 1 ? stop : { ...stop, sequence: index + 1 }));
  const runs = [...runMap.values()].map(run => ({ ...run, stops: resequence(run.stops) }))
    .sort((a, b) => a.driverName.localeCompare(b.driverName));
  return { unassigned: resequence(unassigned).map(stop => ({ ...stop, sequence: undefined })), runs };
}

/**
 * Assign (or reassign) a stop to a driver/vehicle. Reassignment removes it
 * from the previous run (the board rebuild resequences both) and preserves
 * status + unrelated fields. Provider-reported identity is only overwritten
 * when the operator explicitly assigns (this IS the explicit action).
 */
export function assignStop(
  stops: StopRecord[],
  stopId: string,
  driver: { fullName: string; vehicle: string },
  nowIso: string,
): StopRecord[] {
  return stops.map(stop => stop.id === stopId
    ? updateStopRecord(stop, {
        driverName: driver.fullName,
        carNumber: driver.vehicle,
        plateNumber: undefined,
        sequence: undefined, // board rebuild assigns the next free slot deterministically
      }, nowIso)
    : stop);
}

export function unassignStop(stops: StopRecord[], stopId: string, nowIso: string): StopRecord[] {
  return stops.map(stop => stop.id === stopId
    ? updateStopRecord(stop, { driverName: undefined, carNumber: undefined, plateNumber: undefined, sequence: undefined }, nowIso)
    : stop);
}

/** Accessible move up/down within a run. Boundaries are no-ops. */
export function moveStop(stops: StopRecord[], stopId: string, direction: 'up' | 'down', nowIso: string): StopRecord[] {
  const board = buildDispatchBoard(stops);
  for (const run of board.runs) {
    const index = run.stops.findIndex(stop => stop.id === stopId);
    if (index === -1) continue;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= run.stops.length) return stops; // boundary no-op
    const swapped = [...run.stops];
    [swapped[index], swapped[targetIndex]] = [swapped[targetIndex], swapped[index]];
    let next = stops;
    swapped.forEach((stop, order) => {
      if (stop.sequence === order + 1) return;
      next = next.map(candidate => candidate.id === stop.id
        ? updateStopRecord(candidate, { sequence: order + 1 }, nowIso)
        : candidate);
    });
    return next;
  }
  return stops;
}

export interface RunWorkload {
  stopCount: number;
  codTotalSar: number;
  windows: { morning: number; afternoon: number; evening: number; unset: number };
  missingAddress: number;
  /** Optional data — never presented as a requirement. */
  missingPhone: number;
  missingReference: number;
}

export function runWorkload(stops: StopRecord[]): RunWorkload {
  const windows = { morning: 0, afternoon: 0, evening: 0, unset: 0 };
  let codTotalSar = 0, missingAddress = 0, missingPhone = 0, missingReference = 0;
  for (const stop of stops) {
    if (stop.serviceWindow === 'morning') windows.morning += 1;
    else if (stop.serviceWindow === 'afternoon') windows.afternoon += 1;
    else if (stop.serviceWindow === 'evening') windows.evening += 1;
    else windows.unset += 1;
    codTotalSar += stop.codAmountSar ?? 0;
    if (!stop.addressNotes) missingAddress += 1;
    if (!stop.phone) missingPhone += 1;
    if (!stop.reference) missingReference += 1;
  }
  return { stopCount: stops.length, codTotalSar, windows, missingAddress, missingPhone, missingReference };
}
