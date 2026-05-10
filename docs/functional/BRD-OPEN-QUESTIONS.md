# BRD Open Questions

**Context.** Decision points surfaced during design that need an explicit call. Each item is a discrete strategic question, not a defect.

**File structure.** Open entries with full context appear first. Resolved entries below are compressed to one-line redirects pointing at the canonical home where each decision now lives. Original numbering is preserved so external references (e.g., "see BRD-OPEN-QUESTIONS section 14") still resolve. Full historical text of resolved entries is in git history.

---

## Open

Open at v1.x: §7 (scale ceiling — bounded harness shipped; empirical override pending operator runs), §21 (AI auto-reviewers — v1.x defer with adopter-signal bar), §22 (semantic-contradiction validator — schema reservation shipped at v1; implementation v1.x), §23 (lightweight annotations on contributions — re-elevated 2026-05-09 to v1.x M6 schedule based on ai-hive `hive_react` + Ace evidence; `annotate` is the missing mid-deliberation structured-input primitive), §30 (push-notification alerting via messaging adapter — v1 ships UI alerts; out-of-band delivery v1.x with adopter-signal trigger), §31 (X1 audit LOW items — filed with explicit activation criteria each), §32 (v0 methodological failure & grounding), §33 (heartbeat collapse into write-side activity bumps — small-additive ADR pending next 12-tool surface revisit; sourced from sibling `tpoolebigC/ai-hive`), §34 (broadcast delivery-latency telemetry — ARCH §6.8 contract amendment proposed; sourced from sibling), §35 (brainstorm primitives `propose/react/synthesize/approve_plan` — RESOLVED-YES per ADR-054 2026-05-10; reverses prior exclusion; tool surface expands 12→18; brainstorm framed as structured deliberation, not chat — preserves PRD §5 exclusion shape), §36 (one-stop dev studio bundling other OSS — bundling held NO per PRD §5; per-project chat integration cut (a) link surface RESOLVED-YES at v1.x, cut (b) bot adapter elevated to surface-plurality demonstration with adopter-contributed implementations, cut (c) embed OPEN with ADR-required-before-shipping; cut (d) dashboard annotation threads RESOLVED-YES at v1.x lands with §23, cut (e) general-purpose chat in `/atelier` RESOLVED-NO — reverses PRD §5), §37 (Cloudflare migration of the live Vercel deploy — execution scope for ADR-052; trigger-based per the §25/§28 methodology lesson; carries Vercel-deprecated-but-not-deleted parallel-serve discipline until CF parity validated).

### 7 · Scale ceiling per guild

**Scenario.** One guild hosts N projects with M composers total. What are the design limits?

**Open questions:**
- Is the blackboard pub/sub single-channel per-project or per-guild? Pub/sub load scales accordingly.
- Vector index size: embeddings for all decisions + contributions + BRD sections + research across all projects. What's the ceiling before query p95 degrades?
- Reaper cron runs across all projects — does it parallelize per-project or scan one table?

**Recommendation.** Document supported scale envelope (e.g., up to 10 projects × 20 composers × 10K contributions per project = 2M rows). Beyond that, recommend multiple guilds per team.

**Status.** OPEN -- bounded M7 deliverable landed; empirical override pending operator runs of the harness. The v1 envelope is committed in ARCH §9.8 (mirrors `docs/testing/scale-ceiling-benchmark-plan.md` §4). The harness at `scripts/test/scale/load-runner.ts` ships Scenarios A (endpoint sustained load) and B (reaper cycle time) end-to-end; C (broadcast fanout), D (vector kNN at scale), and E (cross-dimension stress) ship as documented stubs that follow the same scenario-A pattern. Per ADR-011 destination-first + the M7 kickoff bounded scope: the v1 deliverable is "harness + observability hooks + measured-envelope doc" not "find the actual ceiling." When operators run the harness against a deployed substrate, the empirical numbers populate `docs/architecture/audits/scale-ceiling-envelope-v1.md` §4 and replace the architectural prediction. Two architectural side-deliverables already landed prior to M7 (ARCH 6.1.2 session row cleanup; ARCH 6.8 broadcast topology) per the plan analysis. The remaining open work is operator-driven (run the harness, populate the measured-envelope section, file an ADR if results diverge by >2x per the plan §7 decision criteria).

---

### 21 - AI auto-reviewers as a `review_role` type

**Scenario.** Per ADR-025, `territories.review_role` keys to a composer role (architect, dev, pm, designer). Every `state=review` transition routes to a human in that role. In an AI-speed reality (per the 2026-04-28 AI-speed red-team pivot), this is the dominant bottleneck: AI implements in 2 min, human approves in 4 hrs. On a 1-human-N-agent team, the human cannot keep up even with engaged attention.

The 2026-04-28 expert review's Opportunities table explicitly named "Auto-Reviewers: Using AI to perform the review_role for 90% of tasks" as the highest-leverage opportunity.

**Open questions:**
- Should `territories.review_role` accept non-human values (e.g., `review_role: ai-validator`)? Or should the existing role values gain an "AI delegate" sub-config (e.g., `review_role: dev` with `dev.ai_auto_approve: <criteria>`)?
- What criteria gate AI auto-approval? Likely a configurable mix of: (a) contribution kind (implementation/research/design), (b) requires_owner_approval flag (always defer to human if set), (c) territory sensitivity tier (low / medium / high), (d) PR diff size, (e) test-pass status, (f) find_similar exclusion (no >0.85 matches).
- What's the AI reviewer's specific check surface? Spec-match (does the PR implement the cited ARCH section?), test-pass, lint-pass, no contradiction with prior ADRs, no overlap with active locks?
- What's the audit trail? Every AI auto-approval needs to be revocable (a human reviewer can later override + re-trigger review with reasoning recorded).
- How does this interact with `requires_owner_approval=true` (from ADR-033 cross-role authoring + triage)? Likely: AI may NOT clear this flag; only human reviewers can. AI auto-approves only when `requires_owner_approval=false`.

**Recommendation.** Extend the territory schema with an optional `ai_review_policy` block (off by default). When enabled, the AI reviewer runs its check surface and either auto-approves (recording an audit-trail entry) or escalates to the human in `review_role`. Human reviewers can override AI approvals retroactively via a new tool or an `update(state="review", reopen=true)` semantic. Cross-role contributions (`requires_owner_approval=true`) are excluded from AI auto-approval per the merge-gate logic in ADR-033.

This is the single highest-leverage v1.x feature. Worth landing at M6 (alongside remote-principal composers + triage, which are the other AI-coordination concentrations) as a future ADR + ARCH 6.2.3 extension + territory schema addition.

**Status.** OPEN at v1.x. v1 reserves the config surface (`territories.<name>.ai_review_policy: null`) so adoption does not require a schema migration. Recommendation is v1.x M6 alongside remote-principal composers and triage; find_similar precision data informs the auto-approve thresholds.

---

### 22 - Semantic contradiction check in the validator

**Scenario.** The `scripts/traceability/validate-refs.mjs` validator (per scripts/README.md "Extended cross-doc consistency") catches syntactic drift: trace IDs resolve, ADR sections exist, frontmatter valid. It does NOT catch semantic drift: "this new ADR contradicts the NORTH-STAR" or "this new contribution implements the opposite of what the cited BRD story specifies."

In an AI-speed reality, agents may generate ADRs at scale that pass syntactic checks but contain subtle contradictions with the canonical state. The 2026-04-28 AI-speed red-team pivot named this "Hallucinated Decision Debt" / "Audit Exhaustion" -- the human architect drowns in 80%-correct rationale.

**Open questions:**
- Should the validator gain a semantic contradiction check class? If yes, when does it run (per-PR? milestone-entry? both?)?
- What's the implementation? Likely an LLM-based check that compares the new ADR/contribution against canonical state (NORTH-STAR + relevant ARCH sections + recent ADRs) and flags potential contradictions for human review.
- What's the cost? An LLM call per PR adds latency + token spend. Worth it on PRs touching `docs/architecture/decisions/` and `docs/functional/BRD.md`; probably not on every code PR.
- What's the failure mode? False positives (the AI flags non-contradictions) waste human time. False negatives (the AI misses real contradictions) defeat the purpose. Need a calibration mechanism.
- How does this interact with section 21 (AI auto-reviewers)? They share the AI-judgment surface. Likely the same `review.ai_judgment` config block governs both: enable, disable, model selection, threshold tuning.

**Recommendation.** Add `semantic_contradiction_check` as an optional check class in scripts/README.md "Extended cross-doc consistency" (off by default). Implementation lands at M5 alongside find_similar productionization (similar LLM-based reasoning surface; can share infrastructure). Default scope: PRs touching `docs/architecture/decisions/`, `docs/functional/BRD.md`, `docs/strategic/NORTH-STAR.md`. Output: per-PR comment listing potential contradictions with citations to the prior canonical content.

The check is advisory at v1.x (warns, never blocks). Promoting to blocking is a per-project policy decision based on observed false-positive rate.

**Status.** OPEN at v1.x — implementation deferred; schema reservation ships at v1.

v1 reservation:

- `.atelier/config.yaml: review.semantic_contradiction` block exists with `enabled: false` default. All fields the v1.x implementation needs (scope_paths, mode, base_url, api_key_env, model_name, anchor_paths, confidence_threshold) are present. Adopters who fork at v1 do not need a schema migration to enable the v1.x validator.
- `scripts/README.md "Extended cross-doc consistency"` table includes the `semantic_contradiction` check-class row marked RESERVED. The validator has not implemented the check yet; the row documents where the v1.x implementation plugs in.
- Adapter pattern matches ADR-041 (OpenAI-compatible `/v1/chat/completions`); adopters override `base_url` + `model_name` to swap providers (Anthropic, Mistral, vLLM, Ollama, etc.) without changing adapter code.

Activation criteria for v1.x landing: an adopter signals need OR AI-generated ADRs cross a noise threshold that empirically warrants the validator's catch.

---

### 23 - Lightweight annotations on contributions (`comment_on_contribution`)

**Scenario.** Decisions and rationale are currently captured via:
- ADR rationale field (for log_decision-shaped decisions)
- contribution.content_ref (the artifact body)
- contribution.transcript_ref (agent session transcript per ADR-024)
- PR comments (in git, not in datastore)

What's missing: lightweight inline rationale on a contribution that does NOT justify a full ADR. Example: a Slack-equivalent "I rejected this proposal because the territory's contracts forbid X -- see contract Y". Currently this rationale either becomes an ad-hoc PR comment (visible in GitHub but not in `/atelier`) or vanishes into chat (Slack/Teams).

The 2026-04-28 red team's Gap A named this "Slack dark matter": decisions still happen in chat, the canonical state captures only the post-hoc summary. ADR-010 explicitly excludes building a chat app, but lightweight annotations on coordination objects are NOT a chat app.

GitHub ACE (per 2026-04-28 strategy addendum on AI-speed coordination) is making the opposite bet: building chat directly into the tool. Atelier's bet remains that chat lives elsewhere (Slack/Teams) but COORDINATION-OBJECT annotations live in the datastore for canonical-state durability.

**Open questions:**
- Add an `annotations` field to `contributions` (and `decisions`?) -- a list of `{author_composer_id, body, created_at}` records?
- Or add a new `annotations` table referencing contributions/decisions, with its own RLS?
- What's the API? A new tool `annotate(target_kind, target_id, body)` would add a 13th MCP tool (per ADR-013); alternatively, reuse `update()` with an optional `annotation` parameter.
- What's the rendering surface? `/atelier` contribution-detail and decision-detail panels show the annotation thread. PR comments still flow through GitHub natively; the annotation surface is for non-PR-shaped rationale.
- How does this interact with the audit trail? Annotations are append-only? Editable by their author within a window? Soft-deletable by admins?

**Recommendation.** Add `annotations` as a new table (cleaner RLS than embedded list; better query patterns). New tool `annotate(target_kind, target_id, body)` -- accepts `target_kind in (contribution, decision)` plus the target's UUID. Append-only at v1 (no edits, no deletes -- soft-flag spam via admin tool). Render in `/atelier` contribution + decision panels. Bumps the MCP tool count to 13; document in ADR-013 as a v1.x extension that fits within the protocol's design.

**Status.** OPEN. Strategic call: does adding a 13th MCP tool + a new schema table for annotations cross the line into "Atelier becomes a wiki" (which ADR-010 excludes)? Recommendation is no -- annotations are coordination-object metadata, not standalone content. But the boundary is worth being explicit about. If accepted, lands at v1.x (M6 alongside other coordination-surface enhancements) as a future ADR.

Surfaced by 2026-04-28 red-team Gap A + reinforced by GitHub ACE intel showing market interest in tool-resident chat.

**Update 2026-04-28 (post-chatbot-pattern landing).** The chatbot-as-MCP-client pattern (per `../user/connectors/chatbot-pattern.md`) covers much of this motivation: lightweight rationale flows through the chat surface where humans already are, and gets canonicalized via `log_decision` (with `transcript_ref` capturing the conversation under ADR-024). Annotations remain a separable concern only for non-chat contexts (e.g., a designer in `/atelier` wanting to attach a note to a contribution without opening chat). The strategic call now narrows to: is the non-chat annotation use case load-bearing enough for a 13th tool, or does the chatbot pattern + existing PR comment surface cover the practical need? Recommendation softens: defer to v1.x M6 with a higher bar to land (concrete pre-M6 user request needed, not speculative coordination-surface gap).

**Update 2026-05-09 (sibling-evidence re-elevation).** The §35 deep-dive on `tpoolebigC/ai-hive` (Cloudflare/D1 sibling from the `hackathon-hive` lineage) and the GitHub Next **Ace** technical preview produced concrete evidence that this annotation primitive is more load-bearing than the 2026-04-28 softening implied. ai-hive ships `hive_react` as an explicit MCP tool callable from any Claude Code session (not a chat app — same delivery vehicle Atelier uses). It is the **only** primitive in ai-hive's `propose / react / synthesize / approve_plan` flow that has no Atelier analog today; the other three map cleanly to existing Atelier tools (see §35 update of the same date for the mapping table). Without `react`, multi-author iterative deliberation in Atelier either happens out-of-band (PR comments, claude.ai, Slack — invisible to `get_context`) or doesn't happen, which means a reviewing agent in another session cannot see "two prior composers raised concern about this approach for these reasons" without going outside the substrate. That is the exact "Slack dark matter" failure mode this entry was filed to prevent.

Re-elevated disposition: keep the recommendation block (annotations table; new tool `annotate(target_kind, target_id, body)`; append-only at v1; render in `/atelier` panels). Lower the activation bar from "concrete pre-M6 user request needed" to "schedule for v1.x M6 alongside §21 (AI auto-reviewers) and remote-principal composers, on the grounds that mid-deliberation reactions are the missing structured input AI auto-reviewers will need to weigh." Implementation lands as a ~13th-tool extension to ADR-013/040, paired in the same surface revision as §33's heartbeat collapse so the surface lock is broken once, deliberately. The chatbot-pattern + PR-comment fallback remains correct for casual rationale; what `annotate` adds is structured, queryable, agent-visible deliberation residue.

**Surface-agnostic design constraint (added 2026-05-09).** The `annotate` primitive must be designed surface-agnostic from day one, consistent with Atelier's "concurrently author one canonical artifact across IDE, browser, and terminal surfaces" charter (CLAUDE.md opening line) and ADR-009 (remote-principal composers). Same backend semantics regardless of caller: an MCP `annotate` call from Claude Code, a button click in `/atelier`, a slash-command from a Mattermost / Slack / Discord bot adapter (per §36 cut b), and a hypothetical future multiplayer-chat surface all hit the same handler and resolve to the same canonical record. This is what distinguishes Atelier's bet from ai-hive (single MCP surface) and Ace (single multiplayer-chat surface): the substrate is what unifies surfaces, not any one surface itself.

**Dashboard surface affordance for `annotate` (added 2026-05-09).** Every surface that supports `annotate` must offer affordances to author and view annotations; the dashboard is no exception. `/atelier` ships an annotation thread component on every contribution panel and every decision panel — chronological list of existing annotations, input to add a new one, @mention of other composers, notification badge when someone annotates a contribution you authored (observing the broadcast substrate per ARCH §6.8). Search across annotations lands at v1.x as a natural extension. Mobile-responsive rendering is required regardless. **This is NOT a chat app** — it is the dashboard being a competent surface for a primitive every surface must support, exactly as the dashboard already is a competent surface for `claim` / `update` / `log_decision`. The scope cut against general-purpose chat is in §36's recommendation block.

---

### 30 · Push-notification alerting via messaging adapter (out-of-band observability delivery)

**Scenario.** ARCH §8.3 specifies messaging-adapter-published alerts when observability thresholds cross (sync lag > NFR thresholds, find_similar precision regression > 5%, reaper rate spike, authentication failure spike). The M7 Track 1 observability stack ships UI-rendered alerts only — the dashboard at `/atelier/observability` colors threshold pills (yellow at 80% of envelope, red at 100%) per `.atelier/config.yaml: observability.thresholds`, but does not push out-of-band notifications to messaging surfaces (Slack, Teams, Discord, email). v1 ships visibility-in-UI; out-of-band delivery is filed for v1.x.

**Why deferred to v1.x:**

- Same lens as the contributions-panel and find_similar deferrals: ship the substrate (UI-visible alerts that operators can actually see), let adopter signal inform the delivery shape rather than pre-deciding before any adopter has voiced what they want notified about.
- Channel coverage matters: messaging-adapter delivery means picking which channels are first-class (Slack? Teams? Discord? Generic webhook?) and which thresholds are noisy by default. Pre-deciding without operator feedback risks both omission (missing the channel adopters use) and churn (an early decision needing reversal once signal arrives).
- The substrate hooks already exist: telemetry rows are queryable, thresholds are configurable, the dashboard shows the alert state. Adding a messaging-adapter publisher is additive — no schema change, no breaking config rename. v1.x lands the publisher when the trigger fires.

**Trigger to land:** first adopter requests out-of-band ops alerts with a named channel preference. Until then, operator practice is dashboard polling — the 30s client-poll on `/atelier/observability` keeps the UI close to real-time, and the threshold pills surface state visibly enough that a tab open during ops review covers the operational case.

**v1 deliverables that already shipped (M7 Track 1):**

- `.atelier/config.yaml: observability.thresholds` block — adopter-tunable values for the 10 envelope dimensions (sessions, contributions, decisions, locks, vector rows, triage backlog, sync lag p95, daily cost)
- `/atelier/observability` route — admin-gated 8-section dashboard rendering threshold pills + 30s client-poll + manual refresh button
- Severity calculator in `prototype/src/lib/atelier/observability-config.ts` — single source for the 80%/100% color bands, ready for the v1.x messaging-adapter publisher to consume

**v1.x deliverables (when triggered):**

1. Messaging-adapter publisher: poll the same view-model the dashboard reads, fire when severity transitions from `ok` → `warn` or `warn` → `alert` (debounced — no continuous reposting while a metric stays in the same band)
2. Per-threshold channel routing: `.atelier/config.yaml: observability.alerts.<metric>.channel` so adopters can route different signals to different channels (cost spike → finance Slack channel, reaper spike → ops on-call)
3. Quiet hours + acknowledgment: respect operator-set quiet windows; allow ack from the messaging surface to suppress repeat notifications until the next state transition
4. Backoff on flap: exponential backoff when a metric oscillates between `warn` and `alert` (reduces alert fatigue from noisy thresholds)

**Status.** OPEN. v1 ships UI alerts; out-of-band delivery is v1.x scope, gated on the adopter-signal trigger above.

---

### 31 · v1.x next-level security and polish items

**Context.** Items the v1 security + quality audit (X1) classified as LOW severity, code polish, or activation-gated by adopter signal. HIGH + MEDIUM findings shipped at v1 (B1 prompt-injection pre-filter on the semantic-contradiction validator; C1 OTP-relay structural protection via the rally-hq token-hash flow at `/auth/confirm` plus `shouldCreateUser:false` on `signInWithOtp` -- the dedicated D7 `/sign-in/check` gate has been removed in favor of these two structural defenses, see "Refactor sign-in to token-hash flow per rally-hq pattern" below; A1 magic-link redaction in `atelier invite` default output; A3 secret redaction in diffs; B2 execFileSync hardening; B4 statement_timeout on migration apply; D1 advisory lock on alert-publisher; D2 advisory lock on migration runner; plus quality patterns for self-disabling tests, regex-as-parser sanity floors, and parallel-implementation consolidation under `scripts/lib/`). Items below carry explicit activation criteria so they do not age into anonymous backlog.

**Security / hardening (activation-gated):**

- **C2 sign-out CSRF.** Switch sign-out from GET to POST. *Activate when:* an adopter reports CSRF concern OR one-form-edit polish lands.
- **C3 invite identity-rebinding.** Invite re-issued to an attacker-controlled email could rebind a composer's `identity_subject`. *Activate when:* multi-admin teams onboard. *Workaround until then:* runbook entry advising single-admin invite + manual identity_subject rotation.
- **C4 LensUnauthorized info disclosure.** The `no_composer` reason names the exact failure mode. *Activate when:* an adopter classifies their deploy as user-class hostile.
- **B3 `git clone --` separator.** `atelier init` invokes `git clone <url>` without `--`; a malicious tutorial URL like `--upload-pack=...` could exploit option parsing. *Activate when:* one-form-edit polish lands.
- **A2 webhook URL in fetch error message.** Node's `fetch` may include the URL in `error.toString`. *Activate when:* a node version drift makes this concrete.
- **A4 deploy validation tail redaction.** `atelier deploy --validate` tails command output that may include secrets if the substrate ever logs them. *Activate when:* an adopter reports a leak OR substrate logging changes.
- **D3 invite race.** Two simultaneous `atelier invite` calls for the same email can both pass the duplicate check. *Activate when:* scale ceiling per ARCH §9.8 is approached, or batch-onboarding lands.
- **E1 / E2 / E3 DoS items.** Endpoint rate-limit; magic-link request flood; cron-publisher fanout. *Activate when:* deploy infra (Vercel + Supabase) signals the layer below cannot absorb the rate.

**Code polish:**

- Rerank adapter type widening; messaging-lib slack coupling; `runner.ts` re-exports; doctor JSON inline type; webhook adapter URL substring matching brittleness.

**Operator ergonomics:**

- **Bearer rotation in build sessions.** Surfaced during BUILD-SEQUENCE row G's first MCP-client session: rotating the local bearer required manual password reset → `signInWithPassword` → `.mcp.json` write because the originating password was not recoverable from existing artifacts. `atelier dev` should be able to rotate non-interactively when the operator opts in to credential persistence. *Activate when:* a second build session hits the same friction OR an adopter reports the same wall during onboarding. *Design space (do not pre-decide):* `.atelier/dev-credentials.json` (gitignored) vs OS keychain integration vs `atelier dev --rotate` interactive prompt. Pre-deciding before the second data point is over-investment.

**Runbook gaps:**

- **first-deploy.md misses Supabase Auth URL Configuration for human sign-in.** *RESOLVED 2026-05-04 by the canonical-rebuild PR.* `docs/user/tutorials/first-deploy.md` rewritten as part of the rebuild. Deploy provisioning recommends the Vercel-Supabase Marketplace integration (auto-provisions every required env var); the email-template paste-in and Site URL guidance live in the rewritten runbook.

- **`ATELIER_PUBLIC_URL` not set in cloud Vercel env.** *RESOLVED 2026-05-04 by the canonical-rebuild PR.* `ATELIER_PUBLIC_URL` and `ATELIER_ENDPOINT_URL` are retired. Invite redirects derive from `NEXT_PUBLIC_SITE_URL` (or `https://${VERCEL_URL}` in production; both standard). The Vercel-Supabase Marketplace integration sets `NEXT_PUBLIC_SITE_URL` automatically when wired through; otherwise the runbook documents the single env-var addition.

- **`NEXT_PUBLIC_SUPABASE_ANON_KEY` not in cloud Vercel env.** *RESOLVED 2026-05-04 by the canonical-rebuild PR.* The recommended provisioning path is the Vercel-Supabase Marketplace integration, which auto-provisions `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` + `POSTGRES_URL` + `POSTGRES_URL_NON_POOLING` in one click. Manual env-var setup remains as a fallback path for adopters who prefer it; `docs/user/tutorials/first-deploy.md` enumerates the canonical names.

- **Broadcast island mounts on `/sign-in` (unauthenticated route).** Same incident as above: the broadcast island throws on mount when the browser Supabase client cannot instantiate, but the deeper issue is that the island has no business mounting on `/sign-in` in the first place — it is a logged-out page with no session to subscribe Realtime against. Even after the env-var fix lands, the island will mount-and-immediately-fail-silently (no useful Realtime subscription possible without a session). *Fix:* gate the broadcast island mount on session presence; only mount inside authenticated `/atelier/*` routes; never on `/sign-in`, `/`, `/auth/confirm`, or any pre-auth surface. *Activate when:* next sign-in flow polish pass OR a real composer reports a confusing console error during sign-in.

- **SMTP deliverability on custom-domain inboxes (vs Gmail).** Supabase's default SMTP relay (`mail.app.supabase.io`) reliably reaches Gmail but is rate-limited (~3-4 emails/hour) and aggressively spam-filtered against custom domains. First-cloud-sign-in attempt to `dev@signalx.studio` produced no delivery; switching to `abelino.chavez@gmail.com` worked. *Fix:* document custom-SMTP configuration (Resend / SendGrid / SES / Postmark) as a production prerequisite in first-deploy.md, with Resend recommended for OSS adopters (3000/month free tier; minimal setup). *Activate when:* an adopter onboards a non-Gmail composer OR invite-volume exceeds Supabase's free-tier limit OR first-deploy.md polish pass.

- **`ATELIER_DATASTORE_URL` set to direct Postgres URL instead of pooler URL.** *RESOLVED 2026-05-04 by the canonical-rebuild PR.* The lens runtime no longer holds a `pg.Pool` (per the architectural fix below); Vercel runtime DB access goes via `@supabase/ssr` → PostgREST. The `POSTGRES_URL` env (renamed from `ATELIER_DATASTORE_URL`) is now used only by the MCP route's bearer validation path + operator-side scripts (migration runner, etc.). The Vercel-Supabase Marketplace integration provisions both `POSTGRES_URL` (pooler) and `POSTGRES_URL_NON_POOLING` (direct) automatically; no operator-side decision required.

- **Direct `pg.Pool` runtime DB access vs canonical Supabase JS client.** *RESOLVED 2026-05-04 by the canonical-rebuild PR.* The lens runtime now uses `createServerSupabaseClient(cookies)` (named adapter under `prototype/src/lib/atelier/adapters/supabase-ssr.ts`) for every DB read/write. Operations PostgREST cannot express land in `supabase/migrations/20260504000011_atelier_rpc_functions.sql` (12 SECURITY DEFINER functions covering lens VM load, observability load, lock acquire/release, find_similar, session register/heartbeat/deregister). Migration runner stays on `pg.Pool` per its CLI lifecycle. `prototype/middleware.ts` and `prototype/vercel.ts` ship as the canonical foundation. Per METHODOLOGY §11.5b this rebuild is the application of the canonical-pattern discipline to the lens runtime; the §11.5b pre-check would have caught it at D7-era spec time but is now codified.

- **`NEXT_PUBLIC_SUPABASE_ANON_KEY` legacy name vs canonical `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.** *RESOLVED 2026-05-04 by the canonical-rebuild PR.* `prototype/src/lib/atelier/adapters/supabase-ssr.ts` accepts either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (canonical, late-2025 Supabase paradigm) or `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy, what the Vercel-Supabase Marketplace integration sets). This is the one place a tiny chain is acceptable because Supabase itself names them inconsistently across docs.

**Architectural alternatives (filed for visibility):**

- **Adopt `vercel.ts` (or `vercel.json`) as the canonical Vercel deploy-config declaration site.** *RESOLVED 2026-05-04 by the canonical-rebuild PR.* `prototype/vercel.ts` ships per the 2026-02 Vercel Knowledge Update — `framework: 'nextjs'`, function timeout pins for the lens path (60s) vs MCP path (300s), and a `crons` array stub for the future reaper / mirror-delivery / reconcile / triage handlers. Closes audit F5.

- **Webhook receivers (S12 grounding-audit finding).** *RESOLVED 2026-05-05 by the M8 webhooks PR; **per-event dispatch wired 2026-05-08 by the Track 3b dispatch PR**.* GitHub + Figma route handlers ship at `prototype/src/app/api/webhooks/{github,figma}/route.ts`. Both verify HMAC-SHA256 over the raw body via `crypto.timingSafeEqual` (constant-time compare) per GitHub's webhook validation guide; idempotency via `webhook_deliveries` table (migration 13) keyed on the provider's per-delivery ID with `INSERT ... ON CONFLICT (delivery_id) DO NOTHING` returning `xmax=0` for first-seen vs duplicate. **Per-event dispatch is now live**: `push` on the project's default branch enqueues `embed_state` rows (migration 15) for paths under ADR / BRD / PRD / research / **, where the embed-runner picks them up on the next pass (ARCH §6.4.2 / §902-905); `pull_request.closed && merged===true` marks the matching contribution `state=merged` via `repo_branch` lookup (ARCH §716, the authoritative source for `state=merged`); Figma `FILE_COMMENT` inserts a raw `triage_pending` row routed via the `ATELIER_FIGMA_{PROJECT_ID,TRIAGE_SESSION_ID,TRIAGE_TERRITORY_ID}` env triple, which the FeedbackQueuePanel surfaces for human approval (ARCH §6.5.2 / ADR-019). Twenty-two smoke checks at `prototype/__smoke__/webhooks.smoke.ts` cover the full ladder: malformed-signature (401), missing headers (400/401), valid-first-delivery (200), duplicate-idempotency (200), missing-secret fail-closed (500), GET 405, plus end-to-end per-event side-effect verification (push → embed_state row inserted with observed_commit_sha; pull_request.merged → contribution.state=merged + last_observed_commit_sha set; FILE_COMMENT → triage_pending row inserted) against a seeded local Supabase fixture. Project resolution: GitHub events match `repository.html_url` to `projects.repo_url` (with/without trailing `.git`); Figma routing is single-project at v1.x (env-driven), with multi-project fan-in (e.g., a `figma_file_key` column) deferred. Supabase Auth Hooks (Svix-style verification) remain deferred to v1.x as separable scope.

- **S09 RLS policies + MCP path off raw pg.Pool BYPASSRLS.** *RESOLVED 2026-05-08 by ADR-051 + `supabase/migrations/20260508000016_atelier_rls_policies.sql`.* The S09 grounding-audit finding (RLS enabled on every table with zero policies; MCP path connects as postgres superuser bypassing RLS structurally) is closed. Migration adds 33 `CREATE POLICY` statements per ARCH 5.3 covering 13 tables; helper functions `atelier_current_composer_id()` / `atelier_current_project_id()` / `atelier_current_project_ids()` resolve the calling composer from `auth.jwt() ->> 'sub'`. The MCP path engages RLS via option (b) of the rebuild brief: `AsyncLocalStorage` (`scripts/sync/lib/request-context.ts`) flows the per-request auth context into `AtelierClient.tx()` / `poolStatement()`, which run `SET LOCAL ROLE atelier_runtime` + `set_config('request.jwt.claims', ...)` after `BEGIN`. Sync paths (service_role) bypass via `FOR ALL TO service_role USING (true)` policies; M1-M6 sync invariants do not regress. New `scripts/endpoint/__smoke__/rls.smoke.ts` (14 checks) verifies cross-composer write rejection at the Postgres tier. Option (a) -- migrating the MCP path to `@supabase/ssr` + per-tool SECURITY DEFINER RPCs -- is rejected for v1.x and stays a v2-shape consideration; rationale in ADR-051 (PostgREST does not naturally express the fencing-CAS / advisory-lock / pgvector / deferred-broadcast patterns the MCP write path uses).

- **Refactor sign-in to token-hash flow per rally-hq pattern.** *RESOLVED 2026-05-04 by [this PR].* The activation criterion fired earlier than expected: the first cloud-deploy `/sign-in` attempt produced a 500 on `/sign-in/check` cold-start on Vercel, breaking sign-in entirely on production. Rather than patch the cold-start, we adopted the rally-hq token-hash pattern wholesale. *What changed:* `/sign-in/check/route.ts` deleted (the C1 enumeration gate is gone); `/sign-in/callback/route.ts` deleted; new `/auth/confirm/route.ts` calls `auth.verifyOtp({ type, token_hash })` via the named SSR adapter; `SignInForm.tsx` no longer POSTs to a server gate before `signInWithOtp`. *Structural protection (post-refactor):* (a) `shouldCreateUser:false` on `signInWithOtp` — Supabase Auth refuses to mint mail for non-existent users; (b) token-hash verify only succeeds for tokens Supabase issued. The form still advances the UI on every submit so it is not a user-enumeration oracle. *Required separate-from-code deployment step:* operator pastes the rally-hq email template body into Supabase Dashboard → Authentication → Email Templates → Magic Link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/atelier`. Site URL stays at the app root; the redirect-URL allowlist is no longer required for the human-sign-in path (still needed for OAuth Connectors / PKCE flows on `/oauth/api/mcp`). Reference impl: `apps/rally-hq/docs/SECURITY.md`.

**Validator polish:**

- **Stale example trace IDs in milestone-exit audit docs.** `docs/architecture/audits/milestone-M0-exit.md` and `milestone-M1-exit.md` reference example trace IDs (matching `NF-N`, `US-N.M`, and `BRD:Epic-N` shapes) that do not resolve in `traceability.json`. The IDs are illustrative-only in audit prose, not real references. *Fix path:* either rewrite the audit-doc references with real trace IDs, or extend `scripts/traceability/validate-refs.ts` to whitelist a documented example-IDs set. *Activate when:* next traceability-validator polish pass, OR a future milestone-exit audit blocks on inheriting the false-positive.

**Status.** OPEN at v1.x. Each item carries an explicit state-triggered activation criterion; no time-triggered ping (state-triggered work per CLAUDE.md).

---

### 32 · v0 Methodological Failure & Infrastructure Reset

**Scenario.** The methodology audits (M0-M7 exits) tested internal consistency (code matches spec), but failed to test the spec against vendor canonical standards. The `§11.5b` canonical-pattern audit was introduced late, was scoped too narrowly, and relied on spec-reading rather than empirical verification. As a result, critical infrastructure surfaces (auth, env vars, DB connections, deploy config) diverged from industry standards and failed in the cloud production environment. The shipped v1 substrate is methodologically a v0.

**Open questions:**
- How do we trust the remaining unscoped surfaces (MCP endpoint, broadcast, RLS, webhooks, cron, pgvector, etc.)?
- How do we execute an audit that actually works and cannot be gamed by spec-reading?

**Recommendation.** Execute a "Soft Reset." Suspend the untrusted infrastructure ADRs (ADR-027, ADR-046, etc.). Formally sequence a new M8 milestone (Comprehensive Grounding Audit) before any further v1.x development. The audit must use isolated worktrees and empirical testing (actually running the code, not reading the spec).

**Status.** RESOLVED by ADR-048. ADR-048 suspends the diverged decisions and mandates the 5-step empirical audit plan. The execution of this audit is tracked as the M8 milestone in `BUILD-SEQUENCE.md`.

---

## Resolved

Each entry below is a one-line redirect to the canonical home where the decision now lives. Recommendations and full Q-and-A blocks have been removed to avoid parallel-summary drift per METHODOLOGY section 6.1; see git history for the original full-context entries.

### 1 - Territory-model validation on the analyst case

Validate territory model end-to-end against an analyst's web-surface week-1 research scenario.

**Status.** RESOLVED 2026-04-24. See `../architecture/walks/analyst-week-1.md` and ADRs 021/022/023/024/025. Five gaps surfaced and landed via the walk; territory schema confirmed adequate for research_artifact flows. Walk re-examined 2026-04-27 with the latent-gaps discipline; see walk section 7 for the per-step audit-trail of additional ARCH subsections folded in.

---

### 2 - Switchman as dependency vs. own-implementation for file locks

Decide whether to integrate Switchman or build Atelier's own lock + fencing implementation.

**Status.** RESOLVED 2026-04-25. See ADR-026. Own-implementation; Switchman lacks a fencing-token API, disqualifying under ADR-004.

---

### 3 - Embedding-model default + swappability for find_similar

Decide the v1 default embedding model + adapter shape for `find_similar`, and the swap procedure across providers.

**Status.** RESOLVED 2026-05-01. See ADR-041. OpenAI-compatible adapter ships as the only named adapter at v1; default config points at OpenAI `text-embedding-3-small` (1536-dim). Swap to vLLM / Ollama / LocalAI / self-hosted by overriding `find_similar.embeddings.base_url` + `api_key_env`. Swap procedure across same-dimension models documented in ARCH 6.4.2; cross-dimension swap filed as section 25 (event-triggered).

---

### 4 - Contract-breaking-change heuristics

Define when a territory contract change classifies as breaking vs additive.

**Status.** RESOLVED 2026-04-27. See ARCH section 6.6.1. Conservative classifier table with publisher override (justification required) and semver-style versioning.

---

### 5 - Identity-service default

Pick the default identity service shipped with `atelier init`.

**Status.** RESOLVED 2026-04-25. See ADR-028. Default Supabase Auth; BYO via OIDC federation through `.atelier/config.yaml: identity.provider`.

---

### 6 - Upgrade path semantics for template versions

Define how a team adopts a new Atelier template version without re-scaffolding.

**Status.** RESOLVED at design level 2026-04-27. See ARCH section 9.7. Additive-preferred + idempotent migrations, no auto-rollback, schema N/N-1 co-existence, no-lockstep upgrades. Data-dependent residue: grace-window length tuned post-M7 from operational experience.

---

### 8 - Cross-composer cost accounting

Manage aggregate LLM-token spend across a team's composers + Atelier-side operations.

**Status.** RESOLVED at v1 design level 2026-04-28. v1 ships visibility (token-usage telemetry per ARCH 8.1, Cost lens in /atelier/observability per ARCH 8.2). Active cost-governance (budgets, hard limits) explicitly DEFERRED to v1.x with trigger "if demand surfaces"; v1 telemetry is the substrate any future governance work builds on.

---

### 9 - Cross-repo projects

Atelier projects spanning multiple git repositories.

**Status.** RESOLVED as deferral 2026-04-28. v1 commitment "one repo per project" landed in ARCH 9.2 with rationale and workarounds. v1.x extension hook (`.atelier/repos.yaml` with `repo://name/path` scope qualifier) sketched; designed when the v1.x epic is authored.

---

### 10 - Offline / disconnected mode

Specify what works and doesn't for a composer offline.

**Status.** RESOLVED 2026-04-27. See ARCH section 9.6. Capability matrix + reconnect semantics; web-surface composers explicitly offline-incapable.

---

### 11 - Solo-to-guild transition

Define how a solo `atelier init --local-only` project promotes to a guild-shared deployment.

**Status.** RESOLVED at design level 2026-04-27. See ARCH section 9.5. Additive-preferred migration, full decision-log transfer, fencing reset with a transition ADR. Operational runbook lands at M7 alongside `atelier upgrade`.

---

### 12 - Find_similar sensitivity trade-off

Set find_similar threshold + UI presentation policy.

**Status.** RESOLVED at design level 2026-04-27. See ARCH section 6.4.1. Two-band response (primary + weak), per-project configurable, top-k per band. Data-dependent residue: actual default-threshold value tuned at M5 against the seed eval set per ADR-006.

---

### 13 - Decision-log growth and searchability

Keep a long-running project's decision log navigable.

**Status.** RESOLVED 2026-04-25. See ADR-030. Per-ADR file split structurally avoids the single-file growth problem.

---

### 14 - Analyst-proposed territory changes

Govern who can modify territory definitions and how.

**Status.** RESOLVED 2026-04-27. See `../../.atelier/territories.yaml` header. Any composer proposes via PR; admin (or delegated approver per `config.yaml`) merges; effect on merge + next datastore reload via the M1 territories-mirror sync script.

---

### 15 - Prototype deployment per environment

Run multiple Atelier environments (staging, production).

**Status.** DOCUMENTED convention. Environments are separate projects within one guild; each has its own repo branch, datastore schema namespace, deploy target. Cross-environment refs via trace IDs. No schema change.

---

### 16 - Adapter sequencing within M1

Decide whether all five non-GitHub external adapters ship at M1 or are sequenced.

**Status.** RESOLVED 2026-04-27. See `../strategic/BUILD-SEQUENCE.md` M1.5. M1 ships the adapter interface + GitHub adapter; M1.5 ships Jira/Linear/Confluence/Notion/Figma with their own integration tests and per-provider runbooks under `docs/user/integrations/`. All five remain v1 scope per ADR-011; only their construction order is sequenced.

---

### 17 - Round-trip whitelist surface

Define what counts as permissible normalization vs drift in the M1 round-trip integrity test.

**Status.** RESOLVED 2026-04-27. See `../../scripts/README.md` "Round-trip integrity contract". Filed as a question in error; was a spec gap (recommendation became spec).

---

### 18 - publish-delivery trigger model (pre-broadcast-substrate)

Pick the trigger mechanism for publish-delivery before the broadcast substrate exists.

**Status.** RESOLVED 2026-04-27. See `../../scripts/README.md` "publish-delivery trigger model". Polling at M1, post-commit hooks at M2, broadcast subscription at M4 -- non-destructive cutover at each milestone.

---

### 19 - Plan-review checkpoint between claim and implementation

Per-territory opt-in lifecycle gate between `claim` and `in_progress`.

**Status.** RESOLVED 2026-04-30. See [ADR-039](../architecture/decisions/ADR-039-plan-review-state-in-contribution-lifecycle.md). Per-territory opt-in (default off); `contributions.state` enum gains `plan_review`; `territories.yaml` gains `requires_plan_review: bool`. Semantics in ARCH 6.2.1.7.

---

### 20 - Composer role enum mixes work-discipline with access-level

Split into `composers.discipline` (5 values including newly-added `architect`) + `composers.access_level` (3 values).

**Status.** RESOLVED 2026-04-28. See [ADR-038](../architecture/decisions/ADR-038-composer-role-split-into-discipline-plus-access-level.md). `composers.default_role` split into `composers.discipline` (analyst | dev | pm | designer | architect) + `composers.access_level` (member | admin | stakeholder). `architect` is first-class discipline, matching its use as `owner_role` across territories.

---

### 24 - Branch reaping in `reconcile.ts` for AI-speed contribution churn

Extend `reconcile.ts` with a branch-reaping pass guarded by a config flag; default off at v1.

**Status.** RESOLVED 2026-04-28. See `../../scripts/sync/reconcile.ts` M1 step 4.iii (`reapBranches` pass guarded by `ATELIER_RECONCILE_BRANCH_REAPING_ENABLED`, default false; `--reap-branches --apply` CLI override) and `../../scripts/README.md` reconcile section.

---

### 25 · Cross-dimension embedding-model swap migration path

Define the swap procedure when a new embedding model has a different native dimension from the v1 default.

**Status.** RESOLVED 2026-05-01 via the M5-entry calibration. v1 path (per migrations 7 and 8): drop + recreate the embeddings table at the new dimension, re-embed corpus from source via `embed-runner`. With no production users at v1, a brief read-only window during rebuild is acceptable. v1.x considers multi-column transitions (`embedding_v1 vector(1536)`, `embedding_v2 vector(N)` with active-pointer swap) or pgvector `halfvec` compression for higher-availability deployments where downtime is not free.

---

### 26 · Wider eval against external corpus (multi-corpus generalization)

Run the find_similar eval against ≥1 external corpus to test whether the advisory tier holds beyond Atelier's own discovery content; feed the §27 reranker activation rule per ADR-043.

**Status.** RESOLVED 2026-05-02. See [ADR-047](../architecture/decisions/ADR-047-find-similar-wider-eval-claude-agent-sdk-and-blocking-tier-reversal.md). Wider eval ran against the claude-agent-sdk public docs corpus (44 chunked items, 117 deduped seeds via the same hand + 3-lens method as M5). Result: P=0.5540 / R=0.5423 — does NOT clear advisory tier (P≥0.60 AND R≥0.60). Per the activation rule's 0-of-2 outcome (M5 cleared advisory but missed blocking; claude-agent-sdk missed both), ADR-047 reverses ADR-043's blocking-tier framing AND demotes advisory's universality claim to "Atelier-shape-corpus dependent." The unanticipated finding (advisory itself is corpus-dependent) is documented in ADR-047's "Decision" section. Corpus + seeds + last-run.json fixtures land in `atelier/eval/find_similar/external-corpora/claude-agent-sdk/`.

---

### 27 · Cross-encoder reranker as a v1.x option for the blocking tier

Decide when (or whether) the cross-encoder reranker ships, per the §26 activation rule + ADR-043 blocking-tier flip criteria.

**Status.** RESOLVED 2026-05-02. See [ADR-047](../architecture/decisions/ADR-047-find-similar-wider-eval-claude-agent-sdk-and-blocking-tier-reversal.md). v1.x opt-in with documented activation criteria: (a) at least one adopter's measured corpus misses advisory by less than 15pp on either P or R, (b) the reranker measurably lifts that corpus into advisory in a controlled experiment, (c) the reranker's latency overhead at the adopter's typical query volume stays under 200ms p95 added to the baseline. ADR-047's failure-mode diagnostic on the claude-agent-sdk corpus (lateral domain-cluster confusion is the dominant failure mode) is exactly what a reranker addresses, so the v1.x opt-in framing is genuinely useful — not a polite deferral. Per the activation rule's 0-of-2 strict reading, the reranker would be deferred indefinitely; ADR-047 records the more nuanced opt-in framing because the diagnostic suggests the reranker is the right tool for adopters whose corpora miss advisory.

---

### 28 · Deploy trigger conditions for the Atelier endpoint

Decide WHEN to deploy the Atelier endpoint to a network-reachable host (vs the local-stack default per ADR-044).

**Status.** RESOLVED 2026-05-02. See [ADR-046](../architecture/decisions/ADR-046-deploy-strategy-vercel-supabase-cloud.md). Trigger #2 (claude.ai Connectors blocked on local-only) fired empirically at M6 entry; the deploy executed as a parallel workstream and landed `https://atelier-three-coral.vercel.app`. ADR-046 codifies the empirical choices (Vercel + Supabase Cloud + rootDirectory=prototype + URL split inheritance from PR #14 + Supabase Auth bearer with operator-driven rotation) and points at `docs/user/tutorials/first-deploy.md` (PR #24) as the procedural twin.

---

### 29 · `atelier upgrade` template-upgrade flow

Build the substrate + CLI for semver-aware template upgrade with migration tracking (per ARCH §9.7: additive-preferred migrations, idempotent, N/N-1 schema co-existence, conflict reports without auto-resolution, decision-log preservation).

**Status.** RESOLVED 2026-05-04. See BUILD-SEQUENCE §10 (E1 + E2). Substrate: `scripts/migration/` library exposing `MigrationRunner` + `atelier_schema_versions` tracking table. Operator-facing CLI: `atelier upgrade [--check | --apply | --dry-run | --force-apply-modified | --json]` consuming the runner. Operator runbook at `docs/user/guides/upgrade-schema.md`. DOWN migrations / rollback remain v1.x next-level per ADR-005 (append-only); cross-deploy coordination is an adopter-side decision.

---

### 33 · Collapse `heartbeat` into write-side activity bumps

**Scenario.** Atelier's 12-tool surface (ADR-013/040) includes a dedicated `heartbeat` tool. Liveness derives from `sessions.last_heartbeat_at`; the reaper marks sessions stale after a configured interval and releases their claims + locks.

The sibling project `tpoolebigC/ai-hive` (Cloudflare Worker + D1; same `hackathon-hive` lineage referenced in ADR-045) shipped initially with the same separate-heartbeat shape, then collapsed it: every write tool calls a shared `bumpActivity()`, and `heartbeat` became a compatibility alias around the same call. Rationale: agents that are doing work are by definition alive; a separate liveness ping was duplicate signal. Recorded in their repo as ADR-0003.

**Open questions:**

- Does Atelier's reaper need a liveness signal that is independent of write activity? (Edge case: a session that registers but never writes — is it "live" or "stale"? ai-hive's collapse implicitly treats it as stale-after-interval, which is fine.)
- If we collapse, does `heartbeat` stay in the 12-tool surface as a thin alias (preserving ADR-013/040's surface lock) or get removed (requiring an ADR-040-style consolidation reversal)?
- Do agent SDK clients that ping on a fixed cadence (independent of work) break if `heartbeat` becomes a no-op? Probably not — server still updates `last_heartbeat_at` on the alias call.
- Does this interact with the plan-review state (ADR-039) where a session may sit in `plan_review` without writing? Yes — `plan_review` would need to also bump activity, or human reviewers in that state appear stale to the reaper. Worth checking whether the current `update(state="plan_review")` path bumps.

**Recommendation.** Adopt the collapse as an ADR. Keep `heartbeat` in the 12-tool surface as a thin alias to `bumpActivity()` (preserves the ADR-013/040 surface lock and SDK client compatibility). Audit every write tool to ensure it bumps. The win is conceptual simplification — one source of truth for liveness — not a tool-count reduction.

**Status.** OPEN. Source: `tpoolebigC/ai-hive` ARCH "Three loops" §Continuity. Adoption is small-additive; defer the ADR until the next 12-tool surface revisit (likely paired with another consolidation per ADR-040 precedent).

---

### 34 · Realtime broadcast delivery-latency telemetry

**Scenario.** Atelier's broadcast substrate (ARCH §6.8) wraps Supabase Realtime via a `BroadcastService` interface (ADR-029). Today there is no measurement of end-to-end delivery latency from publish-time at the substrate to receive-time at the dashboard or agent SDK client. Operators have no signal when Realtime is degraded vs. when their UI just feels slow.

The sibling `tpoolebigC/ai-hive` instruments every SSE event with `{ ts: <publish-time-ms-epoch>, payload: ... }`; clients compute `delivery_latency_ms = Date.now() - ts` and the dashboard maintains a 200-sample ring buffer that is surfaced in-UI. This is concrete, low-cost observability that catches degradation early.

**Open questions:**

- Should every broadcast envelope carry a publish-time `ts` field as a v1 contract change (small ARCH §6.8 amendment)? Or is this an adapter-level concern that the Supabase Realtime adapter adds without contract change?
- Where does the latency sample land? Three options: (a) client-side ring buffer surfaced in `/atelier` (matches ai-hive); (b) telemetry write back to substrate via existing `telemetry` table (per-sample row, expensive at fanout); (c) periodic aggregate write (p50/p95/p99 per minute per project).
- Does this interact with the scale-ceiling envelope (§7)? Yes — this is exactly the kind of empirical signal the harness needs to populate `scale-ceiling-envelope-v1.md`. Worth wiring before M7 harness operator runs.
- Adopters with non-Supabase broadcast adapters (per ADR-029 portability) — does the contract require their adapter to populate `ts`? Yes, if the contract change lands.

**Recommendation.** Land as a v1 ARCH §6.8 contract amendment (envelope gains `ts: number` in milliseconds since epoch, set by the publishing adapter). Surface a ring-buffer in `/atelier` matching ai-hive's pattern. Defer write-back-to-substrate aggregate telemetry until §7 harness operator runs surface a need.

**Status.** OPEN. Source: `tpoolebigC/ai-hive` ARCH §"Wire format on the SSE stream" + dashboard `delivery_latency_ms` ring buffer. Genuinely additive; no scope conflict. Adoption-blocker is contract-amendment discipline (ARCH §6.8 update + adapter guidance + traceability registry note).

---

### 35 · Brainstorm primitives (`propose` / `react` / `synthesize` / `approve_plan`) — currently excluded

**Scenario.** The sibling `tpoolebigC/ai-hive` ships a first-class brainstorm loop — `hive_propose` (idea drop) → `hive_react` (reactions/votes) → `hive_synthesize` (consolidate into actionable plan) → `hive_approve_plan` (convert plan to claimable tasks). This is an explicit 4-tool workflow that takes ideation conversation and produces executable work. They report this is the highest-leverage piece of their kit for hackathon-style cohorts.

Atelier explicitly excludes this category per PRD §5 ("Not a chat app — claude.ai/ChatGPT remain canonical for agent conversations") and NORTH-STAR §14. The current Atelier shape: ideation happens in claude.ai / Slack / wherever; the *output* of ideation lands as a contribution (`kind: research` per ADR-033) or an ADR. The conversation itself is not coordinated by the substrate.

**Open questions:**

- Does the PRD §5 exclusion still hold after seeing ai-hive's empirical traction? The exclusion was justified by "don't compete with claude.ai" — but ai-hive's `propose/react/synthesize` loop is *not* general chat; it's a structured ideation primitive that produces a claim-ready plan. That is a different shape than what claude.ai serves.
- If reconsidered, what's the contribution-model fit? Two options: (a) brainstorm primitives produce a `contribution(kind=research)` on `synthesize`, and `approve_plan` flips that contribution's state to `claimable` — minimal new surface. (b) Brainstorm gets first-class tables (`proposals`, `reactions`, `syntheses`) parallel to contributions — larger surface, mirrors ai-hive's shape.
- Does this conflict with the contribution-as-atomic-unit principle (ADR-002)? Option (a) above preserves ADR-002 (brainstorm is just an authoring path into a research contribution); option (b) reverses it.
- What's the smallest possible adoption that captures ai-hive's value? Likely option (a) plus one tool: `propose_research_contribution` (or extend `update` with a `kind=research, state=draft, votes_required=N` shape). No new tables. No PRD §5 reversal — brainstorm is reframed as "structured authoring of research contributions," which is in-scope.

**Recommendation.** Hold the PRD §5 exclusion as written; do NOT add `propose/react/synthesize/approve_plan` as distinct tools. Instead, watch for adopter signal: if multiple Atelier deployments hand-roll brainstorm loops on top of contributions, treat that as evidence the structured-authoring path (option a above) deserves a v1.x ADR. If no signal emerges, the exclusion holds permanently — claude.ai + a `research` contribution at the end of the conversation is sufficient.

**Status.** OPEN at v1.x with adopter-signal activation criterion. Source: `tpoolebigC/ai-hive` README §"Two modes of use" + `hive_propose/react/synthesize/approve_plan` tools. The honest framing is that this is the largest *philosophical* delta between the sibling projects: ai-hive bets coordination value sits in the conversation that produces the plan; Atelier bets it sits in the artifact + contribution metadata that captures the work. Both bets are defensible. Do not reverse PRD §5 without explicit adopter evidence.

**Update 2026-05-09.** Second sibling confirmed: GitHub Next's **Ace** (technical preview, thousands of users, closed source) — multiplayer agent workspace with session-as-chat, microVM-per-session, bidirectional GitHub PR links.

**Correction to earlier framing.** Two corrections, in order:

*First correction — delivery vehicle.* ai-hive's brainstorm primitives are NOT a separate chat-app surface. They are MCP tools (`hive_propose`, `hive_react`, `hive_synthesize`, `hive_approve_plan`) called by a Claude Code (or other MCP client) agent during a normal session — the same delivery vehicle Atelier's 12 tools use. The earlier "ai-hive bets coordination value sits in the conversation" framing was wrong because it implied ai-hive built a chat UI. It didn't.

*Second correction — Atelier's actual bet.* The bet is NOT "the conversation lives elsewhere." The bet is **the substrate is surface-agnostic** — per CLAUDE.md's opening charter ("concurrently author one canonical artifact across IDE, browser, and terminal surfaces") and ADR-009 (remote-principal composers as first-class). Whatever surface a composer prefers — Claude Code via MCP, the `/atelier` dashboard via HTTP, a Mattermost slash-command via bot adapter, an Ace session via remote-principal integration if Atelier were wired into one, a hypothetical future multiplayer-chat client — calls the same coordination primitives and resolves to the same canonical state. No surface is privileged; none is excluded. PRD §5's "Not a chat app" excludes Atelier *shipping its own messaging product*. It does not exclude Atelier being *driven from* any messaging product. Those are different propositions.

The actual delta with ai-hive and Ace, then, is the **tool-surface coverage of mid-deliberation interaction:**

| Phase | ai-hive tool | Atelier tool today |
|---|---|---|
| Drop an idea visible to other sessions | `hive_propose` | `update(kind=research, state=draft)` ✓ |
| React/vote on someone else's draft | `hive_react` | **Missing.** PR comments or out-of-band only. |
| Consolidate into a plan | `hive_synthesize` | `log_decision` (writes ADR) ✓ |
| Gate to claimable work | `hive_approve_plan` | `update(state=plan_review → in_progress)` per ADR-039 ✓ |

Three of four map cleanly. The missing one — `react` — is **already filed as §23** (`comment_on_contribution` / annotations on contributions/decisions). It's a tool-surface question (13th MCP tool or `update` extension), not a chat-app scope question. The ai-hive + Ace evidence argues for re-elevating §23's disposition (currently v1.x with adopter-signal bar) — see §23 for the updated rationale. The `annotate` primitive will be designed surface-agnostic per Atelier's charter, so once it lands the same handler serves Claude Code MCP calls, dashboard button clicks, Mattermost bot slash-commands, and any future multiplayer-chat surface an adopter builds. PRD §5's "Not a chat app" exclusion remains correct *and orthogonal* to whether `react` should be a structured Atelier primitive. Sources: <https://githubnext.com/talks/one-developer-two-dozen-agents-zero-alignment/>, <https://maggieappleton.com/zero-alignment>.

---

### 36 · Should Atelier ship as a "one-stop dev studio" bundling other OSS (Mattermost / Plane / Coolify / NocoDB / etc.)?

**Scenario.** Recurring-class question, sourced from a 2026-05-09 strategic prompt referencing the Fireship "10 FOSS SaaS replacements" framing (Mattermost = Slack, Plane = Jira, AppFlowy = Notion, Coolify/Dokku = Vercel/Heroku, Instant = Firebase, NocoDB = Airtable, Jitsi = Zoom, ERPNext = Salesforce, etc.).

The broader question: should Atelier expand from "coordination substrate + canonical artifact" to "turnkey self-hosted dev studio that bundles best-in-class FOSS for chat, task tracking, deploy, doc editing, video, etc."? The Fireship list reads as a candidate bundle.

The narrower question (worth separating because it has a defensible smaller cut): should `/atelier` integrate **Mattermost specifically** for per-project chat, given that team conversation co-located with the artifact would lower context-switch tax for human composers?

**Open questions (broad — bundling):**

- Does the bundle proposal conflict with PRD §5? Yes, directly: nine of the ten Fireship picks map 1:1 onto a "Not a..." line (chat / task tracker / doc editor / messaging / SaaS / etc.). Bundling them inverts the entire scope-boundary section.
- Does it conflict with ADR-007 (no SaaS)? In spirit yes — a turnkey "one install gets you everything" bundle is closer in shape to a packaged SaaS than to "a coordination substrate adopters wire into their existing stack."
- Does it conflict with ADR-027 (one named reference stack)? Yes — turnkey bundle implies an installer/orchestrator surface (Helm, Compose stack, meta-installer), which is a net-new ops product Atelier doesn't ship today.
- Is the category already crowded? Yes — GitLab Self-Managed, Sandstorm, Cloudron, YunoHost, Coolify-as-meta-installer all sit in the "turnkey self-hosted dev/ops bundle" space. Atelier would lose on every dimension that matters in *that* category (install ergonomics, app-marketplace polish, lifecycle management, security CVE response across N upstreams) while diluting the only dimension where it's currently differentiated.
- What would adoption actually require? Reverse PRD §5 (six "Not a..." lines), reverse ADR-007 framing, reverse ADR-027 (single reference stack), add an installer/orchestrator surface, take on lifecycle management for ten unrelated upstreams.

**Open questions (narrow — Mattermost integration specifically):**

- Does an *integration* (link / embed / SSO bridge) violate PRD §5 the same way bundling does? No — Mattermost stays canonical for chat; Atelier shows it. The "Not a messaging platform" exclusion is satisfied as long as Atelier doesn't *implement* messaging.
- What are the three integration cuts, smallest to largest?
  - **(a) Link surface.** `/atelier` reads `.atelier/config.yaml: integrations.mattermost.channel_url` (or per-territory) and renders a "Project chat" link. Cost: ~1 day of work. Risk: zero — pure config + UI.
  - **(b) Bot adapter.** A Mattermost bot is a remote-principal composer (per ADR-009): it posts contribution lifecycle events (claim, plan_review, review-requested, merged) to a channel, and optionally accepts slash-commands that map to MCP tools (`/atelier claim T-123`, `/atelier status`). Cost: small adapter package. Risk: low — uses existing extension surfaces.
  - **(c) Embedded panel.** `/atelier` embeds the Mattermost channel via iframe / SSO bridge, side-by-side with the contribution lens. Cost: meaningful — CSP, iframe sandboxing, SSO bridge between Supabase Auth and Mattermost auth, per-territory channel resolution, mobile responsiveness. Risk: drift — once chat is *in* the dashboard, pressure mounts to coordinate via chat (ephemeral, unstructured) instead of contributions (canonical, structured); this is exactly what PRD §5's chat exclusion was meant to prevent.
- Does (c) implicitly reverse the brainstorm-primitives exclusion in §35? Partially yes — embedding chat *into* the coordination surface makes the substrate meaningfully chat-flavored even without `propose/react/synthesize` tools. The drift is harder to govern than the explicit-tool case.
- What about adopters who use Slack / Teams / Discord / Zulip instead of Mattermost? The integration must be vendor-neutral at the contract level (per ADR-012/029); Mattermost would be a named adapter alongside others. Specifying for Mattermost only would be a category error matching ADR-027's "named reference stack ≠ architecture lock-in" guardrail.

**Recommendation.**

- **Broad (bundling):** hold PRD §5. Do not bundle. The legitimate adjacency is integration adapters, not bundling — Atelier publishes contribution + remote-principal composer + adapter contracts; adopters bring their own Mattermost / Plane / Coolify and write thin adapters. That preserves the wedge and respects ADR-027.
- **Narrow (Mattermost):** ship cut (a) at v1.x — link surface only, vendor-neutral (`integrations.<chat_provider>.channel_url`), no embed, no bot. Reserve cut (b) bot adapter for v1.x with adopter-signal activation (multiple adopters ask for lifecycle-event posting → ship the adapter; until then, document the remote-principal composer pattern and let early adopters write their own). Defer cut (c) embedded panel pending an explicit ADR that grapples with the drift risk; do not ship without that ADR.

**Status.** OPEN at v1.x with the disposition above. Source: 2026-05-09 strategic prompt + Fireship video synthesis. The bundling question is treated as RESOLVED-NO (PRD §5 holds); the Mattermost-link cut (a) is RESOLVED-YES-AT-v1.x as additive integration; the bot adapter (b) is OPEN with adopter-signal trigger; the embed (c) is OPEN with ADR-required-before-shipping. This entry exists so the broad question doesn't need to be re-litigated each time someone sees a "10 FOSS replacements" list — the answer is in the recommendation block.

**Update 2026-05-09.** GitHub Next's **Ace** (multiplayer agent workspace, technical preview) reduces the case for cut (c) embed: adopters who want chat-co-located-with-coordination have Ace as the obvious answer at production polish Atelier cannot match. Cut (a) link surface and cut (b) bot adapter are unchanged — both remain useful regardless of Ace's trajectory. Atelier's leverage if Ace ships GA is being the substrate that **Ace sessions can write to** via the remote-principal composer pattern (ADR-009): Ace agent + humans plan in chat → at decision points the agent calls Atelier's `log_decision` / `update` / `propose_contract_change` → canonical ADR/contribution persists in the repo with full ADR-005/030 rigor → Ace session gets a back-link via Atelier's git committer (ADR-023). That positioning honors PRD §5 and §36's broad disposition (publish contracts, don't compete on UI). Source: <https://githubnext.com/talks/one-developer-two-dozen-agents-zero-alignment/>.

**Surface-plurality reframing (added 2026-05-09).** Cut (b) — the chat bot adapter — is the **canonical demonstration of Atelier's surface-plurality bet**, not an optional add-on. Per CLAUDE.md's opening charter and ADR-009, the substrate's reason for being is that the same coordination primitives resolve identically regardless of caller surface. A Mattermost / Slack / Discord / Zulip bot is the proof point: a user in chat types `/atelier claim T-123` or `/atelier react T-456 :concern: "this conflicts with ADR-027"` → bot translates to MCP tool call → same handler that serves Claude Code and `/atelier` produces the same canonical record. Cut (b) should be designed vendor-neutral (per ADR-012/029): one adapter pattern, multiple chat-platform implementations (Mattermost reference adapter at v1.x; Slack/Discord/Zulip as adopter-contributed packages). Re-prioritizing cut (b) above cut (a) link surface — cut (b) is the substrate-leverage demonstration; cut (a) is just a UI affordance. Cut (c) embed remains a separate question because embedding a third-party UI *inside* `/atelier` is structurally different from another surface *calling* Atelier primitives.

**Scope cut: dashboard chat surface (added 2026-05-09).** Distinct from cuts (a)/(b)/(c) above is the question of whether `/atelier` itself ships chat-shaped UI. Two things this could mean, with opposite dispositions:

- **(d) Artifact-scoped annotation threads in `/atelier`** — thread component on each contribution and decision panel rendering the §23 `annotate` primitive. **YES at v1.x, lands with §23.** This is not a chat app; it is the dashboard's surface affordance for a primitive every surface must support. Per §23's surface-agnostic design constraint, the same backend serves MCP / dashboard / bot / future surfaces identically. Detailed scope and rationale in §23's "Dashboard surface affordance for `annotate`" subsection.
- **(e) General-purpose chat in `/atelier`** — project channels, direct messages, free-form threads not tied to a specific coordination object, presence indicators, search, file uploads, mobile push, etc. **NO at v1 and v1.x.** This is a chat app and reverses PRD §5. The friction-and-usability gain that motivates this ask is mostly captured by (d). Free-form team chat remains canonical-elsewhere (Slack / Mattermost / Discord / Teams), wired in via cut (b) bot adapters when the team wants substrate visibility into chat-side activity. Adopters who want a co-located multiplayer-chat experience have GitHub Next's Ace as the obvious answer at production polish Atelier cannot match.

The cleaner restatement of Atelier's bet that emerges: **one canonical record per coordination interaction; many surfaces to author and view it.** The dashboard's annotation thread is one surface; the Mattermost bot is another; Claude Code's MCP call is a third. Atelier ships (1) the substrate that owns the canonical record and (2) the dashboard as a competent default surface — not a chat app, but a surface that exposes every primitive the substrate offers.

---

### 37 · Cloudflare migration execution for the live Vercel deploy (ADR-052 follow-through)

**Scenario.** ADR-052 (2026-05-09) reverses ADR-046 and codifies Cloudflare-primary as the going-forward discipline. The live deploy at `https://atelier-three-coral.vercel.app` continues to serve until the migration ships. This entry tracks the migration scope + trigger criteria + execution steps so the migration is not re-scoped under operational pressure (the §25/§28 methodology lesson: event-triggered with concrete criteria, not date-based).

**Open questions:**

- **Trigger criteria.** What concrete event activates the migration? Candidates: (i) the first cron handler ships (substrate has cron *schedules* declared in `prototype/vercel.ts` but no `/api/cron/*` route handlers yet — when the first handler lands and needs to fire in prod, Vercel Hobby cron-quota becomes load-bearing); (ii) an adopter signals they're standing up Atelier and the canonical operator runbook should match the going-forward discipline; (iii) a dependency upgrade (Next.js, OpenNext adapter, Hyperdrive) lands a feature that materially improves the CF shape; (iv) a Vercel-side regression class surfaces (env-var, pooler, deploy-protection) that CF avoids structurally. Default: trigger (ii) — first adopter activation triggers migration so the runbook ships with current canonical infra rather than legacy Vercel shape. Trigger (i) is closer in expected order (cron handler implementation is in-flight as substrate work) but adopter activation may fire first depending on outreach timing.
- **Cutover model.** Atomic vs blue-green vs parallel-serve? Recommended: **parallel-serve** — Cloudflare deploy stands up alongside Vercel; smoke parity verified end-to-end (12-tool MCP surface + OAuth flow + cron handlers + webhooks); operator promotes by updating `.atelier/config.yaml: endpoint.url` to the CF URL and the registered webhook target URLs. Vercel deploy stays warm for 30 days as fallback. Once parity is validated and no rollbacks fire, Vercel project is decommissioned.
- **Hyperdrive setup ordering.** The Worker needs Hyperdrive binding before first request; binding creation requires a Cloudflare account at the appropriate tier (Workers Paid $5/mo). Operator step list must include Hyperdrive setup ahead of `wrangler deploy`. Document caching-disabled config explicitly per ADR-052.
- **Webhook URL re-registration.** GitHub + Figma + Supabase Auth Hooks all point at Vercel URLs today. Migration must re-register each at the CF URL (operator action; same secrets, different host). Risk: Supabase Auth Hooks re-registration is the most fragile (Svix-style flow per PR #85); test against a staging hook first.
- **`first-deploy.md` rewrite.** The runbook is currently Vercel-shaped. Either (a) rewrite in-place to Cloudflare with the Vercel version archived at `legacy-vercel-deploy.md`, or (b) ship a new `first-deploy-cloudflare.md` and demote the Vercel version. Recommended: (a) — the canonical runbook should match the canonical infra; legacy Vercel doc serves only as historical reference.
- **CI workflow updates.** `.github/workflows/atelier-audit.yml` references Vercel preview URLs in some smokes. Each reference needs a Cloudflare-preview equivalent; OpenNext + Wrangler preview URLs follow a different pattern. Audit each smoke for URL-shape assumptions.
- **Bearer rotation script update.** `scripts/bootstrap/rotate-bearer.ts` writes to `vercel env`; needs a code path that writes to `wrangler secret put` instead. Detect target via `.atelier/config.yaml: deploy.platform: cloudflare | vercel | local-only` so adopters mid-migration can run either.

**Recommendation.** Stage the migration as a single PR series:

1. **PR 1 — Cloudflare scaffold (no traffic).** Add `wrangler.jsonc` + `@opennextjs/cloudflare` adapter wiring + Hyperdrive binding placeholder + GH Action workflow `.github/workflows/cloudflare-deploy.yml` (preview-only, no prod promote, gated behind `vars.CF_DEPLOY_ENABLED`). All smokes pass against preview URLs. Vercel deploy unchanged. Lands without operator action required. **STATUS: SHIPPED as PR #91 (2026-05-09).**
2. **PR 2 — Cron handler implementation (CF-shape from inception) + webhook handler portability.** Cron handlers (reaper, mirror-delivery, reconcile, triage, alert-publisher per `prototype/vercel.ts` schedules) do not exist today — implement them directly with both `fetch()` (HTTPS) and `scheduled()` (Workers cron) entry points sharing logic, skipping the Vercel-shape intermediate. Verify webhook handlers (`/api/webhooks/github`, `/api/webhooks/figma`, `/api/webhooks/supabase-auth`) work identically under Workers' request shape. Smokes per handler. PR 2 is the largest of the migration series because it's actual implementation, not portability work. **Split into 4 chunks (2a/b/c/d) for review-size discipline:**
   - **2a — 3 cron route handlers wrapping existing scripts (alert-publisher, mirror-delivery, reconcile) + cron-auth helper.** **STATUS: SHIPPED as PR #92 (2026-05-09).** Includes additive `runOnce()` exports on the 3 wrapped scripts; existing CLI behavior preserved; existing smokes preserved.
   - **2b — Reaper cron handler + `atelier_reap_stale_sessions(uuid, interval)` SQL function.** **STATUS: SHIPPED as PR #93 (2026-05-09).** Net-new SQL function; explicit lock release per ARCH §6.1; per-project iteration with telemetry emission for metrics population. Migration `20260509000017_atelier_reap_stale_sessions.sql`.
   - **2c — Triage orchestrator cron handler.** **STATUS: DEFERRED.** Recon during 2a/2b revealed triage is not a thin wrapper — `routeProposal` operates per-comment, requiring the cron handler to (i) poll each configured `CommentSourceAdapter.fetchSince(date)` for new comments since last watermark, (ii) resolve `(triageSessionId, territoryId, contentRef)` per comment per-project, (iii) persist watermark per-(project, adapter) to a store that doesn't exist yet. Design questions: where does the watermark live (telemetry table action='triage.watermark' vs new `triage_watermarks` table)? How do comments map to territories when adapter doesn't carry that signal? Defer to follow-up session with explicit design pass; not blocking for cutover (triage was never running on prod anyway).
   - **2d — OpenNext `scheduled()` worker extension + wrangler `[triggers]` block + vercel.ts schedule sync.** **STATUS: DEFERRED.** Recon revealed OpenNext + CF cron is a less-trodden path: `defineCloudflareConfig` has no native `scheduled` config; the canonical pattern requires either (a) custom worker entry that wraps `.open-next/worker.js` (introduces typecheck-vs-build-output coupling), or (b) separate Cloudflare Worker for cron that fetches the OpenNext worker's HTTP cron paths (clean but two deployment artifacts). Plus schedule deduplication: two of the five schedules are `*/5 * * * *` (reaper + alert-publisher) which CF treats as ambiguous; needs staggering (e.g., alert-publisher → `1-56/5 * * * *`). Defer until PR 4 cutover when the actual deploy is in front and the patterns can be tested empirically rather than guessed at.
3. **PR 3 — Operator runbook + bearer-rotate script update.** Rewrite `first-deploy.md` for Cloudflare; archive Vercel version at `legacy-vercel-deploy.md`; update `rotate-bearer.ts` to write to Wrangler secret when `deploy.platform=cloudflare`. **STATUS: PENDING.** Eligible to ship now; recommended sequencing is after 2c+2d resolve so the runbook reflects the final cron wiring shape.
4. **PR 4 — Trigger fires → operator executes parallel-serve cutover.** Operator follows the rewritten `first-deploy.md`, stands up the CF deploy, validates parity, re-registers webhooks at CF URLs, updates `.atelier/config.yaml` endpoint URL. 30-day warm fallback on Vercel. **STATUS: AWAITING TRIGGER.**
5. **PR 5 — Vercel decommission (post-30-day-fallback).** Remove Vercel project; clean up `legacy-vercel-deploy.md` (move to `docs/architecture/audits/` as historical record); flip `.atelier/config.yaml` schema to drop `deploy.platform: vercel` as a supported value. **STATUS: AUTOMATIC POST-30-DAY-FALLBACK.**

PRs 1, 2a, 2b shipped 2026-05-09 as substrate work (no production impact). PRs 2c, 2d, 3 are eligible to ship anytime but blocked on design iterations / runbook coupling. PR 4 awaits trigger. PR 5 is automatic.

**Status.** OPEN. Substrate scaffold + 4 of 5 cron handlers in tree. Triage + CF cron wiring deferred to follow-up sessions for design. Trigger-based for cutover; default trigger is first-adopter activation (criterion (ii) above). Source: ADR-052 (2026-05-09); progress update 2026-05-09 from PRs #91/#92/#93 recon.
