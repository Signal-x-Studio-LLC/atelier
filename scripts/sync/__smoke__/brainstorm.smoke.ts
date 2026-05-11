#!/usr/bin/env -S npx tsx
//
// G1 brainstorm primitives smoke (ADR-054).
//
// Exercises the cohesive cluster end-to-end:
//   propose -> react -> get_proposals -> synthesize -> approve_plan
// and asserts each synthesis.action_items[*] becomes a contribution in
// state='open' after the approve_plan tx commits (the brainstorm-to-task
// bridge per ADR-054 §Decision).
//
// Per the G1 integration plan, this is the substrate-side acceptance
// gate. The endpoint-side smoke (over MCP transport) lives separately;
// this file talks to AtelierClient directly so the test does not depend
// on auth wiring being live.
//
// Run:  npx tsx scripts/sync/__smoke__/brainstorm.smoke.ts

import { Client } from 'pg';

import { AtelierClient } from '../lib/write.ts';

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  const status = ok ? 'PASS' : 'FAIL';
  const suffix = detail ? `  -- ${detail}` : '';
  // eslint-disable-next-line no-console
  console.log(`  ${status}  ${label}${suffix}`);
  if (!ok) failures += 1;
}

// Unique-per-smoke UUIDs. The shared 11111111-... project_id collides
// with scripts/sync/lib/__smoke__/write.smoke.ts (runs earlier in CI),
// which calls logDecision against that project. ADR-005's append-only
// trigger on decisions then blocks this smoke's DELETE FROM sessions
// (the ON DELETE SET NULL cascade can't NULL decisions.session_id).
// Brainstorm gets its own b... namespace; territory id uses a distinct
// numerical block to stay readable in failure messages.
const PROJECT_ID = 'bbbbbbbb-1111-1111-1111-111111111111';
const PROPOSER_COMPOSER_ID = 'bbbbbbbb-2222-2222-2222-222222222222';
const APPROVER_COMPOSER_ID = 'bbbbbbbb-3333-3333-3333-333333333333';
const VOTER_COMPOSER_ID = 'bbbbbbbb-4444-4444-4444-444444444444';
const TERRITORY_ID = 'bbbbbbbb-5555-5555-5555-555555555555';

async function seed(): Promise<void> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    // Clean prior runs. Deleting the project cascades to composers via
    // their FK, but composers have their own row-level FK; explicit
    // deletes keep the seed deterministic.
    await c.query(`DELETE FROM proposals WHERE project_id = $1`, [PROJECT_ID]);
    await c.query(`DELETE FROM contributions WHERE project_id = $1`, [PROJECT_ID]);
    await c.query(`DELETE FROM sessions WHERE project_id = $1`, [PROJECT_ID]);
    await c.query(`DELETE FROM territories WHERE project_id = $1`, [PROJECT_ID]);
    await c.query(`DELETE FROM composers WHERE project_id = $1`, [PROJECT_ID]);
    await c.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]);

    await c.query(
      `INSERT INTO projects (id, name, repo_url, template_version)
       VALUES ($1, 'smoke-brainstorm', 'https://example.invalid/brainstorm', '1.0')`,
      [PROJECT_ID],
    );
    await c.query(
      `INSERT INTO composers (id, project_id, email, display_name, discipline, identity_subject)
       VALUES
         ($1, $4, 'proposer@brainstorm.invalid', 'Proposer', 'dev',       'sub-brainstorm-proposer'),
         ($2, $4, 'approver@brainstorm.invalid', 'Approver', 'architect', 'sub-brainstorm-approver'),
         ($3, $4, 'voter@brainstorm.invalid',    'Voter',    'pm',        'sub-brainstorm-voter')`,
      [PROPOSER_COMPOSER_ID, APPROVER_COMPOSER_ID, VOTER_COMPOSER_ID, PROJECT_ID],
    );
    await c.query(
      `INSERT INTO territories (id, project_id, name, owner_role, review_role, scope_kind, scope_pattern)
       VALUES ($1, $2, 'brainstorm-territory', 'dev', 'architect', 'files', ARRAY['scripts/brainstorm/**'])`,
      [TERRITORY_ID, PROJECT_ID],
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
    // [0] Register three sessions: proposer, approver, voter
    // -----------------------------------------------------------------
    // eslint-disable-next-line no-console
    console.log('\n[0] register sessions');
    const proposerSession = await client.createSession({
      projectId: PROJECT_ID,
      composerId: PROPOSER_COMPOSER_ID,
      surface: 'terminal',
    });
    const approverSession = await client.createSession({
      projectId: PROJECT_ID,
      composerId: APPROVER_COMPOSER_ID,
      surface: 'terminal',
    });
    const voterSession = await client.createSession({
      projectId: PROJECT_ID,
      composerId: VOTER_COMPOSER_ID,
      surface: 'terminal',
    });
    check('sessions created', typeof proposerSession.id === 'string' && proposerSession.id.length > 0);

    // -----------------------------------------------------------------
    // [1] propose
    // -----------------------------------------------------------------
    // eslint-disable-next-line no-console
    console.log('\n[1] propose');
    const proposed = await client.propose({
      sessionId: proposerSession.id,
      traceIds: ['ADR-054', 'US-2.1'],
      territoryId: TERRITORY_ID,
      title: 'Should we adopt brainstorm primitives?',
      bodyMarkdown: 'Three options for structured deliberation.',
      options: [
        { id: 'opt_a', label: 'Adopt Hive primitives wholesale' },
        { id: 'opt_b', label: 'Build a custom shape', tradeoffs: 'More work; tighter fit' },
        { id: 'opt_c', label: 'Defer to v1.x' },
      ],
    });
    check('proposal created in state=open', proposed.state === 'open');
    check('proposal has uuid id', typeof proposed.proposalId === 'string' && proposed.proposalId.length === 36);

    // Body and options must be NOT NULL — assert the negative cases reject
    let optionsTooShort = false;
    try {
      await client.propose({
        sessionId: proposerSession.id,
        traceIds: ['ADR-054'],
        title: 'bad',
        bodyMarkdown: 'too few options',
        options: [{ id: 'only_one', label: 'only one' }],
      });
    } catch (err) {
      optionsTooShort = (err as { code?: string }).code === 'BAD_REQUEST';
    }
    check('propose with <2 options rejected', optionsTooShort);

    // -----------------------------------------------------------------
    // [2] react: vote + concern + vote-uniqueness conflict
    // -----------------------------------------------------------------
    // eslint-disable-next-line no-console
    console.log('\n[2] react');
    const vote = await client.react({
      sessionId: voterSession.id,
      proposalId: proposed.proposalId,
      kind: 'vote',
      voteForOptionId: 'opt_a',
    });
    check('vote reaction created', typeof vote.reactionId === 'string');

    const concern = await client.react({
      sessionId: approverSession.id,
      proposalId: proposed.proposalId,
      kind: 'concern',
      bodyMarkdown: 'option_b might double our maintenance surface',
    });
    check('concern reaction created', typeof concern.reactionId === 'string');

    let voteConflict = false;
    try {
      await client.react({
        sessionId: voterSession.id,
        proposalId: proposed.proposalId,
        kind: 'vote',
        voteForOptionId: 'opt_b',
      });
    } catch (err) {
      voteConflict = (err as { code?: string }).code === 'CONFLICT';
    }
    check('second vote from same composer rejected (CONFLICT)', voteConflict);

    let badOption = false;
    try {
      await client.react({
        sessionId: approverSession.id,
        proposalId: proposed.proposalId,
        kind: 'vote',
        voteForOptionId: 'opt_does_not_exist',
      });
    } catch (err) {
      badOption = (err as { code?: string }).code === 'BAD_REQUEST';
    }
    check('vote with unknown option_id rejected', badOption);

    // -----------------------------------------------------------------
    // [3] get_proposals: filter by state + trace_ids
    // -----------------------------------------------------------------
    // eslint-disable-next-line no-console
    console.log('\n[3] get_proposals');
    const listed = await client.getProposals({
      sessionId: proposerSession.id,
      state: 'open',
      traceIds: ['ADR-054'],
    });
    check('one open proposal listed', listed.length === 1);
    check('reaction_count reflects two reactions', listed[0]?.reactionCount === 2);
    check('options round-tripped through jsonb', listed[0]?.options.length === 3);

    // -----------------------------------------------------------------
    // [4] synthesize: writes action_items
    // -----------------------------------------------------------------
    // eslint-disable-next-line no-console
    console.log('\n[4] synthesize');
    const synthesis = await client.synthesize({
      sessionId: proposerSession.id,
      proposalId: proposed.proposalId,
      bodyMarkdown: 'Option A wins; promote to two follow-up tasks.',
      actionItems: [
        {
          summary: 'Land schema migration for proposals/reactions/syntheses',
          kind: 'implementation',
          artifactScope: ['supabase/migrations/2026__brainstorm.sql'],
          contentRef: 'supabase/migrations/2026__brainstorm.sql',
        },
        {
          summary: 'Wire MCP handlers for brainstorm cluster',
          kind: 'implementation',
          artifactScope: ['scripts/endpoint/lib/handlers.ts'],
          contentRef: 'scripts/endpoint/lib/handlers.ts',
        },
      ],
    });
    check('synthesis created', synthesis.state === 'synthesized');
    check('synthesis carries two action items', synthesis.actionItemCount === 2);

    // -----------------------------------------------------------------
    // [5] approve_plan: action_items[*] -> open contributions
    // -----------------------------------------------------------------
    // eslint-disable-next-line no-console
    console.log('\n[5] approve_plan');

    let selfApprovalBlocked = false;
    try {
      await client.approvePlan({
        sessionId: proposerSession.id,
        proposalId: proposed.proposalId,
      });
    } catch (err) {
      selfApprovalBlocked = (err as { code?: string }).code === 'FORBIDDEN';
    }
    check('self-approval rejected (FORBIDDEN)', selfApprovalBlocked);

    const approved = await client.approvePlan({
      sessionId: approverSession.id,
      proposalId: proposed.proposalId,
    });
    check('proposal moved to state=approved', approved.state === 'approved');
    check('two contributions promoted from action_items', approved.contributionIds.length === 2);

    // -----------------------------------------------------------------
    // [6] verify contributions exist as state='open' on commit
    // -----------------------------------------------------------------
    // eslint-disable-next-line no-console
    console.log('\n[6] verify post-commit contributions');
    const verify = new Client({ connectionString: DB_URL });
    await verify.connect();
    try {
      const { rows } = await verify.query<{
        id: string;
        state: string;
        territory_id: string;
        trace_ids: string[];
        author_composer_id: string | null;
        kind: string;
      }>(
        `SELECT id, state, territory_id, trace_ids, author_composer_id, kind
           FROM contributions WHERE id = ANY($1::uuid[]) ORDER BY content_ref`,
        [approved.contributionIds],
      );
      check('both action_item contributions persisted', rows.length === 2);
      check('all promoted contributions are state=open', rows.every((r) => r.state === 'open'));
      check('all promoted contributions have no author yet', rows.every((r) => r.author_composer_id === null));
      check('all promoted contributions inherit proposal territory_id', rows.every((r) => r.territory_id === TERRITORY_ID));
      check(
        'trace_ids fall back from proposal when action_item omits',
        rows.every((r) => r.trace_ids.includes('ADR-054') && r.trace_ids.includes('US-2.1')),
      );
      check('action_item kind=implementation respected', rows.every((r) => r.kind === 'implementation'));

      // Telemetry rows landed for each step.
      const { rows: telRows } = await verify.query<{ action: string; count: string }>(
        `SELECT action, count(*) AS count FROM telemetry
          WHERE project_id = $1
            AND action IN ('proposal.created', 'proposal.reacted', 'proposal.synthesized', 'plan.approved')
          GROUP BY action`,
        [PROJECT_ID],
      );
      const byAction = new Map(telRows.map((r) => [r.action, Number(r.count)]));
      check('telemetry: proposal.created emitted', (byAction.get('proposal.created') ?? 0) === 1);
      check('telemetry: proposal.reacted emitted twice', (byAction.get('proposal.reacted') ?? 0) === 2);
      check('telemetry: proposal.synthesized emitted', (byAction.get('proposal.synthesized') ?? 0) === 1);
      check('telemetry: plan.approved emitted', (byAction.get('plan.approved') ?? 0) === 1);
    } finally {
      await verify.end();
    }
  } finally {
    await client.close();
  }

  // eslint-disable-next-line no-console
  console.log('\n=========================================');
  if (failures === 0) {
    // eslint-disable-next-line no-console
    console.log('ALL BRAINSTORM CHECKS PASSED');
  } else {
    // eslint-disable-next-line no-console
    console.log(`${failures} BRAINSTORM CHECK(S) FAILED`);
  }
  // eslint-disable-next-line no-console
  console.log('=========================================');
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('BRAINSTORM SMOKE CRASHED:', err);
  process.exit(2);
});
