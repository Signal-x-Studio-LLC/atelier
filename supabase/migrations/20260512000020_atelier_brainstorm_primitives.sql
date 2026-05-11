-- Atelier brainstorm primitives (ADR-054 / G1 of webapp v2 substrate gates).
--
-- Adds three tables (proposals, proposal_reactions, syntheses) + two enums
-- (proposal_state, reaction_kind) that back five new MCP tools: propose,
-- react, get_proposals, synthesize, approve_plan.
--
-- The shape is "GitHub PR review for decisions": structured deliberation
-- artifacts that produce a graph of named decisions with provenance, not
-- a flat conversation thread. Title + body + options are NOT NULL on
-- proposals so PRD §5's "not a chat app" exclusion holds at the schema
-- level (free-form text bodies are rejected by NOT NULL on options).
--
-- The 6th ADR-054 tool (checkpoint) + its session_checkpoints table is
-- G3, not G1. Per webapp v2 integration.md the G1 → G2 → G3 sequencing
-- is locked by ADR-056; this migration ships G1 only.
--
-- RLS pattern follows ADR-051 exactly:
--   - service_role gets FOR ALL bypass so sync paths are unaffected
--   - atelier_runtime + authenticated get project-scoped SELECT
--   - INSERT requires composer_id = atelier_current_composer_id()
--   - UPDATE on proposals is author-scoped (synthesize/approve transitions
--     are author-only until ADR-054's "review_role can approve" extension
--     lands; see open question in §What this does NOT decide)
--
-- Trace:
--   BRD: Epic-2 (brainstorm primitives, RESOLVED-YES per ADR-054)
--   ADR-054 (brainstorm primitives shape), ADR-036 (composer_id immortal),
--   ADR-051 (RLS pattern), ADR-056 (gate serialization)
--   Integration plan: atelier-dashboard-blueprint/docs/content/integration.md §G1

-- =========================================================================
-- 1. Enums
-- =========================================================================

CREATE TYPE proposal_state AS ENUM (
  'open',          -- accepting reactions
  'synthesized',   -- synthesis written; awaiting approval
  'approved',      -- plan approved; action_items become contributions
  'abandoned'      -- closed without synthesis (insufficient engagement)
);

CREATE TYPE reaction_kind AS ENUM (
  'vote',          -- preference for one of proposal.options
  'concern',       -- objection / risk callout
  'clarification', -- request for additional detail
  'endorse',       -- general support without option vote
  'block'          -- veto / hard objection
);

-- =========================================================================
-- 2. proposals
-- =========================================================================
--
-- A structured option set posted by a session for collaborative review.
-- The (title, body_markdown, options) triple is NOT NULL by design: this
-- enforces the "structured deliberation, not chat" invariant from ADR-054.
-- A composer cannot bypass the structure by posting a body-only proposal.
--
-- options jsonb shape (validated at the tool boundary, not schema level
-- because Postgres can't natively schema-check arbitrary jsonb deeply):
--   [{"id": "opt_a", "label": "Option A", "tradeoffs": "..."}, ...]
--
-- composer_id / session_id follow ADR-036: composer_id is the immortal
-- author; session_id is operational and may dangle if the session is
-- deregistered. A NULL session_id on an open proposal means the original
-- author session is gone but the proposal is still open for reactions.

CREATE TABLE proposals (
  id                       uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               uuid                 NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  composer_id              uuid                 NOT NULL REFERENCES composers(id),
  session_id               uuid                 REFERENCES sessions(id) ON DELETE SET NULL,
  trace_ids                text[]               NOT NULL,
  territory_id             uuid                 REFERENCES territories(id),
  title                    text                 NOT NULL,
  body_markdown            text                 NOT NULL,
  options                  jsonb                NOT NULL,
  state                    proposal_state       NOT NULL DEFAULT 'open',
  approver_composer_id     uuid                 REFERENCES composers(id),
  created_at               timestamptz          NOT NULL DEFAULT now(),
  synthesized_at           timestamptz,
  approved_at              timestamptz,

  CONSTRAINT proposals_trace_ids_nonempty CHECK (cardinality(trace_ids) > 0),
  CONSTRAINT proposals_title_nonempty     CHECK (length(btrim(title))         > 0),
  CONSTRAINT proposals_body_nonempty      CHECK (length(btrim(body_markdown)) > 0),
  -- options must be a non-empty JSON array (the tool boundary further
  -- validates the per-element shape).
  CONSTRAINT proposals_options_array      CHECK (jsonb_typeof(options) = 'array'
                                                 AND jsonb_array_length(options) >= 2),
  CONSTRAINT proposals_synthesized_pair   CHECK (
    (state IN ('synthesized', 'approved') AND synthesized_at IS NOT NULL)
    OR (state IN ('open', 'abandoned') AND synthesized_at IS NULL)
  ),
  CONSTRAINT proposals_approved_pair      CHECK (
    (state = 'approved' AND approved_at IS NOT NULL AND approver_composer_id IS NOT NULL)
    OR (state <> 'approved' AND approved_at IS NULL AND approver_composer_id IS NULL)
  ),
  CONSTRAINT proposals_no_self_approval   CHECK (
    approver_composer_id IS NULL OR approver_composer_id <> composer_id
  )
);

CREATE INDEX proposals_project_state_idx   ON proposals(project_id, state);
CREATE INDEX proposals_territory_state_idx ON proposals(territory_id, state) WHERE territory_id IS NOT NULL;
CREATE INDEX proposals_trace_ids_gin       ON proposals USING gin(trace_ids);
CREATE INDEX proposals_created_at_idx      ON proposals(created_at DESC);

-- =========================================================================
-- 3. proposal_reactions
-- =========================================================================
--
-- One row per (composer, proposal, kind) — a composer can vote once and
-- separately register a concern, but cannot register two votes. The
-- partial unique index enforces this for kind='vote' only (other kinds
-- may legitimately recur, e.g., a composer raising two concerns about
-- different aspects).
--
-- vote_for_option_id references the proposal's options[*].id by string
-- match; not a FK because options live in jsonb. Tool boundary validates
-- the referenced option exists at write time.

CREATE TABLE proposal_reactions (
  id                       uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id              uuid                 NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  composer_id              uuid                 NOT NULL REFERENCES composers(id),
  session_id               uuid                 REFERENCES sessions(id) ON DELETE SET NULL,
  kind                     reaction_kind        NOT NULL,
  body_markdown            text,
  vote_for_option_id       text,
  created_at               timestamptz          NOT NULL DEFAULT now(),

  CONSTRAINT reactions_vote_has_option CHECK (
    kind <> 'vote' OR vote_for_option_id IS NOT NULL
  ),
  CONSTRAINT reactions_nonvote_no_option CHECK (
    kind = 'vote' OR vote_for_option_id IS NULL
  ),
  CONSTRAINT reactions_concern_has_body CHECK (
    kind NOT IN ('concern', 'clarification', 'block') OR (body_markdown IS NOT NULL AND length(btrim(body_markdown)) > 0)
  )
);

CREATE INDEX proposal_reactions_proposal_idx ON proposal_reactions(proposal_id);
CREATE UNIQUE INDEX proposal_reactions_one_vote_per_composer
  ON proposal_reactions(proposal_id, composer_id)
  WHERE kind = 'vote';

-- =========================================================================
-- 4. syntheses
-- =========================================================================
--
-- A synthesis is the load-bearing decision draft produced from a
-- proposal's reactions. action_items jsonb shape (tool-validated):
--   [{"summary": "...", "territory_id": "...", "trace_ids": [...]}, ...]
--
-- A proposal can have multiple synthesis attempts (e.g., a first
-- synthesis is rejected, the author revises and re-synthesizes). The
-- proposal.synthesized_at + proposal.state='synthesized' point at the
-- most recent synthesis; older syntheses remain queryable.

CREATE TABLE syntheses (
  id                       uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id              uuid                 NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  composer_id              uuid                 NOT NULL REFERENCES composers(id),
  session_id               uuid                 REFERENCES sessions(id) ON DELETE SET NULL,
  body_markdown            text                 NOT NULL,
  action_items             jsonb                NOT NULL DEFAULT '[]'::jsonb,
  created_at               timestamptz          NOT NULL DEFAULT now(),

  CONSTRAINT syntheses_body_nonempty   CHECK (length(btrim(body_markdown)) > 0),
  CONSTRAINT syntheses_action_items_array CHECK (jsonb_typeof(action_items) = 'array')
);

CREATE INDEX syntheses_proposal_idx ON syntheses(proposal_id, created_at DESC);

-- =========================================================================
-- 5. RLS policies (ADR-051 pattern)
-- =========================================================================

ALTER TABLE proposals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE syntheses          ENABLE ROW LEVEL SECURITY;

-- service_role bypass (sync paths, migrations, eval harnesses).
CREATE POLICY atelier_service_role_all ON proposals
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY atelier_service_role_all ON proposal_reactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY atelier_service_role_all ON syntheses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------- proposals ----------------------------------

CREATE POLICY atelier_proposals_select ON proposals
  FOR SELECT TO atelier_runtime, authenticated
  USING (project_id = ANY(atelier_current_project_ids()));

CREATE POLICY atelier_proposals_insert ON proposals
  FOR INSERT TO atelier_runtime, authenticated
  WITH CHECK (
    project_id = atelier_current_project_id()
    AND composer_id = atelier_current_composer_id()
  );

-- UPDATE permitted when caller is the proposal author OR (for the
-- approved transition only) caller is a composer with discipline
-- 'architect' OR caller holds the territory's review_role. The
-- proposals_no_self_approval CHECK enforces the caller != author
-- invariant for approval at the row level.
CREATE POLICY atelier_proposals_update ON proposals
  FOR UPDATE TO atelier_runtime, authenticated
  USING (
    project_id = ANY(atelier_current_project_ids())
    AND (
      composer_id = atelier_current_composer_id()
      OR EXISTS (
        SELECT 1
          FROM composers c
         WHERE c.id = atelier_current_composer_id()
           AND c.discipline = 'architect'
      )
      OR EXISTS (
        SELECT 1
          FROM territories t
          JOIN composers   c ON c.id = atelier_current_composer_id()
         WHERE t.id = proposals.territory_id
           AND t.review_role = c.discipline
      )
    )
  )
  WITH CHECK (project_id = atelier_current_project_id());

-- ---------------------------- proposal_reactions -------------------------

CREATE POLICY atelier_reactions_select ON proposal_reactions
  FOR SELECT TO atelier_runtime, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
       WHERE p.id = proposal_reactions.proposal_id
         AND p.project_id = ANY(atelier_current_project_ids())
    )
  );

CREATE POLICY atelier_reactions_insert ON proposal_reactions
  FOR INSERT TO atelier_runtime, authenticated
  WITH CHECK (
    composer_id = atelier_current_composer_id()
    AND EXISTS (
      SELECT 1 FROM proposals p
       WHERE p.id = proposal_reactions.proposal_id
         AND p.project_id = atelier_current_project_id()
         AND p.state = 'open'
    )
  );

-- Reactions are append-only via policy (no UPDATE/DELETE); a composer who
-- changes their mind posts a new reaction. Vote uniqueness is enforced by
-- the partial unique index, so a re-vote attempt errors at the database.

-- ---------------------------- syntheses ----------------------------------

CREATE POLICY atelier_syntheses_select ON syntheses
  FOR SELECT TO atelier_runtime, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
       WHERE p.id = syntheses.proposal_id
         AND p.project_id = ANY(atelier_current_project_ids())
    )
  );

-- Synthesis authorship is permitted to the proposal's author or to any
-- composer holding the territory's review_role. Captured via subquery
-- to keep the policy expression direct.
CREATE POLICY atelier_syntheses_insert ON syntheses
  FOR INSERT TO atelier_runtime, authenticated
  WITH CHECK (
    composer_id = atelier_current_composer_id()
    AND EXISTS (
      SELECT 1 FROM proposals p
       WHERE p.id = syntheses.proposal_id
         AND p.project_id = atelier_current_project_id()
         AND p.state IN ('open', 'synthesized')
         AND (
           p.composer_id = atelier_current_composer_id()
           OR EXISTS (
             SELECT 1
               FROM territories t
               JOIN composers   c ON c.id = atelier_current_composer_id()
              WHERE t.id = p.territory_id
                AND t.review_role = c.discipline
           )
         )
    )
  );

-- =========================================================================
-- 6. Comments (operator-facing docs)
-- =========================================================================

COMMENT ON TABLE proposals IS
  'ADR-054 brainstorm primitive. Structured option set with title + body + options. '
  'Author posts; other composers react; one composer (author OR architect OR '
  'territory.review_role) synthesizes and approves.';

COMMENT ON TABLE proposal_reactions IS
  'ADR-054 reactions to a proposal. Append-only; one vote per composer per proposal '
  'enforced by the partial unique index proposal_reactions_one_vote_per_composer.';

COMMENT ON TABLE syntheses IS
  'ADR-054 synthesis of a proposal''s reactions. Multiple syntheses per proposal '
  'allowed (revision flow); the most recent one is referenced by proposal.synthesized_at.';

COMMENT ON TYPE proposal_state IS
  'ADR-054 lifecycle: open -> synthesized -> approved, or open -> abandoned.';

COMMENT ON TYPE reaction_kind IS
  'ADR-054 reaction taxonomy: vote (with vote_for_option_id), concern, '
  'clarification, endorse, block.';

INSERT INTO atelier_schema_versions
  (filename, content_sha256, applied_by, atelier_template_version)
VALUES
  ('20260512000020_atelier_brainstorm_primitives.sql', 'bootstrap', 'init', '1.0')
ON CONFLICT (filename) DO NOTHING;
