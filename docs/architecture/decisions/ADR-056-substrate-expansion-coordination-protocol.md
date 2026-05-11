---
id: ADR-056
trace_id: BRD:Epic-1
category: methodology
session: 2026-05-11-bb-stage-4-substrate-fact-check
composer: nino-chavez
timestamp: 2026-05-11T00:00:00Z
---

# Substrate expansion coordination protocol (claim-slot-before-branching for tools / event-kinds / migration seqs)

**Summary.** Three substrate surfaces are intentionally narrow + monolithic per prior ADRs (ADR-040 tool surface lock; ADR-055 broadcast event topology; Supabase migration sequence-number ordering). The narrowness is load-bearing — it forces ADR-level deliberation before expansion. The side effect surfaced by the dashboard north-star BB initiative's Stage 4 fact-check: parallel PRs each expanding the same surface produce merge conflicts on every line, not just on overlapping work. ADR-056 codifies a claim-slot-before-branching protocol as discipline rather than refactoring the surfaces. Documented in `docs/methodology/substrate-expansion-coordination.md`; applied via tracking-issue + claim-block pattern.

**Rationale.**

The webapp v2 integration doc (BB initiative Stage 3) proposed three substrate gates running in parallel-ish phasing:

- G1: brainstorm pipeline — adds 5 tools (`propose / react / get_proposals / synthesize / approve_plan`) per ADR-054
- G2: SSE deploy — adds 4 broadcast event kinds (`proposal.created / proposal.reacted / synthesis.created / plan.approved`) per ADR-055
- G3: session checkpoints — adds 1 tool (`checkpoint`) per ADR-054

Stage 4 fact-check (`scripts/endpoint/lib/dispatch.ts:49-51`, `scripts/coordination/lib/broadcast.ts:27-34`, `supabase/migrations/`) confirmed each gate independently expands the same three coupling points:

- `TOOL_NAMES` tuple + `_twelveCheck` literal-type assertion: G1 changes literal to 17; G3 changes literal to 18 (or 13 if landed first). Cannot merge in parallel.
- `BroadcastEventKind` union + paired payload interfaces: G1 adds 4 kinds; G2 wires publishers/subscribers to them; G3 likely adds 1 more. All touch the union.
- Migration sequence numbers: parallel branches on the same date pick identical "next seq."

The fact-check makes the choice clear: either refactor the surfaces to be extension-friendly (registry pattern for tools, per-kind file split for broadcast, ULID-based migration filenames) — bigger work, weakens the load-bearing narrowness — or codify discipline so the narrowness is preserved and parallel work is explicitly coordinated.

ADR-056 picks discipline. Refactoring is named as the re-evaluation path if discipline proves brittle.

**Decision.**

The protocol (full text in `docs/methodology/substrate-expansion-coordination.md`):

1. **Tracking issue first.** Any PR expanding `TOOL_NAMES`, `BroadcastEventKind`, or migration seqs opens a tracking issue before branching. Issue body names the ADR governing the expansion + the slot being claimed.
2. **Claim contiguous slots.** For tools: claim tuple positions (e.g., G1 takes 13-17; G3 takes 18). For event kinds: name the new kind strings explicitly. For migrations: reserve seq numbers in the issue body.
3. **Compute new totals at branch time.** Each PR's commit updates the `_twelveCheck` literal to its own post-merge total, knowing where it sits in the merge order.
4. **Serialize when conflict is unavoidable.** Second-merging PR rebases against the first. The rebase is mechanical (increment literal + append entries) but mandatory.
5. **Definition PRs before publisher/consumer PRs.** G1 (defines kinds) lands before G2 (wires publishers/subscribers). Do not branch G2 until G1's kind-definition commit is on `main`.

The protocol does NOT apply to:
- Solo sequential work (single-branch, no parallelism).
- PRs touching only one of the three surfaces (coordinate only on that surface).
- Backfill/data-only migrations (same protocol, lower stakes).
- Renames or refactors that touch a surface without expanding it.

ADR for each expansion remains required (ADR-040 surface lock applies; this ADR is purely about coordination of expansions, not whether expansions happen).

**Consequences.**

- BB initiative integration doc (Stage 3 deliverable) updates Phase 1 phasing language from "parallel-ish gates" to "serialized per methodology / ADR-056" — caught in BB Stage 4 validation per the carry-forward report.
- New methodology doc `docs/methodology/substrate-expansion-coordination.md` joins the existing methodology index. Three references: this ADR, `METHODOLOGY.md §11.5b` (canonical-pattern-first rule), `METHODOLOGY.md` (general).
- `traceability.json` increments: adrs:55→56, decisions:57→58, this ADR's trace_id `BRD:Epic-1` already exists.
- BRD-OPEN-QUESTIONS.md gains a brief reference under §31 (X1 audit LOW items) noting this ADR resolves the substrate-expansion coordination question (which had not been filed explicitly — surfaced fresh in Stage 4).
- Contributors learn the protocol from the methodology doc; the pre-PR checklist at the end of the doc is the operational discipline.

**What this does NOT decide.**

- Whether to eventually refactor the three coupled surfaces. The re-evaluation triggers in the methodology doc name the refactor path; ADR-056 chooses discipline first.
- The exact tracking-issue template. Maintainers add a `.github/ISSUE_TEMPLATE/substrate-expansion.md` as a follow-up if the protocol sees enough use.
- Whether CI should mechanically enforce the protocol (e.g., a lint that flags PRs touching `_twelveCheck` without a linked tracking issue). Filed as a re-evaluation trigger if discipline proves brittle.

**Re-evaluation triggers.**

- 3+ substrate expansions land without the tracking-issue protocol being used → revisit whether the protocol is too heavy and the surfaces themselves should be refactored.
- The literal-type assertion / kind union / migration seqs prove brittle even with the protocol (e.g., contributor misses or rebases corrupt the assertion) → refactor the surfaces (registry, per-kind file split, ULID filenames).
- Contributors consistently bypass the tracking-issue step → the protocol is friction-without-value and should either be CI-enforced or replaced with refactoring.
- A new fourth surface emerges with similar coupling characteristics (e.g., `.atelier/config.yaml` schema enum expansion) → extend this ADR or write a follow-up; today scope is the three named surfaces only.
