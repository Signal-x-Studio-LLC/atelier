# First deploy: run Atelier on the network

**Status:** Routing doc per ADR-052 (Cloudflare-primary infrastructure pivot, 2026-05-09). Atelier supports two deploy targets at v1 with explicit canonical preference.

**Audience:** A composer (architect, dev, PM, designer) whose local-bootstrap is already working and who needs network-reachable access to the endpoint. Triggers per `docs/functional/BRD-OPEN-QUESTIONS.md §28`: a teammate joining on a different machine, a remote agent peer composer (claude.ai Connectors / ChatGPT Connectors), continuous availability, external demo, or CI auto-deploy. If none of those apply, stay on `local-bootstrap.md`; deploy adds operational debt without proportional benefit.

**Prerequisite:** `local-bootstrap.md` ran clean. The deploy sequence assumes you understand the substrate's URL split (`/api/mcp` vs `/oauth/api/mcp`), the bearer model (per ADR-028), and the env-var template (`prototype/.env.example`). If those concepts are unfamiliar, finish local-bootstrap first; this runbook only swaps the URLs.

---

## Pick your deploy target

### Default: Cloudflare Workers + Supabase Cloud (canonical per ADR-052)

**When:** Default for new deployments. Matches the wider-workspace pattern (photography, zerospecs, router, blog, letspepper, simple-aes, bcss-runtime are all on Cloudflare). Resolves the latent Vercel Hobby cron-quota blocker for free under Cloudflare Cron Triggers (Workers Paid is $5/mo for 10M req).

**Runbook:** [`cloudflare-bootstrap.md`](./cloudflare-bootstrap.md) — full operator procedure for standing up the Workers deploy + cron-only Worker + Hyperdrive binding to Supabase pooler.

**Time to complete:** 60-90 minutes the first time (Hyperdrive provisioning + first wrangler deploy). Subsequent deploys land in under 60 seconds via `wrangler deploy`.

---

### Alternative: Vercel + Supabase Cloud (deprecated; migration overlap only)

**When:** You already have a Vercel deploy serving prod and haven't cut over to Cloudflare yet (BRD-OPEN-QUESTIONS §37 PR 4 is the cutover trigger), OR you have a documented "why not Cloudflare" rationale per ADR-052's discipline rule (e.g., specific Vercel feature your team depends on, organizational standardization on Vercel, etc.).

**Runbook:** [`legacy-vercel-deploy.md`](./legacy-vercel-deploy.md) — archived 2026-05-09 per ADR-052. Same content as the prior `first-deploy.md`; renamed to surface the deprecation.

**Time to complete:** 60-90 minutes the first time. Subsequent re-deploys land in 60-90 seconds via `vercel deploy --prod`.

---

## Why this routing doc exists

ADR-052 reverses ADR-046 (Vercel deploy strategy) and codifies Cloudflare as the canonical reference deploy. Both runbooks ship at v1 because:

- **The live reference deploy at `https://atelier-three-coral.vercel.app` is on Vercel** until BRD §37 PR 4 cutover. Adopters who clone the repo before that cutover need a working Vercel runbook to match what's in production.
- **New adopters should target the canonical (Cloudflare) shape** so their deploy matches the going-forward direction without needing a migration step later.
- **Vercel migration overlap is bounded**: per BRD §37 PR 5, the Vercel deploy decommissions 30 days after PR 4 cutover. After that, `legacy-vercel-deploy.md` moves to `docs/architecture/audits/` as historical reference.

If you're unsure which to pick: pick Cloudflare. The wider-workspace pattern is empirically more proven; the Cloudflare cron primitives ship on the free tier; the Hyperdrive binding eliminates the IPv6/pooler-hostname class of bug that bit the M8 prod debug.
