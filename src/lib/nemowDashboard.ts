import type { NemowSummary } from '@/lib/nemowPull';

export type NemowBucketKey = 'delivered' | 'returned' | 'cancelled' | 'active';
export interface NemowBucket { key: NemowBucketKey; count: number; sharePct: number }

export function buildNemowBuckets(summary: Pick<NemowSummary, 'total' | 'buckets'>): NemowBucket[] {
  if (!summary.buckets) return [];
  return (Object.keys(summary.buckets) as NemowBucketKey[]).map(key => ({
    key,
    count: summary.buckets?.[key] ?? 0,
    sharePct: summary.total > 0 ? Math.round(((summary.buckets?.[key] ?? 0) / summary.total) * 1000) / 10 : 0,
  }));
}

export function nemowCodCoverage(summary: Pick<NemowSummary, 'total' | 'codKnownCount'>): 'legacy' | 'none' | 'partial' | 'reported' {
  if (summary.codKnownCount === undefined) return 'legacy';
  if (summary.codKnownCount === 0) return 'none';
  return summary.codKnownCount < summary.total ? 'partial' : 'reported';
}
