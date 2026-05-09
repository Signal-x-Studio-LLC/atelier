// RLS smoke test (S09 close, per ADR-051).
//
// Asserts that the table-level RLS policies added in
// supabase/migrations/20260508000016_atelier_rls_policies.sql actually
// engage when the MCP path enters its AsyncLocalStorage context, and
// that cross-composer reads/updates are rejected at the Postgres tier
// (sqlState 42501 or "row-level security" message), NOT just at the
// endpoint-level authorization layer.
//
// The historical class of bugs this guards against:
//   - A handler forgets to scope a query by project_id; without RLS,
//     the row leaks. With RLS, Postgres rejects.
//   - A future refactor introduces a new admin-style query path that
//     bypasses the existing application-code checks.
//
// Run against a fresh local Supabase (`supabase db reset --local` first):
//   DATABASE_URL=... npx tsx scripts/endpoint/__smoke__/rls.smoke.ts

import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { AtelierClient, AtelierError } from '../../sync/lib/write.ts';
import { stubVerifier } from '../lib/auth.ts';
import { dispatch } from '../lib/dispatch.ts';
import {
  runWithRequestContext,
  claimsForContext,
} from '../../sync/lib/request-context.ts';

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  const status = ok ? 'PASS' : 'FAIL';
  const suffix = detail ? `  -- ${detail}` : '';
  console.log(`  ${status}  ${label}${suffix}`);
  if (!ok) failures += 1;
}

// Match Postgres' RLS rejection — sqlState 42501 (insufficient_privilege)
// or the textual "row-level security" / "new row violates" patterns the
// driver surfaces.
function isRlsRejection(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: string }).code;
  if (code === '42501') return true;
  return /row-level security|new row violates|RLS/i.test(err.message);
}

async function main(): Promise<void> {
  const seed = new Client({ connectionString: DB_URL });
  await seed.connect();

  // Per-run uuids: append-only decisions (ADR-005) block cascade delete
  // from projects, so leftover rows from a prior failed run cannot be
  // cleaned up cheaply. Fresh uuids each run avoid the conflict.
  const projectId = randomUUID();
  const composerAId = randomUUID();
  const composerBId = randomUUID();
  const territoryId = randomUUID();
  const subA = `sub-rls-a-${projectId.slice(0, 8)}`;
  const subB = `sub-rls-b-${projectId.slice(0, 8)}`;

  await seed.query(
    `INSERT INTO projects (id, name, repo_url, template_version)
     VALUES ($1, 'rls-smoke', 'https://example.invalid/rls-smoke', '1.0')`,
    [projectId],
  );
  await seed.query(
    `INSERT INTO composers (id, project_id, email, display_name, discipline, identity_subject)
     VALUES ($1, $2, $4, 'Composer A', 'dev', $5),
            ($3, $2, $6, 'Composer B', 'dev', $7)`,
    [
      composerAId,
      projectId,
      composerBId,
      `a-${projectId.slice(0, 8)}@rls.invalid`,
      subA,
      `b-${projectId.slice(0, 8)}@rls.invalid`,
      subB,
    ],
  );
  await seed.query(
    `INSERT INTO territories (id, project_id, name, owner_role, review_role, scope_kind, scope_pattern)
     VALUES ($1, $2, 'rls-territory', 'dev', 'architect', 'files', ARRAY['rls/**'])`,
    [territoryId, projectId],
  );
  await seed.end();

  const client = new AtelierClient({ databaseUrl: DB_URL });
  const deps = { client, verifier: stubVerifier };

  const bearerA = `stub:${subA}`;
  const bearerB = `stub:${subB}`;

  try {
    // -------------------------------------------------------------
    // [1] Sanity: helpers and policies are present
    // -------------------------------------------------------------
    console.log('\n[1] Migration sanity');
    const c = new Client({ connectionString: DB_URL });
    await c.connect();
    try {
      const { rows: roleRows } = await c.query<{ rolname: string }>(
        `SELECT rolname FROM pg_roles WHERE rolname = 'atelier_runtime'`,
      );
      check('role atelier_runtime exists', roleRows.length === 1);

      const { rows: fnRows } = await c.query<{ proname: string }>(
        `SELECT proname FROM pg_proc
          WHERE proname IN ('atelier_current_composer_id', 'atelier_current_project_id', 'atelier_current_project_ids')`,
      );
      check('helper functions present', fnRows.length === 3, `found: ${fnRows.length}`);

      const { rows: policyRows } = await c.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM pg_policies
          WHERE schemaname = 'public' AND policyname LIKE 'atelier_%'`,
      );
      const policyCount = Number(policyRows[0]!.count);
      check('atelier_* policies present (>= 25)', policyCount >= 25, `count: ${policyCount}`);
    } finally {
      await c.end();
    }

    // -------------------------------------------------------------
    // [2] AtelierClient under ALS context: RLS engages on direct queries
    // -------------------------------------------------------------
    console.log('\n[2] RLS engages under ALS-driven SET LOCAL ROLE');

    // Composer A registers a session and claims a contribution
    const aSession = await dispatch(
      { tool: 'register', bearer: bearerA, body: { surface: 'terminal' } },
      deps,
    );
    check('A register ok', aSession.ok, aSession.ok ? '' : aSession.error.message);
    const aSessionId = aSession.ok
      ? (aSession.data as { session_id: string }).session_id
      : '';

    const aClaim = await dispatch(
      {
        tool: 'claim',
        bearer: bearerA,
        body: {
          contribution_id: null,
          session_id: aSessionId,
          kind: 'implementation',
          trace_ids: ['rls-trace-1'],
          territory_id: territoryId,
          content_ref: 'rls/A.md',
          artifact_scope: ['rls/A.md'],
        },
      },
      deps,
    );
    check('A claim creates contribution', aClaim.ok, aClaim.ok ? '' : aClaim.error.message);
    const aContributionId = aClaim.ok
      ? (aClaim.data as { contributionId: string }).contributionId
      : '';

    // -------------------------------------------------------------
    // [3] Composer B's update on A's contribution: rejected at Postgres tier
    // -------------------------------------------------------------
    console.log('\n[3] Cross-composer update rejected by RLS');

    const bSession = await dispatch(
      { tool: 'register', bearer: bearerB, body: { surface: 'terminal' } },
      deps,
    );
    check('B register ok', bSession.ok, bSession.ok ? '' : bSession.error.message);

    // Direct AtelierClient call under composer B's ALS context attempting
    // to update A's contribution by raw UPDATE through tx() -- this
    // exercises the RLS layer, not just the endpoint authorization.
    let directUpdateRejected = false;
    let directUpdateDetail = '';
    try {
      await runWithRequestContext(
        {
          sub: subB,
          composerId: composerBId,
          projectId,
        },
        async () => {
          await (client as unknown as {
            tx: <T>(fn: (c: import('pg').PoolClient) => Promise<T>) => Promise<T>;
          }).tx(async (pgClient) => {
            await pgClient.query(
              `UPDATE contributions SET content_ref = 'rls/HIJACKED.md' WHERE id = $1`,
              [aContributionId],
            );
          });
        },
      );
    } catch (err) {
      // Per Postgres semantics: an UPDATE that touches zero rows under
      // RLS does NOT raise -- it simply returns rowCount=0. The rejection
      // we want to observe is that the row is INVISIBLE for write.
      directUpdateDetail = `unexpected error: ${(err as Error).message}`;
    }

    // Verify the row was NOT actually updated (the RLS USING predicate
    // hides A's row from B's update). Fetch via service_role.
    const verify = new Client({ connectionString: DB_URL });
    await verify.connect();
    try {
      const { rows } = await verify.query<{ content_ref: string }>(
        `SELECT content_ref FROM contributions WHERE id = $1`,
        [aContributionId],
      );
      directUpdateRejected = rows[0]?.content_ref === 'rls/A.md';
      directUpdateDetail = directUpdateDetail || `content_ref now: ${rows[0]?.content_ref}`;
    } finally {
      await verify.end();
    }
    check(
      'B raw UPDATE on A contribution: row unchanged (RLS USING hid the row)',
      directUpdateRejected,
      directUpdateDetail,
    );

    // -------------------------------------------------------------
    // [4] Composer B's INSERT impersonating A: rejected by RLS WITH CHECK
    // -------------------------------------------------------------
    console.log('\n[4] Cross-composer INSERT rejected by RLS WITH CHECK');

    let insertRejected = false;
    let insertDetail = '';
    try {
      await runWithRequestContext(
        {
          sub: subB,
          composerId: composerBId,
          projectId,
        },
        async () => {
          await (client as unknown as {
            tx: <T>(fn: (c: import('pg').PoolClient) => Promise<T>) => Promise<T>;
          }).tx(async (pgClient) => {
            // B attempts to insert a contribution claiming A as author --
            // the WITH CHECK on contributions_insert_policy must reject.
            await pgClient.query(
              `INSERT INTO contributions
                 (project_id, author_composer_id, trace_ids, territory_id,
                  artifact_scope, kind, content_ref)
               VALUES ($1, $2, ARRAY['hijack'], $3, ARRAY['rls/forge.md'],
                       'implementation', 'rls/forge.md')`,
              [projectId, composerAId, territoryId],
            );
          });
        },
      );
    } catch (err) {
      insertRejected = isRlsRejection(err);
      insertDetail = (err as Error).message;
    }
    check('B INSERT spoofing A author rejected (sqlState 42501 / RLS)', insertRejected, insertDetail);

    // -------------------------------------------------------------
    // [5] Composer B can READ A's contribution (same project)
    // -------------------------------------------------------------
    console.log('\n[5] Same-project read permitted by RLS SELECT policy');

    let bReadOk = false;
    let bReadDetail = '';
    try {
      await runWithRequestContext(
        {
          sub: subB,
          composerId: composerBId,
          projectId,
        },
        async () => {
          await (client as unknown as {
            tx: <T>(fn: (c: import('pg').PoolClient) => Promise<T>) => Promise<T>;
          }).tx(async (pgClient) => {
            const { rows } = await pgClient.query<{ id: string }>(
              `SELECT id FROM contributions WHERE id = $1`,
              [aContributionId],
            );
            bReadOk = rows.length === 1 && rows[0]!.id === aContributionId;
          });
        },
      );
    } catch (err) {
      bReadDetail = (err as Error).message;
    }
    check(
      'B SELECT on A contribution returns row (project-scoped read OK)',
      bReadOk,
      bReadDetail,
    );

    // -------------------------------------------------------------
    // [6] Out-of-project: completely different project, B's bearer cannot see
    // -------------------------------------------------------------
    console.log('\n[6] Cross-project isolation by RLS');

    const seed2 = new Client({ connectionString: DB_URL });
    await seed2.connect();
    let foreignProjectId = '';
    let foreignContributionId = '';
    let foreignTerritoryId = '';
    try {
      const { rows: pr } = await seed2.query<{ id: string }>(
        `INSERT INTO projects (name, repo_url, template_version)
         VALUES ('rls-smoke-foreign', 'https://example.invalid/rls-foreign', '1.0')
         RETURNING id`,
      );
      foreignProjectId = pr[0]!.id;
      const { rows: cr } = await seed2.query<{ id: string }>(
        `INSERT INTO composers (project_id, email, display_name, discipline, identity_subject)
         VALUES ($1, 'foreign@rls.invalid', 'Foreign', 'dev', 'sub-rls-foreign')
         RETURNING id`,
        [foreignProjectId],
      );
      const foreignComposerId = cr[0]!.id;
      const { rows: tr } = await seed2.query<{ id: string }>(
        `INSERT INTO territories (project_id, name, owner_role, review_role, scope_kind, scope_pattern)
         VALUES ($1, 'rls-foreign', 'dev', 'architect', 'files', ARRAY['foreign/**'])
         RETURNING id`,
        [foreignProjectId],
      );
      foreignTerritoryId = tr[0]!.id;
      const { rows: fr } = await seed2.query<{ id: string }>(
        `INSERT INTO contributions
           (project_id, author_composer_id, trace_ids, territory_id, artifact_scope, kind, content_ref)
         VALUES ($1, $2, ARRAY['foreign'], $3, ARRAY['foreign/x.md'], 'implementation', 'foreign/x.md')
         RETURNING id`,
        [foreignProjectId, foreignComposerId, foreignTerritoryId],
      );
      foreignContributionId = fr[0]!.id;
    } finally {
      await seed2.end();
    }

    let crossProjectRowsSeen = -1;
    try {
      await runWithRequestContext(
        {
          sub: subB,
          composerId: composerBId,
          projectId,
        },
        async () => {
          await (client as unknown as {
            tx: <T>(fn: (c: import('pg').PoolClient) => Promise<T>) => Promise<T>;
          }).tx(async (pgClient) => {
            const { rows } = await pgClient.query<{ id: string }>(
              `SELECT id FROM contributions WHERE id = $1`,
              [foreignContributionId],
            );
            crossProjectRowsSeen = rows.length;
          });
        },
      );
    } catch (err) {
      // a thrown error is also acceptable evidence of isolation
      crossProjectRowsSeen = -2;
    }
    check(
      'B SELECT on foreign-project contribution: 0 rows visible',
      crossProjectRowsSeen === 0,
      `rows: ${crossProjectRowsSeen}`,
    );

    // -------------------------------------------------------------
    // [7] No ALS context: pool default role retains BYPASSRLS (sync paths)
    // -------------------------------------------------------------
    console.log('\n[7] No ALS context: sync path retains superuser semantics');

    let syncRowSeen = false;
    try {
      await (client as unknown as {
        tx: <T>(fn: (c: import('pg').PoolClient) => Promise<T>) => Promise<T>;
      }).tx(async (pgClient) => {
        const { rows } = await pgClient.query<{ id: string }>(
          `SELECT id FROM contributions WHERE id = $1`,
          [foreignContributionId],
        );
        syncRowSeen = rows.length === 1;
      });
    } catch (err) {
      // shouldn't throw
    }
    check(
      'sync path (no ALS) reads foreign-project row (BYPASSRLS preserved)',
      syncRowSeen,
    );

    // -------------------------------------------------------------
    // [8] Claims envelope shape (regression guard)
    // -------------------------------------------------------------
    console.log('\n[8] claims envelope shape');
    const envelope = JSON.parse(
      claimsForContext({ sub: 'x', composerId: 'cid', projectId: 'pid' }),
    );
    check('envelope has sub', envelope.sub === 'x');
    check('envelope has composer_id', envelope.composer_id === 'cid');
    check('envelope has project_id', envelope.project_id === 'pid');
  } finally {
    await client.close();
  }

  if (failures > 0) {
    console.log(`\n${failures} smoke check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll RLS smoke checks PASS');
}

main().catch((err) => {
  console.error('rls.smoke.ts crashed:', err);
  if (err instanceof AtelierError) {
    console.error('AtelierError code:', err.code, 'details:', err.details);
  }
  process.exit(2);
});
