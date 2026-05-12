---
id: ADR-058
trace_id: BRD:Epic-2
category: architecture
session: 2026-05-12-g3-session-checkpoints
composer: nino-chavez
timestamp: 2026-05-12T00:00:00Z
---

# Session checkpoints for long-running session resume (G3 of webapp v2 substrate gates)

**Summary.** Atelier adds a `session_checkpoints` table and the `checkpoint` MCP tool (the 6th and final tool of the ADR-054 brainstorm-cluster expansion), taking the tool surface from 17 to 18. Checkpoints are append-only opt-in artifacts that let a session serialize its working context (compacted body_markdown + token budget) so a later session — same composer, possibly different process or surface — can resume from the same point. The tool ships in two actions: `capture` (write the body + token count under the caller's composer) and `restore` (read a prior checkpoint into a newly-registered session). The shape is borrowed from Hive's `session_checkpoints` per ADR-053 (Atelier-Hive paired substrates) and closes the open-item recorded at `atelier-dashboard-blueprint/docs/content/integration.md` pre-flight line 30 ("New ADR drafted for session checkpoints (none exists yet per research/substrate-inventory.md:41)").

**Rationale.**

Long-running agent sessions (multi-hour autonomous loops, overnight builds, human-led architecture walks across days) regularly outlive their original process. The existing `sessions` table is operational-only per ADR-036: it carries presence + heartbeat state and may be reaped when stale. Without an opt-in continuity primitive, the agent that resumes after a process restart loses every byte of compacted context the original session accumulated.

Hive solved this with a `session_checkpoints` table where the agent periodically writes a structured digest (markdown summary of decisions, open questions, current goal) plus a token-budget marker (so the resumer knows what context window cost the predecessor already paid). The shape is intentionally narrow: not a full transcript (transcripts live as repo-sidecar files per ADR-024), not a state machine (lifecycle transitions live on contributions per ADR-034), just a flat append-only log that a resume can read.

The brainstorm-cluster expansion in ADR-054 §54 reserved the 6th tool slot for `checkpoint` and pinned the schema shape. This ADR formalizes the schema, the two RPC entry points, and the RLS posture; it is the implementation companion to ADR-054 §57.

**Decision.**

1. **Table `session_checkpoints`** with columns:
   - `id uuid PRIMARY KEY`
   - `project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE`
   - `session_id uuid REFERENCES sessions(id) ON DELETE SET NULL` (ADR-036: session_id is operational; the checkpoint outlives the session)
   - `composer_id uuid NOT NULL REFERENCES composers(id)` (ADR-036: composer_id is immortal author)
   - `body_markdown text NOT NULL` (compacted digest; tool boundary trims and validates non-empty)
   - `token_count int NOT NULL CHECK (token_count >= 0)`
   - `created_at timestamptz NOT NULL DEFAULT now()`
   - Indexes: `(composer_id, created_at DESC)` (resume picks most recent), `(session_id)` (active-session lookup), `(project_id)` (RLS support).
   - Append-only: no UPDATE / DELETE policy at the runtime tier; checkpoints accrete and the resumer chooses one.

2. **Two RPCs** (vanilla Postgres `LANGUAGE plpgsql`, ADR-029 portable):
   - `atelier_checkpoint_capture(p_session_id, p_composer_id, p_project_id, p_body, p_tokens) RETURNS uuid` — verifies `(p_session_id, p_composer_id, p_project_id)` is a real session, INSERTs the row, returns its id. AtelierClient resolves the composer + project from `loadSessionContext` before calling, identical to the brainstorm cluster.
   - `atelier_checkpoint_restore(p_checkpoint_id, p_composer_id) RETURNS (body_markdown, token_count, original_session_id, composer_id)` — read-only; verifies `composer_id` matches the checkpoint's owner; returns the fields the resumer needs to rehydrate. Restore does not mutate state (no "consumed" flag), so the same checkpoint can be restored more than once if a new branch wants the same starting point.

3. **MCP tool `checkpoint`** dispatched at the endpoint with `action: 'capture' | 'restore'` discriminator:
   - `capture`: `{ session_id, body, tokens }` → `{ checkpoint_id, created_at }` + emits `session.checkpoint_captured` broadcast event and `session.checkpoint_captured` telemetry row.
   - `restore`: `{ checkpoint_id, new_session_id }` → `{ body_markdown, token_count, original_session_id, composer_id }` + emits `session.checkpoint_restored` broadcast event and telemetry row. The `new_session_id` parameter exists so the broadcast payload can report the rehydration target (subscribers / dashboards can surface "session X resumed from checkpoint of session Y").

4. **RLS** mirrors `sessions` (migration `20260508000016_atelier_rls_policies.sql:226-244`):
   - `service_role` FOR ALL bypass (sync paths, migrations, eval harnesses).
   - `atelier_runtime + authenticated` SELECT scoped to `composer_id = atelier_current_composer_id() AND project_id = ANY(atelier_current_project_ids())`. Checkpoints are own-composer scoped (not project-wide visible) — they are working memory for the author, not coordination state for the project.
   - `atelier_runtime + authenticated` INSERT requires `composer_id = atelier_current_composer_id() AND project_id = atelier_current_project_id()`.
   - No UPDATE / DELETE policy; checkpoints are append-only at the runtime tier.

5. **Tool surface lock update.** ADR-054 §Surface lock update specified the eventual 18-tool count. G3 lands `checkpoint` and the surface is now locked at 18. `dispatch.ts`'s `_seventeenCheck: 17` assertion flips to `_eighteenCheck: 18`; the three surface-count smokes (`endpoint.smoke.ts`, `transport.smoke.ts`, `real-client.smoke.ts`) update from 17 to 18 in lockstep.

**What this does NOT decide.**

- The exact prompt template the agent uses to compose a checkpoint body. That's adopter-specific tooling; the substrate just stores the markdown.
- A retention / pruning policy. Checkpoints are unbounded at v1; if a project produces enough to matter (the long tail is small at v1 expected usage), a separate ADR can codify a TTL or a "keep last N per composer" rule.
- Whether checkpoint contents are indexed by `find_similar`. Today they are not. A future ADR can include them in the embedding corpus if cross-session resume retrieval proves valuable.
- A surfacing UI in the webapp. The phase-2 IA reframe (Compose / Inbox / Activity / Atlas / Connect per ADR-055) will decide where checkpoint capture/restore lives; per the defer-UI-affordance memory rule, substrate ships first and UI follows real-use signal.

**Consequences.**

- Tool surface expands from 17 to 18; ADR-040 surface-lock count amends in lockstep.
- ADR-054 §54-61 + §Schema changes are fully realized (G1 shipped the 5 brainstorm tools + 3 tables; G3 ships the 6th tool + 1 table).
- `atelier-dashboard-blueprint/docs/content/integration.md` pre-flight line 30 RESOLVED — ADR drafted as part of G3.
- Phase 1 of webapp v2 substrate gates closes; Phase 2 (IA reframe — Compose first per DP-7) opens.
- Adopters get a continuity primitive that complements `heartbeat` (presence) and the reap job (cleanup): sessions can die, checkpoints persist.

**Re-evaluation triggers.**

- Adopters report that the `body_markdown + token_count` shape is too narrow (e.g., need structured "open questions" or "active goals" fields) → revise schema in a follow-up ADR.
- Checkpoint volume per project grows past the point where unbounded retention is reasonable → add a TTL / pruning policy.
- A use case emerges where another composer should resume from a different composer's checkpoint (e.g., handoff between humans + agents) → re-evaluate own-composer RLS in favor of project-scoped read; today the conservative default holds.
