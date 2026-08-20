import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'vega-logistics-os',
      version: process.env.npm_package_version ?? '0.4.0',
      dataMode: 'simulation',
      checks: {
        application: 'ok',
        persistence: 'not_configured',
        authentication: 'not_configured',
        realtime: 'not_configured',
      },
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
