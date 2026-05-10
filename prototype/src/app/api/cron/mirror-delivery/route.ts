// /api/cron/mirror-delivery
//
// Per ARCH §6.5 (mirror delivery) + BRD-OPEN-QUESTIONS §37 PR 2.
// Schedule: */2 * * * * (every 2 minutes).
//
// Wraps `runOnce()` from scripts/sync/mirror-delivery.ts. Pulls
// delivery-authoritative fields from the configured adapter into the
// registry mirror table; emits telemetry per project.
//
// Per-project iteration: the cron handler iterates all known projects
// and runs mirror-delivery for each. ATELIER_CRON_PROJECTS env var
// (CSV of project IDs) overrides for staged rollouts; defaults to
// querying all projects from the datastore.

import { Client } from 'pg';
import { runOnce } from '../../../../../../scripts/sync/mirror-delivery.ts';
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
    const adapter = process.env.ATELIER_DELIVERY_ADAPTER ?? 'noop';
    const dryRun = process.env.ATELIER_CRON_DRY_RUN === 'true';

    const results = [];
    for (const projectId of projectIds) {
      try {
        const result = await runOnce({ projectId, adapter, dryRun, databaseUrl });
        results.push({ projectId, ...result });
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
    return Response.json({ ok: false, error: 'mirror_delivery_failed', message }, { status: 500 });
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
