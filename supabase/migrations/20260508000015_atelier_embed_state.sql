-- Atelier v1.x: embed_state queue for webhook-driven re-embed.
--
-- Per ARCH §6.4.2 + §902-905 a `push` event on the project's default
-- branch that touches files under ADR/BRD/PRD/research/** must trigger
-- the embedding pipeline. PR #78 (S12 close) shipped the verifying
-- receiver but only a stub for per-event dispatch. This migration adds
-- the queue row that the GitHub `push` handler writes and a future
-- embed-runner pass drains.
--
-- Why a queue (not inline upsertEmbedding):
--   - The OPENAI adapter call may be slow / rate-limited; webhook
--     handlers must return 200 within the provider's retry window.
--   - The webhook handler does not have OPENAI_API_KEY in its env at
--     deploys that put the embedder in a separate worker (BUILD-SEQUENCE
--     M5+). The queue decouples observation from execution.
--   - Re-extracting chunked corpora (BRD/PRD sections) from a raw file
--     path is a multi-step transformation; the runner already owns that
--     logic.
--
-- The queue is keyed (project_id, artifact_path) UNIQUE so repeated
-- pushes touching the same path UPDATE rather than insert duplicates.
-- observed_commit_sha records the latest sha touching the path so the
-- runner can record provenance.
--
-- Trace:
--   ARCH §6.4.2, §902-905
--   ADR-006 / ADR-041 / ADR-042
--   §31 webhook entry — per-event dispatch wiring (push -> embed).

SET search_path = public;

CREATE TABLE IF NOT EXISTS embed_state (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  artifact_path         text          NOT NULL,
  observed_commit_sha   text,
  status                text          NOT NULL DEFAULT 'pending',
  requested_at          timestamptz   NOT NULL DEFAULT now(),
  processed_at          timestamptz,
  error_message         text,
  CONSTRAINT embed_state_status_chk CHECK (status IN ('pending', 'processing', 'done', 'error')),
  CONSTRAINT embed_state_project_path_uniq UNIQUE (project_id, artifact_path)
);

CREATE INDEX IF NOT EXISTS idx_embed_state_pending
  ON embed_state (project_id, requested_at)
  WHERE status = 'pending';

ALTER TABLE embed_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only on embed_state"
  ON embed_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE embed_state IS
  'Queue of artifact paths needing re-embed; written by webhook push dispatch (ARCH 6.4.2 / 902-905), drained by embed-runner.';

INSERT INTO atelier_schema_versions
  (filename, content_sha256, applied_by, atelier_template_version)
VALUES
  ('20260508000015_atelier_embed_state.sql', 'bootstrap', 'init', '1.0')
ON CONFLICT (filename) DO NOTHING;
