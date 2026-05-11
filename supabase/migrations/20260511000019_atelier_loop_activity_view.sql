-- atelier_loop_activity: unified read-side projection of substrate activity
-- across the three-loop framing (ADR-055).
--
-- Surfaced by the BB Stage 4 dashboard finding ("loop column missing"). The
-- naive fix was ALTER TABLE contributions ADD COLUMN loop -- but per ADR-055
-- the loop is fixed by which tool produced the row (and therefore which
-- table the row lives in). A `loop` column on contributions would always
-- equal 'execute'; on decisions, always 'continuity'. Pure accretion.
--
-- The legitimate underlying need is a unified activity feed / timeline /
-- filter-chip surface that ranks rows from multiple tables together with
-- per-row loop tagging. That is a view, not a column.
--
-- Scope today: contributions (execute) + decisions (continuity).
-- ADR-054 brainstorm tables (proposals, syntheses, session_checkpoints)
-- are not yet migrated; when they land, CREATE OR REPLACE VIEW extends
-- this projection with the brainstorm rows.
--
-- Columns are deliberately lossy / dashboard-shaped: enough to render a
-- row in a feed, not enough to replace direct table queries. Drill-down
-- queries the source table via (source_kind, source_id).

CREATE VIEW atelier_loop_activity AS
  SELECT
    'execute'::text                          AS loop,
    'contribution'::text                     AS source_kind,
    c.id                                     AS source_id,
    c.project_id                             AS project_id,
    c.author_composer_id                     AS author_composer_id,
    c.trace_ids                              AS trace_ids,
    c.state::text                            AS state_or_category,
    c.kind::text                             AS row_kind,
    c.content_ref                            AS summary,
    c.created_at                             AS created_at,
    c.updated_at                             AS updated_at
  FROM contributions c

  UNION ALL

  SELECT
    'continuity'::text                       AS loop,
    'decision'::text                         AS source_kind,
    d.id                                     AS source_id,
    d.project_id                             AS project_id,
    d.author_composer_id                     AS author_composer_id,
    d.trace_ids                              AS trace_ids,
    d.category::text                         AS state_or_category,
    NULL::text                               AS row_kind,
    d.summary                                AS summary,
    d.created_at                             AS created_at,
    d.created_at                             AS updated_at
  FROM decisions d;

COMMENT ON VIEW atelier_loop_activity IS
  'Unified read projection of substrate activity tagged by ADR-055 loop. '
  'Extend via CREATE OR REPLACE when ADR-054 brainstorm tables land. '
  'See docs/architecture/audits/loop-projection-finding.md for rationale.';

-- RLS note: views inherit RLS from their underlying tables when invoked
-- via the request-bound role (atelier_runtime per ADR-051). No separate
-- policy needed; the contributions/decisions policies already gate access.
-- Service-role bypass on the base tables propagates through the view.
