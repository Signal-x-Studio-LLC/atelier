// /api/cron/reconcile
//
// Per ARCH §6.5 (reconcile) + BRD-OPEN-QUESTIONS §37 PR 2.
// Schedule: 15 * * * * (hourly, at :15).
//
// Wraps `runOnce()` from scripts/sync/reconcile.ts. Detects drift between
// canonical repo and registry; optionally reaps stale branches per
// BRD-OPEN-QUESTIONS §24 (default-off; opt-in via env vars). Runs
// per-project sequentially.

import { Client } from 'pg';
import { runOnce } from '../../../../../../scripts/sync/reconcile.ts';
import { verifyCronRequest } from '../../../../lib/atelier/cron-auth.ts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  const auth = verifyCronRequest(req);
  if (!auth.ok) {
    return Response.json({ error: auth.reason }, { status: auth.status });
  }

  const databaseUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    return Response.json(
      { error: 'database_url_not_configured' },
      { status: 503 },
    );
  }

  try {
    const projectIds = await resolveProjectIds(databaseUrl);
    const results = [];
    for (const projectId of projectIds) {
      try {
        const result = await runOnce({ projectId, databaseUrl });
        results.push({
          projectId,
          driftDetected: result.driftDetected,
          branchesScanned: result.branchesScanned,
          branchesEligibleForReaping: result.branchesEligibleForReaping,
          branchesReaped: result.branchesReaped,
          reapingEnabled: result.reapingEnabled,
          reapingApply: result.reapingApply,
        });
      } catch (err) {
        results.push({
          projectId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return Response.json({ ok: true, projects: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: 'reconcile_failed', message }, { status: 500 });
  }
}

async function resolveProjectIds(databaseUrl: string): Promise<string[]> {
  const csv = process.env.ATELIER_CRON_PROJECTS;
  if (csv) {
    return csv.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string }>('SELECT id FROM projects');
    return rows.map((r) => r.id);
  } finally {
    await client.end();
  }
}
