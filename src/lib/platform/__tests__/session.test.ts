import { createHmac } from 'node:crypto';
import { describe, expect, it, afterEach, vi } from 'vitest';
import { productionSessionRequired, readRequestSession } from '../session';

function token(payload: Record<string, unknown>, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

const originalMode = process.env.VEGA_RUNTIME_MODE;
const originalSecret = process.env.VEGA_SESSION_SECRET;

afterEach(() => {
  vi.unstubAllEnvs();
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
  it.each([
    { userId: 42 }, { tenantId: {} }, { userId: '   ' }, { tenantId: '' },
    { exp: '9999999999999' }, { exp: null }, { exp: 9999999999999.5 },
    { role: 'owner' },
  ])('rejects signed malformed payload %j', patch => {
    process.env.VEGA_SESSION_SECRET = 'test-secret';
    const signed = token({ userId: 'u', tenantId: 't', role: 'dispatcher', exp: 9999999999999, ...patch }, 'test-secret');
    expect(readRequestSession({ headers: new Headers({ 'x-vega-session': signed }) } as never)).toBeNull();
  });

  it('rejects trailing token segments even with a valid signature', () => {
    process.env.VEGA_SESSION_SECRET = 'test-secret';
    const signed = token({ userId: 'u', tenantId: 't', role: 'dispatcher', exp: 9999999999999 }, 'test-secret');
    expect(readRequestSession({ headers: new Headers({ 'x-vega-session': `${signed}.extra` }) } as never)).toBeNull();
  });

  it.each([undefined, 'production', 'prodution'])('requires sessions by default in production for mode %s', mode => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VEGA_RUNTIME_MODE', mode);
    expect(productionSessionRequired()).toBe(true);
  });

  it('permits an explicitly selected production simulation', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VEGA_RUNTIME_MODE', 'simulation');
    expect(productionSessionRequired()).toBe(false);
  });

});
