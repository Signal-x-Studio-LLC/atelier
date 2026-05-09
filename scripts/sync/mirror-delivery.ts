#!/usr/bin/env -S npx tsx
//
// mirror-delivery: external delivery tracker -> registry mirror.
//
// Per ARCH 6.5:
//   Trigger: nightly cron
//     Script:
//       1. For each contribution with external issue URL:
//          Pull current delivery-authoritative fields (status, sprint, points, assignee)
//          Upsert into registry's mirror table
//       2. Emit telemetry with sync duration + count
//
// M1 scope: skeleton + adapter dispatch. The "registry's mirror table"
// concretizes when a delivery_sync_state table lands with the GitHub
// adapter at step 4.iv. M1 emits telemetry events carrying the pulled
// fields so the round-trip is observable end-to-end without the table.
//
// CLI:
//   mirror-delivery --once         Run once (default; nightly cron is the deployment shape)
//   mirror-delivery --adapter X    Adapter name (default noop)
//   mirror-delivery --dry-run      Skip writes

import { Client } from 'pg';
import { resolveDeliveryAdapter } from './lib/adapters.ts';
import { registerConfiguredAdapters } from './lib/adapter-registry.ts';

interface Args {
  adapter: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    adapter: process.env.ATELIER_DELIVERY_ADAPTER ?? 'noop',
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--once') {/* default; accepted for symmetry with publish-delivery */}
    else if (a === '--adapter') args.adapter = argv[++i]!;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: mirror-delivery [--once] [--adapter NAME] [--dry-run]');
      process.exit(0);
    }
  }
  return args;
}

async function pullForProject(opts: {
  db: Client;
  projectId: string;
  adapterName: string;
  dryRun: boolean;
}): Promise<{ pulled: number; failed: number }> {
  const { db, projectId, adapterName, dryRun } = opts;
  const adapter = resolveDeliveryAdapter(adapterName);

  // M1 step 4.iv: read directly from delivery_sync_state (replaces the
  // telemetry-derived lookup that step 4.iii used as a deliberate seam).
  const { rows: synced } = await db.query<{
    contribution_id: string;
    external_id: string;
    external_url: string;
  }>(
    `SELECT contribution_id, external_id, external_url
       FROM delivery_sync_state
      WHERE project_id = $1 AND adapter = $2`,
    [projectId, adapter.name],
  );

  let pulled = 0;
  let failed = 0;
  for (const row of synced) {
    try {
      const result = await adapter.pullIssue(row.external_id);
      if (result === null) continue;
      pulled += 1;
      if (!dryRun) {
        await db.query(
          `UPDATE delivery_sync_state
             SET external_state = $1,
                 external_url   = $2,
                 metadata       = metadata || $3::jsonb
           WHERE contribution_id = $4 AND adapter = $5`,
          [
            result.externalState,
            result.externalUrl,
            JSON.stringify({
              assignee: result.assignee,
              sprint: result.sprint,
              points: result.points,
              observedAt: result.observedAt,
            }),
            row.contribution_id,
            adapter.name,
          ],
        );
        await db.query(
          `INSERT INTO telemetry (project_id, action, outcome, metadata)
           VALUES ($1, 'delivery.mirrored', 'ok', $2::jsonb)`,
          [
            projectId,
            JSON.stringify({
              contributionId: row.contribution_id,
              externalId: row.external_id,
              externalUrl: result.externalUrl,
              externalState: result.externalState,
              assignee: result.assignee,
              sprint: result.sprint,
              points: result.points,
              observedAt: result.observedAt,
              adapter: adapter.name,
            }),
          ],
        );
      }
    } catch (err) {
      failed += 1;
      if (!dryRun) {
        await db.query(
          `INSERT INTO telemetry (project_id, action, outcome, metadata)
           VALUES ($1, 'delivery.mirror_failed', 'error', $2::jsonb)`,
          [projectId, JSON.stringify({ contributionId: row.contribution_id, error: String(err) })],
        ).catch(() => {});
      }
      console.error(`[mirror-delivery] pull failed for ${row.external_id}:`, err);
    }
  }
  return { pulled, failed };
}

export interface MirrorDeliveryRunOpts {
  projectId: string;
  adapter?: string;
  dryRun?: boolean;
  databaseUrl?: string;
}

export interface MirrorDeliveryRunResult {
  adapter: string;
  pulled: number;
  failed: number;
  durationMs: number;
  dryRun: boolean;
}

// Programmatic entry shared by the CLI and the /api/cron/mirror-delivery
// route handler (BRD-OPEN-QUESTIONS §37 PR 2 / ADR-052). Owns its own
// pg connection lifecycle so callers don't need to wire one up.
export async function runOnce(opts: MirrorDeliveryRunOpts): Promise<MirrorDeliveryRunResult> {
  const adapter = opts.adapter ?? 'noop';
  const dryRun = opts.dryRun ?? false;
  const dbUrl = opts.databaseUrl ?? process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

  const db = new Client({ connectionString: dbUrl });
  await db.connect();
  registerConfiguredAdapters();
  try {
    const start = Date.now();
    const result = await pullForProject({ db, projectId: opts.projectId, adapterName: adapter, dryRun });
    const durationMs = Date.now() - start;
    if (!dryRun) {
      await db.query(
        `INSERT INTO telemetry (project_id, action, outcome, duration_ms, metadata)
         VALUES ($1, 'delivery.mirror_run', 'ok', $2, $3::jsonb)`,
        [opts.projectId, durationMs, JSON.stringify({ ...result, adapter })],
      );
    }
    return { adapter, pulled: result.pulled, failed: result.failed, durationMs, dryRun };
  } finally {
    await db.end();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const projectId = process.env.ATELIER_PROJECT_ID;
  if (!projectId) {
    console.error('error: ATELIER_PROJECT_ID env var is required');
    process.exit(1);
  }

  const result = await runOnce({ projectId, adapter: args.adapter, dryRun: args.dryRun });
  console.log(
    `[mirror-delivery] adapter=${result.adapter} pulled=${result.pulled} failed=${result.failed} duration_ms=${result.durationMs}${result.dryRun ? ' (dry-run)' : ''}`,
  );
}

if (process.argv[1]?.endsWith('mirror-delivery.ts')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { pullForProject, parseArgs };
