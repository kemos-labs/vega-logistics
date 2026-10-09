import { NextResponse } from 'next/server';
import { pullSyncSnapshot } from '@/lib/logestechs/client';
import { guardLogestechsRead, PRIVATE_RESPONSE_HEADERS } from '@/lib/logestechs/access';

export const dynamic = 'force-dynamic';

// In-memory last-sync cache (per server instance). A real deployment would
// persist this to Postgres/Redis; for the dashboard pull-model this is enough.
let lastSync: { scope: string; at: string; summary: Awaited<ReturnType<typeof pullSyncSnapshot>> } | null = null;

/** GET /api/logestechs/sync — pull latest snapshot (cached <60s). */
export async function GET(req: Request) {
  const access = guardLogestechsRead(req);
  if (!access.allowed) return access.response;
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';
  if (lastSync && lastSync.scope === access.scope && !force && Date.now() - +new Date(lastSync.at) < 60_000) {
    return NextResponse.json({ ok: true, cached: true, ...lastSync.summary }, { headers: PRIVATE_RESPONSE_HEADERS });
  }
  try {
    const summary = await pullSyncSnapshot();
    lastSync = { scope: access.scope, at: summary.syncedAt, summary };
    return NextResponse.json({ ok: true, cached: false, ...summary }, { headers: PRIVATE_RESPONSE_HEADERS });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'provider_sync_failed', hint: 'Check LOGESTECHS_* env or switch to demo mode.' },
      { status: 502, headers: PRIVATE_RESPONSE_HEADERS },
    );
  }
}

/** POST /api/logestechs/sync — force a fresh pull. */
export async function POST(req: Request) {
  const access = guardLogestechsRead(req);
  if (!access.allowed) return access.response;
  try {
    const summary = await pullSyncSnapshot();
    lastSync = { scope: access.scope, at: summary.syncedAt, summary };
    return NextResponse.json({ ok: true, cached: false, ...summary }, { headers: PRIVATE_RESPONSE_HEADERS });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'provider_sync_failed' },
      { status: 502, headers: PRIVATE_RESPONSE_HEADERS },
    );
  }
}
