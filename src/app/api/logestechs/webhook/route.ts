import { NextRequest, NextResponse } from 'next/server';
import type { LTWebhookEvent } from '@/lib/logestechs/types';
import { productionSessionRequired, readRequestSession } from '@/lib/platform/session';

export const dynamic = 'force-dynamic';

// Ring buffer of recent webhook events for the dashboard "Live feed" panel.
const recent: (LTWebhookEvent & { receivedAt: string })[] = [];
const MAX = 100;

function hexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type SignatureCheck = 'ok' | 'bad-signature' | 'no-secret-rejected';

async function verifySignature(raw: string, signature: string | null): Promise<SignatureCheck> {
  const secret = process.env.LOGESTECHS_WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured: any caller could forge events. That is only
    // tolerable outside production (local/demo wiring); reject otherwise.
    if (productionSessionRequired()) return 'no-secret-rejected';
    console.warn(
      '[logestechs/webhook] LOGESTECHS_WEBHOOK_SECRET is not set — accepting unsigned webhook payloads. ' +
      'This is only safe in local/demo mode; set the secret before going live.',
    );
    return 'ok';
  }
  if (!signature) return 'bad-signature';
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, enc.encode(raw));
    const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return hexEqual(expected, signature.replace(/^sha256=/, '').toLowerCase()) ? 'ok' : 'bad-signature';
  } catch {
    return 'bad-signature';
  }
}

/**
 * POST /api/logestechs/webhook — LogesTechs push endpoint.
 * Configure this URL in the LogesTechs dashboard:
 *   https://<your-host>/api/logestechs/webhook
 * Topics: shipment.created|status_changed|delivered|failed, pod.captured,
 * return.requested, inventory.adjusted, driver.location
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get('x-logestechs-signature') ?? req.headers.get('x-signature');
  const check = await verifySignature(raw, sig);
  if (check === 'no-secret-rejected') {
    return NextResponse.json(
      { ok: false, error: 'webhook secret not configured', hint: 'Set LOGESTECHS_WEBHOOK_SECRET before enabling production mode.' },
      { status: 503 },
    );
  }
  if (check === 'bad-signature') {
    return NextResponse.json({ ok: false, error: 'bad signature' }, { status: 401 });
  }
  let body: LTWebhookEvent;
  try {
    body = JSON.parse(raw) as LTWebhookEvent;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }
  if (!body.topic) return NextResponse.json({ ok: false, error: 'missing topic' }, { status: 400 });
  recent.unshift({ ...body, receivedAt: new Date().toISOString() });
  if (recent.length > MAX) recent.length = MAX;
  // NOTE: a production build would fan this out — invalidate sync cache,
  // append to tracking_events, fire alerts. The dashboard re-pulls via /sync.
  return NextResponse.json({ ok: true, queued: body.topic });
}

/**
 * GET /api/logestechs/webhook — recent events for the dashboard feed.
 * Received events can carry customer/driver/shipment data, so in production
 * mode this requires the same validated server session as the other
 * operations reads (see src/lib/platform/session.ts).
 */
export async function GET(request: NextRequest) {
  if (productionSessionRequired() && !readRequestSession(request)) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized', message: 'A validated server session is required in production mode.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return NextResponse.json(
    { ok: true, count: recent.length, events: recent.slice(0, 30) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
