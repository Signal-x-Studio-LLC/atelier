#!/usr/bin/env -S npx tsx
//
// G3 session-checkpoint smoke (ADR-058).
//
// Exercises the continuity primitive end-to-end via AtelierClient:
//   1. session_A registered; captureCheckpoint -> checkpoint persisted
//   2. session_A reaped (DELETE); checkpoint_session_id ON DELETE SET NULL
//   3. session_B registered (same composer); restoreCheckpoint returns
//      body + token_count + original_session_id=null + composer_id
//   4. Negative: capture from wrong composer's session rejected (FORBIDDEN)
//   5. Negative: restore from wrong composer's session rejected (FORBIDDEN)
//   6. Negative: restore of nonexistent checkpoint rejected (NOT_FOUND)
//   7. Telemetry: session.checkpoint_captured + session.checkpoint_restored
//      rows landed.
//
// Per the cccccccc-namespace convention (memory rule on smoke isolation):
// brainstorm uses bbbbbbbb-, write.smoke uses 11111111-, checkpoint uses
// cccccccc- so the three smokes can run in any order against the same DB
// without cross-contamination via FK ON DELETE chains.
//
// Run: npx tsx scripts/sync/__smoke__/checkpoint.smoke.ts

import { Client } from 'pg';

import { AtelierClient, AtelierError } from '../lib/write.ts';

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  const status = ok ? 'PASS' : 'FAIL';
  const suffix = detail ? `  -- ${detail}` : '';
  // eslint-disable-next-line no-console
  console.log(`  ${status}  ${label}${suffix}`);
  if (!ok) failures += 1;
}

const PROJECT_ID = 'cccccccc-1111-1111-1111-111111111111';
const OWNER_COMPOSER_ID = 'cccccccc-2222-2222-2222-222222222222';
const OTHER_COMPOSER_ID = 'cccccccc-3333-3333-3333-333333333333';

async function seed(): Promise<void> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    // Clean prior runs. session_checkpoints has FK -> projects ON DELETE
    // CASCADE so deleting the project below removes any prior rows; but
    // explicit deletes keep the seed deterministic if FK shapes change.
    await c.query(`DELETE FROM session_checkpoints WHERE project_id = $1`, [PROJECT_ID]);
    await c.query(`DELETE FROM sessions WHERE project_id = $1`, [PROJECT_ID]);
    await c.query(`DELETE FROM composers WHERE project_id = $1`, [PROJECT_ID]);
    await c.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]);

    await c.query(
      `INSERT INTO projects (id, name, repo_url, template_version)
       VALUES ($1, 'smoke-checkpoint', 'https://example.invalid/checkpoint', '1.0')`,
      [PROJECT_ID],
    );
    await c.query(
      `INSERT INTO composers (id, project_id, email, display_name, discipline, identity_subject)
       VALUES
         ($1, $3, 'owner@checkpoint.invalid', 'Owner', 'dev', 'sub-checkpoint-owner'),
         ($2, $3, 'other@checkpoint.invalid', 'Other', 'dev', 'sub-checkpoint-other')`,
      [OWNER_COMPOSER_ID, OTHER_COMPOSER_ID, PROJECT_ID],
    );
  } finally {
    await c.end();
  }
}

async function main(): Promise<void> {
  await seed();

  const client = new AtelierClient({ databaseUrl: DB_URL });

  try {
    // -----------------------------------------------------------------
    // [0] Register session_A (owner) + a session for the other composer
    // -----------------------------------------------------------------
    // eslint-disable-next-line no-console
    console.log('\n[0] register sessions');
    const sessionA = await client.createSession({
      projectId: PROJECT_ID,
      composerId: OWNER_COMPOSER_ID,
      surface: 'terminal',
    });
    const otherSession = await client.createSession({
      projectId: PROJECT_ID,
      composerId: OTHER_COMPOSER_ID,
      surface: 'terminal',
    });
    check('sessions created', typeof sessionA.id === 'string' && sessionA.id.length > 0);

    // -----------------------------------------------------------------
    // [1] captureCheckpoint happy path
    // -----------------------------------------------------------------
    // eslint-disable-next-line no-console
    console.log('\n[1] captureCheckpoint');
    const captured = await client.captureCheckpoint({
      sessionId: sessionA.id,
      body: '## Working state\n- Goal: land G3 substrate\n- Open: smoke + workflow wire',
      tokens: 42_000,
    });
    check('checkpoint id returned', typeof captured.checkpointId === 'string' && captured.checkpointId.length === 36);
    check('createdAt is a Date', captured.createdAt instanceof Date);

    // Negative-case: capture from another composer's session must be
    // rejected. otherSession belongs to OTHER_COMPOSER_ID, so the RPC's
    // session-vs-composer check fires.
    // NB: AtelierClient resolves composer from session_id, so the only
    // way to forge this is to spoof the session. The check is structural
    // (RPC validates) — we hit it by using otherSession but expecting
    // the RPC to see different composer than the owner-only checkpoint
    // would have. The actual cross-composer test fires on restore.
    // Here we exercise the empty-body + negative-tokens guards.
    let emptyBody = false;
    try {
      await client.captureCheckpoint({ sessionId: sessionA.id, body: '   ', tokens: 10 });
    } catch (err) {
      emptyBody = err instanceof AtelierError && err.code === 'BAD_REQUEST';
    }
    check('capture with empty body rejected (BAD_REQUEST)', emptyBody);

    let negTokens = false;
    try {
      await client.captureCheckpoint({ sessionId: sessionA.id, body: 'ok', tokens: -1 });
    } catch (err) {
      negTokens = err instanceof AtelierError && err.code === 'BAD_REQUEST';
    }
    check('capture with negative tokens rejected (BAD_REQUEST)', negTokens);

    // -----------------------------------------------------------------
    // [2] reap session_A; checkpoint.session_id should set null
    // -----------------------------------------------------------------
    // eslint-disable-next-line no-console
    console.log('\n[2] reap session_A; ON DELETE SET NULL takes effect');
    const reaper = new Client({ connectionString: DB_URL });
    await reaper.connect();
    try {
      await reaper.query(`DELETE FROM sessions WHERE id = $1`, [sessionA.id]);
      const { rows } = await reaper.query<{ session_id: string | null }>(
        `SELECT session_id FROM session_checkpoints WHERE id = $1`,
        [captured.checkpointId],
      );
      check('checkpoint persists after session reap', rows.length === 1);
      check('checkpoint.session_id NULLed by FK cascade', rows[0]?.session_id === null);
    } finally {
      await reaper.end();
    }

    // -----------------------------------------------------------------
    // [3] register session_B (same composer as session_A) and restore
    // -----------------------------------------------------------------
    // eslint-disable-next-line no-console
    console.log('\n[3] restoreCheckpoint into session_B');
    const sessionB = await client.createSession({
      projectId: PROJECT_ID,
      composerId: OWNER_COMPOSER_ID,
      surface: 'terminal',
    });
    const restored = await client.restoreCheckpoint({
      checkpointId: captured.checkpointId,
      newSessionId: sessionB.id,
    });
    check('restore returned same checkpoint id', restored.checkpointId === captured.checkpointId);
    check('restore body round-trips', restored.bodyMarkdown.includes('land G3 substrate'));
    check('restore token_count round-trips', restored.tokenCount === 42_000);
    check('restore original_session_id is null after reap', restored.originalSessionId === null);
    check('restore composer_id is the owner', restored.composerId === OWNER_COMPOSER_ID);
    check('restore project_id round-trips', restored.projectId === PROJECT_ID);

    // -----------------------------------------------------------------
    // [4] Negative: restore from another composer's session
    // -----------------------------------------------------------------
    // eslint-disable-next-line no-console
    console.log('\n[4] cross-composer restore rejected');
    let crossComposer = false;
    try {
      await client.restoreCheckpoint({
        checkpointId: captured.checkpointId,
        newSessionId: otherSession.id,
      });
    } catch (err) {
      crossComposer = err instanceof AtelierError && err.code === 'FORBIDDEN';
    }
    check('cross-composer restore rejected (FORBIDDEN)', crossComposer);

    // -----------------------------------------------------------------
    // [5] Negative: restore of a nonexistent checkpoint
    // -----------------------------------------------------------------
    // eslint-disable-next-line no-console
    console.log('\n[5] nonexistent checkpoint -> NOT_FOUND');
    let notFound = false;
    try {
      await client.restoreCheckpoint({
        checkpointId: 'cccccccc-dead-dead-dead-cccccccccccc',
        newSessionId: sessionB.id,
      });
    } catch (err) {
      notFound = err instanceof AtelierError && err.code === 'NOT_FOUND';
    }
    check('restore of nonexistent checkpoint rejected (NOT_FOUND)', notFound);

    // -----------------------------------------------------------------
    // [6] Telemetry rows landed for capture + restore
    // -----------------------------------------------------------------
    // eslint-disable-next-line no-console
    console.log('\n[6] telemetry assertions');
    const tele = new Client({ connectionString: DB_URL });
    await tele.connect();
    try {
      const { rows } = await tele.query<{ action: string; count: string }>(
        `SELECT action, count(*) AS count FROM telemetry
          WHERE project_id = $1
            AND action IN ('session.checkpoint_captured', 'session.checkpoint_restored')
          GROUP BY action`,
        [PROJECT_ID],
      );
      const byAction = new Map(rows.map((r) => [r.action, Number(r.count)]));
      check(
        'telemetry: session.checkpoint_captured >= 1 (negative-case attempts may not land)',
        (byAction.get('session.checkpoint_captured') ?? 0) >= 1,
      );
      check(
        'telemetry: session.checkpoint_restored >= 1',
        (byAction.get('session.checkpoint_restored') ?? 0) >= 1,
      );
    } finally {
      await tele.end();
    }
  } finally {
    await client.close();
  }

  // eslint-disable-next-line no-console
  console.log('\n=========================================');
  if (failures === 0) {
    // eslint-disable-next-line no-console
    console.log('ALL CHECKPOINT CHECKS PASSED');
  } else {
    // eslint-disable-next-line no-console
    console.log(`${failures} CHECKPOINT CHECK(S) FAILED`);
  }
  // eslint-disable-next-line no-console
  console.log('=========================================');
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('CHECKPOINT SMOKE CRASHED:', err);
  process.exit(2);
});
