import { NextResponse } from 'next/server';
import { guardLogestechsRead, PRIVATE_RESPONSE_HEADERS } from '@/lib/logestechs/access';
import { connectionInfo } from '@/lib/logestechs/client';

export const dynamic = 'force-dynamic';

/** GET /api/logestechs/status — connection health without leaking the key. */
export async function GET(req: Request) {
  const access = guardLogestechsRead(req);
  if (!access.allowed) return access.response;
  const info = connectionInfo();
  return NextResponse.json({
    ok: true,
    ...info,
    setupHint: info.mode === 'demo'
      ? 'Running on DEMO mock. Set LOGESTECHS_API_KEY + LOGESTECHS_BASE_URL (and LOGESTECHS_MODE=live) to pull your real tenant.'
      : 'Live mode. Key present — sync should hit your LogesTechs tenant.',
    docs: '/docs/LOGESTECHS_INTEGRATION.md',
  }, { headers: PRIVATE_RESPONSE_HEADERS });
}
