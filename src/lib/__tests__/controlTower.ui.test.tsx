// @vitest-environment jsdom
// ControlTowerView — presentational behavior (Release R1).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ControlTowerView } from '@/components/rebuild/ControlTower';
import { buildControlTowerSnapshot } from '@/lib/controlTower';

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

const NOW = new Date('2026-08-23T12:00:00+03:00').getTime();

function snapFixture() {
  return buildControlTowerSnapshot({
    records: {
      '2026-08-22': { date: '2026-08-22', completedShipments: 82, failedShipments: 6, recoveredShipments: 3, fuelCost: 90, driversPresent: 2, notes: '', updatedAt: '', cashCollectedSar: 400, cashRemittedSar: 100 },
    },
    recoveryEntries: [{ id: 'r1', createdAt: '2026-08-10', shipments: 2, owner: 'me', status: 'pending' }],
    plannedShipmentsPerDay: 100,
    nowMs: NOW,
    backup: { visible: true, reason: 'stale', daysSince: 9 },
  });
}

afterEach(() => cleanup());

describe('ControlTowerView', () => {
  it('shows the top actions with interpolated params and severity markers', () => {
    render(<ControlTowerView snapshot={snapFixture()} onGoto={vi.fn()} />);
    const actions = screen.getByTestId('tower-actions');
    expect(actions.textContent).toContain('~count=1~');           // recovery overdue
    expect(actions.textContent).toContain('~amount=300~');        // COD outstanding
    expect(document.querySelector('[data-testid="action-recovery-overdue"]')?.className).toContain('bm-sev-high');
  });

  it('yesterday tile reports delivered/planned plus failed and recovered counts', () => {
    render(<ControlTowerView snapshot={snapFixture()} onGoto={vi.fn()} />);
    const y = screen.getByTestId('tower-yesterday');
    expect(y.textContent).toContain('82 / 100');
    expect(y.textContent).toContain('6');   // failed
    expect(y.textContent).toContain('3');   // recovered
    expect(screen.getByTestId('tower-cod').textContent).toContain('300');
  });

  it('navigation buttons route to the corrective workflows', () => {
    const onGoto = vi.fn();
    render(<ControlTowerView snapshot={snapFixture()} onGoto={onGoto} />);
    fireEvent.click(screen.getByText('businessModel.tower.goRecovery'));
    expect(onGoto).toHaveBeenCalledWith('recovery');
  });

  it('clean snapshot renders the all-clear state instead of an empty action list', () => {
    const clean = buildControlTowerSnapshot({
      records: { '2026-08-22': { date: '2026-08-22', completedShipments: 92, failedShipments: 0, fuelCost: 90, driversPresent: 2, notes: '', updatedAt: '', cashCollectedSar: 100, cashRemittedSar: 100, podStatus: 'complete' } },
      recoveryEntries: [], plannedShipmentsPerDay: 100, nowMs: NOW,
      backup: { visible: false, reason: 'fresh', daysSince: 1 },
    });
    render(<ControlTowerView snapshot={clean} onGoto={vi.fn()} />);
    expect(screen.getByTestId('tower-clear')).toBeTruthy();
    expect(screen.queryByTestId('tower-actions')).toBeNull();
  });
});
