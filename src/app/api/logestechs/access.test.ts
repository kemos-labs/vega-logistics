import { createHmac, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pull: vi.fn(), info: vi.fn() }));
vi.mock('@/lib/logestechs/client', () => ({ pullSyncSnapshot: mocks.pull, connectionInfo: mocks.info }));

function request(tenant?: string, path = 'sync') {
  let headers: HeadersInit = {};
  if (tenant) {
    const payload = Buffer.from(JSON.stringify({ userId: 'u', tenantId: tenant, role: 'dispatcher', exp: Date.now() + 60_000 })).toString('base64url');
    const sig = createHmac('sha256', 'test-secret').update(payload).digest('base64url');
    headers = { 'x-vega-session': `${payload}.${sig}` };
  }
  return new Request(`http://localhost/api/logestechs/${path}`, { headers });
}

beforeEach(() => {
  vi.resetModules();
  mocks.pull.mockReset().mockResolvedValue({ syncedAt: new Date().toISOString(), shipments: [{ id: 'private' }] });
  mocks.info.mockReset().mockReturnValue({ mode: 'live' });
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('VEGA_RUNTIME_MODE', 'simulation');
  vi.stubEnv('VEGA_SESSION_SECRET', 'test-secret');
  vi.stubEnv('LOGESTECHS_MODE', 'live');
  vi.stubEnv('LOGESTECHS_API_KEY', 'test-key');
  vi.stubEnv('VEGA_LOGESTECHS_TENANT_ID', 'tenant-a');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('LogesTechs server access boundary', () => {
  it('denies unauthenticated cached reads and forced pulls before provider invocation', async () => {
    const { GET, POST } = await import('./sync/route');
    expect((await GET(request('tenant-a'))).status).toBe(200);
    mocks.pull.mockClear();
    const denied = await GET(request());
    expect(denied.status).toBe(401);
    expect(denied.headers.get('cache-control')).toBe('no-store');
    expect((await POST(request())).status).toBe(401);
    expect((await GET(request('tenant-b'))).status).toBe(403);
    expect(mocks.pull).not.toHaveBeenCalled();
  });

  it('requires explicit mapping and scopes the cache to the mapped tenant', async () => {
    const { GET } = await import('./sync/route');
    expect((await GET(request('tenant-a'))).status).toBe(200);
    vi.stubEnv('VEGA_LOGESTECHS_TENANT_ID', '');
    expect((await GET(request('tenant-a'))).status).toBe(503);
    expect(mocks.pull).toHaveBeenCalledTimes(1);
    vi.stubEnv('VEGA_LOGESTECHS_TENANT_ID', 'tenant-b');
    expect((await GET(request('tenant-a'))).status).toBe(403);
    expect((await GET(request('tenant-b'))).status).toBe(200);
    expect(mocks.pull).toHaveBeenCalledTimes(2);
  });

  it('guards status and webhook feed even in production demo mode', async () => {
    vi.stubEnv('LOGESTECHS_MODE', 'demo');
    vi.stubEnv('VEGA_RUNTIME_MODE', 'production');
    const status = await import('./status/route');
    const webhook = await import('./webhook/route');
    expect((await status.GET(request())).status).toBe(401);
    expect((await webhook.GET(request())).status).toBe(401);
    expect(mocks.info).not.toHaveBeenCalled();
    expect((await status.GET(request('tenant-b'))).status).toBe(403);
    expect((await webhook.GET(request('tenant-b'))).status).toBe(403);
    expect((await status.GET(request('tenant-a'))).status).toBe(200);
    vi.stubEnv('VEGA_LOGESTECHS_TENANT_ID', '');
    expect((await webhook.GET(request('tenant-a'))).status).toBe(503);
  });

  it('checks operations permission before cached or provider access', async () => {
    const authorization = await import('@/lib/platform/authorization');
    vi.spyOn(authorization, 'hasPermission').mockReturnValue(false);
    const { GET } = await import('./sync/route');
    expect((await GET(request('tenant-a'))).status).toBe(403);
    expect(mocks.pull).not.toHaveBeenCalled();
  });

  it('does not expose old webhook events after changing the server binding', async () => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubEnv('LOGESTECHS_WEBHOOK_SECRET', 'webhook-secret');
    const { GET, POST } = await import('./webhook/route');
    const body = JSON.stringify({ topic: 'shipment.created', shipmentId: 'private' });
    const sig = createHmac('sha256', 'webhook-secret').update(body).digest('hex');
    expect((await POST(new Request('http://localhost/api/logestechs/webhook', { method: 'POST', body, headers: { 'x-logestechs-signature': sig } }))).status).toBe(200);
    expect((await (await GET(request('tenant-a'))).json()).count).toBe(1);
    vi.stubEnv('VEGA_LOGESTECHS_TENANT_ID', 'tenant-b');
    expect((await (await GET(request('tenant-b'))).json()).events).toEqual([]);
  });

  it('sanitizes provider failures and disables response caching', async () => {
    mocks.pull.mockRejectedValue(new Error('secret-provider-key'));
    const { POST } = await import('./sync/route');
    const response = await POST(request('tenant-a'));
    expect(response.status).toBe(502);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ ok: false, error: 'provider_sync_failed' });
  });

  it.each([null, [], { topic: {} }, { topic: '   ' }])('rejects malformed signed webhook payload %j', async payload => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubEnv('LOGESTECHS_WEBHOOK_SECRET', 'webhook-secret');
    const webhook = await import('./webhook/route');
    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', 'webhook-secret').update(body).digest('hex');
    const response = await webhook.POST(new Request('http://localhost/api/logestechs/webhook', { method: 'POST', body, headers: { 'x-logestechs-signature': signature } }));
    expect(response.status).toBe(400);
    expect((await (await webhook.GET(request('tenant-a'))).json()).count).toBe(0);
  });

  it.each(['live', 'production'])('rejects unsigned webhook in %s even with explicit simulation', async mode => {
    vi.stubEnv('LOGESTECHS_WEBHOOK_SECRET', '');
    vi.stubEnv('LOGESTECHS_MODE', mode === 'live' ? 'live' : 'demo');
    vi.stubEnv('NODE_ENV', mode === 'production' ? 'production' : 'test');
    const webhook = await import('./webhook/route');
    const response = await webhook.POST(new Request('http://localhost/api/logestechs/webhook', { method: 'POST', body: JSON.stringify({ topic: 'shipment.created' }) }));
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await webhook.GET(request())).status).toBe(401);
    expect((await (await webhook.GET(request('tenant-a'))).json()).count).toBe(0);
  });

  it('requires tenant mapping in NODE_ENV production despite explicit simulation', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOGESTECHS_MODE', 'demo');
    vi.stubEnv('VEGA_LOGESTECHS_TENANT_ID', '');
    const status = await import('./status/route');
    expect((await status.GET(request())).status).toBe(401);
    expect((await status.GET(request('tenant-a'))).status).toBe(503);
    expect(mocks.info).not.toHaveBeenCalled();
  });

  it('rejects signed ingestion without tenant mapping before storing events', async () => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubEnv('LOGESTECHS_WEBHOOK_SECRET', 'webhook-secret');
    vi.stubEnv('VEGA_LOGESTECHS_TENANT_ID', '');
    const { GET, POST } = await import('./webhook/route');
    const body = JSON.stringify({ topic: 'shipment.created', shipmentId: 'unbound' });
    const signature = createHmac('sha256', 'webhook-secret').update(body).digest('hex');
    const response = await POST(new Request('http://localhost/api/logestechs/webhook', { method: 'POST', body, headers: { 'x-logestechs-signature': signature } }));
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    vi.stubEnv('VEGA_LOGESTECHS_TENANT_ID', 'tenant-a');
    expect((await (await GET(request('tenant-a'))).json()).events).toEqual([]);
  });

  it('preserves local synthetic demo access without configuration', async () => {
    vi.stubEnv('LOGESTECHS_MODE', 'demo');
    vi.stubEnv('VEGA_LOGESTECHS_TENANT_ID', '');
    const { GET } = await import('./sync/route');
    expect((await GET(request())).status).toBe(200);
  });
});
