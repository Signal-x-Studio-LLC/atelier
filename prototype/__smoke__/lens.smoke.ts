// Smoke test for the M3 /atelier lens substrate.
//
// Exercises:
//   1. Each of the five lens configs returns a view-model populated from
//      the canonical state slice + lens-augmenting queries.
//   2. Lens-appropriate panels are present in config.panels per ADR-017 +
//      NORTH-STAR section 4.
//   3. Lens-appropriate affordances: write surfaces present for the four
//      authoring lenses; absent (canWrite=false) for stakeholder.
//   4. Per-lens kind-weight ordering is reflected in activeContributions:
//      analyst weights research; dev weights implementation; designer
//      weights design; pm + stakeholder uniform.
//   5. Presence indicators show seeded sessions; locks show seeded locks;
//      contracts show seeded contracts; review_queue shows contributions
//      whose territory.review_role matches the viewer's discipline.
//   6. defaultLensFor maps disciplines + access_level correctly.
//   7. Auth failure paths: no bearer -> reason=no_bearer; signed-in user
//      with no composer row -> reason=no_composer (D7 differentiated this
//      from invalid_bearer so the user-facing LensUnauthorized state can
//      render an actionable "ask your admin to invite you" message).
//
// Lives at prototype/__smoke__/ rather than prototype/src/ so Next.js does
// not include it in the build. Import paths reach into prototype/src for
// the lens substrate.
//
// Per canonical-rebuild (ADR-029-aligned, PR #75): the lens runtime now
// goes through @supabase/ssr -> PostgREST -> SECURITY DEFINER RPC and
// PostgREST validates the JWT on every call. This smoke seeds a real
// Supabase Auth user per test composer (admin.createUser +
// signInWithPassword), constructs a Supabase JS client carrying the
// resulting JWT on every request, and passes that client into
// loadLensViewModel via the optional `client` argument. composers.
// identity_subject is set to the Supabase user.id so the SECURITY DEFINER
// RPC's auth.jwt() -> sub -> composer lookup resolves correctly.
//
// Prerequisites: fresh local Supabase (`supabase db reset --local`) on
// the configured POSTGRES_URL, plus SUPABASE_URL / SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY exported (eval "$(supabase status -o env)").

import { Client } from 'pg';
import {
  defaultLensFor,
  LENS_IDS,
  LENS_CONFIGS,
  type LensId,
} from '../src/lib/atelier/lens-config.ts';
import { loadLensViewModel } from '../src/lib/atelier/lens-data.ts';
import type { ServerSupabaseClient } from '../src/lib/atelier/adapters/supabase-ssr.ts';
import {
  deleteAuthUser,
  provisionAuthUser,
  readSupabaseEnvOrDie,
  type ProvisionedAuthUser,
} from './real-auth-helpers.ts';

const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  const status = ok ? 'PASS' : 'FAIL';
  const suffix = detail ? `  -- ${detail}` : '';
  console.log(`  ${status}  ${label}${suffix}`);
  if (!ok) failures += 1;
}

function fakeRequest(lensId: LensId): Request {
  return new Request(`http://internal/atelier/${lensId}`);
}

interface LensComposer {
  composerId: string;
  discipline: 'analyst' | 'dev' | 'pm' | 'designer' | 'architect' | null;
  accessLevel: 'member' | 'admin' | 'stakeholder';
  authUser: ProvisionedAuthUser;
}

async function main(): Promise<void> {
  process.env.POSTGRES_URL = DB_URL;
  const sb = readSupabaseEnvOrDie();

  // Provision real Supabase Auth users for each composer up front. The
  // admin.createUser path requires a service-role key; signInWithPassword
  // is the same OAuth-style password grant real-client.smoke.ts uses.
  const provisioned = {
    analyst: await provisionAuthUser(sb, 'lens-smoke-analyst'),
    dev: await provisionAuthUser(sb, 'lens-smoke-dev'),
    pm: await provisionAuthUser(sb, 'lens-smoke-pm'),
    designer: await provisionAuthUser(sb, 'lens-smoke-designer'),
    stakeholder: await provisionAuthUser(sb, 'lens-smoke-stake'),
    arch: await provisionAuthUser(sb, 'lens-smoke-arch'),
    // Extra: a Supabase user with no matching composer row, for the
    // no_composer auth-failure path.
    orphan: await provisionAuthUser(sb, 'lens-smoke-orphan'),
  } satisfies Record<string, ProvisionedAuthUser>;

  // Wire each provisioned user through to the post-cleanup teardown so
  // every Supabase Auth user is deleted regardless of pass/fail.
  const cleanup = async () => {
    for (const u of Object.values(provisioned)) {
      await deleteAuthUser(sb, u.userId);
    }
  };

  try {
    // ---- seed ----
    const seed = new Client({ connectionString: DB_URL });
    await seed.connect();
    // Reset prior runs. The decisions table has an append-only delete-blocking
    // trigger (ADR-005 / ARCH 7.6); we disable just that trigger for the
    // cascade DELETE so FK constraints still fire (session_replication_role=
    // replica would also bypass cascades, leaving orphan composer/territory
    // rows). This is a smoke-test-only escape; real operators never DELETE
    // decisions.
    await seed.query(`ALTER TABLE decisions DISABLE TRIGGER decisions_block_delete`);
    try {
      await seed.query(`DELETE FROM projects WHERE name LIKE 'lens-smoke%' OR id = $1`, [
        '88888888-1111-1111-1111-111111111111',
      ]);
    } finally {
      await seed.query(`ALTER TABLE decisions ENABLE TRIGGER decisions_block_delete`);
    }

    const projectId    = '88888888-1111-1111-1111-111111111111';
    const analystId    = '88888888-2222-2222-2222-aaaaaaaaaaaa';
    const devId        = '88888888-2222-2222-2222-bbbbbbbbbbbb';
    const pmId         = '88888888-2222-2222-2222-cccccccccccc';
    const designerId   = '88888888-2222-2222-2222-dddddddddddd';
    const stakeholderId= '88888888-2222-2222-2222-eeeeeeeeeeee';
    const archId       = '88888888-2222-2222-2222-ffffffffffff';
    const stratResId   = '88888888-3333-3333-3333-aaaaaaaaaaaa';
    const protocolId   = '88888888-3333-3333-3333-bbbbbbbbbbbb';
    const designId     = '88888888-3333-3333-3333-dddddddddddd';

    await seed.query(
      `INSERT INTO projects (id, name, repo_url, template_version)
       VALUES ($1, 'lens-smoke', 'https://example.invalid/lens', '1.0')`,
      [projectId],
    );

    await seed.query(
      `INSERT INTO composers (id, project_id, email, display_name, discipline, access_level, identity_subject)
       VALUES ($1,  $2, $8,  'Analyst Ana',     'analyst',  'member',      $9),
              ($3,  $2, $10, 'Dev Dee',         'dev',      'member',      $11),
              ($4,  $2, $12, 'PM Pat',          'pm',       'member',      $13),
              ($5,  $2, $14, 'Designer Des',    'designer', 'member',      $15),
              ($6,  $2, $16, 'Stakeholder Sam', NULL,       'stakeholder', $17),
              ($7,  $2, $18, 'Architect Arc',   'architect','member',      $19)`,
      [
        analystId, projectId, devId, pmId, designerId, stakeholderId, archId,
        provisioned.analyst.email,     provisioned.analyst.userId,
        provisioned.dev.email,         provisioned.dev.userId,
        provisioned.pm.email,          provisioned.pm.userId,
        provisioned.designer.email,    provisioned.designer.userId,
        provisioned.stakeholder.email, provisioned.stakeholder.userId,
        provisioned.arch.email,        provisioned.arch.userId,
      ],
    );

    await seed.query(
      `INSERT INTO territories (id, project_id, name, owner_role, review_role, scope_kind, scope_pattern, requires_plan_review)
       VALUES ($1, $2, 'strategy-research', 'analyst',  'pm',       'research_artifact', ARRAY['research/**/*'], false),
              ($3, $2, 'protocol',          'dev',      'dev',      'files',             ARRAY['scripts/**'],    false),
              ($4, $2, 'prototype-design',  'designer', 'designer', 'design_component',  ARRAY['prototype/src/components/**'], false)`,
      [stratResId, projectId, protocolId, designId],
    );

    // Contributions across kinds + states
    await seed.query(
      `INSERT INTO contributions
         (project_id, author_composer_id, author_session_id, trace_ids, territory_id, artifact_scope,
          state, kind, requires_owner_approval, content_ref)
       VALUES
         ($1, $2, NULL, ARRAY['US-1.3'], $3, ARRAY['research/comp.md'],   'in_progress', 'research',       false, 'research/competitive.md'),
         ($1, $2, NULL, ARRAY['US-1.4'], $3, ARRAY['research/red.md'],    'review',      'research',       false, 'research/red-team.md'),
         ($1, $4, NULL, ARRAY['US-2.9'], $5, ARRAY['scripts/sync.ts'],    'claimed',     'implementation', false, 'scripts/sync.ts'),
         ($1, $4, NULL, ARRAY['US-2.1'], $5, ARRAY['scripts/lock.ts'],    'in_progress', 'implementation', false, 'scripts/lock.ts'),
         ($1, $6, NULL, ARRAY['US-3.3'], $7, ARRAY['prototype/src/components/Btn.tsx'], 'review', 'design', true,  'prototype/src/components/Button.tsx')
      `,
      [projectId, analystId, stratResId, devId, protocolId, designerId, designId],
    );

    // Decisions
    await seed.query(
      `INSERT INTO decisions
         (project_id, author_composer_id, trace_ids, category, summary, rationale, repo_commit_sha)
       VALUES
         ($1, $2, ARRAY['US-1.3'], 'research', 'Competitive deploy patterns favor self-host', 'rationale', 'aaaaaaa1'),
         ($1, $3, ARRAY['US-2.9'], 'architecture', 'Fencing tokens monotonic per project', 'rationale', 'bbbbbbb1'),
         ($1, $4, ARRAY['US-3.3'], 'design', 'Tertiary button variant uses token-driven styling', 'rationale', 'ccccccc1')`,
      [projectId, analystId, devId, designerId],
    );

    // Sessions (presence)
    await seed.query(
      `INSERT INTO sessions (project_id, composer_id, surface, agent_client, status, heartbeat_at)
       VALUES ($1, $2, 'web', 'claude.ai',     'active', now() - interval '2 minutes'),
              ($1, $3, 'ide', 'claude-code',   'active', now() - interval '1 minute'),
              ($1, $4, 'web', 'claude.ai',     'active', now())`,
      [projectId, analystId, devId, designerId],
    );

    // Locks (need a contribution + session for the lock holder)
    const { rows: contribRows } = await seed.query<{ id: string }>(
      `SELECT id FROM contributions WHERE project_id = $1 AND kind = 'implementation' ORDER BY created_at LIMIT 1`,
      [projectId],
    );
    const lockContribId = contribRows[0]!.id;
    await seed.query(
      `INSERT INTO locks (project_id, holder_composer_id, contribution_id, artifact_scope, fencing_token)
       VALUES ($1, $2, $3, ARRAY['scripts/sync.ts'], 1),
              ($1, $2, $3, ARRAY['scripts/lock.ts'], 2)`,
      [projectId, devId, lockContribId],
    );

    // Contracts (territory has to exist and contracts table has FK)
    await seed.query(
      `INSERT INTO contracts (project_id, territory_id, name, schema, version, classifier_decision)
       VALUES ($1, $2, 'design_tokens',     '{"v":1}'::jsonb, 1, 'additive'),
              ($1, $2, 'component_variants','{"v":1}'::jsonb, 1, 'breaking')`,
      [projectId, designId],
    );

    await seed.end();

    const lensComposers: Record<LensId | 'arch' | 'orphan', LensComposer> = {
      analyst:     { composerId: analystId,     discipline: 'analyst',     accessLevel: 'member',      authUser: provisioned.analyst },
      dev:         { composerId: devId,         discipline: 'dev',         accessLevel: 'member',      authUser: provisioned.dev },
      pm:          { composerId: pmId,          discipline: 'pm',          accessLevel: 'member',      authUser: provisioned.pm },
      designer:    { composerId: designerId,    discipline: 'designer',    accessLevel: 'member',      authUser: provisioned.designer },
      stakeholder: { composerId: stakeholderId, discipline: null,          accessLevel: 'stakeholder', authUser: provisioned.stakeholder },
      arch:        { composerId: archId,        discipline: 'architect',   accessLevel: 'member',      authUser: provisioned.arch },
      orphan:      { composerId: '',            discipline: null,          accessLevel: 'member',      authUser: provisioned.orphan },
    };

    // ---- defaultLensFor mapping ----
    console.log('\n[0] defaultLensFor mapping');
    check('analyst -> analyst', defaultLensFor({ discipline: 'analyst' }) === 'analyst');
    check('dev -> dev', defaultLensFor({ discipline: 'dev' }) === 'dev');
    check('architect -> dev (closes territories.yaml architect-discipline gap)', defaultLensFor({ discipline: 'architect' }) === 'dev');
    check('pm -> pm', defaultLensFor({ discipline: 'pm' }) === 'pm');
    check('designer -> designer', defaultLensFor({ discipline: 'designer' }) === 'designer');
    check('access_level=stakeholder overrides discipline', defaultLensFor({ discipline: 'analyst', accessLevel: 'stakeholder' }) === 'stakeholder');
    check('null discipline -> analyst fallback', defaultLensFor({ discipline: null }) === 'analyst');

    // ---- per-lens config + view-model ----
    for (const lensId of LENS_IDS) {
      console.log(`\n[lens:${lensId}] config + view-model assertions`);
      const cfg = LENS_CONFIGS[lensId];
      check('config.id matches lensId', cfg.id === lensId);
      if (lensId === 'analyst') {
        check('analyst panels include find_similar', cfg.panels.includes('find_similar'));
        check('analyst panels include review_queue', cfg.panels.includes('review_queue'));
        check('analyst weights research highest', cfg.depth.contributionsKindWeights.research === 3);
        check('analyst canWrite=true', cfg.affordances.canWrite === true);
      }
      if (lensId === 'dev') {
        check('dev panels include locks', cfg.panels.includes('locks'));
        check('dev panels include contracts', cfg.panels.includes('contracts'));
        check('dev weights implementation highest', cfg.depth.contributionsKindWeights.implementation === 3);
      }
      if (lensId === 'pm') {
        check('pm panels include review_queue', cfg.panels.includes('review_queue'));
        check('pm canTriage=true', cfg.affordances.canTriage === true);
        check('pm weights uniform', cfg.depth.contributionsKindWeights.implementation === 1 && cfg.depth.contributionsKindWeights.research === 1);
      }
      if (lensId === 'designer') {
        check('designer panels include feedback_queue', cfg.panels.includes('feedback_queue'));
        check('designer panels include contracts', cfg.panels.includes('contracts'));
        check('designer weights design highest', cfg.depth.contributionsKindWeights.design === 3);
      }
      if (lensId === 'stakeholder') {
        check('stakeholder canWrite=false (read-only)', cfg.affordances.canWrite === false);
        check('stakeholder canTriage=false', cfg.affordances.canTriage === false);
        check('stakeholder panels exclude find_similar', !cfg.panels.includes('find_similar'));
        check('stakeholder panels exclude review_queue', !cfg.panels.includes('review_queue'));
        check('stakeholder panels exclude locks', !cfg.panels.includes('locks'));
        check('stakeholder panels exclude feedback_queue', !cfg.panels.includes('feedback_queue'));
        check('stakeholder panels exclude contracts', !cfg.panels.includes('contracts'));
      }

      // ---- view-model load via real Supabase Auth client ----
      const composer = lensComposers[lensId];
      const client = composer.authUser.client as unknown as ServerSupabaseClient;
      // resolveBearer needs a bearer for the dispatch(get_context) leg; we
      // pass cookies:null and route the JWT through the env-bearer fallback.
      // ATELIER_ALLOW_DEV_BEARER=true gates the env path on; the env value
      // is the real Supabase-issued JWT (not a stub) so the JWKS verifier
      // accepts it identically to a cookie-borne session.
      process.env.ATELIER_ALLOW_DEV_BEARER = 'true';
      process.env.ATELIER_DEV_BEARER = composer.authUser.accessToken;

      const result = await loadLensViewModel(lensId, fakeRequest(lensId), {
        cookies: null,
        client,
      });
      if (!result.ok) {
        check(
          `${lensId} view-model loaded`,
          false,
          `result.ok=false reason=${result.reason} message=${result.message}`,
        );
        continue;
      }
      check(`${lensId} view-model loaded`, true);

      const vm = result.viewModel;
      check(`${lensId} viewer.composerId matches seed`, vm.viewer.composerId === composer.composerId,
        `expected=${composer.composerId} got=${vm.viewer.composerId}`);
      check(`${lensId} viewer.discipline matches seed`,
        (vm.viewer.discipline ?? null) === composer.discipline);
      check(`${lensId} viewer.projectName populated`, typeof vm.viewer.projectName === 'string' && vm.viewer.projectName.length > 0);
      check(`${lensId} territories populated`, vm.territories.length >= 1);
      check(`${lensId} contributionsByState populated`,
        vm.contributionsByState && Object.keys(vm.contributionsByState).length > 0);

      if (lensId === 'analyst') {
        const first = vm.activeContributions[0];
        check(
          'analyst lens surfaces a research-kind contribution first (kind weighting fires)',
          !!first && first.kind === 'research',
          `firstKind=${first?.kind}`,
        );
      }
      if (lensId === 'dev') {
        check(
          'dev lens surfaces locks panel data',
          (vm.locks?.length ?? 0) >= 2,
          `locks.length=${vm.locks?.length ?? 0}`,
        );
        const first = vm.activeContributions[0];
        check(
          'dev lens surfaces an implementation-kind contribution first',
          !!first && first.kind === 'implementation',
          `firstKind=${first?.kind}`,
        );
      }
      if (lensId === 'designer') {
        check(
          'designer lens surfaces contracts panel data',
          (vm.contracts?.length ?? 0) >= 2,
          `contracts.length=${vm.contracts?.length ?? 0}`,
        );
      }
      if (lensId === 'stakeholder') {
        check(
          'stakeholder lens canWrite=false on view-model config',
          vm.config.affordances.canWrite === false,
        );
      }
    }

    // ---- auth-failure paths ----
    console.log('\n[auth] auth-failure paths');

    // no_bearer: a valid signed-in viewer (resolveLensViewer succeeds via
    // the auth-bound supabase client) but the dispatch leg has no bearer
    // available. Clear the env-bearer fallback so resolveBearer returns
    // null and the bearer-guard returns reason='no_bearer'.
    delete process.env.ATELIER_ALLOW_DEV_BEARER;
    delete process.env.ATELIER_DEV_BEARER;
    const noBearerResult = await loadLensViewModel(
      'analyst',
      fakeRequest('analyst'),
      {
        cookies: null,
        client: provisioned.analyst.client as unknown as ServerSupabaseClient,
      },
    );
    check(
      'authed viewer + no dispatch bearer -> reason=no_bearer',
      !noBearerResult.ok && noBearerResult.reason === 'no_bearer',
      noBearerResult.ok ? 'unexpected ok' : `reason=${noBearerResult.reason}`,
    );

    // no_composer: a real signed-in user with no matching composer row.
    process.env.ATELIER_ALLOW_DEV_BEARER = 'true';
    process.env.ATELIER_DEV_BEARER = provisioned.orphan.accessToken;
    const orphanResult = await loadLensViewModel(
      'analyst',
      fakeRequest('analyst'),
      {
        cookies: null,
        client: provisioned.orphan.client as unknown as ServerSupabaseClient,
      },
    );
    check(
      'real signed-in user with no composer row -> reason=no_composer',
      !orphanResult.ok && orphanResult.reason === 'no_composer',
      orphanResult.ok ? 'unexpected ok' : `reason=${orphanResult.reason}`,
    );

    delete process.env.ATELIER_ALLOW_DEV_BEARER;
    delete process.env.ATELIER_DEV_BEARER;

    // ---- result ----
    console.log('');
    if (failures > 0) {
      console.log(`=========================================`);
      console.log(`FAIL: ${failures} assertion(s) failed`);
      console.log(`=========================================`);
      await cleanup();
      process.exit(1);
    }
    console.log(`=========================================`);
    console.log(`ALL LENS SMOKE CHECKS PASSED`);
    console.log(`=========================================`);
    await cleanup();
  } catch (err) {
    await cleanup().catch(() => {});
    throw err;
  }
}

main().catch((err) => {
  console.error('LENS SMOKE CRASHED:', err);
  process.exit(2);
});
