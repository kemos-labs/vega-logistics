// Dispatch domain tests (Release R3).
import { describe, expect, it } from 'vitest';

import {
  assignStop, assignableDrivers, buildDispatchBoard, isDispatchable,
  moveStop, runWorkload, unassignStop,
} from '@/lib/dispatch';
import { createStopRecord, type StopRecord } from '@/lib/stops';
import type { DriverRecord } from '@/lib/types';

const NOW = '2026-08-24T06:00:00.000Z';
const LATER = '2026-08-24T07:00:00.000Z';
const DATE = '2026-08-25';

let fixtureTick = 0;
function stop(over: Partial<StopRecord> = {}): StopRecord {
  fixtureTick += 1;
  return createStopRecord({
    operationDate: DATE, customerName: 'Ninja', stopLabel: 'Gate',
    ...over,
  }, new Date(Date.parse(NOW) + fixtureTick * 1000).toISOString()); // deterministic creation order
}

const drivers: DriverRecord[] = [
  { id: 'd1', fullName: 'سالم', phone: '', nationalId: '', assignedVehicle: 'Van-1', status: 'active' },
  { id: 'd2', fullName: 'مغلق', phone: '', nationalId: '', assignedVehicle: 'Van-2', status: 'inactive' },
];

const driverWithCar: DriverRecord = {
  id: 'd3', fullName: 'خالد', phone: '0551234567', nationalId: '',
  assignedVehicle: 'Sedan', carNumber: 'CAR-12', plateNumber: 'أ ب ج 1234', status: 'active',
};

describe('catalog adapter', () => {
  it('only ACTIVE drivers are assignable, with stable operational labels', () => {
    const options = assignableDrivers(drivers);
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ fullName: 'سالم', label: 'سالم · Van-1' });
  });

  it('carries catalog car number + plate so dispatch can stamp complete identity', () => {
    const options = assignableDrivers([driverWithCar]);
    expect(options[0]).toMatchObject({ fullName: 'خالد', vehicle: 'Sedan', carNumber: 'CAR-12', plateNumber: 'أ ب ج 1234' });
  });
});

describe('dispatch participation', () => {
  it('planned/pending participate; delivered/failed/returned are never reassigned', () => {
    expect(isDispatchable(stop())).toBe(true);
    expect(isDispatchable(stop({ status: 'pending' }))).toBe(true);
    expect(isDispatchable(stop({ status: 'delivered' }))).toBe(false);
    expect(isDispatchable(stop({ status: 'failed', failureReasonKey: 'addressIssue' }))).toBe(false);
    expect(isDispatchable(stop({ status: 'returned', failureReasonKey: 'refusedDelivery' }))).toBe(false);
  });
});

describe('assignment', () => {
  it('assign fills driver fields, preserves status/unrelated fields, refreshes updatedAt only', () => {
    const original = stop({ reference: 'A-1', codAmountSar: 30 });
    const next = assignStop([original], original.id, { fullName: 'سالم', vehicle: 'Van-1' }, LATER);
    expect(next[0]).toMatchObject({ driverName: 'سالم', carNumber: 'Van-1', status: 'planned', codAmountSar: 30 });
    expect(next[0].createdAt).toBe(original.createdAt);
    expect(next[0].updatedAt).not.toBe(original.updatedAt);
  });

  it('catalog car number + plate propagate onto the assigned stop', () => {
    const original = stop();
    const next = assignStop([original], original.id,
      { fullName: 'خالد', vehicle: 'Sedan', carNumber: 'CAR-12', plateNumber: 'أ ب ج 1234' }, LATER);
    expect(next[0]).toMatchObject({ driverName: 'خالد', carNumber: 'CAR-12', plateNumber: 'أ ب ج 1234' });
  });

  it('legacy callers without explicit carNumber still get vehicle as car (fallback)', () => {
    const original = stop();
    const next = assignStop([original], original.id, { fullName: 'سالم', vehicle: 'Van-9' }, LATER);
    expect(next[0].carNumber).toBe('Van-9');
    expect(next[0].plateNumber).toBeUndefined();
    // run identity groups by driver+car even with only the fallback
    const board = buildDispatchBoard([next[0], stop({ driverName: 'سالم', carNumber: 'Van-9' })]);
    expect(board.runs).toHaveLength(1);
  });

  it('board groups assigned runs, resequences 1..N gapless, keeps unassigned queue', () => {
    const a = stop({ reference: 'A' });
    const b = stop({ reference: 'B' });
    const c = stop({ reference: 'C' });
    let all = assignStop([a, b, c], a.id, { fullName: 'سالم', vehicle: 'V' }, LATER);
    all = assignStop(all, b.id, { fullName: 'سالم', vehicle: 'V' }, LATER);
    const board = buildDispatchBoard(all);
    expect(board.unassigned.map(s => s.reference)).toEqual(['C']);
    expect(board.runs[0].stops.map(s => s.sequence)).toEqual([1, 2]);
  });

  it('reassignment moves the stop between runs and resequences both', () => {
    const a = stop({ reference: 'A' });
    const b = stop({ reference: 'B' });
    const c = stop({ reference: 'C' });
    let all = assignStop([a, b, c], a.id, { fullName: 'X', vehicle: 'V1' }, LATER);
    all = assignStop(all, b.id, { fullName: 'X', vehicle: 'V1' }, LATER);
    all = assignStop(all, c.id, { fullName: 'Y', vehicle: 'V2' }, LATER);
    all = assignStop(all, b.id, { fullName: 'Y', vehicle: 'V2' }, LATER); // move B to Y
    const board = buildDispatchBoard(all);
    const runX = board.runs.find(run => run.driverName === 'X');
    const runY = board.runs.find(run => run.driverName === 'Y');
    expect(runX?.stops.map(s => s.reference)).toEqual(['A']);
    // deterministic tie-break: createdAt then id (B was created before C)
    expect(runY?.stops.map(s => [s.reference, s.sequence])).toEqual([['B', 1], ['C', 2]]);
  });

  it('unassign returns the stop to the queue without touching status', () => {
    const a = stop({ reference: 'A' });
    let all = assignStop([a], a.id, { fullName: 'X', vehicle: 'V' }, LATER);
    all = unassignStop(all, a.id, LATER);
    const board = buildDispatchBoard(all);
    expect(board.runs).toHaveLength(0);
    expect(board.unassigned[0]?.status).toBe('planned');
    expect(board.unassigned[0]?.driverName).toBeUndefined();
  });
});

describe('ordering', () => {
  function threeRun() {
    const a = stop({ reference: 'A' });
    const b = stop({ reference: 'B' });
    const c = stop({ reference: 'C' });
    let all = assignStop([a, b, c], a.id, { fullName: 'X', vehicle: 'V' }, LATER);
    all = assignStop(all, b.id, { fullName: 'X', vehicle: 'V' }, LATER);
    all = assignStop(all, c.id, { fullName: 'X', vehicle: 'V' }, LATER);
    return { all, ids: { a: a.id, b: b.id, c: c.id } };
  }
  it('move down swaps neighbours and resequences gaplessly', () => {
    const { all, ids } = threeRun();
    const board = buildDispatchBoard(moveStop(all, ids.a, 'down', LATER));
    expect(board.runs[0].stops.map(s => s.reference)).toEqual(['B', 'A', 'C']);
    expect(board.runs[0].stops.map(s => s.sequence)).toEqual([1, 2, 3]);
  });
  it('first/last boundaries are no-ops', () => {
    const { all, ids } = threeRun();
    expect(moveStop(all, ids.a, 'up', LATER)).toHaveLength(3);
    const moved = moveStop(all, ids.c, 'down', LATER);
    expect(buildDispatchBoard(moved).runs[0].stops.map(s => s.reference)).toEqual(['A', 'B', 'C']);
  });
  it('completed history is untouched by board rebuilds', () => {
    const done = stop({ reference: 'DONE', status: 'delivered', driverName: 'X', carNumber: 'V', sequence: 1 });
    const board = buildDispatchBoard([done]);
    expect(board.runs).toHaveLength(0);
    expect(board.unassigned).toHaveLength(0);
  });
});

describe('workload & readiness', () => {
  it('counts COD, windows, missing address/phone/reference', () => {
    const w = runWorkload([
      stop({ codAmountSar: 30, serviceWindow: 'morning', addressNotes: 'x', phone: '1', reference: 'R' }),
      stop({ codAmountSar: 12 }),
    ]);
    expect(w).toMatchObject({
      stopCount: 2, codTotalSar: 42,
      windows: { morning: 1, afternoon: 0, evening: 0, unset: 1 },
      missingAddress: 1, missingPhone: 1, missingReference: 1,
    });
  });

  it('counts stops missing a Short Address (TGA readiness signal)', () => {
    const w = runWorkload([
      stop({ shortAddress: 'ABCD1234' }),
      stop({}),
    ]);
    expect(w.missingShortAddress).toBe(1);
  });
});
