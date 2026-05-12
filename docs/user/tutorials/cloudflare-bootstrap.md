---
title: Cloudflare bootstrap (operator runbook)
audience: operator
status: canonical
landed: 2026-05-09
canonicalized: 2026-05-09  # was stub; expanded at BRD §37 PR 3
---

# Cloudflare bootstrap

**Status.** Canonical operator runbook for standing up Atelier on Cloudflare Workers + Supabase Cloud. Procedural twin to ADR-052 (Cloudflare-primary infrastructure pivot, 2026-05-09).

**Audience.** Operator deploying Atelier for the first time, OR cutting an existing Vercel deploy over to Cloudflare per BRD-OPEN-QUESTIONS §37 PR 4. Adopters following this for first-time deploy don't need to read the legacy Vercel doc; cutover operators should have both open.

**Time to complete.** 60-90 minutes the first time (Hyperdrive provisioning + first deploy + smoke verification). Subsequent deploys land in under 60 seconds via `wrangler deploy`.

---

## What you'll have at the end

- A live Atelier endpoint at `https://atelier-prototype.<your-cf-subdomain>.workers.dev/api/mcp` (and `/oauth/api/mcp` for OAuth-flow clients)
- A separate cron-only Cloudflare Worker firing the 5 substrate cron handlers (reaper, mirror-delivery, reconcile, triage, alert-publisher) on the schedules from `cron-worker/wrangler.jsonc`
- A Cloudflare Hyperdrive binding pooling connections to the Supabase pooler (caching disabled per ADR-052 RLS-correctness rule)
- A cloud Supabase project hosting the coordination datastore + auth (all migrations applied)
- A static bearer token issued against cloud Supabase Auth, ready to hand to any MCP client
- The `/atelier` lens UI at `https://atelier-prototype.<your-cf-subdomain>.workers.dev/atelier` for any composer with an authenticated session
- Git auto-deploy: PRs against `main` trigger preview deploys; pushes to `main` trigger production deploys (gated behind `vars.CF_DEPLOY_ENABLED`)

After this runbook, claude.ai Connectors / ChatGPT Connectors / any remote MCP client can reach the substrate. Local development still works against `localhost:3030` per local-bootstrap.

---

## Prerequisites

- **Cloudflare account with Workers Paid plan ($5/mo).** Required for Hyperdrive bindings + cron triggers beyond the free tier. The free tier covers Workers compute (100k req/day) but not Hyperdrive.
- **Supabase Cloud project.** Free tier provisions Postgres + Auth + Realtime + pgvector. Pro recommended once a real team uses the deploy.
- **GitHub repository with the Atelier source.** PR-based preview deploys depend on it.
- **Wrangler CLI installed locally.** `npm install -g wrangler` or use the version in `prototype/node_modules/.bin/wrangler` after the prototype install.
- **OpenAI API key.** Same as local-bootstrap; needed for the `find_similar` embedding adapter.

---

## Step 1 — Wrangler authentication

```bash
wrangler login
```

Opens a browser flow against your Cloudflare account. One-time per machine.

Verify:

```bash
wrangler whoami
```

Should print your account email + the account ID(s) you have access to. Capture the account ID — you'll need it for GitHub Actions secret `CLOUDFLARE_ACCOUNT_ID` later.

---

## Step 2 — Provision the Hyperdrive binding

Hyperdrive owns the connection pool from Workers to your Supabase Postgres. Per ADR-052 caching MUST be disabled for ADR-051 RLS correctness (per-tx `SET LOCAL ROLE atelier_runtime` would be cached across composer identities otherwise, breaking tenant isolation).

```bash
wrangler hyperdrive create atelier-pool \
  --connection-string="postgres://postgres.<project-ref>:<password>@aws-1-<region>.pooler.supabase.com:6543/postgres"
```

Substitute `<project-ref>`, `<password>`, `<region>` from your Supabase project settings → Database → Connection pooling → Transaction pooler. Use the **transaction pooler** (port 6543), not direct (5432).

Output includes a binding `id` like `abc123def456...`. Capture it.

Edit `prototype/wrangler.jsonc` and replace `REPLACE_WITH_HYPERDRIVE_BINDING_ID` with the returned id:

```jsonc
"hyperdrive": [
  {
    "binding": "ATELIER_POOL",
    "id": "abc123def456...",
    "localConnectionString": "postgres://postgres:postgres@127.0.0.1:54322/postgres"
  }
]
```

Caching disabled: by default Hyperdrive enables result caching. To disable for the Atelier pool:

```bash
wrangler hyperdrive update <binding-id> --caching-disabled
```

(Verify in dashboard → Hyperdrive → atelier-pool → settings → caching = disabled.)

---

## Step 3 — Apply Supabase migrations

If you haven't already (e.g., during local-bootstrap):

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Confirms with the migrations diff; type `y` to apply. Should land all 18 migrations cleanly (M1 through M8 + reaper + triage_watermarks).

---

## Step 4 — Set Workers secrets (main app)

From `prototype/`:

```bash
wrangler secret put ATELIER_OIDC_ISSUER
# enter: https://<project-ref>.supabase.co/auth/v1

wrangler secret put ATELIER_JWT_AUDIENCE
# enter: authenticated

wrangler secret put OPENAI_API_KEY
# enter: <your OpenAI key>

wrangler secret put NEXT_PUBLIC_SUPABASE_URL
# enter: https://<project-ref>.supabase.co

wrangler secret put NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# enter: the sb_publishable_* key from Supabase dashboard → Settings → API
# (the late-2025 paradigm; legacy installs may still expose this slot as
# NEXT_PUBLIC_SUPABASE_ANON_KEY -- either name works at runtime per the
# adapter at prototype/src/lib/atelier/adapters/supabase-ssr.ts)

wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# enter: from Supabase dashboard → Settings → API → service_role secret

wrangler secret put CRON_SECRET
# enter: a fresh random string (used by both the main app and cron-worker
# to authenticate cron HTTP calls). Generate via `openssl rand -hex 32`.
```

Note: `ATELIER_DATASTORE_URL` is NOT a Workers secret on the CF deploy — the Hyperdrive binding handles connection routing. The main app reads `env.ATELIER_POOL.connectionString` (the Hyperdrive-routed URL) at request time.

---

## Step 5 — Set Workers secrets (cron-worker)

From `cron-worker/`:

```bash
wrangler secret put CRON_SECRET
# enter: the SAME string from Step 4 (both Workers must agree on the bearer)
```

---

## Step 6 — Deploy the main app

From `prototype/`:

```bash
npm run cf:deploy
```

This runs `opennextjs-cloudflare deploy` which builds the Next.js app via OpenNext, bundles the worker, and deploys to your CF account.

Output includes the deployed URL like `https://atelier-prototype.<your-subdomain>.workers.dev`. Capture this URL.

---

## Step 7 — Wire the cron-worker to the main app

Edit `cron-worker/wrangler.jsonc` and replace the `ATELIER_APP_URL` placeholder with the URL from Step 6:

```jsonc
"vars": {
  "ATELIER_APP_URL": "https://atelier-prototype.<your-subdomain>.workers.dev"
}
```

Then deploy the cron-worker:

```bash
cd cron-worker
npm run deploy
```

The cron Worker is now live. CF will fire the scheduled handlers per the cron expressions in `wrangler.jsonc triggers.crons` (every 2 minutes for mirror-delivery, etc.).

---

## Step 8 — GitHub Actions wiring

In your repo settings:

- **Secrets** (Settings → Secrets and variables → Actions → New repository secret):
  - `CLOUDFLARE_API_TOKEN` — create at Cloudflare dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template
  - `CLOUDFLARE_ACCOUNT_ID` — the account ID from `wrangler whoami` Step 1

- **Variables** (Settings → Secrets and variables → Actions → Variables):
  - `CF_DEPLOY_ENABLED` = `true`

Setting `CF_DEPLOY_ENABLED=true` activates `.github/workflows/cloudflare-deploy.yml`. PRs touching `prototype/**` or `cron-worker/**` will now trigger preview deploys; pushes to `main` will trigger production deploys.

---

## Step 9 — Issue the operator bearer

The operator bearer is a Supabase-issued ES256 JWT, identical to local-bootstrap. The deployment URL changes; the bearer issuance flow doesn't.

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_ANON_KEY=<anon key from Supabase dashboard → Settings → API → anon public> \
npx tsx scripts/bootstrap/issue-bearer.ts \
  --email you@example.com \
  --password <your seeded password>
```

The script prints a fresh Bearer token with 1-hour TTL. Use this with any MCP client targeting the deployed URL.

---

## Step 10 — Webhook re-registration (cutover only)

Skip this step if you're doing a first-time deploy. Only relevant if you're cutting over from Vercel per BRD §37 PR 4.

Re-register webhooks pointing at the new CF URL:

- **GitHub webhook** (your repo → Settings → Webhooks → existing webhook → edit URL):
  `https://atelier-prototype.<your-subdomain>.workers.dev/api/webhooks/github`
  Secret: same `GITHUB_WEBHOOK_SECRET` (already a Workers secret from Step 4).

- **Figma webhook** (via Figma API — see Figma docs):
  `https://atelier-prototype.<your-subdomain>.workers.dev/api/webhooks/figma`
  Secret: same `FIGMA_WEBHOOK_SECRET`.

- **Supabase Auth Hooks** (Supabase dashboard → Authentication → Hooks):
  `https://atelier-prototype.<your-subdomain>.workers.dev/api/webhooks/supabase-auth`
  Secret: same `SUPABASE_AUTH_HOOK_SECRET`. Use the Svix-style verification per PR #85 — Supabase generates this signing secret when you create the hook; reuse the existing one.

Test each webhook by triggering an event from the source system; verify the main app's logs (`wrangler tail` from `prototype/`) show 200 responses.

---

## Step 11 — Verify

Smoke the deployed substrate:

```bash
# OAuth discovery should return a JSON document (not 404)
curl https://atelier-prototype.<your-subdomain>.workers.dev/.well-known/oauth-authorization-server/oauth/api/mcp

# OAuth discovery at root should return JSON 404 (catch-all per PR #16)
curl https://atelier-prototype.<your-subdomain>.workers.dev/.well-known/oauth-authorization-server

# MCP static-bearer endpoint with your bearer
curl -H "Authorization: Bearer <token from Step 9>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-11-25" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  https://atelier-prototype.<your-subdomain>.workers.dev/api/mcp
```

Expected: tools/list returns the 18 MCP tools per ADR-013/040 + ADR-054 (brainstorm primitives expansion: propose / react / get_proposals / synthesize / approve_plan) + ADR-058 (checkpoint). If it doesn't, check `wrangler tail` from `prototype/` for the error.

Verify cron is firing:

```bash
cd cron-worker && wrangler tail
```

Within 2 minutes you should see `[atelier-cron] /api/cron/mirror-delivery ok status=200 duration_ms=...` (or similar for whichever cron fires first).

---

## Operator recurring tasks

- **Bearer rotation**: run `scripts/bootstrap/rotate-bearer.ts` periodically per the 1-hour TTL. The script writes to `.mcp.json` for local Claude Code; deployed clients (claude.ai Connectors, etc.) re-issue from their own Supabase Auth flow.

- **Hyperdrive monitoring**: Cloudflare dashboard → Hyperdrive → atelier-pool → metrics. Watch for connection-pool exhaustion or query-latency degradation.

- **Cron observability**: `cd cron-worker && wrangler tail` for live cron handler logs. Failures log + continue (don't throw to CF) so you'll see `non-2xx` lines for downstream errors.

---

## Cross-references

- ADR-052 — Cloudflare-primary infrastructure pivot (decision)
- BRD-OPEN-QUESTIONS §37 — migration execution scope (5-PR plan; this runbook lands at PR 3)
- `docs/user/tutorials/legacy-vercel-deploy.md` — prior Vercel runbook (deprecated)
- `prototype/wrangler.jsonc` — main-app Cloudflare configuration with inline operator notes
- `cron-worker/wrangler.jsonc` — cron-only Worker configuration with inline operator notes
