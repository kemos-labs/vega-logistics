import { NextRequest, NextResponse } from 'next/server';
import { calculateFleetKPIs } from '@/lib/engines/kpi50';
import { generateFleetSnapshot } from '@/lib/engines/mockData50';
import { simulationFreshness } from '@/lib/platform/data-source';
import type { ApiErrorResponse, OperationsSnapshotResponse } from '@/lib/platform/contracts';
import { productionSessionRequired, readRequestSession } from '@/lib/platform/session';

export const dynamic = 'force-dynamic';

const DEFAULT_SEED = 42;
const MAX_SEED = 999_999;

function readSeed(request: NextRequest) {
  const rawSeed = request.nextUrl.searchParams.get('seed');
  if (!rawSeed) return DEFAULT_SEED;

  const seed = Number(rawSeed);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > MAX_SEED) return null;
  return seed;
}

/**
 * Demo read model for the future operations BFF.
 *
 * This route intentionally reports simulation mode. It must not be treated as
 * an authenticated production data endpoint until tenant/session middleware,
 * persistence and authorization are implemented.
 */
export async function GET(request: NextRequest) {
  if (productionSessionRequired() && !readRequestSession(request)) {
    const error: ApiErrorResponse = {
      error: 'unauthorized',
      message: 'A validated server session is required in production mode.',
    };
    return NextResponse.json(error, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const seed = readSeed(request);
  if (seed === null) {
    const error: ApiErrorResponse = {
      error: 'invalid_seed',
      message: `seed must be an integer from 0 to ${MAX_SEED}`,
    };
    return NextResponse.json(error, {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const snapshot = generateFleetSnapshot(seed);
  const response: OperationsSnapshotResponse = {
    dataMode: 'simulation',
    freshness: simulationFreshness(),
    snapshot,
    kpis: calculateFleetKPIs(snapshot),
  };
  return NextResponse.json(
    response,
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-VEGA-Data-Mode': 'simulation',
      },
    },
  );
}
