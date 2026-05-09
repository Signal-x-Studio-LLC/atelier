---
id: ADR-051
trace_id: BRD:Epic-1
category: architecture
session: s09-rls-and-mcp-path
composer: nino-chavez
timestamp: 2026-05-08T00:00:00Z
---

# Engage RLS on the MCP path via AsyncLocalStorage + per-transaction SET LOCAL (option b); defer the supabase-js-on-MCP migration (option a)

## Context

PR #75 canonicalized the lens path onto `@supabase/ssr` -> PostgREST -> SECURITY DEFINER RPCs (12 RPCs in migration 11). It explicitly deferred the parallel work for the MCP `/api/mcp` request path, which still connects via `AtelierClient` (raw `pg.Pool`) using `POSTGRES_URL` -- the postgres superuser, which carries `BYPASSRLS`.

The M8 grounding audit (S09) flagged two structural gaps that PR #75 did not close:

1. Zero `CREATE POLICY` statements exist anywhere in the schema. RLS is enabled on every table, but the substrate ships with default-deny + zero policies and a superuser connection that bypasses the deny. The lens path's authorization is enforced inside SECURITY DEFINER RPCs that hand-check `project_id`; the MCP path's authorization is enforced inside application code (`scripts/endpoint/lib/auth.ts` resolves a composer from JWT.sub and trusts the rest of the dispatch).
2. With or without policies, the MCP path's superuser connection bypasses RLS structurally. Adding policies alone closes nothing on the MCP path; the connection role must lose `BYPASSRLS` and a viewer identity must be established per request.

S09 cannot close until both gaps close together.

## Decision

Two coordinated changes:

1. **Add table-level RLS policies** per ARCH section 5.3 in a new migration `<TS>_atelier_rls_policies.sql`. Policies key on a server-issued JWT-claims envelope (`request.jwt.claims`) carrying three claims: `sub` (IdP subject), `project_id` (resolved at authenticate-time from `composers.identity_subject`), and `composer_id` (the immortal composer per ADR-036). Policies reference these via two `STABLE` `SECURITY DEFINER` helpers: `atelier_current_composer_id()` and `atelier_current_project_id()`. Sync writers (`scripts/sync/`) keep their service-role/superuser path with `TO service_role USING (true)` policies so M1-M6 sync invariants do not regress.
2. **Engage RLS on the MCP request path via per-transaction `SET LOCAL`** (option b in the rebuild brief), using `AsyncLocalStorage` to flow the per-request auth context into `AtelierClient`'s existing `tx()` / `txWithEvents()` wrappers without changing every public-method signature. Inside `tx()`, when an ALS context is present, the wrapper runs `SELECT set_config('request.jwt.claims', $1, true); SET LOCAL ROLE atelier_runtime;` after `BEGIN`. The role `atelier_runtime` is a non-superuser role created in the same migration that inherits `authenticated`-equivalent grants but does NOT carry `BYPASSRLS`. Sync paths that do not enter the ALS context continue to run as the superuser connection role (no behavior change).

We explicitly REJECT option (a) -- moving the MCP path to `@supabase/ssr` + per-tool SECURITY DEFINER RPCs -- for v1.x. The disqualifier is operational completeness: the MCP path runs Postgres-native primitives that PostgREST does not express naturally, including (i) the fencing-token CAS pattern in `acquire_lock`/`release_lock` (per ADR-004), (ii) `pg_advisory_xact_lock` use inside the migration runner (per ARCH 9), (iii) pgvector custom operators in `find_similar` (per ADR-049), and (iv) the deferred broadcast-publish pattern in `txWithEvents` (per ARCH 6.8 + the in-tx allocator deadlock note in `scripts/sync/lib/write.ts:1909-1927`). Replicating these as SECURITY DEFINER RPCs is feasible but is a v2-shape change, not a v1.x defense-in-depth fix.

## Rationale

### Why option (b) over option (a) at v1.x

The audit's `Fix path` for S09 lists the choice as "Split endpoint DB connection into a non-superuser role with `set_config('request.jwt.claims', ...)` per request OR move to PostgREST/`@supabase/supabase-js` for user-context paths." The brief mirrors this. The deciding factors:

- **Surface preserved.** Option (b) preserves the 12-tool MCP surface contract (ADR-013 + ADR-040) and the compile-time `_twelveCheck: 12` length assertion in `scripts/endpoint/lib/dispatch.ts`. Option (a) changes the in-substrate shape of every tool -- 12 new RPCs, 12 new request shapes, one migration per RPC family for review-ability -- without changing the externally-visible MCP surface. Net cost is high; net benefit on the security axis is the same as option (b).
- **Postgres primitives.** Four substrate features (fencing CAS, advisory locks, pgvector operators, deferred-broadcast tx pattern) are Postgres-native. Lens-side RPCs (migration 11) handle simpler read shapes; the MCP write path is denser. The ratio of "PostgREST-naturally-expresses-this" to "needs RPC" is much lower on the MCP path than on the lens path.
- **Defense-in-depth, not authorization-replacement.** The MCP path's existing application-code authorization stays; RLS becomes the second layer that catches future regressions where a handler forgets a project_id check. Option (a) replaces application-code authorization with RPC-internal authorization; option (b) layers them.
- **Reversibility.** Option (b) is purely additive at the schema and connection layers. If a future M9+ project decides to migrate the MCP path to supabase-js, the policies and helper functions stay; only the access path changes. Option (a) is a one-way refactor.

### Why AsyncLocalStorage (ALS), not a method-signature change

Two alternatives were considered:

- **Thread context through every method signature.** Changes 50+ public-method signatures on `AtelierClient`. Mechanical but high blast radius.
- **A per-request wrapper that exposes the same surface.** Requires a duplicate proxy class with 50+ delegating methods; scope mirrors option-(a)-ish.

ALS is the Node.js-native primitive (`node:async_hooks`) for request-scoped context across awaits. It works on Vercel Functions (Fluid Compute, Node.js 24 LTS). The dispatch layer enters the ALS context once per `tools/call`; `tx()` reads from ALS to decide whether to `SET LOCAL`. No public-method signature changes. The trade-off is a small implicit-context surface that future readers must know about; we mitigate by documenting the ALS in `tx()`'s comment and in the dispatch wrapper.

### Why a new role `atelier_runtime` instead of reusing Supabase's `authenticated`

Supabase's stock `authenticated` role exists in cloud projects but is a Supabase platform convention. For self-hostable OSS portability (per ADR-029, named-adapter discipline), Atelier creates its own role with explicit grants in the migration. Adopters running on Supabase Cloud get the role created alongside the existing `authenticated` role; the policies do not depend on Supabase platform conventions. The role inherits the same intent (no `BYPASSRLS`, table-level grants restricted to what RLS will then filter) but is owned by the Atelier substrate.

## Consequences

### What changes

- New migration: `supabase/migrations/<TS>_atelier_rls_policies.sql`.
  - Creates role `atelier_runtime` with the necessary `GRANT` set (USAGE on schema; SELECT/INSERT/UPDATE/DELETE on the relevant tables; USAGE on sequences).
  - Creates two SECURITY DEFINER helpers: `atelier_current_composer_id()`, `atelier_current_project_id()`.
  - Creates `CREATE POLICY` statements per (table, op) per ARCH 5.3.
  - Adds `TO service_role USING (true)` bypass policies for sync paths.
- `scripts/sync/lib/write.ts`: adds `AsyncLocalStorage`-backed request-context support inside `tx()` / `txWithEvents()`. The 8 direct `this.pool.query` callsites that run on the MCP path are routed through `tx()`. Existing sync paths that do not enter the ALS context retain the existing direct-pool semantics.
- `scripts/endpoint/lib/dispatch.ts`: wraps `tools/call` in `runWithRequestContext(authContext, () => handler(...))`.
- New smoke: `scripts/endpoint/__smoke__/rls.smoke.ts` -- registers two composers in the same project, A claims a contribution, B's session-token attempts read/update on A's contribution; assertion is Postgres-level rejection (sqlState `42501` or "row-level security" message), not endpoint-level 403.
- Updated smoke: `scripts/test/__smoke__/schema-invariants.smoke.ts` -- the existing default-deny baseline (test [3]) is preserved as the "no JWT claims set" branch; a new branch sets JWT claims via `set_config` and asserts the per-policy admit/deny outcomes.

### What does NOT change

- Sync-path semantics (M1 schema migrations, M2 sync writes, M5 embedding ingest, M6 triage). All run as service_role / superuser; the new bypass policies preserve current behavior.
- The 12-tool MCP surface contract.
- The OAuth flow path at `/oauth/api/mcp`.
- The lens path's PostgREST + RPC architecture (per PR #75); RLS policies layer underneath the existing RPCs.
- Bearer validation, JWKS resolution, identity-subject mapping, AuthContext shape -- all preserved.

### Acceptance

1. `rls.smoke.ts` passes against a local Supabase stack (`supabase status` running) with no manual setup beyond `atelier upgrade --apply`.
2. The existing `schema-invariants.smoke.ts [3]` continues to pass (default-deny baseline preserved when no JWT claims set).
3. `cc-mcp-client.smoke.ts`, `real-client.smoke.ts`, `endpoint.smoke.ts`, `transport.smoke.ts`, `find_similar.smoke.ts`, `committer.smoke.ts` all pass after the refactor.
4. M8 audit matrix: S09 row moves from `partial` to `closed`.
5. BRD-OPEN-QUESTIONS section 31 (S09 row): marked RESOLVED with cross-reference to this ADR.

### Migration-runner caveat

The migration runner (per ARCH 9 + S10) uses `pg_advisory_xact_lock(hashtextextended('atelier-migration-runner', 0))` while applying migrations. The `atelier_runtime` role does NOT receive `EXECUTE` on this; the runner continues to run as the superuser connection it already uses. This is intentional: the migration runner is an admin-class operation, not a request-path operation.

### Cross-dimension swap (find_similar / pgvector)

The `find_similar` path runs inside an ALS-scoped tx on the MCP request path (going forward). pgvector operators (`<#>`, etc.) work under any role that has `EXECUTE` on the operator's underlying function, which the `atelier_runtime` grant set covers. The HNSW-index access path is unchanged.

### Open questions deferred (not resolved here)

- The supabase-js-on-MCP migration (option a) is filed in §31 as a v2-shape consideration. The PR #75 split (lens canonical; MCP pg.Pool) stands; closing S09 does not require option (a). If a future need arises (e.g., a managed-Postgres provider that disallows custom roles or `set_config`), option (a) becomes the fallback path.
- The S02 §31 entry (pg.Pool everywhere on the MCP path) remains open as a v2-shape consideration. Closing S09 partially overlaps -- the role boundary now exists -- but the connection-pattern divergence per S02 stays a separate concern.
