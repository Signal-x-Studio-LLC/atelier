// S12 webhook receiver smoke — covers the four conformance points the
// audit's S12 finding named: malformed-signature rejection, missing-
// secret fail-closed, valid-signature acceptance, double-delivery
// idempotency.
//
// Exercises the GitHub handler shape directly (Figma uses the identical
// pattern with a different signature prefix; one shape covered = both
// shapes covered for the verifier + idempotency dimensions).
//
// Prerequisites:
//   - Local Supabase running (supabase start) so webhook_deliveries exists
//   - POSTGRES_URL set to the local pooler URL
//   - GITHUB_WEBHOOK_SECRET set to a known test value
//
// Run: `npx tsx prototype/__smoke__/webhooks.smoke.ts`
//
// The smoke does NOT spin up Next.js; it imports the route handler's
// POST function directly and exercises it with synthetic Request objects.
// This is the smoke equivalent of "test the function pure-style" — the
// route adapter is a one-line export, so testing the function gets the
// load-bearing logic without the Next.js cold-compile cost.

import { createHmac, randomUUID } from 'node:crypto';
import { Client } from 'pg';

import { POST as githubPOST } from '../src/app/api/webhooks/github/route.ts';
import { POST as figmaPOST } from '../src/app/api/webhooks/figma/route.ts';
import { __closePoolForTesting } from '../src/lib/atelier/webhooks/idempotency.ts';

const TEST_SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? 'smoke-test-secret-do-not-use-in-prod';
process.env.GITHUB_WEBHOOK_SECRET = TEST_SECRET;
const FIGMA_TEST_SECRET = process.env.FIGMA_WEBHOOK_SECRET ?? 'figma-smoke-secret';
process.env.FIGMA_WEBHOOK_SECRET = FIGMA_TEST_SECRET;
// idempotency.ts reads POSTGRES_URL; smoke runs against local Supabase
// the same way webhook_deliveries was set up at S12 close.
process.env.POSTGRES_URL =
  process.env.POSTGRES_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const DB_URL = process.env.POSTGRES_URL;

let failures = 0;
function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`PASS ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

function signGithub(body: string): string {
  return 'sha256=' + createHmac('sha256', TEST_SECRET).update(body, 'utf8').digest('hex');
}

function makeRequest(opts: {
  body: string;
  signature?: string | null;
  deliveryId?: string | null;
  eventType?: string;
}): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (opts.signature !== null && opts.signature !== undefined) {
    headers.set('x-hub-signature-256', opts.signature);
  }
  if (opts.deliveryId !== null && opts.deliveryId !== undefined) {
    headers.set('x-github-delivery', opts.deliveryId);
  }
  if (opts.eventType) {
    headers.set('x-github-event', opts.eventType);
  }
  return new Request('http://localhost/api/webhooks/github', {
    method: 'POST',
    headers,
    body: opts.body,
  });
}

async function run() {
  // ---- 1. Missing X-Hub-Signature-256 -> 401 ----
  {
    const body = JSON.stringify({ ref: 'refs/heads/main' });
    const res = await githubPOST(
      makeRequest({ body, signature: null, deliveryId: randomUUID(), eventType: 'push' }),
    );
    check('missing_signature returns 401', res.status === 401, `got ${res.status}`);
  }

  // ---- 2. Missing X-GitHub-Delivery -> 400 ----
  {
    const body = JSON.stringify({ ref: 'refs/heads/main' });
    const res = await githubPOST(
      makeRequest({ body, signature: signGithub(body), deliveryId: null, eventType: 'push' }),
    );
    check('missing_delivery_id returns 400', res.status === 400, `got ${res.status}`);
  }

  // ---- 3. Malformed signature (wrong hex) -> 401 ----
  {
    const body = JSON.stringify({ ref: 'refs/heads/main' });
    const res = await githubPOST(
      makeRequest({
        body,
        signature: 'sha256=' + 'f'.repeat(64),
        deliveryId: randomUUID(),
        eventType: 'push',
      }),
    );
    check('invalid_signature returns 401', res.status === 401, `got ${res.status}`);
  }

  // ---- 4. Wrong-prefix signature -> 401 ----
  {
    const body = JSON.stringify({ ref: 'refs/heads/main' });
    const sig = signGithub(body).replace('sha256=', 'sha1=');
    const res = await githubPOST(
      makeRequest({ body, signature: sig, deliveryId: randomUUID(), eventType: 'push' }),
    );
    check('wrong_prefix_signature returns 401', res.status === 401, `got ${res.status}`);
  }

  // ---- 5. Valid signature, first delivery -> 200 + ok=true (NOT idempotent) ----
  const idempotencyDeliveryId = `smoke-${randomUUID()}`;
  {
    const body = JSON.stringify({ ref: 'refs/heads/main', smoke: idempotencyDeliveryId });
    const res = await githubPOST(
      makeRequest({
        body,
        signature: signGithub(body),
        deliveryId: idempotencyDeliveryId,
        eventType: 'push',
      }),
    );
    const data = (await res.json()) as { ok?: boolean; idempotent?: boolean; deliveryId?: string };
    check('valid_first_delivery returns 200', res.status === 200, `got ${res.status}`);
    check('valid_first_delivery ok=true', data.ok === true);
    check('valid_first_delivery NOT idempotent', data.idempotent !== true);
  }

  // ---- 6. Same delivery_id again -> 200 + idempotent=true ----
  {
    const body = JSON.stringify({ ref: 'refs/heads/main', smoke: idempotencyDeliveryId });
    const res = await githubPOST(
      makeRequest({
        body,
        signature: signGithub(body),
        deliveryId: idempotencyDeliveryId,
        eventType: 'push',
      }),
    );
    const data = (await res.json()) as { ok?: boolean; idempotent?: boolean };
    check('duplicate_delivery returns 200', res.status === 200, `got ${res.status}`);
    check('duplicate_delivery idempotent=true', data.idempotent === true);
  }

  // ---- 7. Missing secret env -> fail-closed 500 ----
  {
    const savedSecret = process.env.GITHUB_WEBHOOK_SECRET;
    delete process.env.GITHUB_WEBHOOK_SECRET;
    try {
      const body = JSON.stringify({ ref: 'refs/heads/main' });
      const res = await githubPOST(
        makeRequest({
          body,
          signature: signGithub(body),
          deliveryId: randomUUID(),
          eventType: 'push',
        }),
      );
      check('missing_secret returns 500', res.status === 500, `got ${res.status}`);
    } finally {
      process.env.GITHUB_WEBHOOK_SECRET = savedSecret;
    }
  }

  // ---- 8. GET -> 405 ----
  {
    const { GET } = await import('../src/app/api/webhooks/github/route.ts');
    const res = await GET();
    check('get_method returns 405', res.status === 405, `got ${res.status}`);
  }

  // ===========================================================================
  // Per-event dispatch tests (Track 3b)
  // ---------------------------------------------------------------------------
  // These exercise the per-event business-logic wiring the route handlers
  // call after first-seen idempotency check. Each test seeds the
  // minimum schema fixtures, fires a synthetic signed webhook, and
  // asserts the side-effect row appeared.

  const seed = new Client({ connectionString: DB_URL });
  await seed.connect();

  // Stable IDs for fixture isolation across runs.
  const PROJECT_ID = '99999999-1111-1111-1111-111111111111';
  const COMPOSER_ID = '99999999-2222-2222-2222-222222222222';
  const TERRITORY_ID = '99999999-3333-3333-3333-333333333333';
  const SESSION_ID = '99999999-4444-4444-4444-444444444444';
  const REPO_URL = 'https://example.invalid/dispatch-smoke';

  await seed.query(`DELETE FROM triage_pending WHERE project_id = $1`, [PROJECT_ID]);
  await seed.query(`DELETE FROM contributions WHERE project_id = $1`, [PROJECT_ID]);
  await seed.query(`DELETE FROM embed_state WHERE project_id = $1`, [PROJECT_ID]);
  await seed.query(`DELETE FROM telemetry WHERE project_id = $1`, [PROJECT_ID]);
  await seed.query(`DELETE FROM territories WHERE project_id = $1`, [PROJECT_ID]);
  await seed.query(`DELETE FROM sessions WHERE composer_id = $1`, [COMPOSER_ID]);
  await seed.query(`DELETE FROM composers WHERE project_id = $1`, [PROJECT_ID]);
  await seed.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]);
  await seed.query(
    `DELETE FROM webhook_deliveries WHERE source IN ('github', 'figma') AND delivery_id LIKE 'dispatch-smoke-%'`,
  );

  await seed.query(
    `INSERT INTO projects (id, name, repo_url, default_branch, template_version)
     VALUES ($1, 'dispatch-smoke', $2, 'main', '1.0')`,
    [PROJECT_ID, REPO_URL],
  );
  await seed.query(
    `INSERT INTO composers (id, project_id, email, display_name, discipline, identity_subject)
     VALUES ($1, $2, 'dispatch-bot@smoke.invalid', 'Dispatch Bot', 'dev', 'sub-dispatch')`,
    [COMPOSER_ID, PROJECT_ID],
  );
  await seed.query(
    `INSERT INTO territories (id, project_id, name, owner_role, review_role, scope_kind, scope_pattern)
     VALUES ($1, $2, 'dispatch-smoke-terr', 'dev', 'architect', 'files', ARRAY['dispatch-smoke/**'])`,
    [TERRITORY_ID, PROJECT_ID],
  );
  await seed.query(
    `INSERT INTO sessions (id, project_id, composer_id, surface)
     VALUES ($1, $2, $3, 'passive')`,
    [SESSION_ID, PROJECT_ID, COMPOSER_ID],
  );

  // ---- 9. push event -> embed_state row inserted ----
  {
    const deliveryId = `dispatch-smoke-${randomUUID()}`;
    const body = JSON.stringify({
      ref: 'refs/heads/main',
      after: 'abc123',
      repository: { html_url: REPO_URL, full_name: 'example/dispatch-smoke' },
      commits: [
        {
          id: 'abc123',
          added: [],
          modified: ['docs/architecture/decisions/ADR-099-test.md'],
          removed: [],
        },
      ],
    });
    const res = await githubPOST(
      makeRequest({
        body,
        signature: signGithub(body),
        deliveryId,
        eventType: 'push',
      }),
    );
    check('push_dispatch returns 200', res.status === 200, `got ${res.status}`);
    const data = (await res.json()) as { dispatch?: string };
    check(
      'push_dispatch summary mentions enqueue',
      typeof data.dispatch === 'string' && data.dispatch.includes('enqueued'),
      `got ${data.dispatch}`,
    );
    const { rows: embedRows } = await seed.query<{ artifact_path: string; observed_commit_sha: string | null }>(
      `SELECT artifact_path, observed_commit_sha FROM embed_state WHERE project_id = $1`,
      [PROJECT_ID],
    );
    check(
      'push_dispatch embed_state row inserted',
      embedRows.length === 1 &&
        embedRows[0]?.artifact_path === 'docs/architecture/decisions/ADR-099-test.md',
      `rows=${JSON.stringify(embedRows)}`,
    );
    check(
      'push_dispatch embed_state observed_commit_sha set',
      embedRows[0]?.observed_commit_sha === 'abc123',
    );
  }

  // ---- 10. pull_request closed+merged -> contribution.state='merged' ----
  {
    // Seed a contribution on a known branch in claimed/in_progress state.
    const contribId = randomUUID();
    await seed.query(
      `INSERT INTO contributions (
         id, project_id, author_composer_id, author_session_id, trace_ids,
         territory_id, artifact_scope, state, kind, content_ref, repo_branch
       ) VALUES (
         $1, $2, $3, $4, ARRAY['US-1.1'],
         $5, ARRAY['dispatch-smoke/file.ts'], 'in_progress', 'implementation',
         'dispatch-smoke/file.ts', 'feat/dispatch-smoke'
       )`,
      [contribId, PROJECT_ID, COMPOSER_ID, SESSION_ID, TERRITORY_ID],
    );
    const deliveryId = `dispatch-smoke-${randomUUID()}`;
    const body = JSON.stringify({
      action: 'closed',
      pull_request: {
        merged: true,
        head: { ref: 'feat/dispatch-smoke' },
        merge_commit_sha: 'def456',
        html_url: 'https://example.invalid/pr/1',
      },
      repository: { html_url: REPO_URL, full_name: 'example/dispatch-smoke' },
    });
    const res = await githubPOST(
      makeRequest({
        body,
        signature: signGithub(body),
        deliveryId,
        eventType: 'pull_request',
      }),
    );
    check('pr_merge_dispatch returns 200', res.status === 200, `got ${res.status}`);
    const data = (await res.json()) as { dispatch?: string };
    check(
      'pr_merge_dispatch summary mentions merged',
      typeof data.dispatch === 'string' && data.dispatch.includes('merged'),
      `got ${data.dispatch}`,
    );
    const { rows } = await seed.query<{ state: string; last_observed_commit_sha: string | null }>(
      `SELECT state, last_observed_commit_sha FROM contributions WHERE id = $1`,
      [contribId],
    );
    check(
      'pr_merge_dispatch contribution state=merged',
      rows[0]?.state === 'merged',
      `state=${rows[0]?.state}`,
    );
    check(
      'pr_merge_dispatch records merge commit sha',
      rows[0]?.last_observed_commit_sha === 'def456',
    );
  }

  // ---- 11. FILE_COMMENT -> triage_pending row inserted ----
  {
    process.env.ATELIER_FIGMA_PROJECT_ID = PROJECT_ID;
    process.env.ATELIER_FIGMA_TRIAGE_SESSION_ID = SESSION_ID;
    process.env.ATELIER_FIGMA_TRIAGE_TERRITORY_ID = TERRITORY_ID;
    const externalCommentId = `figma-cmt-${randomUUID()}`;
    const body = JSON.stringify({
      event_type: 'FILE_COMMENT',
      file_key: 'fk-smoke',
      file_name: 'Dispatch Smoke File',
      comment_id: externalCommentId,
      triggered_by: { handle: 'designer-smoke', id: 'u-1' },
      comment: [{ text: 'this color feels off' }],
      timestamp: new Date().toISOString(),
      webhook_id: 'wh-smoke',
    });
    const sig = createHmac('sha256', FIGMA_TEST_SECRET).update(body, 'utf8').digest('hex');
    const headers = new Headers({ 'content-type': 'application/json' });
    headers.set('x-figma-signature', sig);
    headers.set('x-figma-webhook-id', `dispatch-smoke-figma-${randomUUID()}`);
    const req = new Request('http://localhost/api/webhooks/figma', {
      method: 'POST',
      headers,
      body,
    });
    const res = await figmaPOST(req);
    check('figma_dispatch returns 200', res.status === 200, `got ${res.status}`);
    const data = (await res.json()) as { dispatch?: string };
    check(
      'figma_dispatch summary mentions triage_pending',
      typeof data.dispatch === 'string' && data.dispatch.includes('triage_pending'),
      `got ${data.dispatch}`,
    );
    const { rows } = await seed.query<{ id: string; comment_text: string }>(
      `SELECT id, comment_text FROM triage_pending
        WHERE project_id = $1 AND comment_source = 'figma' AND external_comment_id = $2`,
      [PROJECT_ID, externalCommentId],
    );
    check(
      'figma_dispatch triage_pending row inserted',
      rows.length === 1 && rows[0]?.comment_text.includes('this color feels off') === true,
      `rows=${rows.length}`,
    );
  }

  await seed.end();

  await __closePoolForTesting();

  if (failures > 0) {
    console.error(`\n${failures} smoke check(s) FAILED`);
    process.exit(1);
  } else {
    console.log('\nAll webhook smoke checks PASSED');
  }
}

run().catch((err) => {
  console.error('smoke run threw:', err);
  process.exit(1);
});
