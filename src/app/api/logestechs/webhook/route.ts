import { NextResponse } from 'next/server';
import type { LTWebhookEvent } from '@/lib/logestechs/types';

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

async function verifySignature(raw: string, signature: string | null): Promise<boolean> {
  const secret = process.env.LOGESTECHS_WEBHOOK_SECRET;
  if (!secret) return true; // no secret configured → accept (log warning)
  if (!signature) return false;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, enc.encode(raw));
    const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return hexEqual(expected, signature.replace(/^sha256=/, '').toLowerCase());
  } catch {
    return false;
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
  if (!(await verifySignature(raw, sig))) {
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

/** GET /api/logestechs/webhook — recent events for the dashboard feed. */
export async function GET() {
  return NextResponse.json({ ok: true, count: recent.length, events: recent.slice(0, 30) });
}
