---
id: ADR-052
trace_id: BRD:Epic-1
category: architecture
session: m8-strategic-pivot-cloudflare-primary
composer: nino-chavez
timestamp: 2026-05-09T00:00:00Z
reverses: ADR-046
---

# Cloudflare-primary infrastructure pivot; SaaS carve-outs for capabilities CF does not match

**Summary.** Atelier's primary compute + edge + scheduling + object storage + KV + queues land on Cloudflare. Specific capabilities remain on best-suited SaaS where Cloudflare has no equivalent or where the SaaS is the canonical pattern: **Supabase Postgres** (pgvector — required for find_similar; ARCH §5.4), **Supabase Auth** (canonical identity per ADR-028; ES256 JWT issuance + RLS integration), **Resend** (transactional email when added). Reverses ADR-046 (Vercel + Supabase Cloud deploy). Amends ADR-027 capability mapping (Vercel cells become Cloudflare). Amends ADR-029 portability framing (Cloudflare-portability is now the v1 constraint; GCP migration mapping preserved as documented v2 alternative). Establishes a forward-looking discipline: **always try Cloudflare first; deviate only when the capability is non-standard for CF or a SaaS is demonstrably better-suited.**

**Rationale.**

The 2026-05-09 strategic call codified a pivot Nino's wider workspace already converged on empirically. Working reference impls under `~/Workspace/dev/`:

- `apps/photography` — SvelteKit + `@sveltejs/adapter-cloudflare` + Supabase + Cloudflare Worker for album-zip generation
- `apps/zerospecs`, `apps/router`, `apps/blog`, `apps/letspepper`, `wip/simple-aes`, `wip/bcss/runtime-cf` — all on Cloudflare

The canonical-pattern-first rule (Nino's global `~/.claude/CLAUDE.md`) requires checking Nino's other repos for working primitives before specifying custom infra. The pattern shipping in those repos is Cloudflare-primary with Supabase as the relational + identity SaaS layer. ADR-046 codified Vercel because that was the M6 empirical deploy executed under operational pressure (claude.ai Connectors validation trigger); the wider-workspace pattern was not consulted at the time. This ADR aligns Atelier with the established pattern.

Concrete drivers beyond pattern alignment:

1. **Cron blocker resolution (future, not current).** The substrate's cron schedules are declared in `prototype/vercel.ts` (reaper, mirror-delivery, reconcile, triage, alert-publisher per ARCH §6.5 / §7.4 / §8) but the corresponding `/api/cron/*` route handlers are not yet implemented — the schedule is the contract, the handler implementation is pending. The Vercel Hobby cron-quota blocker is therefore *latent*, not active: it becomes load-bearing the moment the first cron handler ships and needs to fire in prod. Cloudflare Cron Triggers ship on the free tier with arbitrary schedules; the blocker is resolved structurally before it ever activates rather than scrambled around when it does.
2. **Connection-pooling fit.** Workers + Hyperdrive binds the substrate to Supabase's pooler natively (the IPv6/serverless footgun that bit M8 prod debug never appears — Hyperdrive owns the egress path). The Vercel Functions → Supabase pooler pattern required the matrix S03 trim-defense work and the pooler hostname spelunking.
3. **Pricing posture for substrate.** Workers Paid is $5/mo for 10M req; Vercel Pro is $20/mo. For substrate workloads (12-tool MCP surface + 5 cron handlers + GitHub/Figma/Auth webhooks), the request-volume sits well under Workers Paid envelope; the cost tier matches the OSS adopter expectation better than Vercel's ladder.
4. **Edge-native primitives are first-class.** R2 (S3-compatible blob), KV (eventually consistent KV), Queues (durable at-least-once), Durable Objects (single-writer state), D1 (SQLite at edge — not used by Atelier; pgvector requirement keeps Postgres canonical) are platform-native and don't require external SaaS. Vercel's marketplace approach makes each capability a separate vendor + billing line.
5. **Same-developer-workflow continuity.** Wrangler CLI matches the operational pattern Nino's other repos use; shared muscle memory for deploy + secrets + tail logs reduces context-switching cost across the workspace.

**SaaS carve-outs (deliberately NOT on Cloudflare).**

| Capability | Stays on | Why CF doesn't suit |
|---|---|---|
| Relational datastore + vector | Supabase Postgres + pgvector | D1 is SQLite (no pgvector); Cloudflare Postgres-via-Hyperdrive routes back to Postgres anyway. Postgres + pgvector is the canonical fit per ARCH §5.4 + ADR-041. |
| Identity service | Supabase Auth | Canonical per ADR-028; ES256 JWT issuance + RLS integration + OIDC discovery at `/auth/v1`. CF Access is a different shape (zero-trust gateway, not OIDC IdP) and would not match the substrate's bearer + composer-row pattern. |
| Transactional email (when added) | Resend | CF Email Routing is inbound-only/forwarding; Resend is the canonical outbound transactional sender pattern. Not load-bearing today; reserved for when notifications surface. |
| File / large-blob versioned storage | GitHub | Per ADR-027 unchanged. CF R2 fits *binary* blob storage (e.g., agent-session transcripts at scale per ADR-024), but the canonical artifact stays on GitHub. R2 is the v1.x escalation path if transcript volume warrants. |

**Why each choice (Cloudflare side).**

1. **Compute / hosting: Cloudflare Workers via `@opennextjs/cloudflare`.** The OpenNext Cloudflare adapter is the canonical Next.js → Workers shape; supports App Router, RSC, route handlers, ISR, on-demand revalidation, middleware. Requires `compatibility_flags = ["nodejs_compat"]` for the substrate's Node-standard imports (pg driver, crypto, AsyncLocalStorage). The `nodejs_compat` envelope covers ADR-051's AsyncLocalStorage pattern unchanged. Static assets serve via Workers Static Assets binding (no separate Pages project).
2. **Cron: Cloudflare Cron Triggers.** Per-script schedules in `wrangler.toml`'s `[triggers] crons = [...]` block. Replaces Vercel Cron's per-path schedule from the M6 deploy. Each substrate cron handler (reaper, mirror-delivery, reconcile, etc. per ARCH §6.5) becomes a `scheduled()` Worker handler reachable via the same code path as the HTTPS handler — same bearer + composer-row logic, different invocation envelope. Free tier supports unlimited schedules.
3. **Postgres connection pool: Cloudflare Hyperdrive → Supabase pooler.** Hyperdrive binds the Worker to a persistent pooled connection. The Supabase pooler URL becomes the Hyperdrive origin; the Worker reads the Hyperdrive binding instead of `POSTGRES_URL` directly. Eliminates the matrix S03 IPv6/pooler-hostname class of bug because Hyperdrive owns the egress path. Compatibility note for ADR-051: `SET LOCAL ROLE` + `set_config('request.jwt.claims', ...)` operates on the transaction; Hyperdrive supports tx pooling but its query-result caching MUST be disabled for RLS-engaged statements (caching across composer identities would break tenant isolation). Hyperdrive config: `caching = { disabled = true }` for Atelier's pool.
4. **Static assets: Workers Static Assets binding.** Single Worker project serves static + dynamic; no separate Cloudflare Pages project. Asset routing is Wrangler-native. Maintains the substrate's URL split (`/api/mcp` static-bearer + `/oauth/api/mcp` OAuth-flow with discovery published path-prefixed) as Worker route patterns.
5. **Secrets: Wrangler secrets via `wrangler secret put`.** Replaces `vercel env add`. Same env-var names (`ATELIER_DATASTORE_URL`, `ATELIER_OIDC_ISSUER`, `ATELIER_JWT_AUDIENCE`, `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`); transport changes only. The trailing-newline gotcha that fired on Vercel's CLI piped-input path (matrix S03 trim-defense commit `785ef1c`) is irrelevant on Wrangler's secret-put flow, but the `.trim()` guard in `oauth-discovery.ts` stays — defense-in-depth, costs nothing.
6. **Deploy trigger: Wrangler + GitHub Actions.** `wrangler deploy` from CI on push-to-main. Replaces Vercel's git-integration auto-deploy. Per-PR preview deploys via Wrangler Deploy Previews (preview Worker URL per branch). The same M7 deploy-validation surface (preview-URL smokes) carries over to Cloudflare's preview shape unchanged.

**Operational debt accepted (Cloudflare-side).**

- **Hyperdrive caching disabled for the substrate pool.** Performance cost: Hyperdrive's value-add is connection pooling (always-on benefit) plus result caching (disabled for Atelier). The substrate workloads are predominantly write-heavy and tx-bound; result caching wouldn't help much regardless. RLS correctness > marginal read cache.
- **OpenNext adapter version maturity.** `@opennextjs/cloudflare` is GA but evolves. Version pinning required; upgrade discipline needed when adopting features. Track adapter changelog at PR time.
- **No rolling-release / canary by default.** Workers deploys atomically per environment. Vercel's Rolling Releases (the GA-since-June-2025 feature) is not a Cloudflare equivalent at v1; canary patterns require manual % traffic split via Workers Routes or third-party gateway. Adopters needing canary file follow-up.
- **Bearer rotation: same operator script.** `scripts/bootstrap/rotate-bearer.ts` works against Supabase Auth identically; Cloudflare doesn't change the bearer model (still ES256 1-hour JWT per ADR-028). The script's only change: env-var write target becomes Wrangler secret instead of Vercel env.
- **Migration of existing Vercel deploy.** ADR-052 codifies the going-forward discipline; the in-flight production deploy at `https://atelier-three-coral.vercel.app` continues to serve until the migration ships. Migration is filed as BRD-OPEN-QUESTIONS §37 with concrete trigger criteria + execution scope. Vercel deploy is deprecated, not deleted, until CF deploy reaches operator-validated parity.

**What this ADR does NOT decide.**

- **Migration timing for the live Vercel deploy.** Filed as BRD-OPEN-QUESTIONS §37; trigger-based per the §25 + §28 methodology lesson (event-triggered with concrete criteria, not date-based).
- **Custom domain.** Adopters wire whatever DNS they prefer; Cloudflare's R1 advantage (registrar + DNS + Workers same vendor) makes custom domain setup one Cloudflare dashboard step, but Atelier doesn't require it.
- **Cloudflare Access / Zero Trust.** Could be layered on the substrate URL for adopters with sensitive content (replaces Vercel's Deployment Protection feature). Adopter-driven; not part of the substrate.
- **D1 / Workers KV adoption inside the substrate.** None planned at v1. The `12-tool surface` (ADR-013/040) is Postgres-bound by design; KV is reserved for future capabilities (e.g., rate-limit counters) where its consistency model fits.
- **Multi-region datastore.** Supabase region (`us-west-1` per the M6 deploy) stays the source of truth; Workers run globally and round-trip via Hyperdrive. Multi-region Postgres is out-of-scope for v1.

**Decision.**

For the v1 reference implementation deploy:

- **Hosting:** Cloudflare Workers via `@opennextjs/cloudflare` adapter, `compatibility_flags = ["nodejs_compat"]`, Workers Static Assets binding for `prototype/` build output, default `*.workers.dev` subdomain
- **Datastore + auth:** Supabase Cloud project (Pro tier recommended; Free works for evaluation), `us-west-1` or co-located with primary Worker region, all migrations applied via `supabase db push` from CLI link
- **Connection pool:** Cloudflare Hyperdrive binding pointing at Supabase pooler (port 6543); Hyperdrive caching disabled for RLS correctness; the Worker reads the Hyperdrive binding URL, not `POSTGRES_URL` directly
- **Cron:** `wrangler.toml [triggers] crons = [...]` with one entry per substrate cron handler (reaper, mirror-delivery, reconcile per ARCH §6.5); each handler exposes both `fetch()` (HTTPS) and `scheduled()` (cron) entry points sharing the same logic
- **URL surface:** unchanged from local-bootstrap and the prior Vercel deploy — `/api/mcp` (static-bearer) + `/oauth/api/mcp` (OAuth-flow); discovery published only at `/.well-known/oauth-authorization-server/oauth/api/mcp`; `/.well-known/oauth-authorization-server` returns JSON 404 per PR #16 catch-all
- **Secrets on Cloudflare:** `ATELIER_DATASTORE_URL` (Hyperdrive binding URL), `ATELIER_OIDC_ISSUER` (`https://<project-ref>.supabase.co/auth/v1`), `ATELIER_JWT_AUDIENCE=authenticated`, `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`. Set via `wrangler secret put`.
- **Bearer model:** unchanged — Supabase Auth ES256 1-hour default TTL; operator rotation via `scripts/bootstrap/rotate-bearer.ts` (writes to Wrangler secret instead of Vercel env)
- **Deploy trigger:** `wrangler deploy` from `.github/workflows/deploy.yml` on push-to-main; per-PR preview deploys via Wrangler preview URLs
- **Operator runbook:** `docs/user/tutorials/first-deploy.md` updated to Cloudflare-primary; the prior Vercel-shape runbook moves to `docs/user/tutorials/legacy-vercel-deploy.md` until the migration ships

**Discipline (forward-looking).**

When adding new infrastructure capability to Atelier (queues, scheduled jobs, blob storage, KV, edge cache, durable single-writer state, AI inference, image transformation, etc.):

1. **Cloudflare first.** Check whether Cloudflare ships the primitive (R2, Queues, KV, Durable Objects, Workers AI, Images, Stream, Vectorize, Browser Rendering, Email Routing inbound, etc.). If yes, default to the Cloudflare primitive.
2. **SaaS carve-out only with named justification.** Deviating to a non-CF SaaS requires a named disqualifier in the spec/ADR — same shape as the canonical-pattern-first rule. The pre-approved carve-outs (Supabase Postgres+pgvector, Supabase Auth, Resend) need no per-use re-justification; novel deviations do.
3. **Vercel-shape patterns are deprecated.** New work targeting Vercel Functions, Vercel Cron, Vercel KV, Vercel Edge Config, Edge Runtime, `@vercel/*` packages is rejected at PR review unless the spec carries an explicit "why not Cloudflare" sentence. The portability lint (PR #28 era) extends to ban `@vercel/*` imports outside named adapters.
4. **Cross-vendor portability framing flips.** ADR-029's GCP-portability mapping stays in the doc as a documented v2 alternative (organizations standardizing on GCP can still execute the migration), but the v1 portability target is **Cloudflare → Supabase**. The named-adapter discipline (no proprietary imports outside adapters) generalizes: no `@vercel/*` AND no Cloudflare-proprietary imports outside the Cloudflare adapter (which is the v1 default).

**Consequences.**

- ADR-046 reversed: Vercel + Supabase Cloud deploy is no longer the canonical reference impl; Cloudflare + Supabase Cloud is.
- ADR-027 amended: capability mapping cells for *serverless runtime*, *static hosting*, *cron* update from Vercel to Cloudflare; *relational datastore*, *identity*, *vector*, *versioned file store*, *protocol* unchanged. ADR-027 itself is not reversed (the architecture-level claim "GitHub + Supabase + [serverless+hosting+cron] + MCP" still holds; the vendor for the bracketed capabilities flips).
- ADR-029 amended: GCP-portability is preserved as a v2 alternative; Cloudflare-portability is the v1 constraint. The named-adapter rule generalizes (banned imports list adds Cloudflare-proprietary alongside `@vercel/*`).
- ADR-028 reaffirmed: Supabase Auth stays the identity default; Cloudflare Access is not a substitute (different shape).
- ADR-051 (RLS engagement via AsyncLocalStorage + SET LOCAL) carries over unchanged: Workers `nodejs_compat` envelope supports AsyncLocalStorage; the per-tx SET LOCAL pattern operates inside the Worker handler exactly as it does inside the Next.js route handler.
- ADR-013 / ADR-040 (12-tool surface) unchanged: the surface is platform-agnostic; only the host changes.
- BUILD-SEQUENCE M9+ scope updates to include Cloudflare migration of the live Vercel deploy. Migration filed as BRD-OPEN-QUESTIONS §37 with trigger criteria.
- Vercel Hobby cron-quota blocker (matrix S03 → operator-pending follow-up) is structurally avoided once cron handlers are implemented on the CF shape; the future operator-decision tree (upgrade Pro / relax crons / migrate) never has to be navigated. Note: blocker is latent today (handlers not yet built), not active — the resolution is forward-looking, not retroactive cleanup.
- The methodology canonical-pattern-first rule is reinforced: when wider-workspace shows a pattern, codify it across new projects rather than re-deriving under operational pressure (the M6 deploy was the last Vercel-shape decision made in isolation from the workspace pattern).

**Re-evaluation triggers.**

- Cloudflare announces deprecation or pricing change that makes Workers Paid untenable for adopter scale → re-evaluate hosting platform; ADR-029's preserved migration mapping (GCP) is the immediate fallback path.
- Supabase Cloud announces deprecation or pricing change for Pro Postgres + pgvector + Auth → re-evaluate datastore + auth (this trigger is shared with ADR-027).
- An adopter signals a regulated-environment requirement that bans Cloudflare or Supabase from their stack → invoke ADR-029 portability mapping; the v2 GCP shape is the documented alternative.
- An adopter signals a multi-region datastore requirement → file a v1.x ADR for region scoping; not handled at v1.
- A Workers feature gap surfaces that materially blocks substrate function (e.g., `nodejs_compat` envelope drops a needed primitive) → re-evaluate; OpenNext adapter is upstream-tracked, so the gap has a name and a remediation path before it lands as a blocker.
