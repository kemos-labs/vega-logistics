import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import BusinessModelApp from '@/components/rebuild/BusinessModelApp';
import { createStopRecord } from '@/lib/stops';

describe('Today shell IA', () => {
  beforeEach(() => { localStorage.clear(); });

  it('defaults to Today and renders primary nav with exactly four items', async () => {
    render(<BusinessModelApp />);
    // primary nav
    const primaryBtns = screen.getAllByTestId(/^primary-nav-/);
    expect(primaryBtns).toHaveLength(4);
    expect(primaryBtns.map(b => b.getAttribute('data-testid'))).toEqual(
      expect.arrayContaining(['primary-nav-today','primary-nav-operations','primary-nav-reports','primary-nav-more'])
    );
    // H1 عمليات اليوم / Today’s Operations
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/عمليات اليوم|Today/);
    // mobile bottom nav also 4
    const mobileBtns = screen.getAllByTestId(/^mobile-nav-/);
    expect(mobileBtns).toHaveLength(4);
  });

  it('nested navigation lands correctly', async () => {
    render(<BusinessModelApp />);
    // Operations -> Stops
    act(() => { screen.getByTestId('primary-nav-operations').click(); });
    expect(screen.getByTestId('subgroup-operations')).toBeTruthy();
    act(() => { screen.getAllByRole('button', { name: /^Stops$/ })[0].click(); });
    expect(screen.getByTestId('stop-planning')).toBeTruthy();

    // Reports -> Daily
    act(() => { screen.getByTestId('primary-nav-reports').click(); });
    expect(screen.getByTestId('subgroup-reports')).toBeTruthy();

    // More -> Fleet
    act(() => { screen.getByTestId('primary-nav-more').click(); });
    expect(screen.getByTestId('subgroup-more')).toBeTruthy();
    act(() => { screen.getAllByRole('button', { name: /Cars & drivers/i })[0].click(); });
    expect(screen.getByRole('heading', { name: /Cars & drivers/i })).toBeTruthy();
  });
});
