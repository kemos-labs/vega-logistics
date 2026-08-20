import { createHmac } from 'node:crypto';
import { describe, expect, it, afterEach } from 'vitest';
import { productionSessionRequired, readRequestSession } from '../session';

function token(payload: Record<string, unknown>, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

const originalMode = process.env.VEGA_RUNTIME_MODE;
const originalSecret = process.env.VEGA_SESSION_SECRET;

afterEach(() => {
  if (originalMode === undefined) delete process.env.VEGA_RUNTIME_MODE;
  else process.env.VEGA_RUNTIME_MODE = originalMode;
  if (originalSecret === undefined) delete process.env.VEGA_SESSION_SECRET;
  else process.env.VEGA_SESSION_SECRET = originalSecret;
});

describe('server session boundary', () => {
  it('does not require production sessions in simulation mode', () => {
    delete process.env.VEGA_RUNTIME_MODE;
    expect(productionSessionRequired()).toBe(false);
  });

  it('accepts a valid signed session and rejects tampering or expiry', () => {
    process.env.VEGA_SESSION_SECRET = 'test-secret';
    const valid = token({ userId: 'u-1', tenantId: 'tenant-a', role: 'dispatcher', exp: Date.now() + 60_000 }, 'test-secret');
    const request = { headers: new Headers({ 'x-vega-session': valid }) } as never;
    expect(readRequestSession(request)).toEqual({ userId: 'u-1', tenantId: 'tenant-a', role: 'dispatcher' });

    const tampered = { headers: new Headers({ 'x-vega-session': `${valid}x` }) } as never;
    expect(readRequestSession(tampered)).toBeNull();

    const expired = token({ userId: 'u-1', tenantId: 'tenant-a', role: 'dispatcher', exp: Date.now() - 1 }, 'test-secret');
    const expiredRequest = { headers: new Headers({ 'x-vega-session': expired }) } as never;
    expect(readRequestSession(expiredRequest)).toBeNull();
  });
});
