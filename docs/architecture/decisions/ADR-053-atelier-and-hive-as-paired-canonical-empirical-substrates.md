---
id: ADR-053
trace_id: BRD:Epic-1
category: strategic
session: 2026-05-10-hive-pairing-strategic-reframe
composer: nino-chavez
timestamp: 2026-05-10T00:00:00Z
---

# Atelier and AI Hive as paired canonical-vs-empirical substrates

**Summary.** Atelier and AI Hive (`bc-subscriptions/.hive/`) are not competitors and not duplicates. They are paired by intent: **AI Hive is the empirical lab; Atelier is the canonical destination.** Hive ships pragmatically under BigCommerce's organizational + infrastructural constraints (shared CF account, D1/SQLite, BigDesign UI, hackathon timeline, internal team). Atelier is what Hive could be without those constraints — open market, self-hostable, vector-retrieval-capable, RLS-engaged, multi-tenant, spec-first. The two evolve in parallel with bidirectional learning: Hive's production-proven primitives flow into Atelier's spec; Atelier's architectural decisions inform Hive's roadmap when constraints permit.

**Rationale.**

The pairing was always implicit but never codified. Atelier's session memory carried the framing ("hackathon-hive and hive-dashboard as predecessor projects per the strategic-direction conversation 2026-04-24"); Hive's docs (`bc-subscriptions/.hive/README.md`) carry the framing the other direction ("This repo merges what used to be two coupled-but-separate projects into a single artifact"). BigBlueprint's `hive-coordination-pattern.md` (2026-05-08) documents Hive as the canonical pattern to copy when bootstrapping any multi-agent initiative. None of these docs name the relationship between Hive and Atelier explicitly.

The 2026-05-10 first-principles audit (this session) surfaced what was implicit: Atelier's 52 ADRs and zero users vs. Hive's pragmatic deployment and active production use is not "Atelier is wrong." It is the structural difference between a canonical destination (deliberately codified, awaiting adoption) and an empirical lab (deliberately pragmatic, generating production signal). The discipline-tax memory note ("more spec/process is not always net-positive; past a point, discipline tax kills adoption; ergonomics > rigor accretion") applies WITHIN a single substrate; it does NOT apply to the canonical-vs-empirical pairing where each substrate's role differs.

**The relationship.**

| Dimension | Atelier (canonical) | AI Hive (empirical) |
|---|---|---|
| Role | Destination + canonical synthesis | Production lab + empirical ground truth |
| Cadence | Spec-first; ADRs codify why; rigor over speed | Ship-first; primitives prove out under load; speed over deliberation |
| Constraint surface | None (open market, self-hostable, BYO infra) | BC-internal (shared CF account, D1/SQLite, BigDesign, hackathon timeline) |
| Tool surface | Locked at 12; expands deliberately via ADR (e.g., ADR-054 expands to 18) | Grew organically to ~21; each addition empirically driven |
| Datastore | Postgres + pgvector + RLS | D1 (SQLite) — no pgvector, no RLS |
| UI | Generic React/Next.js with role-aware lenses | BigDesign-bound dashboard SPA |
| Real-time | Supabase Realtime → migrating to SSE per ADR-055 | SSE push (proven 1s latency) |
| Multi-tenancy | Multi-guild from day 1 (proper schema + RLS) | Single shared-tenant deploy by default |
| Locks | Mandatory fencing tokens (ADR-004) | Advisory locks |
| Vector retrieval | pgvector hybrid CTE (ADR-049) | None |
| Contracts | propose_contract_change with classifier (ADR-035) | None |
| Onboarding modes | Single (bootstrap-fresh per ADR-044) → expanding to two (ADR-056 follow-up) | Two-mode (join existing / bootstrap fresh) |
| Adoption status | Zero real users (intentional pre-canonical) | Production use by BC team since 2026-04 |

**Bidirectional flow.**

The two substrates feed each other along documented rules:

**Hive → Atelier (empirical evidence informs canonical spec):**

- When a Hive primitive proves load-bearing in production use, Atelier's spec adopts it via a new ADR with `evidence: hive-production-use` named in the rationale. The exclusion that the new ADR reverses (if any) gets a new ADR per the append-only rule (ADR-030).
- When Hive's deployment pattern proves more correct than Atelier's, Atelier amends accordingly (e.g., SSE push proving better than the assumed Supabase Realtime — ADR-055).
- When Hive's onboarding mode pattern proves more inviting (e.g., two-mode onboarding vs Atelier's single bootstrap-fresh), Atelier expands.
- When Hive's vocabulary proves clearer (e.g., the three-loop framing brainstorm/execute/continuity), Atelier adopts it as IA scaffolding.

**Atelier → Hive (canonical decisions inform Hive roadmap when constraints permit):**

- When BC's constraints relax (e.g., Hive can adopt Postgres + pgvector instead of D1; Hive can add RLS for multi-tenant scale; Hive can drop BigDesign in favor of generic UI), Atelier's relevant ADRs become Hive's roadmap items.
- When non-BC adopters arrive at Hive ("we want this but without BC's constraints"), the answer is "use Atelier" — not because Hive is broken, but because Atelier IS the version of Hive without BC's constraints.
- Eventually, when Hive's BC-specific constraints are fully shed AND Atelier has matured to production-grade, the two substrates may converge into one. That convergence is a future ADR (not this one); the trigger is empirical, not date-based.

**What this is NOT.**

- NOT a merge plan. The two substrates remain separate repos, separate deployments, separate user populations until convergence is empirically warranted.
- NOT a deprecation of either. Both serve their roles. Atelier is the destination; Hive is the production. Both are real.
- NOT an order of operations. Bidirectional flow is continuous; ADRs codify the flow when specific evidence triggers them.
- NOT a positioning of one over the other. The "Atelier vs Hive" framing was wrong-evidence; the correct framing is paired-by-design.

**Consequences.**

- The discipline-tax memory note's scope clarifies: it applies within a single substrate, NOT across the pairing. Atelier carrying ADR rigor without users is appropriate to its canonical role; it is NOT a sign that Atelier is over-built.
- Atelier's BRD-OPEN-QUESTIONS gets a new section type: "Hive-evidence triggers" — open questions whose resolution awaits Hive surfacing production signal. (Existing §7, §21, §22 etc. don't change; new sections may be filed under this category going forward.)
- Hive's docs (in its own repo, separate PR) get a complementary entry naming Atelier as the canonical destination — out of scope for this PR; filed as Hive-side follow-up.
- ADR-054 (paired with this) operationalizes the first concrete instance: brainstorm primitives (`propose / react / synthesize / approve_plan`) flow Hive → Atelier, reversing BRD §35.
- ADR-055 (paired with this) operationalizes the second: SSE push pattern (proven 1s latency at Hive scale) flows Hive → Atelier, supersedes the assumed Supabase Realtime broadcast layer.
- The "for-reviewers" pitch doc gets a paragraph about the pairing — out of scope for this PR; filed as doc-update follow-up.
- The webapp v2 IA reframe (Compose / Inbox / Activity / Atlas / Connect) integrates Hive's three-loop framing per ADR-055.

**Re-evaluation triggers.**

- Hive's BC-specific constraints are fully shed (e.g., Hive moves off shared CF account, drops BigDesign coupling, adopts pgvector) → re-evaluate whether convergence is now empirical.
- Atelier reaches production-grade adoption (e.g., 5+ teams running their own deploy) → re-evaluate whether Atelier is now the empirical substrate too, making Hive's role redundant.
- Non-BC adopter arrives at Hive and explicitly asks for Atelier-only features (vector retrieval, RLS, multi-guild) → re-evaluate whether to bridge the adoption from Hive to Atelier directly.
- The pairing's bidirectional flow proves to be one-way in practice (only Hive → Atelier flows, never Atelier → Hive) → re-evaluate whether Atelier is generating any signal Hive needs, or whether Atelier is purely a destination Hive is growing toward (which would change the pairing's framing to "predecessor → successor" instead of "empirical lab paired with canonical destination").
