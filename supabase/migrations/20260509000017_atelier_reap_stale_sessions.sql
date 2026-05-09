-- atelier_reap_stale_sessions: marks stale active sessions dead + releases their locks.
--
-- Per ARCH §6.1 (reaper) + ADR-036 (immortal composer identity; session_id
-- on locks is operational, ON DELETE SET NULL fallback) + BRD-OPEN-QUESTIONS
-- §37 PR 2b (CF migration cron-handler implementation).
--
-- Lock release ordering: per ARCH §6.1 the reaper DELETEs locks first, then
-- marks the session dead. The session_id ON DELETE SET NULL on locks is a
-- safety fallback for non-reaper deletion paths, NOT the primary release
-- mechanism — that's intentional release via this function.
--
-- Telemetry: emits one 'session.reaped' row per reaped session so the
-- existing metrics functions (which count `action='session.reaped'` rows
-- per project) populate without further wiring. composer_id captures the
-- session's owning composer for audit attribution.
--
-- Caller: /api/cron/reaper route handler (lands in PR 2b alongside this
-- migration). The handler iterates known projects and calls this function
-- per-project; per-project errors don't fail the cron tick.

CREATE OR REPLACE FUNCTION atelier_reap_stale_sessions(
  p_project_id  uuid,
  p_threshold   interval DEFAULT interval '15 minutes'
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_reaped_session_ids uuid[];
  v_locks_released     bigint := 0;
  v_telemetry_rows     bigint := 0;
BEGIN
  -- 1. Find stale active sessions (single statement; CTE captures the IDs
  --    we'll act on across subsequent steps so set membership stays stable
  --    even if heartbeats arrive mid-transaction).
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_reaped_session_ids
    FROM sessions
   WHERE project_id = p_project_id
     AND status = 'active'
     AND heartbeat_at < (now() - p_threshold);

  IF cardinality(v_reaped_session_ids) = 0 THEN
    RETURN jsonb_build_object(
      'reaped_session_count', 0,
      'locks_released',       0,
      'telemetry_rows',       0
    );
  END IF;

  -- 2. Release locks (ARCH §6.1: explicit DELETE, not the FK SET NULL path).
  WITH released AS (
    DELETE FROM locks
     WHERE session_id = ANY (v_reaped_session_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_locks_released FROM released;

  -- 3. Mark sessions dead.
  UPDATE sessions
     SET status = 'dead'
   WHERE id = ANY (v_reaped_session_ids);

  -- 4. Emit telemetry per reaped session for metrics + observability.
  WITH reaped_sessions AS (
    SELECT id, composer_id FROM sessions WHERE id = ANY (v_reaped_session_ids)
  ),
  inserted AS (
    INSERT INTO telemetry (project_id, composer_id, session_id, action, outcome, metadata)
    SELECT
      p_project_id,
      rs.composer_id,
      rs.id,
      'session.reaped',
      'ok',
      jsonb_build_object(
        'threshold_seconds', extract(epoch FROM p_threshold)::int,
        'locks_released_for_session',
          (SELECT count(*) FROM locks_pre_reap WHERE locks_pre_reap.session_id_orig = rs.id)
      )
    FROM reaped_sessions rs
    -- locks_pre_reap is a no-op CTE here because we already DELETEd above;
    -- the per-session lock-released count is captured at aggregate level
    -- via v_locks_released. Per-session attribution would need a different
    -- shape; deferred until adopter signal needs it.
    LEFT JOIN (SELECT NULL::uuid AS session_id_orig WHERE false) locks_pre_reap ON true
    RETURNING id
  )
  SELECT count(*) INTO v_telemetry_rows FROM inserted;

  RETURN jsonb_build_object(
    'reaped_session_count', cardinality(v_reaped_session_ids),
    'locks_released',       v_locks_released,
    'telemetry_rows',       v_telemetry_rows
  );
END;
$$;

GRANT EXECUTE ON FUNCTION atelier_reap_stale_sessions(uuid, interval) TO authenticated;
GRANT EXECUTE ON FUNCTION atelier_reap_stale_sessions(uuid, interval) TO service_role;

-- Schema-versions tracking row (per migration 14 baseline-extension pattern).
INSERT INTO atelier_schema_versions
  (filename, content_sha256, applied_by, atelier_template_version)
VALUES
  ('20260509000017_atelier_reap_stale_sessions.sql', 'bootstrap', 'init', '1.0')
ON CONFLICT (filename) DO NOTHING;
