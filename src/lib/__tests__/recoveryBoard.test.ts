import { describe, it, expect } from 'vitest';
import { buildWeeklyRecoveryTrend, createRecoveryEntry, sortForAction, summarizeRecoveryBoard, validateRecoveryEntries } from '@/lib/recoveryBoard';

const NOW = new Date('2026-08-22T12:00:00');
const dayKeyHelper = (days: number) => {
  const date = new Date(NOW);
  date.setDate(NOW.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const daysAgo = (days: number) => {
  const date = new Date(NOW);
  date.setDate(NOW.getDate() - days);
  return date.toISOString().slice(0, 10);
};

describe('recovery board — validation', () => {
  it('drops junk rows and coerces the rest', () => {
    const entries = validateRecoveryEntries([
      { id: 'a', createdAt: '2026-08-01', shipments: 3, status: 'pending', owner: 'Fahad' },
      { createdAt: 'garbage', shipments: 5, status: 'pending' },
      { createdAt: '2026-08-02', shipments: -2, status: 'pending' },
      null,
      'nope',
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: 'a', shipments: 3, owner: 'Fahad' });
  });

  it('defaults unknown status to pending? no — drops unknown status', () => {
    expect(validateRecoveryEntries([{ createdAt: '2026-08-01', shipments: 1, status: 'weird' }])).toHaveLength(0);
  });

  it('trims overlong customer/owner/note fields', () => {
    const [entry] = validateRecoveryEntries([{ createdAt: '2026-08-01', shipments: 1, status: 'pending', note: 'x'.repeat(500), customer: 'c'.repeat(200) }]);
    expect(entry?.note).toHaveLength(300);
    expect(entry?.customer).toHaveLength(80);
  });
});

describe('recovery board — summary math', () => {
  const board = [
    createRecoveryEntry({ createdAt: daysAgo(9), shipments: 4, status: 'pending' }),
    createRecoveryEntry({ createdAt: daysAgo(2), shipments: 6, status: 'recovered' }),
    createRecoveryEntry({ createdAt: daysAgo(15), shipments: 10, status: 'pending' }),
    createRecoveryEntry({ createdAt: daysAgo(20), shipments: 5, status: 'written_off' }),
  ];

  it('counts pending entries/shipments, recovered, written-off', () => {
    const summary = summarizeRecoveryBoard(board, NOW);
    expect(summary.pendingEntries).toBe(2);
    expect(summary.pendingShipments).toBe(14);
    expect(summary.recoveredShipments).toBe(6);
    expect(summary.writtenOffShipments).toBe(5);
  });

  it('close rate = recovered share of closed shipments', () => {
    expect(summarizeRecoveryBoard(board, NOW).closeRatePercent).toBe(55);
    expect(summarizeRecoveryBoard([], NOW).closeRatePercent).toBe(0);
  });

  it('ages the oldest pending entry', () => {
    expect(summarizeRecoveryBoard(board, NOW).oldestPendingDays).toBe(15);
  });
});

describe('recovery board — action ordering', () => {
  it('pending first, oldest on top; closed sink to the bottom', () => {
    const sorted = sortForAction([
      createRecoveryEntry({ createdAt: daysAgo(1), shipments: 1, status: 'recovered' }),
      createRecoveryEntry({ createdAt: daysAgo(5), shipments: 1, status: 'pending' }),
      createRecoveryEntry({ createdAt: daysAgo(12), shipments: 1, status: 'pending' }),
    ]);
    expect(sorted.map(entry => entry.status)).toEqual(['pending', 'pending', 'recovered']);
    expect(new Date(sorted[0].createdAt).getTime()).toBeLessThan(new Date(sorted[1].createdAt).getTime());
  });
});

describe('recovery board — weekly trend', () => {
  const mk = (daysAgoResolved: number, shipments: number, status: 'recovered' | 'written_off') => {
    const resolved = new Date(NOW);
    resolved.setDate(NOW.getDate() - daysAgoResolved);
    return { ...createRecoveryEntry({ createdAt: daysAgoResolved + 10 >= 0 ? dayKeyHelper(daysAgoResolved + 5) : '2026-01-01', shipments }), status, resolvedAt: resolved.toISOString() };
  };
  it('buckets recovered vs written-off by resolution week', () => {
    const entries = [
      mk(1, 3, 'recovered'),
      mk(2, 2, 'recovered'),
      mk(9, 4, 'recovered'),
      mk(10, 1, 'written_off'),
      { ...createRecoveryEntry({ createdAt: dayKeyHelper(3), shipments: 7 }), status: 'pending' },
    ];
    const trend = buildWeeklyRecoveryTrend(entries as never[], 4, NOW);
    expect(trend).toHaveLength(4);
    const thisWeek = trend.at(-1)!;
    const lastWeek = trend.at(-2)!;
    expect(thisWeek.recovered).toBe(5);
    expect(lastWeek.recovered).toBe(4);
    expect(lastWeek.writtenOff).toBe(1);
    expect(trend[0].recovered).toBe(0);
  });

  it('ignores pending entries and bad timestamps', () => {
    const entries = [
      { ...createRecoveryEntry({ createdAt: dayKeyHelper(1), shipments: 5 }), status: 'pending' },
      { ...createRecoveryEntry({ createdAt: dayKeyHelper(2), shipments: 3 }), status: 'recovered', resolvedAt: 'not-a-date' },
    ];
    const trend = buildWeeklyRecoveryTrend(entries as never[], 4, NOW);
    expect(trend.every(bucket => bucket.recovered === 0 && bucket.writtenOff === 0)).toBe(true);
  });
});
