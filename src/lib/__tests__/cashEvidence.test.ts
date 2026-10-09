import { describe, expect, it } from 'vitest';
import { summarizeCashEvidence } from '@/lib/cashEvidence';
import type { DailyRecord } from '@/lib/operationsReporting';
import { buildOperationalWorkbookData } from '@/lib/operationsReportExport';
const record = (extra: Partial<DailyRecord> = {}): DailyRecord => ({ date: '2026-10-08', completedShipments: 1, failedShipments: 0, fuelCost: 0, driversPresent: 1, notes: '', updatedAt: '', ...extra });
describe('cash evidence coverage', () => {
  it('distinguishes no evidence from explicitly recorded zero', () => {
    expect(summarizeCashEvidence([]).outstandingSar).toBeNull();
    expect(summarizeCashEvidence([record()]).collectedSar).toBeNull();
    expect(summarizeCashEvidence([record({ cashCollectedSar: 0, cashRemittedSar: 0 })]).outstandingSar).toBe(0);
  });
  it('does not net partial history and keeps independently known collection', () => {
    const result = summarizeCashEvidence([record({ cashCollectedSar: 50, cashRemittedSar: 20 }), record({ date: '2026-10-07', cashCollectedSar: 10 })]);
    expect(result).toEqual({ collectedSar: 60, remittedSar: null, outstandingSar: null, missingDates: ['2026-10-07'] });
  });
  it('rejects malformed amounts and excludes drafts', () => {
    for (const value of [NaN, Infinity, -1]) expect(summarizeCashEvidence([record({ cashCollectedSar: value, cashRemittedSar: 0 })]).collectedSar).toBeNull();
    expect(summarizeCashEvidence([record({ cashCollectedSar: 10, cashRemittedSar: 0 }), record({ closeStatus: 'draft' })]).outstandingSar).toBe(10);
  });
  it('operational workbook never turns missing cash into zeros', () => {
    const data = buildOperationalWorkbookData({ date: '2026-10-08', record: record(), stops: [], runs: [] });
    expect(data.company).toMatchObject({ collected: null, remitted: null, outstanding: null, uncollected: null, overRemitted: null });
  });
});
