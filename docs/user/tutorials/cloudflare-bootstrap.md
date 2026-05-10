---
title: Cloudflare bootstrap (operator runbook)
audience: operator
status: stub
landed: 2026-05-09
expanded_at: BRD-OPEN-QUESTIONS-37-PR-3
---

# Cloudflare bootstrap

**Status.** Stub. Lands as part of BRD-OPEN-QUESTIONS §37 PR 1 (CF scaffold). The full operator runbook lands at §37 PR 3 (alongside the bearer-rotate script update). Until then this file exists as a placeholder so the wrangler.jsonc and CI workflow can reference a stable path; treat its content as a checklist outline, not an executable runbook.

## What this runbook will cover (PR 3)

The full procedural twin to ADR-052 — how an operator stands up Atelier on Cloudflare from a clean account.

## Prerequisites

- Cloudflare account with Workers Paid plan ($5/mo) — required for Hyperdrive bindings + cron triggers beyond the free tier
- Supabase project (Cloud Pro or Free; pgvector + Auth + Postgres) — unchanged from ADR-046 era
- GitHub repository with the Atelier source

## Outline (to be expanded at PR 3)

1. **Wrangler authentication** — `wrangler login`
2. **Hyperdrive binding creation**
   - `wrangler hyperdrive create atelier-pool --connection-string="$ATELIER_DATASTORE_URL"`
   - copy the binding `id` into `prototype/wrangler.jsonc` `[hyperdrive]` block
   - verify caching is disabled per ADR-052 (RLS correctness)
3. **Workers secrets**
   - `wrangler secret put ATELIER_OIDC_ISSUER`
   - `wrangler secret put ATELIER_JWT_AUDIENCE`
   - `wrangler secret put OPENAI_API_KEY`
   - `wrangler secret put NEXT_PUBLIC_SUPABASE_URL`
   - `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`
4. **GitHub Actions wiring**
   - set `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in repo secrets
   - set `CF_DEPLOY_ENABLED=true` in repo variables (activates `.github/workflows/cloudflare-deploy.yml`)
5. **First deploy**
   - `cd prototype && npm run cf:deploy`
   - workflow runs on push-to-main and per-PR thereafter
6. **Webhook re-registration** (PR 4 cutover only — not for the scaffold deploy)
   - GitHub webhook → CF URL
   - Figma webhook → CF URL
   - Supabase Auth Hooks → CF URL (Svix-style verification per PR #85)
7. **Bearer rotation**
   - `scripts/bootstrap/rotate-bearer.ts` updated at PR 3 to write to `wrangler secret put` when `.atelier/config.yaml` `deploy.platform=cloudflare`
8. **Verification**
   - run smoke suite against the deployed URL
   - validate OAuth discovery + static-bearer + OAuth-flow per the URL split (ADR-052 § decision)

## Cross-references

- ADR-052 — Cloudflare-primary infrastructure pivot (decision)
- BRD-OPEN-QUESTIONS §37 — migration execution scope (5-PR plan)
- `docs/user/tutorials/legacy-vercel-deploy.md` — prior Vercel runbook (created at PR 3 by relocating `first-deploy.md`)
- `prototype/wrangler.jsonc` — Cloudflare configuration with inline operator notes
