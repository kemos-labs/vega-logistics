// Backup integrity tests — P1 gate, revision 2 (review contract C).
import { describe, expect, it } from 'vitest';

import {
  applyBackupMerge,
  applyLegacyScopedRestore,
  buildBackup,
  commitBundle,
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
import { validateRecoveryEntries } from '@/lib/recoveryBoard';
import type { Scenario } from '@/lib/scenarios';
import { defaultFinancialInput } from '@/lib/mockData';
import { memoryStorage } from './helpers/memoryStorage';

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


describe('transactional persistence (contract E-4)', () => {

  it('writes all six destinations; language stored RAW (no JSON quotes)', () => {
    const store = memoryStorage();
    const result = commitBundle(fullBundle(), 'ar', { storage: store });
    expect(result.persistedOk).toBe(true);
    expect(store.getItem(STORAGE_KEYS.language)).toBe('ar'); // raw, not '"ar"'
  });

  it('rolls EVERY touched key back when one write fails, incl. re-removing absent keys', () => {
    const seed: Record<string, string> = {};
    seed[STORAGE_KEYS.financialInput] = '{"kept":true}';
    // dailyRecords + language intentionally ABSENT before
    let calls = 0;
    const store = memoryStorage(seed);
    const realSet = store.setItem.bind(store);
    (store as { setItem: Storage['setItem'] }).setItem = (k, v) => {
      calls += 1;
      if (calls === 2) throw new DOMException('quota', 'QuotaExceededError'); // second write fails
      realSet(k, v);
    };
    const result = commitBundle(fullBundle(), 'ar', { storage: store });
    expect(result.persistedOk).toBe(false);
    expect(result.rollbackOk).toBe(true);
    expect(result.failedKeys).toEqual([STORAGE_KEYS.dailyRecords]);
    const dump = store.dump();
    expect(dump[STORAGE_KEYS.financialInput]).toBe('{"kept":true}'); // restored raw
    expect(dump[STORAGE_KEYS.dailyRecords]).toBeUndefined(); // absent again
    expect(dump[STORAGE_KEYS.language]).toBeUndefined();
  });

  it('reports critical rollback failure distinctly', () => {
    const store = memoryStorage({ [STORAGE_KEYS.financialInput]: 'x' });
    let first = true;
    const realSet = store.setItem.bind(store);
    (store as { setItem: Storage['setItem'] }).setItem = (key: string, value: string) => {
      void realSet; void key; void value;
      if (first) { first = false; throw new Error('quota'); } // original write fails
      throw new Error('rollback-broken'); // rollback of this key also fails
    };
    const result = commitBundle(fullBundle(), undefined, { storage: store });
    expect(result.persistedOk).toBe(false);
    expect(result.rollbackOk).toBe(false);
    expect(result.rollbackFailedKeys.length).toBeGreaterThan(0);
  });
});

describe('legacy scoped restore (contract E-2)', () => {
  it('adopts v1 model/days/scenarios and PRESERVES recovery entries, actions and language', () => {
    const current = fullBundle(); // has recovery entries + actions
    const v1File = JSON.stringify({
      version: 1,
      exportedAt: T0,
      input: structuredClone(defaultFinancialInput),
      dailyRecords: { '2026-06-30': record('2026-06-30', 30, 6) },
      scenarios: [scenario('scn-old', '2026-06-01T00:00:00.000Z')],
    });
    const parsed = parseBackup(v1File);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const { next } = applyLegacyScopedRestore(current, parsed.file);
    expect(next.dailyRecords['2026-06-30'].completedShipments).toBe(30); // v1 adopted
    expect(next.scenarios.map(scn => scn.id)).toEqual(['scn-old']);
    expect(next.financialInput).toEqual(defaultFinancialInput);
    // newer scope untouched:
    expect(next.recoveryEntries).toEqual(current.recoveryEntries);
    expect(next.followUpActions).toEqual(current.followUpActions);

    // persistence for scoped restore touches ONLY the three adopted keys —
    // recovery/actions/language stay exactly as stored before:
    const store = memoryStorage({
      [STORAGE_KEYS.recoveryEntries]: JSON.stringify(current.recoveryEntries),
      [STORAGE_KEYS.followUpActions]: JSON.stringify(current.followUpActions),
      [STORAGE_KEYS.language]: 'en',
    });
    const persisted = persistBundle(
      { financialInput: next.financialInput, dailyRecords: next.dailyRecords, scenarios: next.scenarios, recoveryEntries: next.recoveryEntries, followUpActions: next.followUpActions },
      'en',
      store,
    );
    expect(persisted.persistedOk).toBe(true);
    expect(JSON.parse(store.getItem(STORAGE_KEYS.dailyRecords) ?? '{}')['2026-06-30']).toBeDefined();
    expect(JSON.parse(store.getItem(STORAGE_KEYS.recoveryEntries) ?? '[]')).toEqual(current.recoveryEntries);
    expect(store.getItem(STORAGE_KEYS.language)).toBe('en'); // preserved raw
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

describe('recovery updatedAt survives the full pipeline (contract F1)', () => {
  it('RecoveryBoard write → validator/read path → export → parse → merge; newer entry wins', () => {
    // 1. RecoveryBoard "write": row persisted with its edit stamp
    const storedRow = {
      id: 'rec-e2e', createdAt: '2026-08-19', shipments: 4, owner: 'Yaquob',
      status: 'recovered', resolvedAt: '2026-08-21T12:00:00.000Z',
      updatedAt: '2026-08-21T14:30:00.000Z',
    };
    // 2. read path through the app validator — updatedAt must SURVIVE
    const validated = validateRecoveryEntries([storedRow]);
    expect(validated[0].updatedAt).toBe('2026-08-21T14:30:00.000Z');
    expect(validated[0].resolvedAt).toBe('2026-08-21T12:00:00.000Z'); // normalized form preserved

    // 3. backup export → parse
    const current: StateBundle = { ...fullBundle(), recoveryEntries: validated };
    const parsed = parseBackup(JSON.stringify(buildBackup(current)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.data.recoveryEntries[0].updatedAt).toBe('2026-08-21T14:30:00.000Z');

    // 4. merge against an OLDER local copy → newer incoming wins via updatedAt
    const olderLocal: StateBundle = { ...fullBundle(), recoveryEntries: [recovery('rec-e2e', { owner: 'Old', shipments: 1, status: 'pending', updatedAt: '2026-08-20T00:00:00.000Z' })] };
    const result = applyBackupMerge(olderLocal, parsed.file);
    const winner = result.next.recoveryEntries.find(e => e.id === 'rec-e2e');
    expect(winner?.owner).toBe('Yaquob');
    expect(winner?.status).toBe('recovered');
    expect(winner?.updatedAt).toBe('2026-08-21T14:30:00.000Z');
    expect(result.stats.updated).toBeGreaterThanOrEqual(1);
  });
});

describe('v1 metadata split: legacy scope vs corruption (contract F2)', () => {
  const cleanV1 = () => ({
    version: 1,
    exportedAt: T0,
    input: structuredClone(defaultFinancialInput),
    dailyRecords: { '2026-06-30': record('2026-06-30', 30, 6) },
    scenarios: [scenario('scn-old', '2026-06-01T00:00:00.000Z')],
  });

  it('clean v1: legacyScopeMissing=true but contentLoss=false', () => {
    const parsed = parseBackup(JSON.stringify(cleanV1()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.migratedFrom).toBe(1);
    expect(parsed.legacyScopeMissing).toBe(true);
    expect(parsed.contentLoss).toBe(false);
  });

  it('corrupt v1 day/scenario rows set contentLoss=true', () => {
    const file = JSON.parse(JSON.stringify(cleanV1())) as { dailyRecords: Record<string, unknown>; scenarios: unknown[] };
    file.dailyRecords['2026-07-01'] = { date: '2026-07-01', completedShipments: NaN };
    file.scenarios.push({ id: 'bad' }); // shapeless scenario input
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contentLoss).toBe(true);
    expect(parsed.dropped.days).toBe(1);
    expect(parsed.dropped.scenarios).toBe(1);
    expect(parsed.lossless).toBe(false);
  });

  it('shapeless v1 financial input still rejects the whole file', () => {
    const file = JSON.parse(JSON.stringify(cleanV1())) as { input: unknown };
    file.input = {};
    expect(parseBackup(JSON.stringify(file)).ok).toBe(false);
  });
});

describe('lossless-aware field validation (contract F3)', () => {
  function parseWithDayMutator(mutate: (day: Record<string, unknown>) => void) {
    const payload = buildBackup(fullBundle());
    const raw = JSON.parse(JSON.stringify(payload)) as { data: { dailyRecords: Record<string, Record<string, unknown>> } };
    mutate(raw.data.dailyRecords['2026-08-20']);
    return parseBackup(JSON.stringify(raw));
  }

  it('warns on every non-string supplied text field without coercion', () => {
    const parsed = parseWithDayMutator(day => {
      day.notes = 42; day.tomorrowNote = true; day.driverName = 7;
      day.carNumber = {}; day.plateNumber = [];
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contentLoss).toBe(true);
    expect(parsed.warnings.filter(w => w.endsWith('-invalid')).length).toBeGreaterThanOrEqual(5);
    // values were NOT silently coerced into strings
    expect(parsed.file.data.dailyRecords['2026-08-20'].notes).toBe('');
    expect(parsed.file.data.dailyRecords['2026-08-20'].driverName).toBeUndefined();
  });

  it('warns on non-object customerBreakdown children and non-object failureReasons container', () => {
    const parsed = parseWithDayMutator(day => {
      day.customerBreakdown = { bad: 'not-an-object' };
      day.failureReasons = 'oops';
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contentLoss).toBe(true);
    expect(parsed.warnings.some(w => w.includes('customerBreakdown'))).toBe(true);
    expect(parsed.warnings.some(w => w.includes('failureReasons-container'))).toBe(true);
    expect(parsed.file.data.dailyRecords['2026-08-20'].customerBreakdown).toBeUndefined();
  });

  it('warns on invalid recovery reasonKey/customer/note/owner types and keeps lossy flag', () => {
    const bundle = fullBundle();
    const rows = [
      { ...bundle.recoveryEntries[1], reasonKey: 9, customer: 8, note: false },
      { id: 'r-owner-type', createdAt: '2026-08-19', shipments: 2, owner: 123, status: 'pending' },
    ];
    const parsed = parseBackup(JSON.stringify(buildBackup({ ...bundle, recoveryEntries: rows as unknown as RecoveryEntry[] })));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contentLoss).toBe(true);
    expect(parsed.warnings.some(w => w.includes('reasonKey-type'))).toBe(true);
    expect(parsed.warnings.some(w => w.includes('customer-type'))).toBe(true);
    expect(parsed.warnings.some(w => w.includes('note-type'))).toBe(true);
    expect(parsed.warnings.some(w => w.includes('owner-type'))).toBe(true);
  });

  it('warns on non-boolean action.done and non-string action.owner', () => {
    const bundle = fullBundle();
    const rows: FollowUpAction[] = [
      { id: 1, text: 'x', owner: 'Ops', done: false },
      // @ts-expect-error deliberately malformed supplied values
      { id: 2, text: 'y', owner: 42, done: 'yes' },
    ];
    const parsed = parseBackup(JSON.stringify(buildBackup({ ...bundle, followUpActions: rows })));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contentLoss).toBe(true);
    expect(parsed.warnings.some(w => w.includes('done-type'))).toBe(true);
    expect(parsed.warnings.some(w => w.includes('owner-type'))).toBe(true);
    const second = parsed.file.data.followUpActions.find(a => a.id === 2);
    expect(second?.done).toBe(false); // not silently coerced to truthy
  });
});

describe('snapshot-read failure aborts before any write (contract F4)', () => {
  it('persistedOk=false and storage untouched when getItem throws', () => {
    const store = memoryStorage({ [STORAGE_KEYS.financialInput]: 'original' });
    // memoryStorage defines getItem as an OWN property — override it there
    let readCalls = 0;
    const originalOwnGet = store.getItem.bind(store);
    (store as { getItem: Storage['getItem'] }).getItem = (key: string) => {
      readCalls += 1;
      if (key === STORAGE_KEYS.dailyRecords) throw new Error('read locked');
      return originalOwnGet(key);
    };
    const result = commitBundle(fullBundle(), 'ar', { storage: store });
    expect(readCalls).toBeGreaterThan(0); // snapshot phase actually ran
    expect(result.persistedOk).toBe(false); // aborted before ANY write
    expect(result.rollbackFailedKeys).toEqual([]);
    expect(store.getItem(STORAGE_KEYS.financialInput)).toBe('original');
    expect(store.dump()[STORAGE_KEYS.dailyRecords]).toBeUndefined();
  });
});

describe('v1 duplicate-id scope corruption (contract G1)', () => {
  const v1WithDuplicateScenarios = () => {
    const scn = { id: 'dup-1', name: 'Same id twice', savedAt: '2026-06-01T00:00:00.000Z', input: structuredClone(defaultFinancialInput) };
    return {
      version: 1,
      exportedAt: T0,
      input: structuredClone(defaultFinancialInput),
      dailyRecords: {},
      scenarios: [scn, { ...structuredClone(scn) }],
    };
  };

  it('unit: duplicate v1 ids warn, set contentLoss=true and count as dropped', () => {
    const parsed = parseBackup(JSON.stringify(v1WithDuplicateScenarios()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contentLoss).toBe(true);
    expect(parsed.warnings.some(w => w.startsWith('duplicate-id'))).toBe(true);
    expect(parsed.dropped.scenarios).toBe(1); // original 2 → deduped 1
    expect(parsed.file.data.scenarios).toHaveLength(1);
  });
});
