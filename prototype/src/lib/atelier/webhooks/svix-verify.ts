// Svix-style (Standard Webhooks) signature verification.
//
// Used by Supabase Auth Hooks and any other provider that follows the
// Standard Webhooks spec (https://www.standardwebhooks.com). The shape
// differs from raw HMAC (GitHub/Figma) on three axes:
//
//   1. Signed content is `${id}.${timestamp}.${body}` — NOT the raw body
//      alone. Replay protection lives in the timestamp.
//   2. Signature header carries one or more `v<N>,<base64sig>` entries
//      space-separated; verifier must accept any matching entry so
//      providers can rotate secrets without a flip-of-a-switch outage.
//   3. Secret is conventionally `whsec_<base64>`; the base64-decoded
//      bytes are the actual HMAC key. Plain (non-prefixed) secrets are
//      treated as raw UTF-8 bytes — adopters using a raw shared secret
//      for testing don't need to base64-encode.
//
// Reference impl: apps/rally-hq/src/routes/api/webhooks/resend/+server.ts
// uses Resend's SDK wrapper; this file is the dependency-free equivalent
// so the substrate doesn't pull `standardwebhooks` or `svix` for the
// single Supabase Auth Hooks receiver.
//
// Load-bearing properties (parallel to verify.ts):
//   - Constant-time compare via crypto.timingSafeEqual.
//   - Reject when any required input is missing — fail-closed.
//   - Timestamp window check rejects replays outside ±tolerance.

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifySvixOptions {
  /** Raw request body as it arrived on the wire (UTF-8 string). */
  rawBody: string;
  /** webhook-id header value. */
  id: string | null;
  /** webhook-timestamp header value (unix seconds). */
  timestamp: string | null;
  /** webhook-signature header value (one or more "v<N>,<base64>" entries). */
  signatureHeader: string | null;
  /** Provider secret. Accepts `whsec_<base64>` or a raw UTF-8 string. Throws if missing. */
  secret: string | undefined;
  /** Replay tolerance in seconds. Default 5 minutes. */
  toleranceSeconds?: number;
  /** Override "now" for deterministic tests. Unix seconds. */
  nowSeconds?: number;
}

const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

export function verifySvix(opts: VerifySvixOptions): boolean {
  if (!opts.secret) {
    throw new Error(
      'webhook secret is missing; refusing to verify (fail-closed). Set SUPABASE_AUTH_HOOK_SECRET.',
    );
  }
  if (!opts.id || !opts.timestamp || !opts.signatureHeader) return false;

  const tsSeconds = Number(opts.timestamp);
  if (!Number.isFinite(tsSeconds)) return false;

  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(now - tsSeconds) > tolerance) return false;

  const keyBytes = decodeSecret(opts.secret);
  const signedContent = `${opts.id}.${opts.timestamp}.${opts.rawBody}`;
  const expected = createHmac('sha256', keyBytes).update(signedContent, 'utf8').digest();

  // Header carries one or more space-separated "v<N>,<base64>" entries.
  // Accept v1 only at v1 of this verifier; future versions can extend.
  const entries = opts.signatureHeader.split(' ');
  for (const entry of entries) {
    const commaIdx = entry.indexOf(',');
    if (commaIdx < 0) continue;
    const version = entry.slice(0, commaIdx);
    if (version !== 'v1') continue;
    const sigB64 = entry.slice(commaIdx + 1);
    let received: Buffer;
    try {
      received = Buffer.from(sigB64, 'base64');
    } catch {
      continue;
    }
    if (received.length !== expected.length) continue;
    if (timingSafeEqual(received, expected)) return true;
  }

  return false;
}

function decodeSecret(secret: string): Buffer {
  if (secret.startsWith('whsec_')) {
    return Buffer.from(secret.slice('whsec_'.length), 'base64');
  }
  return Buffer.from(secret, 'utf8');
}
