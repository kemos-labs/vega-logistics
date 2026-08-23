// Backup integrity tests — P1 gate, revision 2 (review contract C).
import { describe, expect, it } from 'vitest';

import {
  applyBackupMerge,
  buildBackup,
  normalizeIso,
  parseBackup,
  persistBundle,
  replaceWithBackup,
  STORAGE_KEYS,
  type FollowUpAction,
  type StateBundle,
} from '@/lib/backup';
import type { DailyRecord } from '@/lib/operationsReporting';
import type { RecoveryEntry } from '@/lib/recoveryBoard';
import type { Scenario } from '@/lib/scenarios';
import { defaultFinancialInput } from '@/lib/mockData';

const T0 = '2026-08-20T18:00:00.000Z';
const T1 = '2026-08-21T09:00:00.000Z';
const T2 = '2026-08-21T15:00:00.000Z';

function record(date: string, completed: number, failed: number, extra: Partial<DailyRecord> = {}): DailyRecord {
  return {
    date,
    completedShipments: completed,
    failedShipments: failed,
    fuelCost: 120,
    driversPresent: 3,
    notes: '',
    updatedAt: `${date}T18:00:00.000Z`,
    ...extra,
  };
}

const scenario = (id: string, savedAt: string): Scenario => ({
  id,
  name: id,
  savedAt,
  input: structuredClone(defaultFinancialInput),
});

const recovery = (id: string, overrides: Partial<RecoveryEntry> = {}): RecoveryEntry => ({
  id,
  createdAt: '2026-08-19',
  shipments: 2,
  owner: '',
  // empty owner is VALID in the current model (unassigned row)
  status: 'pending',
  ...overrides,
});

const action = (id: number, done = false, updatedAt?: string): FollowUpAction => ({
  id,
  text: `Action ${id}: review pricing`,
  owner: 'Ops',
  done,
  ...(updatedAt ? { updatedAt } : {}),
});

function fullBundle(): StateBundle {
  return {
    financialInput: structuredClone(defaultFinancialInput),
    dailyRecords: {
      '2026-08-20': record('2026-08-20', 37, 14),
      '2026-08-21': record('2026-08-21', 40, 8),
    },
    scenarios: [scenario('scn-1', T0)],
    recoveryEntries: [
      recovery('rec-empty-owner'),
      recovery('rec-1', { owner: 'Yaquob', status: 'recovered', resolvedAt: T1, updatedAt: T1 }),
    ],
    followUpActions: [action(1), action(2, true, T2)],
  };
}

function v2File(bundle: StateBundle, language?: string): string {
  return JSON.stringify(buildBackup(bundle, language));
}

describe('normalizeIso', () => {
  it('normalizes valid stamps to canonical UTC and rejects junk', () => {
    expect(normalizeIso('2026-08-20T18:00:00.000Z')).toBe(T0);
    expect(normalizeIso('2026-08-20T21:00:00+03:00')).toBe(T0); // offset normalized
    expect(normalizeIso('2026-08-20')).toBe('2026-08-20T00:00:00.000Z');
    expect(normalizeIso('not-a-date')).toBeNull();
    expect(normalizeIso('')).toBeNull();
    expect(normalizeIso(null)).toBeNull();
    expect(normalizeIso(42)).toBeNull();
  });
});

describe('strict v2 parsing (contract C1)', () => {
  const base = fullBundle();

  it('rejects a missing or wrong-typed collection instead of defaulting to empty', () => {
    const file = JSON.parse(v2File(base));
    type Mutable = { data: Record<string, unknown> };
    for (const mutation of [
      (f: Mutable) => delete f.data.recoveryEntries,
      (f: Mutable) => delete f.data.followUpActions,
      (f: Mutable) => delete f.data.scenarios,
      (f: Mutable) => { f.data.dailyRecords = []; }, // wrong container
      (f: Mutable) => { f.data.scenarios = {}; }, // wrong container
      (f: Mutable) => { f.data.recoveryEntries = 'none'; },
      (f: Mutable) => { f.data.followUpActions = null; },
    ]) {
      const mutated = structuredClone(file) as Mutable;
      mutation(mutated);
      const parsed = parseBackup(JSON.stringify(mutated));
      expect(parsed.ok, JSON.stringify(mutated).slice(0, 80)).toBe(false);
    }
  });

  it('rejects shapeless FinancialInput BEFORE sanitizing — `{}` never passes', () => {
    for (const bad of [{}, { driverSalary: 1 }, { vehicleClasses: [] }, { providers: [], driverSalary: 'x' }]) {
      const file = JSON.parse(v2File(base));
      (file as { data: { financialInput: unknown } }).data.financialInput = bad;
      const parsed = parseBackup(JSON.stringify(file));
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.error).toBe('financial-input-shape');
    }
  });

  it('drops corrupt individual records with warnings and marks the file lossy', () => {
    const file = JSON.parse(v2File(base)) as { data: Record<string, unknown[]> & { dailyRecords: Record<string, unknown>; recoveryEntries: unknown[] } };
    file.data.dailyRecords['2026-08-25'] = { date: '2026-08-25', completedShipments: 'many' };
    file.data.recoveryEntries.push({ id: 'bad', shipments: -3, createdAt: 'nope', owner: '', status: 'pending' });
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.dropped.days).toBe(1);
    expect(parsed.dropped.recoveryEntries).toBe(1);
    expect(parsed.lossless).toBe(false);
    expect(parsed.warnings.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(parsed.file.data.dailyRecords)).not.toContain('2026-08-25');
  });

  it('dedupes duplicate ids deterministically to the LAST occurrence with a warning', () => {
    const file = JSON.parse(v2File(base)) as { data: { followUpActions: FollowUpAction[] } };
    file.data.followUpActions.push({ id: 1, text: 'Later duplicate wins', owner: 'Ops', done: true, updatedAt: T2 });
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.data.followUpActions.filter(a => a.id === 1)).toHaveLength(1);
    expect(parsed.file.data.followUpActions.find(a => a.id === 1)?.text).toBe('Later duplicate wins');
    expect(parsed.lossless).toBe(false);
  });
});

describe('round-trip and full-state coverage (contract C3)', () => {
  it('replace mode reproduces the original bundle by deep equality', () => {
    const bundle = fullBundle(); // includes empty-owner + stamped rows + language-less
    const parsed = parseBackup(v2File(bundle));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.lossless).toBe(true);
    const next = replaceWithBackup(bundle, parsed.file);
    expect(next).toEqual(bundle);
  });

  it('carries the language preference both ways', () => {
    const parsed = parseBackup(v2File(fullBundle(), 'ar'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.data.language).toBe('ar');
  });

  it('empty-owner recovery entries round-trip untouched', () => {
    const parsed = parseBackup(v2File(fullBundle()));
    if (!parsed.ok) throw new Error('parse failed');
    const restored = replaceWithBackup(fullBundle(), parsed.file).recoveryEntries.find(e => e.id === 'rec-empty-owner');
    expect(restored).toBeDefined();
    expect(restored?.owner).toBe('');
    expect(restored?.status).toBe('pending');
  });
});

describe('conflict semantics (contract C4)', () => {
  it('edited pending recovery entry with newer updatedAt wins; older loses as conflict', () => {
    const current: StateBundle = { ...fullBundle(), recoveryEntries: [recovery('r1', { owner: 'A', updatedAt: T1 })] };
    const incomingNewer = [recovery('r1', { owner: 'B', shipments: 9, updatedAt: T2 })];
    const newerFile = buildBackup({ ...current, recoveryEntries: incomingNewer });
    const r1 = applyBackupMerge(current, newerFile);
    expect(r1.stats.updated).toBeGreaterThanOrEqual(1);
    expect(r1.next.recoveryEntries.find(e => e.id === 'r1')?.owner).toBe('B');

    const olderIncoming = [recovery('r1', { owner: 'C', updatedAt: T0 })];
    const lose = applyBackupMerge(current, buildBackup({ ...current, recoveryEntries: olderIncoming }));
    expect(lose.stats.conflicts).toBeGreaterThanOrEqual(1);
    expect(lose.next.recoveryEntries.find(e => e.id === 'r1')?.owner).toBe('A');
  });

  it('edited actions resolve by normalized updatedAt, not lexical order', () => {
    const current: StateBundle = { ...fullBundle(), followUpActions: [action(1, false, '2026-08-21T09:00:00+03:00')] }; // ≡06:00Z
    const incomingEarlierClock = [action(1, true, '2026-08-21T07:00:00.000Z')]; // earlier instant, lexically larger
    const result = applyBackupMerge(current, buildBackup({ ...current, followUpActions: incomingEarlierClock }));
    // incoming instant 07:00Z < existing 06:00Z? no: 06:00Z existing vs 07:00Z incoming → incoming newer → wins
    expect(result.stats.updated).toBe(1);
    expect(result.next.followUpActions[0].done).toBe(true);
  });

  it('identical days and rows are ignored, not counted as conflicts', () => {
    const bundle = fullBundle();
    const result = applyBackupMerge(bundle, buildBackup(bundle));
    expect(result.stats.conflicts).toBe(0);
    expect(result.stats.identical).toBeGreaterThan(0);
    expect(result.stats.added).toBe(0);
    expect(result.stats.updated).toBe(0);
  });

  it('invalid timestamps are treated as oldest — stamped local copy always wins', () => {
    const current: StateBundle = { ...fullBundle(), recoveryEntries: [recovery('r9', { owner: 'local', updatedAt: T1 })] };
    const incomingJunk = [recovery('r9', { owner: 'incoming-junk-stamp', updatedAt: 'garbage' as unknown as string })];
    const result = applyBackupMerge(current, buildBackup({ ...current, recoveryEntries: incomingJunk }));
    expect(result.next.recoveryEntries.find(e => e.id === 'r9')?.owner).toBe('local');
    expect(result.stats.conflicts).toBeGreaterThanOrEqual(1);
  });

  it('re-importing an already-merged backup changes nothing further', () => {
    const current = fullBundle();
    const incomingState: StateBundle = {
      ...structuredClone(current),
      dailyRecords: { '2026-08-23': record('2026-08-23', 51, 0) },
      recoveryEntries: [...current.recoveryEntries, recovery('r-new', { owner: 'N', updatedAt: T2 })],
    };
    const first = applyBackupMerge(current, buildBackup(incomingState));
    const second = applyBackupMerge(first.next, buildBackup(incomingState));
    expect(second.next).toEqual(first.next);
    expect(second.stats.added).toBe(0);
    expect(second.stats.updated).toBe(0);
  });
});

describe('corrupt data is rejected without deleting current data (contract C2)', () => {
  it('rejects malformed files with typed errors and never mutates state', () => {
    const bundle = fullBundle();
    const before = structuredClone(bundle);
    for (const [label, raw] of [
      ['truncated json', '{"format":"vega-logistics-backup","version":2,"data":{'],
      ['not an object', '[1,2,3]'],
      ['wrong version', JSON.stringify({ format: 'vega-logistics-backup', version: 99, data: {} })],
      ['wrong format', JSON.stringify({ version: 2, data: {} })],
      ['data not object', JSON.stringify({ format: 'vega-logistics-backup', version: 2, data: [] })],
      ['missing financials', JSON.stringify({ format: 'vega-logistics-backup', version: 2, exportedAt: '', data: {} })],
      ['shapeless input', v2File({ ...bundle, financialInput: {} as StateBundle['financialInput'] })],
    ] as const) {
      const parsed = parseBackup(raw);
      expect(parsed.ok, label).toBe(false);
    }
    expect(bundle).toEqual(before); // nothing touched anywhere
  });
});

describe('persistence honesty — quota/write failures are reported (contract C2)', () => {
  it('persistBundle collects failed keys and reports persistedOk=false', () => {
    const bundle = fullBundle();
    const failing: Pick<Storage, 'setItem'> = {
      setItem: key => {
        if (key === STORAGE_KEYS.dailyRecords) throw new DOMException('quota', 'QuotaExceededError');
        if (key === STORAGE_KEYS.language) throw new Error('disk full');
      },
    };
    const result = persistBundle(bundle, 'ar', failing);
    expect(result.persistedOk).toBe(false);
    expect(result.failedKeys).toEqual([STORAGE_KEYS.dailyRecords, STORAGE_KEYS.language]);
    const ok = persistBundle(bundle, undefined, { setItem: () => undefined });
    expect(ok.persistedOk).toBe(true);
    expect(ok.failedKeys).toEqual([]);
  });
});

describe('v1 migration (backward compatibility)', () => {
  it('maps legacy ModelBackup into the v2 envelope and warns about scope', () => {
    const v1 = {
      version: 1,
      exportedAt: T0,
      input: structuredClone(defaultFinancialInput),
      dailyRecords: { '2026-06-30': record('2026-06-30', 30, 6) },
      scenarios: [scenario('scn-old', '2026-06-01T00:00:00.000Z')],
    };
    const parsed = parseBackup(JSON.stringify(v1));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.migratedFrom).toBe(1);
    expect(parsed.file.version).toBe(2);
    expect(parsed.file.data.dailyRecords['2026-06-30'].completedShipments).toBe(30);
    expect(parsed.file.data.scenarios[0].id).toBe('scn-old');
    expect(parsed.file.data.recoveryEntries).toEqual([]);
    expect(parsed.file.data.followUpActions).toEqual([]);
    expect(parsed.warnings.some(w => w.includes('legacy-v1'))).toBe(true);
    expect(parsed.lossless).toBe(false); // v1 never held recovery/actions
  });

  it('rejects a v1 file whose dailyRecords container is malformed', () => {
    const v1 = { version: 1, exportedAt: T0, input: structuredClone(defaultFinancialInput), dailyRecords: [] };
    const parsed = parseBackup(JSON.stringify(v1));
    expect(parsed.ok).toBe(false);
  });
});
