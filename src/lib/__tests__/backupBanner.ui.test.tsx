// @vitest-environment jsdom
// BackupBanner component + download-reset integration (contract G2).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BackupBanner } from '@/components/rebuild/BusinessModelApp';
import { BACKUP_REMINDER_KEY } from '@/lib/backupReminder';

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
}));

const onCta = vi.fn();
const onDismiss = vi.fn();

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => cleanup());

function renderBanner(reason: 'never' | 'stale' | 'invalid' | 'future' | 'fresh' | 'no-data', days: number | null = null) {
  return render(<BackupBanner reason={reason} days={days} onCta={onCta} onDismiss={onDismiss} />);
}

describe('BackupBanner rendering per reminder state', () => {
  it('never: shows never-backed-up copy', () => {
    renderBanner('never');
    expect(screen.getByTestId('backup-banner').getAttribute('data-reason')).toBe('never');
    expect(screen.getByText(/bannerBodyNever/)).toBeTruthy();
  });

  it('stale ≥7d: shows day count', () => {
    renderBanner('stale', 9);
    expect(screen.getByText(/bannerBodyStale/)).toBeTruthy();
    expect(screen.getByText(/bannerBodyStale.*~days=9~/).textContent).toContain('~days=9~');
  });

  it('invalid timestamp: corrupted-stamp copy', () => {
    renderBanner('invalid');
    expect(screen.getByText(/bannerBodyInvalid/)).toBeTruthy();
  });

  it('CTA and dismissal fire their callbacks; role=status for aria-live', async () => {
    renderBanner('stale', 8);
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    fireEvent.click(screen.getByTestId('banner-cta'));
    fireEvent.click(screen.getByTestId('banner-dismiss'));
    await Promise.resolve();
    expect(onCta).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('successful download resets the reminder stamp (integration)', () => {
  it('ScenarioView backup click writes RAW ISO under the device metadata key — outside backup files', async () => {
    // reuse the ScenarioView harness minimally
    const { defaultFinancialInput } = await import('@/lib/mockData');
    const spies = { setDailyRecords: vi.fn(), setScenarios: vi.fn(), setRecoveryEntries: vi.fn(), setActions: vi.fn(), applyFinancialInput: vi.fn(), onBackedUp: vi.fn() };
    const { ScenarioView } = await import('@/components/rebuild/BusinessModelApp');
    render(
      <ScenarioView
        input={structuredClone(defaultFinancialInput)}
        output={{} as never}
        scenarios={[]}
        setScenarios={spies.setScenarios}
        dailyRecords={{}}
        setDailyRecords={spies.setDailyRecords}
        recoveryEntries={[]}
        setRecoveryEntries={spies.setRecoveryEntries}
        stops={[]}
        setStops={() => undefined}
        actions={[{ id: 1, text: 'a', owner: 'o', done: false }]}
        setActions={spies.setActions}
        applyFinancialInput={spies.applyFinancialInput}
        onBackedUp={() => {
          localStorage.setItem(BACKUP_REMINDER_KEY, new Date().toISOString());
          spies.onBackedUp();
        }}
      />,
    );
    const created: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => { created.push(blob as Blob); return 'blob:x'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    HTMLAnchorElement.prototype.click = vi.fn();

    fireEvent.click(screen.getByText(/downloadBackup/));
    expect(spies.onBackedUp).toHaveBeenCalledOnce();
    const stored = localStorage.getItem(BACKUP_REMINDER_KEY);
    expect(stored).not.toBeNull();
    expect(new Date(stored as string).getTime()).not.toBeNaN(); // raw valid ISO

    // AND the downloaded file must NOT contain the reminder metadata
    const text = await created[0].text();
    expect(text.includes('vega-last-backup-at')).toBe(false);
    expect(JSON.parse(text).data).not.toHaveProperty('lastBackupAt');
  });
});
