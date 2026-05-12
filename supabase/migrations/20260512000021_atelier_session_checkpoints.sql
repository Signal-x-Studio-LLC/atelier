-- Atelier session checkpoints (ADR-058 / G3 of webapp v2 substrate gates).
--
-- Adds the session_checkpoints table + two RPCs (atelier_checkpoint_capture
-- and atelier_checkpoint_restore) that back the 6th and final brainstorm-
-- cluster tool from ADR-054 §54. Tool surface expands from 17 to 18.
--
-- Shape per ADR-058 §Decision:
--   - composer_id is the immortal author (ADR-036); session_id is
--     operational and may dangle (ON DELETE SET NULL).
--   - body_markdown + token_count are NOT NULL; the tool boundary further
--     trims and rejects empty bodies.
--   - Append-only at the runtime tier: no UPDATE / DELETE policy. Caller
--     accretes checkpoints; resumer chooses one. Restore is read-only and
--     does NOT mutate (no "consumed" flag) so a checkpoint can fan out to
--     multiple resume branches.
--
-- RLS pattern mirrors sessions (20260508000016_atelier_rls_policies.sql
-- lines 226-244) per ADR-051:
--   - service_role FOR ALL bypass (sync paths, migrations).
--   - atelier_runtime + authenticated SELECT/INSERT scoped to
--     composer_id = atelier_current_composer_id() (own-composer; checkpoints
--     are working memory for the author, not project-wide coordination
--     state).
--
-- Trace:
--   BRD: Epic-2 (continuity primitives, RESOLVED-YES per ADR-058)
--   ADR-058 (session checkpoints), ADR-054 §57 (tool slot reserved),
--   ADR-036 (immortal composer_id), ADR-051 (RLS pattern),
--   ADR-056 (gate serialization G1 -> G2 -> G3)
--   Integration plan: atelier-dashboard-blueprint/docs/content/integration.md §G3

-- =========================================================================
-- 1. session_checkpoints
-- =========================================================================

CREATE TABLE session_checkpoints (
  id                       uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               uuid                 NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  composer_id              uuid                 NOT NULL REFERENCES composers(id),
  session_id               uuid                 REFERENCES sessions(id) ON DELETE SET NULL,
  body_markdown            text                 NOT NULL,
  token_count              int                  NOT NULL,
  created_at               timestamptz          NOT NULL DEFAULT now(),

  CONSTRAINT session_checkpoints_body_nonempty  CHECK (length(btrim(body_markdown)) > 0),
  CONSTRAINT session_checkpoints_tokens_nonneg  CHECK (token_count >= 0)
);

-- Resume picks most recent for a composer.
CREATE INDEX session_checkpoints_composer_recent_idx
  ON session_checkpoints(composer_id, created_at DESC);

-- Active-session lookup (e.g., "did THIS session post a checkpoint?").
CREATE INDEX session_checkpoints_session_idx
  ON session_checkpoints(session_id)
  WHERE session_id IS NOT NULL;

-- Project-scoped queries (RLS + admin tooling).
CREATE INDEX session_checkpoints_project_idx
  ON session_checkpoints(project_id);

-- =========================================================================
-- 2. RLS policies (ADR-051 pattern; mirrors sessions at the 16-migration
-- lines 226-244)
-- =========================================================================

ALTER TABLE session_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY atelier_service_role_all ON session_checkpoints
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY atelier_session_checkpoints_select ON session_checkpoints
  FOR SELECT TO atelier_runtime, authenticated
  USING (
    composer_id = atelier_current_composer_id()
    AND project_id = ANY(atelier_current_project_ids())
  );

CREATE POLICY atelier_session_checkpoints_insert ON session_checkpoints
  FOR INSERT TO atelier_runtime, authenticated
  WITH CHECK (
    composer_id = atelier_current_composer_id()
    AND project_id = atelier_current_project_id()
  );

-- No UPDATE / DELETE policy: checkpoints append-only at the runtime tier.

-- =========================================================================
-- 3. RPCs
-- =========================================================================
--
-- SECURITY INVOKER so the call inherits the caller's role. AtelierClient
-- resolves composer_id + project_id from loadSessionContext(session_id)
-- before invoking, identical to the brainstorm cluster's resolve-then-
-- insert pattern. Both RPCs validate identity before touching the row.

CREATE OR REPLACE FUNCTION atelier_checkpoint_capture(
  p_session_id  uuid,
  p_composer_id uuid,
  p_project_id  uuid,
  p_body        text,
  p_tokens      int
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_owner uuid;
  v_session_proj  uuid;
  v_checkpoint_id uuid;
BEGIN
  IF p_session_id  IS NULL THEN RAISE EXCEPTION 'session_id is required'  USING ERRCODE = '22023'; END IF;
  IF p_composer_id IS NULL THEN RAISE EXCEPTION 'composer_id is required' USING ERRCODE = '22023'; END IF;
  IF p_project_id  IS NULL THEN RAISE EXCEPTION 'project_id is required'  USING ERRCODE = '22023'; END IF;
  IF p_body IS NULL OR length(btrim(p_body)) = 0 THEN
    RAISE EXCEPTION 'body must be non-empty' USING ERRCODE = '22023';
  END IF;
  IF p_tokens IS NULL OR p_tokens < 0 THEN
    RAISE EXCEPTION 'tokens must be a non-negative integer' USING ERRCODE = '22023';
  END IF;

  SELECT composer_id, project_id
    INTO v_session_owner, v_session_proj
    FROM sessions
   WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session % not found', p_session_id USING ERRCODE = 'P0002';
  END IF;
  IF v_session_owner <> p_composer_id THEN
    RAISE EXCEPTION 'session % does not belong to composer %', p_session_id, p_composer_id
      USING ERRCODE = '42501';
  END IF;
  IF v_session_proj <> p_project_id THEN
    RAISE EXCEPTION 'session % is in a different project', p_session_id
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO session_checkpoints (project_id, composer_id, session_id, body_markdown, token_count)
  VALUES (p_project_id, p_composer_id, p_session_id, p_body, p_tokens)
  RETURNING id INTO v_checkpoint_id;

  RETURN v_checkpoint_id;
END;
$$;

CREATE OR REPLACE FUNCTION atelier_checkpoint_restore(
  p_checkpoint_id uuid,
  p_composer_id   uuid
)
RETURNS TABLE (
  body_markdown        text,
  token_count          int,
  original_session_id  uuid,
  composer_id          uuid,
  project_id           uuid,
  created_at           timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF p_checkpoint_id IS NULL THEN RAISE EXCEPTION 'checkpoint_id is required' USING ERRCODE = '22023'; END IF;
  IF p_composer_id   IS NULL THEN RAISE EXCEPTION 'composer_id is required'   USING ERRCODE = '22023'; END IF;

  SELECT sc.composer_id INTO v_owner
    FROM session_checkpoints sc
   WHERE sc.id = p_checkpoint_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'checkpoint % not found', p_checkpoint_id USING ERRCODE = 'P0002';
  END IF;
  IF v_owner <> p_composer_id THEN
    RAISE EXCEPTION 'checkpoint % does not belong to composer %', p_checkpoint_id, p_composer_id
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT sc.body_markdown,
           sc.token_count,
           sc.session_id,
           sc.composer_id,
           sc.project_id,
           sc.created_at
      FROM session_checkpoints sc
     WHERE sc.id = p_checkpoint_id;
END;
$$;

-- =========================================================================
-- 4. Comments (operator-facing docs)
-- =========================================================================

COMMENT ON TABLE session_checkpoints IS
  'ADR-058 continuity primitive. Append-only compacted-context store per '
  '(composer_id, created_at). session_id is operational (ADR-036) and may '
  'be NULL once the originating session is reaped; composer_id is the '
  'immortal owner. Read scope is own-composer per ADR-058 RLS.';

COMMENT ON FUNCTION atelier_checkpoint_capture(uuid, uuid, uuid, text, int) IS
  'ADR-058 capture entry-point. Validates session belongs to caller composer + '
  'project, then INSERTs a checkpoint row. Returns the new id.';

COMMENT ON FUNCTION atelier_checkpoint_restore(uuid, uuid) IS
  'ADR-058 restore entry-point. Read-only; validates checkpoint belongs to '
  'caller composer; returns body_markdown + token_count + original session_id + '
  'composer_id + project_id + created_at for the resumer to rehydrate.';

-- =========================================================================
-- 5. Schema-versions self-insert (per the migration-must-self-insert rule;
-- two bugs in 24h on 2026-05-11 codified this)
-- =========================================================================

INSERT INTO atelier_schema_versions
  (filename, content_sha256, applied_by, atelier_template_version)
VALUES
  ('20260512000021_atelier_session_checkpoints.sql', 'bootstrap', 'init', '1.0')
ON CONFLICT (filename) DO NOTHING;
