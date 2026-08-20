import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { AuthorizationContext } from './authorization';
import type { FleetRole } from '@/lib/types2026';

const ROLES: readonly FleetRole[] = ['super_admin', 'fleet_manager', 'dispatcher', 'driver', 'warehouse_operator', 'maintenance_tech', 'customer_support', 'executive'];

type SessionPayload = AuthorizationContext & { exp: number };

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/**
 * Verifies a server-issued, signed session token. This is deliberately not a
 * login implementation; production must issue the token through a real OIDC
 * or session provider and set VEGA_SESSION_SECRET outside the client bundle.
 */
export function readRequestSession(request: NextRequest, now = Date.now()): AuthorizationContext | null {
  const token = request.headers.get('x-vega-session');
  const secret = process.env.VEGA_SESSION_SECRET;
  if (!token || !secret) return null;

  const [encodedPayload, providedSignature] = token.split('.');
  if (!encodedPayload || !providedSignature) return null;

  const expected = Buffer.from(signature(encodedPayload, secret));
  const actual = Buffer.from(providedSignature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(decode(encodedPayload)) as Partial<SessionPayload>;
    if (!payload.userId || !payload.tenantId || !payload.exp || payload.exp <= now) return null;
    if (!payload.role || !ROLES.includes(payload.role)) return null;
    return { userId: payload.userId, tenantId: payload.tenantId, role: payload.role };
  } catch {
    return null;
  }
}

export function productionSessionRequired(): boolean {
  return process.env.VEGA_RUNTIME_MODE === 'production';
}
