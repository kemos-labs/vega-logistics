import { NextResponse } from 'next/server';
import { readLogestechsConfig } from './types';
import { hasPermission } from '@/lib/platform/authorization';
import { productionSessionRequired, readRequestSession } from '@/lib/platform/session';

export const PRIVATE_RESPONSE_HEADERS = { 'Cache-Control': 'no-store' };

/** Bind the single configured provider account to an explicitly mapped VEGA tenant. */
export function guardLogestechsRead(request: Request): { allowed: true; scope: string } | { allowed: false; response: NextResponse } {
  const config = readLogestechsConfig();
  const live = config.mode !== 'demo';
  const deny = (status: number, error: string) => ({ allowed: false as const, response: NextResponse.json({ ok: false, error }, { status, headers: PRIVATE_RESPONSE_HEADERS }) });
  const guarded = process.env.NODE_ENV === 'production' || productionSessionRequired() || live;
  const session = readRequestSession(request);
  if (guarded && !session) return deny(401, 'unauthorized');
  if (session && !hasPermission(session.role, 'operations.read')) return deny(403, 'forbidden');
  const mappedTenant = process.env.VEGA_LOGESTECHS_TENANT_ID;
  if (guarded) {
    if (!mappedTenant?.trim()) return deny(503, 'tenant_mapping_not_configured');
    if (session?.tenantId !== mappedTenant) return deny(403, 'tenant_mismatch');
  }
  return { allowed: true, scope: logestechsDataScope() };
}

/** Stamp cache/feed entries with the server account binding at acquisition time. */
export function logestechsDataScope(): string {
  const config = readLogestechsConfig();
  return JSON.stringify([config.mode, process.env.VEGA_LOGESTECHS_TENANT_ID ?? 'demo', config.baseUrl, config.tenantId ?? '']);
}
