import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { AuthorizationContext } from './authorization';
import type { FleetRole } from '@/lib/types2026';

const ROLES: readonly FleetRole[] = ['super_admin', 'fleet_manager', 'dispatcher', 'driver', 'warehouse_operator', 'maintenance_tech', 'customer_support', 'executive'];

/** Custom session expiry is Unix milliseconds, matching Date.now(), not JWT seconds. */
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
export function readRequestSession(request: Pick<NextRequest, 'headers'>, now = Date.now()): AuthorizationContext | null {
  const token = request.headers.get('x-vega-session');
  const secret = process.env.VEGA_SESSION_SECRET;
  if (!token || !secret || token.length > 8192 || !Number.isSafeInteger(now)) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, providedSignature] = parts;
  if (!encodedPayload || !/^[A-Za-z0-9_-]+$/.test(encodedPayload) || !/^[A-Za-z0-9_-]{43}$/.test(providedSignature)) return null;
  if (Buffer.from(encodedPayload, 'base64url').toString('base64url') !== encodedPayload) return null;

  const expected = Buffer.from(signature(encodedPayload, secret));
  const actual = Buffer.from(providedSignature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(decode(encodedPayload)) as Partial<SessionPayload>;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    if (typeof payload.userId !== 'string' || !payload.userId.trim() || payload.userId.length > 256) return null;
    if (typeof payload.tenantId !== 'string' || !payload.tenantId.trim() || payload.tenantId.length > 256) return null;
    if (typeof payload.exp !== 'number' || !Number.isSafeInteger(payload.exp) || payload.exp <= now) return null;
    if (!payload.role || !ROLES.includes(payload.role)) return null;
    return { userId: payload.userId, tenantId: payload.tenantId, role: payload.role };
  } catch {
    return null;
  }
}

export function productionSessionRequired(): boolean {
  if (process.env.VEGA_RUNTIME_MODE === 'simulation') return false;
  return process.env.VEGA_RUNTIME_MODE === 'production' || process.env.NODE_ENV === 'production';
}
