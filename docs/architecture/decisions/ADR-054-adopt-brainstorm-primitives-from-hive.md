---
id: ADR-054
trace_id: BRD:Epic-2
category: architecture
session: 2026-05-10-hive-pairing-strategic-reframe
composer: nino-chavez
timestamp: 2026-05-10T00:00:00Z
---

# Adopt brainstorm primitives from Hive (reverses BRD §35; expands tool surface 12→18)

**Summary.** Atelier adopts six brainstorm + checkpoint primitives from AI Hive's production tool surface: `propose`, `react`, `get_proposals`, `synthesize`, `approve_plan`, `checkpoint`. This reverses BRD-OPEN-QUESTIONS §35 ("Brainstorm primitives currently excluded by PRD §5"). Per ADR-053, this is the first concrete instance of Hive → Atelier flow: Hive's production use proved these primitives load-bearing for the brainstorm-to-task workflow. The 12-tool surface lock from ADR-040 expands to 18; ADR-040 amended in lockstep.

**Rationale.**

BRD §35 (filed 2026-05-09) excluded brainstorm primitives on the framing that they would make Atelier "meaningfully chat-flavored" and reverse PRD §5's "not a chat app" exclusion. The framing was wrong-evidence: brainstorm primitives in Hive's actual production use are NOT chat. They are structured deliberation primitives that produce auditable artifacts (proposals → reactions → syntheses → approved plans → claimable tasks). The output is a graph of named decisions with provenance, not a flat conversation thread.

Hive's `bc-subscriptions/.hive/docs/ARCHITECTURE.md` documents the loop: "Brainstorm produces syntheses with action items. Approving a synthesis converts those action items into claimable tasks. The execute loop is what turns plans into PRs." This is the brainstorm-to-task bridge that Atelier's spec lacked — and it's the missing primitive for "humans + agents deliberating over architecture decisions before they become commits."

Concrete production evidence from Hive (per `bc-subscriptions/.hive/packages/core/src/tools/brainstorm.ts`, deployed and in active use since 2026-04):

- `propose`: posts a structured option set ("I'm thinking about X; here are options A/B/C with tradeoffs"); visible to all sessions
- `react`: other sessions vote / comment / flag concerns on a proposal
- `get_proposals`: lists open proposals for a session to discover what's pending input
- `synthesize`: when proposals stabilize (votes converge, no new reactions for N hours), the synthesis becomes a load-bearing decision draft
- `approve_plan`: the synthesis transitions to an approved plan; action items in the plan become claimable tasks via the execute loop

The shape is closer to "GitHub PR review for decisions" than "Slack thread." Each artifact is queryable, auditable, and convertible to follow-up work. None of this matches PRD §5's chat-app exclusion criteria.

**Decision.**

Atelier's MCP tool surface expands from 12 to 18:

**Existing 12 (ADR-040 lock):**
1. `register` (lifecycle)
2. `heartbeat` (lifecycle)
3. `deregister` (lifecycle)
4. `get_context` (discovery)
5. `find_similar` (discovery)
6. `claim` (work)
7. `update` (work)
8. `release` (work)
9. `log_decision` (decisions)
10. `acquire_lock` (locking)
11. `release_lock` (locking)
12. `propose_contract_change` (contracts)

**New 6 (this ADR):**
13. `propose` (brainstorm) — post a structured option set with tradeoffs; FK to optional trace_ids + territory_id
14. `react` (brainstorm) — vote / comment / flag-concern on a proposal; FK to proposal_id + session_id
15. `get_proposals` (brainstorm/discovery) — list open proposals filtered by territory / trace_id / age; surfaces pending-input set
16. `synthesize` (brainstorm) — produce a synthesis from a proposal's reactions; transitions proposal state to `synthesized`; can include action_items for downstream `approve_plan`
17. `approve_plan` (brainstorm) — transition synthesis to approved; action_items become contributions in `open` state; names approver composer
18. `checkpoint` (continuity) — long-running session checkpoint; saves session state hash + token-budget marker for resume; complements `heartbeat` for sessions that pause/resume across hours

**Schema changes (separate migration in implementation PR; not this spec PR):**

- New table: `proposals` (id, project_id, session_id, composer_id, trace_ids text[], territory_id, title, body_markdown, options jsonb, state proposal_state, created_at, synthesized_at, approved_at, approver_composer_id)
- New table: `proposal_reactions` (id, proposal_id, session_id, composer_id, kind reaction_kind, body_markdown, vote_for_option_id, created_at)
- New table: `syntheses` (id, proposal_id, session_id, composer_id, body_markdown, action_items jsonb, created_at)
- New table: `session_checkpoints` (id, session_id, composer_id, body_markdown, token_count int, created_at) — borrowed pattern from Hive's `session_checkpoints`
- New enums: `proposal_state` (open | synthesized | approved | abandoned), `reaction_kind` (vote | concern | clarification | endorse | block)
- RLS policies per ADR-051 pattern: service_role ALL + atelier_runtime SELECT/INSERT scoped via `atelier_current_project_ids()` membership

**Tool naming:** Atelier uses bare names (`propose`, not `hive_propose`). Hive's prefixed naming is BC-internal convention; Atelier's open-market positioning doesn't carry the prefix. The functional behavior is aligned; the names are normalized to Atelier's existing convention.

**Surface lock update:** ADR-040's surface count amends from 12 to 18. Future tool additions still require an ADR. The brainstorm cluster is treated as one cohesive addition (the 6 tools work together; you can't ship `propose` without `react` and `synthesize`).

**What this does NOT decide.**

- The exact wire format / Zod schema for each tool's parameters — implementation detail; lands in the implementation PR.
- Whether the brainstorm cluster auto-generates broadcast events (likely yes per ARCH §6.8 broadcast topology; will be implementation-specific decision).
- The dashboard surface for proposals — covered by the webapp v2 reframe (Inbox surface includes "active brainstorms needing your reaction" per the prior session).
- Whether `approve_plan` requires the territory's `review_role` to approve, or whether any composer can approve (default: composer with `architect` discipline OR territory's `review_role`; refinable in implementation).

**Consequences.**

- BRD-OPEN-QUESTIONS §35 RESOLVED-YES per this ADR. Update §35 from "currently excluded" to "RESOLVED-YES per ADR-054; implementation pending in v1.x M9."
- ADR-040 amended: tool surface expands from 12 to 18.
- ADR-013 (12-tool surface framing) remains directionally correct but the count is now stale; ADR-040 is authoritative.
- PRD §5 ("not a chat app") remains correct AS LONG AS the brainstorm primitives are framed as structured deliberation, not free-form chat. The implementation must enforce this: proposals MUST have a title + body + options structure, NOT a free-form text body.
- Webapp v2 Compose surface adds: New Proposal form, Reaction interaction on existing proposals, Synthesis view, Approve Plan flow.
- Webapp v2 Inbox surface adds: "Active brainstorms needing your reaction" + "Syntheses awaiting your approval" routed by territory's `review_role`.
- The find_similar tool (ADR-049) extends to index proposals + syntheses alongside contributions + decisions + ADRs. Vector retrieval covers the brainstorm corpus too.
- Hive's tool count (~21) and Atelier's expanded count (18) converge on shape; remaining Hive-only tools (`createProject`, `listProjects`, `status`, `branchMerged`) are either covered differently in Atelier (multi-tenant via repo init; status via get_context; branchMerged via webhook handler) or out-of-scope (createProject as Atelier handles via filesystem repo creation, not API).

**Re-evaluation triggers.**

- The brainstorm primitives ship and adopters report them as ceremony rather than value → re-evaluate whether the structure is too heavy for adopter workflows. (Hive's evidence is BC-internal; non-BC adopters may have different expectations.)
- Vote / reaction kinds prove insufficient → expand `reaction_kind` enum via a new ADR.
- The brainstorm-to-task bridge (synthesis → action_items → contributions) proves brittle (e.g., contributions don't carry enough context from the synthesis to be actionable) → revisit the synthesis schema.
- Hive evolves the brainstorm primitives (e.g., adds `revoke_approval`, `link_proposal_to_proposal` for chains) → consider follow-up ADR adopting the new primitives if production evidence warrants.
