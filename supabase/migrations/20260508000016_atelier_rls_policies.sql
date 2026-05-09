-- Atelier RLS policies migration (S09 close).
--
-- Implements ARCH 5.3 row-level authorization. Per ADR-051, this migration
-- adds two structural changes that close the M8 grounding audit's S09
-- finding:
--
--   1. A non-superuser role `atelier_runtime` that the MCP request path
--      assumes per request via SET LOCAL ROLE. It does NOT carry
--      BYPASSRLS, so policies actually engage on its queries.
--
--   2. CREATE POLICY statements per (table, op) per ARCH 5.3, keyed on
--      the JWT sub claim resolved through composers.identity_subject.
--      Sync paths (service_role) get FOR ALL bypass policies so M1 / M2 /
--      M5 / M6 sync invariants do not regress.
--
-- The MCP path's per-request flow (per ADR-051):
--   client -> tools/call -> authenticate() resolves AuthContext
--   -> dispatch wraps handler in AsyncLocalStorage(authContext)
--   -> AtelierClient.tx() reads ALS, runs:
--        SELECT set_config('request.jwt.claims', '{...}', true);
--        SET LOCAL ROLE atelier_runtime;
--      after BEGIN, before any SQL.
--   -> auth.jwt() returns the server-issued claims envelope.
--   -> Policies referencing atelier_current_composer_id() /
--      atelier_current_project_id() resolve via the embedded sub claim.
--   -> COMMIT (which also resets ROLE per Postgres semantics).
--
-- The claims envelope is server-issued AFTER authenticate() succeeds. It
-- carries:
--   - sub:           identity_subject from the validated bearer
--   - composer_id:   the resolved composer.id (immortal per ADR-036)
--   - project_id:    the resolved composer's project_id
-- App-derived claims (composer_id, project_id) are not user-supplied; the
-- bearer only carries `sub`. The policies still cross-check composer_id /
-- project_id against the composers table via the helper functions, so a
-- malformed claims envelope does not grant access beyond what `sub` would
-- have granted alone.
--
-- Trace:
--   BRD: Epic-1 (substrate hardening / S09 close)
--   ADR-027 (reference impl stack), ADR-029 (named-adapter discipline),
--   ADR-036 (composer_id immortal), ADR-051 (this work)
--   Audit: docs/architecture/audits/v1-comprehensive-grounding-audit.md S09

-- =========================================================================
-- 1. Runtime role
-- =========================================================================
--
-- Created idempotently. The role is INHERITed by no one; the MCP path
-- enters it via SET LOCAL ROLE.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atelier_runtime') THEN
    CREATE ROLE atelier_runtime NOLOGIN NOINHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO atelier_runtime;

-- Grant atelier_runtime membership to the connection roles so SET LOCAL
-- ROLE works. By default only members of a role may SET ROLE to it.
-- The MCP path connects as `postgres` (POSTGRES_URL); future-proof for
-- supabase-managed connections by also granting to the standard
-- service_role and authenticated roles.
DO $$
BEGIN
  -- postgres superuser bypasses GRANT machinery, but the explicit grant
  -- documents intent and avoids surprises if connection role changes.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    EXECUTE 'GRANT atelier_runtime TO postgres';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT atelier_runtime TO service_role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    EXECUTE 'GRANT atelier_runtime TO authenticator';
  END IF;
END
$$;

-- Table-level grants. The atelier_runtime role can attempt every operation
-- on every table; RLS policies (added below) determine whether each row
-- is visible/writable. Tables not listed here (atelier_schema_versions,
-- triage_pending, delivery_sync_state, webhook_deliveries) remain
-- service-role-only per ARCH 5.3.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  projects,
  composers,
  sessions,
  territories,
  contributions,
  decisions,
  locks,
  contracts,
  telemetry,
  embeddings
TO atelier_runtime;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO atelier_runtime;

-- The append-only trigger on decisions, the contracts effective_decision
-- generated column, and the updated_at trigger on contributions all run
-- in trigger context (definer's role); no extra grants required.

-- =========================================================================
-- 2. Helper functions
-- =========================================================================
--
-- atelier_current_composer_id(): the calling composer's immortal id, or
--   NULL when no JWT (default-deny works).
-- atelier_current_project_id():  the calling composer's project_id, or
--   NULL.
-- atelier_current_project_ids(): the set of project_ids the JWT sub is
--   active in. At v1 a sub maps 1:1 to a (project, composer) row; the
--   array form anticipates ADR-015 ("one guild, many projects") cases
--   where a sub spans multiple projects.
--
-- All STABLE + SECURITY DEFINER + SET search_path so they can be called
-- from policies without GRANT-by-row.

CREATE OR REPLACE FUNCTION atelier_current_composer_id() RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
    FROM composers c
   WHERE c.identity_subject = nullif(auth.jwt() ->> 'sub', '')
     AND c.status = 'active'
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION atelier_current_project_id() RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.project_id
    FROM composers c
   WHERE c.identity_subject = nullif(auth.jwt() ->> 'sub', '')
     AND c.status = 'active'
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION atelier_current_project_ids() RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(c.project_id), ARRAY[]::uuid[])
    FROM composers c
   WHERE c.identity_subject = nullif(auth.jwt() ->> 'sub', '')
     AND c.status = 'active'
$$;

REVOKE ALL ON FUNCTION atelier_current_composer_id()  FROM public;
REVOKE ALL ON FUNCTION atelier_current_project_id()   FROM public;
REVOKE ALL ON FUNCTION atelier_current_project_ids()  FROM public;

GRANT EXECUTE ON FUNCTION atelier_current_composer_id()  TO atelier_runtime, authenticated, service_role;
GRANT EXECUTE ON FUNCTION atelier_current_project_id()   TO atelier_runtime, authenticated, service_role;
GRANT EXECUTE ON FUNCTION atelier_current_project_ids()  TO atelier_runtime, authenticated, service_role;

COMMENT ON FUNCTION atelier_current_composer_id() IS
  'Resolves the calling composer.id from auth.jwt() sub. Returns NULL when no JWT or no active composer matches. Used in RLS policies.';
COMMENT ON FUNCTION atelier_current_project_id() IS
  'Resolves the calling composer''s project_id from auth.jwt() sub. Returns NULL when no JWT or no active composer matches. Used in RLS policies.';
COMMENT ON FUNCTION atelier_current_project_ids() IS
  'Returns the set of project_ids the calling JWT sub is active in. Used for cross-project read scoping per ADR-015 ("one guild, many projects").';

-- =========================================================================
-- 3. Service-role bypass policies
-- =========================================================================
--
-- Sync paths (M1 schema seed, M2 sync writes, M5 embedding ingest, M6
-- triage worker, all migration runner activity) connect with
-- service_role and require unfettered access. One FOR ALL TO service_role
-- policy per table preserves their behavior. Without these, enabling
-- policies on tables flips the default-deny mode on for service_role too,
-- which would break sync.

CREATE POLICY atelier_service_role_all ON projects        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY atelier_service_role_all ON composers       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY atelier_service_role_all ON sessions        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY atelier_service_role_all ON territories     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY atelier_service_role_all ON contributions   FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY atelier_service_role_all ON decisions       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY atelier_service_role_all ON locks           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY atelier_service_role_all ON contracts       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY atelier_service_role_all ON telemetry       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY atelier_service_role_all ON embeddings      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY atelier_service_role_all ON delivery_sync_state FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY atelier_service_role_all ON webhook_deliveries  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY atelier_service_role_all ON triage_pending      FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =========================================================================
-- 4. Runtime policies (atelier_runtime + authenticated)
-- =========================================================================
--
-- Policies are TO atelier_runtime, authenticated. The atelier_runtime
-- role is the MCP path; authenticated covers the lens path's
-- @supabase/ssr connection. Both roles see the same RLS surface; lens
-- path additionally goes through SECURITY DEFINER RPCs that bypass RLS
-- intentionally for read-shapes too dense for direct table policies.

-- ---------------------------- projects ----------------------------------
CREATE POLICY atelier_projects_select ON projects
  FOR SELECT TO atelier_runtime, authenticated
  USING (id = ANY(atelier_current_project_ids()));

-- INSERT/UPDATE/DELETE on projects: admin operation, service_role only.

-- ---------------------------- composers ---------------------------------
CREATE POLICY atelier_composers_select ON composers
  FOR SELECT TO atelier_runtime, authenticated
  USING (project_id = ANY(atelier_current_project_ids()));

-- INSERT/UPDATE/DELETE on composers: admin operation, service_role only.

-- ---------------------------- sessions ----------------------------------
CREATE POLICY atelier_sessions_select ON sessions
  FOR SELECT TO atelier_runtime, authenticated
  USING (project_id = ANY(atelier_current_project_ids()));

CREATE POLICY atelier_sessions_insert ON sessions
  FOR INSERT TO atelier_runtime, authenticated
  WITH CHECK (
    composer_id = atelier_current_composer_id()
    AND project_id = atelier_current_project_id()
  );

CREATE POLICY atelier_sessions_update ON sessions
  FOR UPDATE TO atelier_runtime, authenticated
  USING (composer_id = atelier_current_composer_id())
  WITH CHECK (composer_id = atelier_current_composer_id());

CREATE POLICY atelier_sessions_delete ON sessions
  FOR DELETE TO atelier_runtime, authenticated
  USING (composer_id = atelier_current_composer_id());

-- ---------------------------- territories -------------------------------
CREATE POLICY atelier_territories_select ON territories
  FOR SELECT TO atelier_runtime, authenticated
  USING (project_id = ANY(atelier_current_project_ids()));

-- INSERT/UPDATE/DELETE on territories: admin operation, service_role only.

-- ---------------------------- contributions -----------------------------
CREATE POLICY atelier_contributions_select ON contributions
  FOR SELECT TO atelier_runtime, authenticated
  USING (project_id = ANY(atelier_current_project_ids()));

CREATE POLICY atelier_contributions_insert ON contributions
  FOR INSERT TO atelier_runtime, authenticated
  WITH CHECK (
    project_id = atelier_current_project_id()
    AND (
      author_composer_id IS NULL
      OR author_composer_id = atelier_current_composer_id()
    )
  );

-- UPDATE: permitted when (a) caller is the author, or (b) caller holds
-- the contribution's territories.review_role (reviewer-driven approval
-- flow per ARCH 5.3 / ARCH 6.2.2 / audit G2). The no-self-approval
-- invariant (caller != author when approving) is enforced by the
-- contributions_no_self_approval table CHECK constraint.
CREATE POLICY atelier_contributions_update ON contributions
  FOR UPDATE TO atelier_runtime, authenticated
  USING (
    project_id = atelier_current_project_id()
    AND (
      author_composer_id = atelier_current_composer_id()
      OR EXISTS (
        SELECT 1
          FROM territories t
          JOIN composers c ON c.id = atelier_current_composer_id()
         WHERE t.id = contributions.territory_id
           AND t.review_role = c.discipline
      )
    )
  )
  WITH CHECK (
    project_id = atelier_current_project_id()
    AND (
      -- Release transition (ARCH 6.2.4) nulls author_composer_id; trust
      -- the USING clause's author/reviewer gate to authorize the row.
      state = 'open'
      OR author_composer_id = atelier_current_composer_id()
      OR EXISTS (
        SELECT 1
          FROM territories t
          JOIN composers c ON c.id = atelier_current_composer_id()
         WHERE t.id = contributions.territory_id
           AND t.review_role = c.discipline
      )
    )
  );

-- DELETE on contributions: not permitted via runtime path. Lifecycle
-- progresses to merged/rejected; rows are kept for audit.

-- ---------------------------- decisions ---------------------------------
-- decisions are append-only via the decisions_block_mutation trigger
-- (ADR-005); no UPDATE / DELETE policy is needed because the trigger
-- rejects those operations regardless of role. Only SELECT and INSERT
-- policies are required at the RLS layer.

CREATE POLICY atelier_decisions_select ON decisions
  FOR SELECT TO atelier_runtime, authenticated
  USING (project_id = ANY(atelier_current_project_ids()));

CREATE POLICY atelier_decisions_insert ON decisions
  FOR INSERT TO atelier_runtime, authenticated
  WITH CHECK (
    project_id = atelier_current_project_id()
    AND author_composer_id = atelier_current_composer_id()
  );

-- ---------------------------- locks -------------------------------------
CREATE POLICY atelier_locks_select ON locks
  FOR SELECT TO atelier_runtime, authenticated
  USING (project_id = ANY(atelier_current_project_ids()));

CREATE POLICY atelier_locks_insert ON locks
  FOR INSERT TO atelier_runtime, authenticated
  WITH CHECK (
    project_id = atelier_current_project_id()
    AND holder_composer_id = atelier_current_composer_id()
  );

CREATE POLICY atelier_locks_update ON locks
  FOR UPDATE TO atelier_runtime, authenticated
  USING (holder_composer_id = atelier_current_composer_id())
  WITH CHECK (holder_composer_id = atelier_current_composer_id());

CREATE POLICY atelier_locks_delete ON locks
  FOR DELETE TO atelier_runtime, authenticated
  USING (holder_composer_id = atelier_current_composer_id());

-- ---------------------------- contracts ---------------------------------
CREATE POLICY atelier_contracts_select ON contracts
  FOR SELECT TO atelier_runtime, authenticated
  USING (project_id = ANY(atelier_current_project_ids()));

-- INSERT/UPDATE/DELETE on contracts: territory-owner gated; flows
-- through service_role / SECURITY DEFINER paths at v1.

-- ---------------------------- telemetry ---------------------------------
CREATE POLICY atelier_telemetry_select ON telemetry
  FOR SELECT TO atelier_runtime, authenticated
  USING (project_id = ANY(atelier_current_project_ids()));

CREATE POLICY atelier_telemetry_insert ON telemetry
  FOR INSERT TO atelier_runtime, authenticated
  WITH CHECK (
    project_id = atelier_current_project_id()
    AND (
      composer_id IS NULL
      OR composer_id = atelier_current_composer_id()
    )
  );

-- No UPDATE / DELETE on telemetry; rows are immutable.

-- ---------------------------- embeddings --------------------------------
CREATE POLICY atelier_embeddings_select ON embeddings
  FOR SELECT TO atelier_runtime, authenticated
  USING (project_id = ANY(atelier_current_project_ids()));

-- INSERT/UPDATE/DELETE on embeddings: ingest path runs as service_role.
-- The MCP path's find_similar reads only.

-- ---------------------------- delivery_sync_state -----------------------
-- Service-role-only at v1 (sync path).

-- ---------------------------- webhook_deliveries ------------------------
-- Service-role-only at v1 (webhook ingest path).

-- ---------------------------- triage_pending ----------------------------
-- Service-role-only at v1 per ARCH 5.3 (triage worker is the only writer;
-- FeedbackQueuePanel reads via the same service-role backend handler).

-- =========================================================================
-- 5. atelier_resolve_viewer GRANT extension
-- =========================================================================
--
-- The lens helper added in migration 11 is granted to authenticated, anon,
-- service_role. atelier_runtime joins that set so the MCP path can call
-- it during diagnostic surfaces (it does not at present, but this avoids
-- a future GRANT migration if the substrate references it).

GRANT EXECUTE ON FUNCTION atelier_resolve_viewer() TO atelier_runtime;

-- =========================================================================
-- 6. Allocator function elevation
-- =========================================================================
--
-- The three monotonic allocators (allocate_fencing_token, allocate_adr_number,
-- allocate_broadcast_seq) UPDATE the projects row to bump per-project
-- counters. atelier_runtime intentionally does not have UPDATE on projects
-- (admin-only). Mark each as SECURITY DEFINER so the counter bump runs
-- with elevated privileges regardless of caller role; this is admin-class
-- bookkeeping, not user-attributable mutation, and the function bodies
-- contain no caller-influenced predicates.
--
-- SET search_path on each function so the SECURITY DEFINER elevation does
-- not leak via search_path injection (vendor recommended pattern).

ALTER FUNCTION allocate_fencing_token(uuid)  SECURITY DEFINER SET search_path = public;
ALTER FUNCTION allocate_adr_number(uuid)     SECURITY DEFINER SET search_path = public;
ALTER FUNCTION allocate_broadcast_seq(uuid)  SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION allocate_fencing_token(uuid)  FROM public;
REVOKE ALL ON FUNCTION allocate_adr_number(uuid)     FROM public;
REVOKE ALL ON FUNCTION allocate_broadcast_seq(uuid)  FROM public;

GRANT EXECUTE ON FUNCTION allocate_fencing_token(uuid)  TO atelier_runtime, authenticated, service_role;
GRANT EXECUTE ON FUNCTION allocate_adr_number(uuid)     TO atelier_runtime, authenticated, service_role;
GRANT EXECUTE ON FUNCTION allocate_broadcast_seq(uuid)  TO atelier_runtime, authenticated, service_role;

-- =========================================================================
-- 7. Sanity check (non-mutating)
-- =========================================================================
--
-- Surface a NOTICE summarizing what was created so the migration runner
-- log shows the policy count for fast-look verification.

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
    FROM pg_policies
   WHERE schemaname = 'public'
     AND policyname LIKE 'atelier_%';
  RAISE NOTICE 'atelier_rls_policies migration: % policies present in public schema', v_count;
END
$$;

-- =========================================================================
-- 8. Self-track in atelier_schema_versions (per migration 14 pattern)
-- =========================================================================
--
-- The Supabase CLI applies migrations directly without populating
-- atelier_schema_versions; the smoke at scripts/test/__smoke__/schema-
-- invariants.smoke.ts checks that every migration file has a tracking
-- row. Self-tracking here keeps that smoke green on `supabase start`
-- and `supabase db reset` paths. The 'bootstrap' sentinel sidesteps the
-- self-referential SHA chicken-and-egg per migration 14's note.

INSERT INTO atelier_schema_versions
  (filename, content_sha256, applied_by, atelier_template_version)
VALUES
  ('20260508000016_atelier_rls_policies.sql', 'bootstrap', 'init', '1.0')
ON CONFLICT (filename) DO NOTHING;
