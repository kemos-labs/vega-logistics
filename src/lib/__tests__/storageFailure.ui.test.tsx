import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import BusinessModelApp from '@/components/rebuild/BusinessModelApp';
import { useSimulatedData } from '@/hooks/useSimulatedData';
import { STORAGE_KEYS } from '@/lib/backup';
import { defaultFinancialInput } from '@/lib/mockData';

describe('operator-visible storage failure handling', () => {
  beforeEach(() => { localStorage.clear(); cleanup(); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('preserves malformed stop bytes, shows one actionable warning and opens backup recovery', async () => {
    const raw = '{not-json';
    localStorage.setItem(STORAGE_KEYS.stops, raw);
    render(<BusinessModelApp />);

    const alert = screen.getByTestId('storage-failure-alert');
    expect(alert.textContent).toContain('Saved data could not be read');
    expect(screen.queryByTestId('stops-boot-warning')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open Backups' }));
    await waitFor(() => expect(document.getElementById('bm-backup-card')).toBeTruthy());
    expect(localStorage.getItem(STORAGE_KEYS.stops)).toBe(raw);
  });

  it('keeps financial state and derived output at the last durable value after quota failure', () => {
    const key = 'vega-financialInput-v2';
    const saved = JSON.stringify({ ...structuredClone(defaultFinancialInput), companyDriverCount: 9 });
    localStorage.setItem(key, saved);
    const { result } = renderHook(() => useSimulatedData());
    const beforeInput = result.current.financialInput;
    const beforeOutput = result.current.financialOutput;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    let outcome: unknown;
    act(() => { outcome = result.current.updateFinancialInput({ companyDriverCount: 2 }); });
    expect(outcome).toMatchObject({ ok: false, issue: { stage: 'write' } });
    expect(result.current.financialInput).toEqual(beforeInput);
    expect(result.current.financialOutput).toEqual(beforeOutput);
    expect(localStorage.getItem(key)).toBe(saved);
    expect(setItem).toHaveBeenCalledOnce();
  });
});
