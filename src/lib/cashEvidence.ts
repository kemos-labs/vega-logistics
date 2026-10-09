import type { DailyRecord } from '@/lib/operationsReporting';

export function isKnownCashAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Complete evidence is required for a total; partial sums are not balances. */
export function summarizeCashEvidence(input: DailyRecord[]): {
  collectedSar: number | null;
  remittedSar: number | null;
  outstandingSar: number | null;
  missingDates: string[];
} {
  const records = input.filter(record => record.closeStatus !== 'draft');
  const total = (field: 'cashCollectedSar' | 'cashRemittedSar'): number | null =>
    records.length > 0 && records.every(record => isKnownCashAmount(record[field]))
      ? records.reduce((sum, record) => sum + (record[field] as number), 0) : null;
  const collectedSar = total('cashCollectedSar');
  const remittedSar = total('cashRemittedSar');
  return {
    collectedSar,
    remittedSar,
    outstandingSar: collectedSar !== null && remittedSar !== null ? Math.max(0, collectedSar - remittedSar) : null,
    missingDates: records.filter(record => !isKnownCashAmount(record.cashCollectedSar) || !isKnownCashAmount(record.cashRemittedSar))
      .map(record => record.date).sort((a, b) => b.localeCompare(a)),
  };
}
