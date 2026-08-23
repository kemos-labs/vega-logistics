// @vitest-environment jsdom
// Browser-level backup tests (review contract C5): the REAL ScenarioView UI
// driving parse → preview → decision, asserting React state calls AND raw
// localStorage contents.
import type { ComponentType } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DailyRecord } from '@/lib/operationsReporting';
import {
  buildBackup,
  STORAGE_KEYS,
  type FollowUpAction,
  type StateBundle,
} from '@/lib/backup';
import { defaultFinancialInput } from '@/lib/mockData';
import { ScenarioView } from '@/components/rebuild/BusinessModelApp';

const T0 = '2026-08-20T18:00:00.000Z';

// Parse continuations settle outside act(); with the act environment ON,
// React 19 queues those renders behind an enclosing act scope that never
// arrives. Disable it so renders flush through the normal scheduler.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdparty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      let out = key;
      if (opts) for (const [k, v] of Object.entries(opts)) out += ` ~${k}=${String(v)}~`;
      return out;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  withTranslation: () => <P extends object>(Component: ComponentType<P>) => Component,
}));

function record(date: string, completed: number, failed: number): DailyRecord {
  return { date, completedShipments: completed, failedShipments: failed, fuelCost: 100, driversPresent: 2, notes: '', updatedAt: `${date}T18:00:00.000Z` };
}

function bundle(overrides: Partial<StateBundle> = {}): StateBundle {
  return {
    financialInput: structuredClone(defaultFinancialInput),
    dailyRecords: { '2026-08-20': record('2026-08-20', 37, 14) },
    scenarios: [{ id: 'scn-1', name: 'Base', savedAt: T0, input: structuredClone(defaultFinancialInput) }],
    recoveryEntries: [{ id: 'rec-1', createdAt: '2026-08-19', shipments: 3, owner: 'Yaquob', status: 'pending' }],
    followUpActions: [{ id: 1, text: 'Review pricing', owner: 'Ops', done: false }],
    ...overrides,
  };
}

function renderView(current: StateBundle, language = 'en') {
  const spies = {
    setDailyRecords: vi.fn(),
    setScenarios: vi.fn(),
    setRecoveryEntries: vi.fn(),
    setActions: vi.fn(),
    applyFinancialInput: vi.fn(),
  };
  const view = render(
    <ScenarioView
      input={current.financialInput}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      output={{} as any}
      scenarios={current.scenarios}
      setScenarios={spies.setScenarios}
      dailyRecords={current.dailyRecords}
      setDailyRecords={spies.setDailyRecords}
      recoveryEntries={current.recoveryEntries}
      setRecoveryEntries={spies.setRecoveryEntries}
      actions={current.followUpActions as FollowUpAction[]}
      setActions={spies.setActions}
      applyFinancialInput={spies.applyFinancialInput}
    />,
  );
  void language;
  return { view, spies };
}

function chooseFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  fireEvent.change(input, { target: { files: [file] } });
}

async function expectPreview() {
  // findBy* wraps polling in RTL's async(act) wrapper — required because the
  // parse continuation settles outside any synchronous act() scope.
  return screen.findByTestId('import-preview');
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe('backup UI integration', () => {
  it('preview → Cancel changes neither React state nor localStorage', async () => {
    const current = bundle();
    const before = structuredClone(current);
    const { spies } = renderView(current);
    const file = new File([JSON.stringify(buildBackup(bundle({ dailyRecords: { '2026-08-23': record('2026-08-23', 9, 1) } })))], 'v.json', { type: 'application/json' });
    chooseFile(file);
    await expectPreview();

    fireEvent.click(screen.getByTestId('import-cancel'));

    expect(screen.queryByTestId('import-preview')).toBeNull();
    Object.values(spies).forEach(spy => expect(spy).not.toHaveBeenCalled());
    expect(localStorage.getItem(STORAGE_KEYS.dailyRecords)).toBeNull();
    expect(current).toEqual(before);
  });

  it('strict parse failure changes nothing and reports failure', async () => {
    const current = bundle();
    const { spies } = renderView(current);
    const file = new File(['{"format":"vega-logistics-backup","version":2,"data":{"financialInput":{}}}'], 'bad.json', { type: 'application/json' });
    chooseFile(file);
    // shapeless financial input ⇒ rejected ⇒ NO preview panel at all;
    // failure surfaces through the async parse continuation → findBy*
    await screen.findByText(/importFailed/);
    expect(screen.queryByTestId('import-preview')).toBeNull();
    Object.values(spies).forEach(spy => expect(spy).not.toHaveBeenCalled());
    expect(localStorage.length).toBe(0);
  });

  it('merge persists every expected key and keeps model inputs + language', async () => {
    const current = bundle();
    localStorage.setItem(STORAGE_KEYS.language, 'en');
    const incoming: StateBundle = {
      ...bundle(),
      dailyRecords: { '2026-08-26': record('2026-08-26', 51, 0, ) },
    };
    (incoming.followUpActions[0] as FollowUpAction).updatedAt = T0;
    const { spies } = renderView(current);
    chooseFile(new File([JSON.stringify(buildBackup(incoming))], 'm.json', { type: 'application/json' }));
    await expectPreview();
    fireEvent.click(screen.getByTestId('import-merge'));
    await waitFor(() => expect(spies.setDailyRecords).toHaveBeenCalled());

    const storedDays = JSON.parse(localStorage.getItem(STORAGE_KEYS.dailyRecords) ?? '{}');
    expect(storedDays['2026-08-26'].completedShipments).toBe(51);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.recoveryEntries) ?? '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.scenarios) ?? '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.financialInput) ?? '{}').driverSalary).toBe(defaultFinancialInput.driverSalary);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.followUpActions) ?? '[]')).toHaveLength(1);
    expect(localStorage.getItem(STORAGE_KEYS.language)).toBe('en'); // merge never touches language
    // applyFinancialInput IS invoked but receives the unchanged current inputs —
    // assert the kept identity rather than call-count:
    expect(spies.applyFinancialInput).toHaveBeenCalledWith(current.financialInput);
    await screen.findByText(/mergeDoneMessage/);
  });

  it('replace persists every expected key including language, and switches locale event', async () => {
    const current = bundle();
    const incoming = bundle({
      dailyRecords: { '2026-09-01': record('2026-09-01', 12, 2) },
      recoveryEntries: [{ id: 'r9', createdAt: '2026-09-01', shipments: 1, owner: '', status: 'pending' }],
    });
    const { spies } = renderView(current);
    chooseFile(new File([JSON.stringify(buildBackup(incoming, 'ar'))], 'r.json', { type: 'application/json' }));
    await expectPreview();
    fireEvent.click(screen.getByTestId('import-replace'));
    await waitFor(() => expect(spies.applyFinancialInput).toHaveBeenCalled());

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.dailyRecords) ?? '{}')['2026-09-01'].completedShipments).toBe(12);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.recoveryEntries) ?? '[]')[0].owner).toBe('');
    expect(localStorage.getItem(STORAGE_KEYS.language)).toBe('"ar"');
    expect(screen.getByText(/replaceDoneMessage/)).toBeTruthy();
  });

  it('lossy files disable Replace and show the dropped warning; Merge stays available', async () => {
    const current = bundle();
    renderView(current);
    const payload = buildBackup(bundle());
    // corrupt one required numeric inside an otherwise valid container
    const poisoned = JSON.parse(JSON.stringify(payload)) as { data: { dailyRecords: Record<string, unknown> } };
    poisoned.data.dailyRecords['2026-08-27'] = { date: '2026-08-27', completedShipments: 'garbage' };
    chooseFile(new File([JSON.stringify(poisoned)], 'lossy.json', { type: 'application/json' }));
    await expectPreview();

    const replaceButton = await screen.findByTestId('import-replace') as HTMLButtonElement;
    expect(replaceButton.disabled).toBe(true);
    expect(screen.getByTestId('import-warning')).toBeTruthy();
    expect((screen.getByTestId('import-merge') as HTMLButtonElement).disabled).toBe(false);
  });

  it('v1 preview clearly warns that recovery entries and actions were never contained', async () => {
    const current = bundle();
    renderView(current);
    const v1 = { version: 1, exportedAt: T0, input: structuredClone(defaultFinancialInput), dailyRecords: {}, scenarios: [] };
    chooseFile(new File([JSON.stringify(v1)], 'old.json', { type: 'application/json' }));
    await screen.findByTestId('legacy-note');
    const replaceButton = screen.getByTestId('import-replace') as HTMLButtonElement;
    expect(replaceButton.disabled).toBe(true); // v1 cannot be a lossless replacement
  });

  it('wipe → restore → simulated reload produces deep equality', async () => {
    const original = bundle({ followUpActions: [{ id: 1, text: 'Review pricing', owner: 'Ops', done: true, updatedAt: T0 }] });
    // establish the "old device" storage
    localStorage.setItem(STORAGE_KEYS.financialInput, JSON.stringify(original.financialInput));
    localStorage.setItem(STORAGE_KEYS.dailyRecords, JSON.stringify(original.dailyRecords));
    localStorage.setItem(STORAGE_KEYS.scenarios, JSON.stringify(original.scenarios));
    localStorage.setItem(STORAGE_KEYS.recoveryEntries, JSON.stringify(original.recoveryEntries));
    localStorage.setItem(STORAGE_KEYS.followUpActions, JSON.stringify(original.followUpActions));
    const snapshotFile = new File([JSON.stringify(buildBackup(original))], 'snapshot.json', { type: 'application/json' });

    // WIPE
    localStorage.clear();
    expect(localStorage.getItem(STORAGE_KEYS.dailyRecords)).toBeNull();

    // RESTORE through the real UI onto empty state
    const empty: StateBundle = { financialInput: structuredClone(defaultFinancialInput), dailyRecords: {}, scenarios: [], recoveryEntries: [], followUpActions: [] };
    renderView(empty);
    chooseFile(snapshotFile);
    await expectPreview();
    fireEvent.click(screen.getByTestId('import-replace'));
    await waitFor(() => screen.getByText(/replaceDoneMessage/));

    // RELOAD simulation: read raw persisted keys only
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.dailyRecords) ?? '{}')).toEqual(original.dailyRecords);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.scenarios) ?? '[]')).toEqual(original.scenarios);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.recoveryEntries) ?? '[]')).toEqual(original.recoveryEntries);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.followUpActions) ?? '[]')).toEqual(original.followUpActions);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.financialInput) ?? '{}')).toEqual(original.financialInput);
  });
});
