// /api/cron/reaper
//
// Per ARCH §6.1 + BRD-OPEN-QUESTIONS §37 PR 2b (ADR-052 migration).
// Schedule: */5 * * * * (every 5 minutes).
//
// Sweeps stale active sessions and releases their locks via the
// atelier_reap_stale_sessions(p_project_id, p_threshold) SQL function
// (migration 20260509000017). Iterates per-project; per-project errors
// caught + reported.
//
// Threshold: defaults to 15 minutes (matching the existing observability
// metrics' active-session window). Override via ATELIER_REAPER_THRESHOLD_SEC
// env var.

import { Client } from 'pg';
import { verifyCronRequest } from '../../../../lib/atelier/cron-auth.ts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ReapResult {
  reaped_session_count: number;
  locks_released: number;
  telemetry_rows: number;
}

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

  const thresholdSec = parseInt(process.env.ATELIER_REAPER_THRESHOLD_SEC ?? '900', 10);
  const thresholdInterval = `${thresholdSec} seconds`;

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const projectIds = await resolveProjectIds(client);
    const results = [];
    for (const projectId of projectIds) {
      try {
        const { rows } = await client.query<{ atelier_reap_stale_sessions: ReapResult }>(
          `SELECT atelier_reap_stale_sessions($1::uuid, $2::interval) AS atelier_reap_stale_sessions`,
          [projectId, thresholdInterval],
        );
        results.push({ projectId, ...(rows[0]?.atelier_reap_stale_sessions ?? { reaped_session_count: 0, locks_released: 0, telemetry_rows: 0 }) });
      } catch (err) {
        results.push({
          projectId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return Response.json({
      ok: true,
      thresholdSec,
      projects: results,
      totals: aggregate(results),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: 'reaper_failed', message }, { status: 500 });
  } finally {
    await client.end();
  }
}

async function resolveProjectIds(client: Client): Promise<string[]> {
  const csv = process.env.ATELIER_CRON_PROJECTS;
  if (csv) {
    return csv.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const { rows } = await client.query<{ id: string }>('SELECT id FROM projects');
  return rows.map((r) => r.id);
}

interface ReaperTotals {
  reaped_session_count: number;
  locks_released: number;
  telemetry_rows: number;
}

function aggregate(results: Array<Record<string, unknown>>): ReaperTotals {
  const init: ReaperTotals = { reaped_session_count: 0, locks_released: 0, telemetry_rows: 0 };
  return results.reduce<ReaperTotals>((acc, r) => ({
    reaped_session_count: acc.reaped_session_count + ((r.reaped_session_count as number | undefined) ?? 0),
    locks_released: acc.locks_released + ((r.locks_released as number | undefined) ?? 0),
    telemetry_rows: acc.telemetry_rows + ((r.telemetry_rows as number | undefined) ?? 0),
  }), init);
}
