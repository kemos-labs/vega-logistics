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

// Mutable active-language handle so tests can flip the UI language and
// observe it flowing into exports / restores.
let CURRENT_LANG: 'en' | 'ar' = 'en';
const changeLanguageSpy = vi.fn();

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdparty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      let out = key;
      if (opts) for (const [k, v] of Object.entries(opts)) out += ` ~${k}=${String(v)}~`;
      return out;
    },
    i18n: { get language() { return CURRENT_LANG; }, changeLanguage: (lng: string) => changeLanguageSpy(lng) },
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

let lastSpies: ReturnType<typeof createSpies> | undefined;
function createSpies() {
  return {
    setDailyRecords: vi.fn(),
    setScenarios: vi.fn(),
    setRecoveryEntries: vi.fn(),
    setActions: vi.fn(),
    applyFinancialInput: vi.fn(),
  };
}
function spiesForLastRender() {
  return lastSpies as unknown as Record<string, ReturnType<typeof vi.fn>>;
}

function renderView(current: StateBundle, language = 'en') {
  const spies = createSpies();
  lastSpies = spies;
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
      applyFinancialInput={spies.applyFinancialInput} onBackedUp={() => undefined} />,
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
  CURRENT_LANG = 'en';
});
afterEach(() => cleanup());

describe('exported file language (contract E-1)', () => {
  it('intercepts the downloaded Blob and proves the ACTIVE language is inside', async () => {
    CURRENT_LANG = 'ar'; // operator is using the Arabic UI
    renderView(bundle());
    const created: Blob[] = [];
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
      created.push(blob as Blob);
      return 'blob:mock';
    });
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi.fn();
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = clickSpy;

    fireEvent.click(screen.getByText(/downloadBackup/));

    expect(clickSpy).toHaveBeenCalled();
    createSpy.mockRestore(); revokeSpy.mockRestore(); HTMLAnchorElement.prototype.click = originalClick;
    expect(created).toHaveLength(1);
    const text = await created[0].text();
    const parsedFile = JSON.parse(text) as { format: string; version: number; data: { language?: string } };
    expect(parsedFile.format).toBe('vega-logistics-backup');
    expect(parsedFile.version).toBe(2);
    expect(parsedFile.data.language).toBe('ar'); // active language captured in the export
  });
});

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
    const firedEvents: string[] = [];
    const onLang = (event: Event) => firedEvents.push((event as CustomEvent).detail as string);
    window.addEventListener('vega:set-language', onLang);
    chooseFile(new File([JSON.stringify(buildBackup(incoming, 'ar'))], 'r.json', { type: 'application/json' }));
    await expectPreview();
    fireEvent.click(screen.getByTestId('import-replace'));
    await waitFor(() => expect(spies.applyFinancialInput).toHaveBeenCalled());

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.dailyRecords) ?? '{}')['2026-09-01'].completedShipments).toBe(12);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.recoveryEntries) ?? '[]')[0].owner).toBe('');
    // RAW storage — matches ClientLayout.setItem('language', lang), never JSON-stringified
    expect(localStorage.getItem(STORAGE_KEYS.language)).toBe('ar');
    expect(changeLanguageSpy).toHaveBeenCalledWith('ar');
    expect(firedEvents).toContain('ar');
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

describe('quota failure → transactional rollback in the UI (contract E-4)', () => {
  it('setters untouched, previous values restored, preview stays open, no success message', async () => {
    const current = bundle();
    const previousDaysRaw = JSON.stringify(current.dailyRecords);
    // seed so there IS a previous value to protect
    localStorage.setItem(STORAGE_KEYS.dailyRecords, previousDaysRaw);
    renderView(current);
    const originalSetItem = Storage.prototype.setItem;
    let quotaHit = false;
    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      // fail ONLY the first dailyRecords write so the subsequent ROLLBACK
      // pass can succeed — exercising the recoverable branch
      if (!quotaHit && key === STORAGE_KEYS.dailyRecords) {
        quotaHit = true;
        throw new DOMException('quota', 'QuotaExceededError');
      }
      return originalSetItem.call(this, key, value);
    };
    try {
      const incoming: StateBundle = { ...bundle(), dailyRecords: { '2026-08-30': record('2026-08-30', 77, 1) } };
      chooseFile(new File([JSON.stringify(buildBackup(incoming))], 'q.json', { type: 'application/json' }));
      await expectPreview();
      fireEvent.click(screen.getByTestId('import-merge'));

      // React setters were NEVER called — storage failed first
      expect(spiesForLastRender().setDailyRecords).not.toHaveBeenCalled();
      // previous raw value rolled back / untouched
      expect(localStorage.getItem(STORAGE_KEYS.dailyRecords)).toBe(previousDaysRaw);
      // preview remains open for retry-or-cancel
      expect(screen.getByTestId('import-preview')).toBeTruthy();
      // no success message appeared
      expect(screen.queryByText(/mergeDoneMessage/)).toBeNull();
      // honest partial-failure message IS shown
      await screen.findByText(/partialFailMessage/);
    } finally {
      Storage.prototype.setItem = originalSetItem;
    }
  });
});

describe('v1 scoped restore through the UI (contract E-2)', () => {
  it('wipe-default browser → v1 restore → v1 model/days/scenarios back, newer scope preserved', async () => {
    // "old device": only v1-era data ever existed; user ALSO has newer-scope
    // rows on this device that v1 could never have contained
    const current = bundle(); // has recovery entry + action + language default en
    const v1Payload = {
      version: 1,
      exportedAt: T0,
      input: structuredClone(defaultFinancialInput),
      dailyRecords: { '2026-06-30': record('2026-06-30', 30, 6) },
      scenarios: [{ id: 'scn-old', name: 'Old plan', savedAt: '2026-06-01T00:00:00.000Z', input: structuredClone(defaultFinancialInput) }],
    };
    localStorage.setItem(STORAGE_KEYS.recoveryEntries, JSON.stringify(current.recoveryEntries));
    localStorage.setItem(STORAGE_KEYS.followUpActions, JSON.stringify(current.followUpActions));
    localStorage.setItem(STORAGE_KEYS.language, 'en');

    const { spies } = renderView(current);
    chooseFile(new File([JSON.stringify(v1Payload)], 'legacy.json', { type: 'application/json' }));
    await expectPreview();
    expect(screen.getByTestId('legacy-note')).toBeTruthy();
    fireEvent.click(await screen.findByTestId('import-legacy'));
    await screen.findByText(/scopedDoneMessage/);

    // v1 scope adopted (React)
    expect(spies.applyFinancialInput).toHaveBeenCalledWith(v1Payload.input);
    expect(spies.setDailyRecords).toHaveBeenCalledWith(expect.objectContaining({ '2026-06-30': expect.objectContaining({ completedShipments: 30 }) }));
    expect(spies.setScenarios).toHaveBeenCalledWith([expect.objectContaining({ id: 'scn-old' })]);
    // newer scope PRESERVED (React)
    expect(spies.setRecoveryEntries).not.toHaveBeenCalled();
    expect(spies.setActions).not.toHaveBeenCalled();

    // RELOAD simulation from raw storage:
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.dailyRecords) ?? '{}')['2026-06-30'].completedShipments).toBe(30);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.scenarios) ?? '[]')[0].id).toBe('scn-old');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.financialInput) ?? '{}')).toEqual(defaultFinancialInput);
    // newer-scope collections never replaced by the v1 file:
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.recoveryEntries) ?? '[]')).toEqual(current.recoveryEntries);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.followUpActions) ?? '[]')).toEqual(current.followUpActions);
    expect(localStorage.getItem(STORAGE_KEYS.language)).toBe('en');
  });
});

describe('corrupt v1 blocks scoped restore (contract F2)', () => {
  it('legacy button disabled + explicit corrupt-legacy warning; merge still available', async () => {
    renderView(bundle());
    const v1 = { version: 1, exportedAt: T0, input: structuredClone(defaultFinancialInput), dailyRecords: { '2026-07-01': { date: '2026-07-01', completedShipments: 'junk' } }, scenarios: [] };
    chooseFile(new File([JSON.stringify(v1)], 'broken-legacy.json', { type: 'application/json' }));
    await expectPreview();
    expect(await screen.findByTestId('corrupt-legacy-warning')).toBeTruthy();
    const legacyButton = await screen.findByTestId('import-legacy') as HTMLButtonElement;
    expect(legacyButton.disabled).toBe(true);
    expect((screen.getByTestId('import-merge') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('snapshot-read failure aborts restore in the UI (contract F4)', () => {
  it('preview stays open, no setters run, honest failure message shown', async () => {
    localStorage.setItem(STORAGE_KEYS.dailyRecords, '{"seed":true}');
    renderView(bundle());
    const incoming: StateBundle = { ...bundle(), dailyRecords: { '2026-08-31': record('2026-08-31', 10, 1) } };
    const originalGetItem = Storage.prototype.getItem;
    let readLockArmed = true; // fail only the FIRST dailyRecords read
    Storage.prototype.getItem = function (this: Storage, key: string) {
      if (readLockArmed && key === STORAGE_KEYS.dailyRecords) {
        readLockArmed = false;
        throw new Error('read locked');
      }
      return originalGetItem.call(this, key);
    };
    try {
      chooseFile(new File([JSON.stringify(buildBackup(incoming))], 'f.json', { type: 'application/json' }));
      await expectPreview();
      fireEvent.click(screen.getByTestId('import-merge'));
      // abort BEFORE any write/state change:
      expect(lastSpies?.setDailyRecords).not.toHaveBeenCalled();
      expect(localStorage.getItem(STORAGE_KEYS.dailyRecords)).toBe('{"seed":true}');
      expect(screen.getByTestId('import-preview')).toBeTruthy();
      expect(screen.queryByText(/mergeDoneMessage/)).toBeNull();
      await screen.findByText(/partialFailMessage/);
    } finally {
      Storage.prototype.getItem = originalGetItem;
    }
  });
});
