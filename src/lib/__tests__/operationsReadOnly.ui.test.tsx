import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StopPlanning } from '@/components/rebuild/StopPlanning';
import { DispatchBoardView } from '@/components/rebuild/DispatchBoard';
import { createStopRecord } from '@/lib/stops';

const DATE = '2026-08-27';
const NOW = '2026-08-27T12:00:00.000Z';

function stop(over: Partial<ReturnType<typeof createStopRecord>> = {}) {
  return createStopRecord({ operationDate: DATE, customerName: 'C', stopLabel: 'L', addressNotes: 'ok', ...over }, NOW);
}

describe('Operations readOnly when reconciled', () => {
  beforeEach(() => { localStorage.clear(); });

  it('StopPlanning blocks save/delete/import when reconciled, draft remains enabled', async () => {
    const s = stop({ reference: 'R1' });
    const setStops = vi.fn();
    const draftSetStops = vi.fn();
    // reconciled
    const { unmount } = render(<StopPlanning stops={[s]} setStops={setStops} initialDate={DATE} readOnly={true} />);
    expect(screen.getByTestId('stops-readonly-blocked')).toBeTruthy();
    const saveBtn = screen.getByTestId('save-stop') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    // forced submit should not call setStops
    const form = document.querySelector('form.bm-stops-form') as HTMLFormElement;
    fireEvent.submit(form);
    expect(setStops).not.toHaveBeenCalled();
    // delete also blocked
    const delBtn = screen.getByTestId('delete-R1') as HTMLButtonElement;
    expect(delBtn.disabled).toBe(true);
    // import confirm blocked
    // need to setup preview first: paste valid CSV
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'customer,label\nTest,Stop1' } });
    fireEvent.click(screen.getByTestId('parse-stops-btn'));
    const confirm = screen.queryByTestId('confirm-import') as HTMLButtonElement | null;
    if (confirm) expect(confirm.disabled).toBe(true);
    unmount();
    // draft remains enabled
    render(<StopPlanning stops={[s]} setStops={draftSetStops} initialDate={DATE} readOnly={false} />);
    expect(screen.queryByTestId('stops-readonly-blocked')).toBeNull();
    expect((screen.getByTestId('save-stop') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('delete-R1') as HTMLButtonElement).disabled).toBe(false);
  });

  it('DispatchBoard blocks assign/move/unassign when reconciled, draft remains enabled', async () => {
    const s1 = stop({ reference: 'A' }); // unassigned
    const s2 = stop({ reference: 'B', driverName: 'Ali', carNumber: 'V1' });
    const setStops = vi.fn();
    const drivers = [{ id: 'd1', fullName: 'Ali', phone: '05', assignedVehicle: 'V1', status: 'active' as const }];
    const { unmount } = render(<DispatchBoardView stops={[s1, s2]} setStops={setStops} drivers={drivers as never} initialDate={DATE} readOnly={true} />);
    expect(screen.getByTestId('dispatch-readonly-blocked')).toBeTruthy();
    const assignSel = screen.getByTestId('assign-A') as HTMLSelectElement;
    expect(assignSel.disabled).toBe(true);
    // move buttons disabled (first is disabled due to index, but also readOnly)
    const upBtn = screen.getByTestId('up-B') as HTMLButtonElement;
    expect(upBtn.disabled).toBe(true);
    const unassignBtn = screen.getByRole('button', { name: /unassign/i }) as HTMLButtonElement;
    expect(unassignBtn.disabled).toBe(true);
    // forced assign via handler should not call setStops
    fireEvent.change(assignSel, { target: { value: 'd1' } });
    expect(setStops).not.toHaveBeenCalled();
    unmount();
    // draft enabled
    render(<DispatchBoardView stops={[s1, s2]} setStops={setStops} drivers={drivers as never} initialDate={DATE} readOnly={false} />);
    expect(screen.queryByTestId('dispatch-readonly-blocked')).toBeNull();
    expect((screen.getByTestId('assign-A') as HTMLSelectElement).disabled).toBe(false);
  });
});
