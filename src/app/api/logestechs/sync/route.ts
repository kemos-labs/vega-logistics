import { NextResponse } from 'next/server';
import { pullSyncSnapshot } from '@/lib/logestechs/client';

export const dynamic = 'force-dynamic';

// In-memory last-sync cache (per server instance). A real deployment would
// persist this to Postgres/Redis; for the dashboard pull-model this is enough.
let lastSync: { at: string; summary: Awaited<ReturnType<typeof pullSyncSnapshot>> } | null = null;

/** GET /api/logestechs/sync — pull latest snapshot (cached <60s). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';
  if (lastSync && !force && Date.now() - +new Date(lastSync.at) < 60_000) {
    return NextResponse.json({ ok: true, cached: true, ...lastSync.summary });
  }
  try {
    const summary = await pullSyncSnapshot();
    lastSync = { at: summary.syncedAt, summary };
    return NextResponse.json({ ok: true, cached: false, ...summary });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'sync failed', hint: 'Check LOGESTECHS_* env or switch to demo mode.' },
      { status: 502 },
    );
  }
}

/** POST /api/logestechs/sync — force a fresh pull. */
export async function POST() {
  try {
    const summary = await pullSyncSnapshot();
    lastSync = { at: summary.syncedAt, summary };
    return NextResponse.json({ ok: true, cached: false, ...summary });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'sync failed' },
      { status: 502 },
    );
  }
}
