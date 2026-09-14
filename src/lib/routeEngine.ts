// Opt-in road-routing adapter. No endpoint is contacted unless the caller
// supplies a configured, owner-approved self-hosted OSRM base URL.

import { buildOsrmOptimizeUrl, parseOsrmTripResponse, type OsrmParsedRoute } from '@/lib/routeLite';

export type RouteEngineError = 'not-configured' | 'timeout' | 'network' | 'invalid-response' | 'invalid-input';

export type RouteEngineResult = {
  ok: true;
  route: OsrmParsedRoute;
  provider: 'self-hosted-osrm';
  measuredAt: string;
} | { ok: false; error: RouteEngineError };

export async function measureOsrmRoute(
  baseUrl: string | undefined,
  coords: Array<{ lat: number; lng: number }>,
  options: { timeoutMs?: number; returnToStart?: boolean } = {},
): Promise<RouteEngineResult> {
  if (!baseUrl?.trim()) return { ok: false, error: 'not-configured' };
  const built = buildOsrmOptimizeUrl(baseUrl, coords, options.returnToStart ?? false);
  if (!built.ok) return { ok: false, error: 'invalid-input' };
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const response = await fetch(built.url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) return { ok: false, error: 'network' };
    const parsed = parseOsrmTripResponse(await response.json());
    return parsed.ok
      ? { ok: true, route: parsed.route, provider: 'self-hosted-osrm', measuredAt: new Date().toISOString() }
      : { ok: false, error: 'invalid-response' };
  } catch (error) {
    return { ok: false, error: error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    window.clearTimeout(timeout);
  }
}
