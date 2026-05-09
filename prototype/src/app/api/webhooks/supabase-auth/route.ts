// Supabase Auth Hooks receiver — Track 3d (v1.x) closes the third inbound
// webhook leg deferred by PR #78 (S12). Supabase Auth Hooks fire on auth
// events (user-created, password-reset, sign-in/out, send-email, etc.)
// and use Standard Webhooks (Svix-style) signing rather than the raw
// HMAC pattern of GitHub/Figma — see svix-verify.ts for the protocol.
//
// What this handler does at v1.x (matching GitHub/Figma's initial scope):
//   1. Read RAW body via req.text() before any JSON.parse.
//   2. Verify webhook-id / webhook-timestamp / webhook-signature via the
//      Standard Webhooks v1 protocol (timing-safe; ±5min replay window).
//   3. Idempotency-record on webhook-id; duplicates short-circuit to 200.
//   4. Mark processed; return 200.
//
// What this handler does NOT do at v1.x (per-event business logic is
// follow-on; receive-only mirrors how GitHub/Figma shipped):
//   - Auto-provision composer rows on user-created (operator-driven via
//     `atelier invite` remains canonical).
//   - Custom email-template rewrite via the send-email hook.
//   - Auth-event audit-trail insert into telemetry.
// Each is a separate adopter-signal-driven slice; the spec gap (no
// verifying receiver for Supabase Auth Hooks) is closed by this file.
//
// Reference impl: apps/rally-hq/src/routes/api/webhooks/resend/+server.ts
// uses Resend's Svix-shaped SDK wrapper. This handler implements the
// same protocol dependency-free via svix-verify.ts.
//
// Runtime: Node.js (idempotency ledger uses pg.Pool).

import { verifySvix } from '../../../../lib/atelier/webhooks/svix-verify.ts';
import {
  recordDelivery,
  markDeliveryProcessed,
} from '../../../../lib/atelier/webhooks/idempotency.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (!secret) {
    return jsonResponse(500, { error: 'webhook_secret_missing' });
  }

  const id = request.headers.get('webhook-id');
  const timestamp = request.headers.get('webhook-timestamp');
  const signatureHeader = request.headers.get('webhook-signature');

  if (!id) {
    return jsonResponse(400, { error: 'missing_delivery_id' });
  }
  if (!signatureHeader || !timestamp) {
    return jsonResponse(401, { error: 'missing_signature' });
  }

  const rawBody = await request.text();

  let valid: boolean;
  try {
    valid = verifySvix({ rawBody, id, timestamp, signatureHeader, secret });
  } catch {
    return jsonResponse(500, { error: 'webhook_secret_missing' });
  }

  if (!valid) {
    return jsonResponse(401, { error: 'invalid_signature' });
  }

  // Parse after verify. Supabase auth-hook payloads carry a top-level
  // `type` field (e.g. "auth.user.created", "send-email"); we record it
  // for observability but do not branch on it at v1.x receive-only.
  let payload: { type?: string };
  try {
    payload = JSON.parse(rawBody) as { type?: string };
  } catch {
    return jsonResponse(400, { error: 'invalid_json' });
  }

  const { firstSeen } = await recordDelivery({
    deliveryId: id,
    source: 'supabase-auth',
    eventType: payload.type ?? null,
  });

  if (!firstSeen) {
    return jsonResponse(200, { ok: true, deliveryId: id, idempotent: true });
  }

  try {
    await markDeliveryProcessed(id, 'received');
    return jsonResponse(200, { ok: true, deliveryId: id, eventType: payload.type ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markDeliveryProcessed(id, 'error', message).catch(() => {});
    return jsonResponse(500, { error: 'processing_failed', message });
  }
}

export async function GET(): Promise<Response> {
  return jsonResponse(405, { error: 'method_not_allowed', allow: ['POST'] });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
