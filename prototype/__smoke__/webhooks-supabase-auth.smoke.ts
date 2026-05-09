// Supabase Auth Hooks receiver smoke — Track 3d (v1.x) parallel of
// webhooks.smoke.ts but for the Svix-style verifier path.
//
// Mirrors the conformance points S12 named for GitHub/Figma:
//   - missing-headers rejection (400/401)
//   - malformed signature (401)
//   - timestamp outside replay window (401)
//   - valid first delivery (200, not idempotent)
//   - duplicate delivery (200, idempotent)
//   - missing secret env (500 fail-closed)
//   - GET (405)
//
// Prerequisites:
//   - Local Supabase running (supabase start) so webhook_deliveries exists
//   - POSTGRES_URL set to the local pooler URL
//   - SUPABASE_AUTH_HOOK_SECRET set (or default test value below applies)
//
// Run: `npx tsx prototype/__smoke__/webhooks-supabase-auth.smoke.ts`

import { createHmac, randomUUID } from 'node:crypto';

import { POST as supabasePOST } from '../src/app/api/webhooks/supabase-auth/route.ts';
import { __closePoolForTesting } from '../src/lib/atelier/webhooks/idempotency.ts';

const TEST_SECRET = process.env.SUPABASE_AUTH_HOOK_SECRET ?? 'smoke-test-secret-do-not-use-in-prod';
process.env.SUPABASE_AUTH_HOOK_SECRET = TEST_SECRET;

let failures = 0;
function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`PASS ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

function decodeSecretBytes(secret: string): Buffer {
  if (secret.startsWith('whsec_')) return Buffer.from(secret.slice('whsec_'.length), 'base64');
  return Buffer.from(secret, 'utf8');
}

function signSvix(opts: { id: string; timestamp: string; body: string; secret?: string }): string {
  const secret = opts.secret ?? TEST_SECRET;
  const signed = `${opts.id}.${opts.timestamp}.${opts.body}`;
  const sig = createHmac('sha256', decodeSecretBytes(secret)).update(signed, 'utf8').digest('base64');
  return `v1,${sig}`;
}

interface MakeReqOpts {
  body: string;
  id?: string | null;
  timestamp?: string | null;
  signature?: string | null;
}

function makeRequest(opts: MakeReqOpts): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (opts.id !== null && opts.id !== undefined) headers.set('webhook-id', opts.id);
  if (opts.timestamp !== null && opts.timestamp !== undefined) {
    headers.set('webhook-timestamp', opts.timestamp);
  }
  if (opts.signature !== null && opts.signature !== undefined) {
    headers.set('webhook-signature', opts.signature);
  }
  return new Request('http://localhost/api/webhooks/supabase-auth', {
    method: 'POST',
    headers,
    body: opts.body,
  });
}

async function run() {
  const nowSeconds = () => String(Math.floor(Date.now() / 1000));

  // ---- 1. Missing webhook-id -> 400 ----
  {
    const body = JSON.stringify({ type: 'auth.user.created' });
    const ts = nowSeconds();
    const res = await supabasePOST(
      makeRequest({
        body,
        id: null,
        timestamp: ts,
        signature: signSvix({ id: 'x', timestamp: ts, body }),
      }),
    );
    check('missing_webhook_id returns 400', res.status === 400, `got ${res.status}`);
  }

  // ---- 2. Missing webhook-signature -> 401 ----
  {
    const body = JSON.stringify({ type: 'auth.user.created' });
    const res = await supabasePOST(
      makeRequest({ body, id: randomUUID(), timestamp: nowSeconds(), signature: null }),
    );
    check('missing_signature returns 401', res.status === 401, `got ${res.status}`);
  }

  // ---- 3. Missing webhook-timestamp -> 401 ----
  {
    const body = JSON.stringify({ type: 'auth.user.created' });
    const id = randomUUID();
    const res = await supabasePOST(
      makeRequest({
        body,
        id,
        timestamp: null,
        signature: signSvix({ id, timestamp: nowSeconds(), body }),
      }),
    );
    check('missing_timestamp returns 401', res.status === 401, `got ${res.status}`);
  }

  // ---- 4. Malformed signature (wrong base64) -> 401 ----
  {
    const body = JSON.stringify({ type: 'auth.user.created' });
    const res = await supabasePOST(
      makeRequest({
        body,
        id: randomUUID(),
        timestamp: nowSeconds(),
        signature: 'v1,' + Buffer.from('x'.repeat(32)).toString('base64'),
      }),
    );
    check('invalid_signature returns 401', res.status === 401, `got ${res.status}`);
  }

  // ---- 5. Wrong-version prefix (v2,...) -> 401 ----
  {
    const body = JSON.stringify({ type: 'auth.user.created' });
    const ts = nowSeconds();
    const id = randomUUID();
    const sig = signSvix({ id, timestamp: ts, body }).replace('v1,', 'v2,');
    const res = await supabasePOST(makeRequest({ body, id, timestamp: ts, signature: sig }));
    check('wrong_version_prefix returns 401', res.status === 401, `got ${res.status}`);
  }

  // ---- 6. Timestamp outside replay window -> 401 ----
  {
    const body = JSON.stringify({ type: 'auth.user.created' });
    const id = randomUUID();
    const staleTs = String(Math.floor(Date.now() / 1000) - 60 * 60); // 1h old
    const res = await supabasePOST(
      makeRequest({
        body,
        id,
        timestamp: staleTs,
        signature: signSvix({ id, timestamp: staleTs, body }),
      }),
    );
    check('stale_timestamp returns 401', res.status === 401, `got ${res.status}`);
  }

  // ---- 7. Valid first delivery -> 200 + ok=true (not idempotent) ----
  const idempotencyDeliveryId = `smoke-${randomUUID()}`;
  {
    const body = JSON.stringify({ type: 'auth.user.created', smoke: idempotencyDeliveryId });
    const ts = nowSeconds();
    const res = await supabasePOST(
      makeRequest({
        body,
        id: idempotencyDeliveryId,
        timestamp: ts,
        signature: signSvix({ id: idempotencyDeliveryId, timestamp: ts, body }),
      }),
    );
    const data = (await res.json()) as { ok?: boolean; idempotent?: boolean; eventType?: string };
    check('valid_first_delivery returns 200', res.status === 200, `got ${res.status}`);
    check('valid_first_delivery ok=true', data.ok === true);
    check('valid_first_delivery NOT idempotent', data.idempotent !== true);
    check('valid_first_delivery records event_type', data.eventType === 'auth.user.created');
  }

  // ---- 8. Same delivery_id again -> 200 + idempotent=true ----
  {
    const body = JSON.stringify({ type: 'auth.user.created', smoke: idempotencyDeliveryId });
    const ts = nowSeconds();
    const res = await supabasePOST(
      makeRequest({
        body,
        id: idempotencyDeliveryId,
        timestamp: ts,
        signature: signSvix({ id: idempotencyDeliveryId, timestamp: ts, body }),
      }),
    );
    const data = (await res.json()) as { ok?: boolean; idempotent?: boolean };
    check('duplicate_delivery returns 200', res.status === 200, `got ${res.status}`);
    check('duplicate_delivery idempotent=true', data.idempotent === true);
  }

  // ---- 9. Missing secret env -> fail-closed 500 ----
  {
    const saved = process.env.SUPABASE_AUTH_HOOK_SECRET;
    delete process.env.SUPABASE_AUTH_HOOK_SECRET;
    try {
      const body = JSON.stringify({ type: 'auth.user.created' });
      const ts = nowSeconds();
      const id = randomUUID();
      const res = await supabasePOST(
        makeRequest({
          body,
          id,
          timestamp: ts,
          signature: signSvix({ id, timestamp: ts, body, secret: saved }),
        }),
      );
      check('missing_secret returns 500', res.status === 500, `got ${res.status}`);
    } finally {
      process.env.SUPABASE_AUTH_HOOK_SECRET = saved;
    }
  }

  // ---- 10. GET -> 405 ----
  {
    const { GET } = await import('../src/app/api/webhooks/supabase-auth/route.ts');
    const res = await GET();
    check('get_method returns 405', res.status === 405, `got ${res.status}`);
  }

  // ---- 11. whsec_-prefixed secret round-trips ----
  {
    const saved = process.env.SUPABASE_AUTH_HOOK_SECRET;
    const rawKey = Buffer.from('a'.repeat(32), 'utf8').toString('base64');
    const prefixed = `whsec_${rawKey}`;
    process.env.SUPABASE_AUTH_HOOK_SECRET = prefixed;
    try {
      const body = JSON.stringify({ type: 'auth.user.created', whsec: true });
      const ts = nowSeconds();
      const id = `smoke-whsec-${randomUUID()}`;
      const res = await supabasePOST(
        makeRequest({
          body,
          id,
          timestamp: ts,
          signature: signSvix({ id, timestamp: ts, body, secret: prefixed }),
        }),
      );
      check('whsec_prefixed_secret returns 200', res.status === 200, `got ${res.status}`);
    } finally {
      process.env.SUPABASE_AUTH_HOOK_SECRET = saved;
    }
  }

  await __closePoolForTesting();

  if (failures > 0) {
    console.error(`\n${failures} smoke check(s) FAILED`);
    process.exit(1);
  } else {
    console.log('\nAll Supabase Auth Hook smoke checks PASSED');
  }
}

run().catch((err) => {
  console.error('smoke run threw:', err);
  process.exit(1);
});
