---
title: Substrate expansion coordination
audience: contributors
status: canonical
landed: 2026-05-11
---

# Substrate expansion coordination

**Status.** Canonical contributor protocol for coordinating PRs that expand load-bearing substrate surfaces. Procedural twin to ADR-056.

**Audience.** Anyone opening a PR that expands the MCP tool surface, the broadcast event-kind union, or the Supabase migration sequence — solo or as part of a multi-PR series (e.g., the webapp v2 substrate gates per integration doc).

---

## Why this exists

Three substrate surfaces are intentionally narrow + monolithic by design (ADR-040 surface lock for tools; ADR-055 broadcast event topology; Supabase migration ordering constraint). The narrowness is load-bearing — it forces ADR-level deliberation before expansion. The side effect: parallel PRs that each expand the same surface produce merge conflicts on every line, not just on overlapping work.

Stage 4 of the dashboard north-star BB initiative surfaced this concretely. The integration doc named three gates (G1 brainstorm pipeline +5 tools, G2 SSE deploy, G3 checkpoint +1 tool) that the doc-writers expected to run in parallel; each gate independently expands the same coupling points; the parallel framing is structurally unsafe without coordination.

The mitigation is discipline, not refactor: claim the slot before opening the parallel branch.

---

## The three coordinated surfaces

### 1. `TOOL_NAMES` + `_twelveCheck` literal-type assertion

**Location.** `scripts/endpoint/lib/dispatch.ts`.

**Shape.** `TOOL_NAMES` is a `readonly` tuple of literal strings. The next line asserts `TOOL_NAMES.length` is a specific literal number (currently `12` per ADR-040, expanding to `18` per ADR-054). The assertion is intentional: a typo or accidental tool addition will fail the type check at compile time.

**Coordination requirement.** Any PR that adds tools must update both the tuple and the literal-type assertion in a single commit. Two parallel PRs each adding tools cannot merge without rebase — they touch the same line.

**Protocol when planning parallel work.**

1. Open a tracking issue named "Tool surface expansion: <ADR-NNN> +<count>" before branching.
2. Claim the next contiguous block in the tuple (e.g., G1 takes positions 13-17; G3 takes position 18).
3. Compute the new total (e.g., G1 → 17; G3 → 18). Each PR's commit updates the assertion to its own claimed total.
4. If both PRs are open simultaneously: the second-merging PR's CI will fail until it rebases onto the first-merged result. The rebase is mechanical — increment the assertion literal + append tools to the tuple — but it is mandatory.
5. ADR for each expansion remains a hard requirement (ADR-040 surface lock).

### 2. `BroadcastEventKind` union + payload interfaces

**Location.** `scripts/coordination/lib/broadcast.ts`.

**Shape.** `BroadcastEventKind` is a string-literal union; each kind has a paired `<Kind>Payload` interface and an entry in the discriminated `BroadcastPayload` union. The pattern is intentional: TypeScript narrows `envelope.kind` to the matching payload shape at every consumer.

**Coordination requirement.** Any PR adding broadcast event kinds touches: the kind union (3-4 lines), the payload interface (~10 lines per kind), the discriminated payload union, and any consumer that exhaustively switches on `kind` (likely the SSE serializer + the lens read paths). Parallel PRs that each add kinds will conflict on every one of these.

**Protocol when planning parallel work.**

1. Same tracking-issue + claim-slot pattern as the tool surface.
2. Name the new kinds in the issue body explicitly (e.g., `proposal.created`, `proposal.reacted`, `synthesis.created`, `plan.approved` for G1).
3. The PR that adds the kinds lands first (definition); follow-up PRs that emit them (publishers) and consume them (subscribers) land second.
4. SSE wiring (G2) explicitly depends on the kinds being defined; do not branch G2 until G1's kind-definition commit is on `main`.

### 3. Supabase migration sequence numbers

**Location.** `supabase/migrations/<YYYYMMDD><seq>_<slug>.sql`.

**Shape.** Filenames sort lexicographically; the migration runner applies them in lexicographic order. Same-day migrations distinguish themselves via a 5-digit seq suffix (e.g., `20260509000017` + `20260509000018`).

**Coordination requirement.** Two parallel branches authored on the same day will independently pick "the next seq" and produce identical filenames. Postgres won't replay-collide (the files differ in slug), but the migration runner's ordering becomes implementation-defined for the conflicting pair, and a future migration that depends on one running before the other will be flaky.

**Protocol when planning parallel work.**

1. Same tracking-issue + claim-slot pattern.
2. Reserve seqs in the issue body: "G1 claims `20260512000019` through `20260512000022` (4 migrations); G3 claims `20260512000023` (1 migration)."
3. Each PR uses its claimed seqs exactly. If the date rolls over before merge, both PRs update their migration filenames to the new date with the same relative ordering preserved.
4. Migration content that depends on another migration's table existing must explicitly cite the dependency in the SQL comment header.

---

## When this protocol does NOT apply

- Solo sequential work on a single surface — no parallel branches, no coordination needed; just open the PR.
- PRs that touch only one of the three surfaces — coordinate only on that surface.
- Backfill / data-only migrations that don't change schema — no merge conflict beyond filename seq (same protocol but lower stakes).
- Renames or refactors that touch one of these surfaces without expanding it — standard rebase discipline suffices; ADR not required if the change is mechanical.

---

## Pre-PR checklist

Before opening a PR that touches any of the three coordinated surfaces:

- [ ] Tracking issue exists naming this expansion + the ADR governing it
- [ ] Slot claimed: tuple positions / event-kind names / migration seqs reserved in the issue body
- [ ] No other open PR claims the same slot (or the conflict is acknowledged + serialization order documented)
- [ ] If the change adds a tool or event kind, the corresponding ADR PR is open or merged
- [ ] The PR description references the tracking issue + ADR

---

## Reference incident

Dashboard north-star BB initiative Stage 4 surfaced this. The integration doc proposed G1 + G2 + G3 as parallel-ish gates; substrate-side fact-check (this work) confirmed each gate independently expands `_twelveCheck`, `BroadcastEventKind`, and migration seqs. The parallel-gate framing as authored was structurally unsafe.

Resolution: this protocol + ADR-056. The BB integration doc updates Phase 1 phasing language from "parallel-ish gates" to "serialized via methodology" + cites this doc.

---

## Re-evaluation triggers

- Substrate expansion happens 3+ times without the tracking-issue protocol being used → revisit whether the protocol is too heavy and whether the surfaces themselves should be refactored.
- The literal-type assertion / kind union / migration seqs prove brittle even with the protocol (e.g., issue-tracking misses or rebases corrupt the assertion) → consider refactoring the surfaces (registry pattern for tools; per-kind file split for broadcast; ULID-based migration filenames). The refactor is bigger work; this protocol is the cheap mitigation first.
