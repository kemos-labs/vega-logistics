import { describe, expect, it } from 'vitest';

import { pickNemowSheetIndex } from '@/lib/nemowXlsx';

describe('pickNemowSheetIndex', () => {
  it('prefers a valid Packages sheet even when it is not first', () => {
    expect(pickNemowSheetIndex(['Cover', 'Packages'], [8, 8])).toBe(1);
  });

  it('falls back to the highest-scoring canonical-shaped sheet', () => {
    expect(pickNemowSheetIndex(['Cover', 'Export'], [1, 8])).toBe(1);
  });
});
