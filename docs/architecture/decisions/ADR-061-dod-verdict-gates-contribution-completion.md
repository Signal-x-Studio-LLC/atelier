---
id: ADR-061
trace_id: ADR-061
category: architecture
session: 2026-06-11-blueprint-dod-contract
composer: nino-chavez
timestamp: 2026-06-11T00:00:00Z
---

# DoD verdict gates contribution completion (the Blueprint↔coordinator contract)

**Summary.** Atelier is the reference implementation of the coordinator side of a Blueprint methodology contract: *a contribution cannot be considered done while its definition-of-done verdict is not clean.* Atelier already vendors `tools/state-derive`, which derives a per-capability acceptance verdict (`COMPLIANT | PARTIAL | NON-COMPLIANT | ABSENT | ERROR | MANUAL_REVIEW`) into `docs/state/_state.json` — but until now nothing read it. The artifact was written and ignored, so "done" in the coordination layer was a self-asserted state transition with no verification behind it. This ADR adds the verdict reader (`scripts/cli/lib/dod-verdict.ts`) and the gate that consumes it (`atelier dod`), and records *where* the gate runs and why. It is the atelier realization of candidate B in Blueprint's `METHODOLOGY-AMENDMENTS.md` (2026-06-11, "Blueprint↔Hive gaps").

**Rationale.**

The gap is structural. Atelier's coordinator owns the contribution lifecycle `open → claimed → [plan_review] → in_progress → review`, and the live `update` tool (write.ts § update) stops at `review`. The terminal `merged` state is reached by the git merge / external sync, not by a coordinator tool. Meanwhile `_state.json`'s verdict was consumed by nothing — not CI, not the dashboard, not any transition. The two halves never met: a contribution could be marked ready, reviewed, and merged while the repo's acceptance capabilities read NON-COMPLIANT, and no gate would notice. That is the exact "claimed done by assertion, not by verified behavior" failure the Blueprint DoD verification ladder exists to kill — observed in the field (a teammate marking an incident addressed by citing docs that did not match reality; see the Blueprint amendments entry).

Two constraints shape *where* the gate can live:

1. **The live MCP endpoint cannot host it.** `update` is a pure Postgres transaction (write.ts) with no filesystem context, and the deployed endpoint (Vercel + Supabase, per ADR-027) has no repo checkout — so `docs/state/_state.json` is not on disk at request time. Reading the artifact inside the live transition is architecturally impossible and would couple a coordination request to a build artifact.
2. **`_state.json` is a build artifact.** It is produced by `state-derive` against a checkout, stamped with `as_of_commit`. It is current only where the checkout is current — CI, or a local run.

Those constraints point to the same place: the gate runs where the artifact lives and where atelier's *real* completion is decided — the CI / merge layer that owns `review → merged`. This mirrors atelier's existing pattern for `find_similar` (ADR-006), which also ships as a CI-runnable check rather than a live-endpoint blocker. `find_similar` is orthogonal: it is an advisory pre-claim "is this already in flight?" search (demoted to non-blocking by ADR-043/ADR-045), not a completion verdict. The DoD gate is a distinct, blocking-by-default completion check; the two do not overlap.

**Decision.**

1. **Verdict reader — `scripts/cli/lib/dod-verdict.ts`.** A pure `deriveDodVerdict(state, headCommit)` plus an fs wrapper `readDodVerdict(repoRoot, headCommit)`. It depends only on the artifact contract (`as_of_commit` + `capabilities[].status`), not on `tools/state-derive` package internals. Aggregation, fail-safe-ordered so a missing or uncertain signal can never read COMPLIANT:
   - no artifact → `MANUAL_REVIEW`;
   - `as_of_commit != HEAD` (stale) → `MANUAL_REVIEW`, even if every capability passes;
   - any capability `NON-COMPLIANT` or `PARTIAL` (definitively not done) → `NON-COMPLIANT`;
   - any capability `ERROR` or `MANUAL_REVIEW` (unverifiable), with no red → `MANUAL_REVIEW` (the monotone rule — an indeterminate gate cannot read done);
   - all `COMPLIANT` / `ABSENT` → `COMPLIANT`.

2. **The gate — `atelier dod`.** Resolves git HEAD, reads the verdict, prints it. Exit codes: `NON-COMPLIANT` → 1 (block); `MANUAL_REVIEW` → 0 with a warning by default, 1 under `--strict`; `COMPLIANT` → 0. `--json` for machine consumption. Wired into the CLI dispatcher as a `working` command. This is the line a CI job runs before a merge — the coordinator "reading the DoD verdict" at the layer that owns completion.

3. **Fail-safe is load-bearing, not advisory.** The default treats `MANUAL_REVIEW` as non-blocking (so a stale artifact does not wedge the flow) but never silently green — it warns and refuses to report COMPLIANT. `--strict` is the CI posture once `state-derive` runs on every push (so the artifact is reliably fresh). The `fast` job of `atelier-audit.yml` runs `--strict` after regenerating the artifact, so the gate enforces on every PR.

4. **Per-AC scoping — `atelier dod --trace-id <id>`.** Beyond the repo-level verdict, the gate scopes to a contribution's own acceptance capabilities. Contributions carry `trace_ids text[]` in the `BRD:Epic-N` vocabulary (ADR-021); capability `reference` strings already cite the bare `Epic-N` token. The reader joins them by word-boundary match on the reference prose (so `Epic-2` does not match `Epic-20`), aggregating only the covering capabilities. An AC with **no** covering capability is a coverage gap → `MANUAL_REVIEW` (it cannot read done, and blocks under `--strict`). This is the AC-keyed framing the Blueprint ladder uses, realized without a state-derive schema change — the join rides the existing `reference` field.

**Consequences.**

- `_state.json` gains a consumer; the previously-dangling artifact is now load-bearing. A `state-derive` run becomes a meaningful CI step rather than documentation.
- Smoke coverage: `scripts/cli/__smoke__/dod.smoke.ts` pins the eight fail-safe cases.
- **Deferred (sequenced follow-ups, deliberately out of this ADR):**
  - *Structured AC coverage.* Per-AC scoping (Decision 4) joins on the capability's free-text `reference` prose — consistent today, but fragile: a reworded reference silently drops coverage. The hardening is a structured `covers: string[]` field on the `Capability` type (`tools/state-derive`), populated per capability in the catalog, so the reader joins on `covers` instead of parsing prose. AC-keying is methodology-general, so that field is a candidate for Blueprint's template `Capability` type — it lands there first, not as an atelier-local divergence.
  - *Coordinator-response surfacing.* The live `update(state=review)` path could echo the last known verdict as an advisory annotation (read from the datastore, not disk), so an authoring agent sees the DoD posture without leaving the protocol. Requires persisting the verdict (next item).
  - *Persistence.* A `dod_verdict` column on `contributions` (write-first per ADR-005, then datastore) would make the verdict durable on the contribution rather than recomputed per CI run.
  - *Freshness enforcement.* Flip `atelier dod --strict` on in CI once `state-derive` runs on every push, so `MANUAL_REVIEW`-by-staleness becomes impossible rather than tolerated.
- The methodology source for the contract is Blueprint, not atelier: the wiring *contract* lives in `METHODOLOGY-AMENDMENTS.md` (candidate B); atelier is its reference implementation. Changes to the contract land there first.
