-- triage_watermarks: per-(project, adapter) polling state for the triage cron.
--
-- Per BRD-OPEN-QUESTIONS §37 PR 2c (CF migration triage orchestrator).
-- Tracks the last successful poll per (project, comment-source adapter) so
-- the triage cron handler's CommentSourceAdapter.fetchSince(date) call only
-- pulls comments newer than the last tick.
--
-- last_external_comment_id is informational (debugging / replay-from-cursor
-- if a future adapter supports id-based pagination); the canonical poll
-- cursor is last_polled_at (timestamp-based, matching the fetchSince signature).
--
-- One row per (project_id, adapter_name) combination. Created lazily on
-- first triage tick for that pair (UPSERT pattern); deleted on project
-- deletion via the FK CASCADE.
--
-- Out-of-scope at v1: cross-region replication of watermarks, watermark
-- rollback for replay scenarios, per-territory watermarks within an adapter
-- (territories share the adapter's poll cursor — if an adapter feeds
-- multiple territories on one project, all advance together). These are
-- adopter-signal-driven follow-ups.

CREATE TABLE IF NOT EXISTS triage_watermarks (
  project_id                uuid         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  adapter_name              text         NOT NULL,
  last_polled_at            timestamptz  NOT NULL DEFAULT (now() - interval '1 hour'),
  last_external_comment_id  text,
  updated_at                timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, adapter_name)
);

COMMENT ON TABLE triage_watermarks IS 'Per-(project, adapter) polling cursor for the triage cron. Default initial last_polled_at is now()-1h so a fresh adapter doesnt drown a brand-new project in historical comments.';

-- RLS posture: triage cron writes via service_role; lens reads (e.g., a
-- future "triage status" panel showing poll freshness) would go through
-- the standard composer-bound path. Per ADR-051 we add the policies now
-- so RLS engagement covers this table from migration time.

ALTER TABLE triage_watermarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY triage_watermarks_service_role_all
  ON triage_watermarks
  FOR ALL TO service_role
  USING (true);

CREATE POLICY triage_watermarks_runtime_select
  ON triage_watermarks
  FOR SELECT TO atelier_runtime
  USING (project_id = ANY (atelier_current_project_ids()));

INSERT INTO atelier_schema_versions
  (filename, content_sha256, applied_by, atelier_template_version)
VALUES
  ('20260509000018_atelier_triage_watermarks.sql', 'bootstrap', 'init', '1.0')
ON CONFLICT (filename) DO NOTHING;
