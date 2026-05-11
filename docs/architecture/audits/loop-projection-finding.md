---
title: Loop-projection finding (BB Stage 4 Claim 1)
status: substrate-side fix shipped; awaits dashboard PM confirmation
date: 2026-05-11
trace_ids: [ADR-055, ADR-054, BB-Stage4-Claim1]
---

# Loop-projection finding

## What the dashboard observed

BB initiative Stage 4 Claim 1 surfaced "loop column missing" — the
dashboard cannot tag rows in its unified activity feed by the ADR-055
three-loop framing (brainstorm / execute / continuity) without a
substrate-side hint per row.

## The naive fix (rejected)

```sql
ALTER TABLE contributions ADD COLUMN loop atelier_loop NOT NULL;
ALTER TABLE decisions     ADD COLUMN loop atelier_loop NOT NULL;
```

This is **spec-accretion**. Per ADR-055, the loop is fixed by which
tool produced the row, and tools write to distinct tables:

| Loop       | Tools                                              | Target table(s)                                    |
| ---------- | -------------------------------------------------- | -------------------------------------------------- |
| brainstorm | propose, react, synthesize, approve_plan           | proposals, syntheses (ADR-054; not yet migrated)   |
| execute    | claim, update, release, locks, contracts           | contributions                                      |
| continuity | log_decision, checkpoint, register, heartbeat      | decisions, session_checkpoints, sessions           |

A `contributions.loop` column would always equal `'execute'`. A
`decisions.loop` column would always equal `'continuity'`. The
column carries no signal; it duplicates the table identity. New
write-path constraints + new migration risk for zero query benefit.

## The substrate-side fix shipped

`supabase/migrations/20260511000019_atelier_loop_activity_view.sql`
creates `atelier_loop_activity` — a UNION-ALL view across the
contributions + decisions tables that projects:

- `loop`              — synthetic literal per source table
- `source_kind`       — `'contribution'` | `'decision'`
- `source_id`         — primary key of the source row (for drill-down)
- `project_id`        — for filtering
- `author_composer_id`
- `trace_ids`
- `state_or_category` — contributions.state or decisions.category (text)
- `row_kind`          — contributions.kind (NULL for decisions)
- `summary`           — contributions.content_ref or decisions.summary
- `created_at`, `updated_at`

The view extends via `CREATE OR REPLACE` when ADR-054 brainstorm
tables land. Dashboard queries the view once; backend grows under it.

## Open question for dashboard PM

The substrate-side fix assumes the dashboard wants a **unified feed
with loop tags**. If the actual need is different — for example:

- Three separate per-loop feeds (no UNION needed; query each table directly)
- Per-row writes to set a custom loop hint (e.g., a contribution authored
  inside a brainstorm sub-context that should display as brainstorm-loop)
- Drill-down from a brainstorm proposal to the contribution it spawned
  (cross-loop linkage rather than per-row tagging)

— the view does not fit and a different shape is needed.

**Decision asked:** confirm the view matches the dashboard's loop-tagging
need, OR describe the actual UX shape so the right substrate primitive
can be designed.

## Why this matters beyond the immediate finding

Per the `~/.claude/CLAUDE.md` "check existing primitives first" rule:
spec accretion is the recurring failure mode. The BB Stage 4 finding
naming this as a "missing column" was understandable — that's the
shape the dashboard was reaching for — but the right level to push
back is *before* the migration ships, not after. Filing this finding
as a doc rather than silently adding a column also lets the dashboard
PM see the redundancy reasoning rather than working around a column
they don't actually need.

If the dashboard PM responds "yes, view fits," the migration ships
as-is and Claim 1 closes. If they respond "no, we actually need X,"
the view comes out and a different ADR/migration takes its place.
