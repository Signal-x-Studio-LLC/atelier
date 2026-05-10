// /api/cron/triage
//
// Per ARCH §6.5.2 + BRD-OPEN-QUESTIONS §37 PR 2c (ADR-052 migration).
// Schedule: */10 * * * * (every 10 minutes).
//
// Wraps `runOnce()` from scripts/sync/triage/run.ts. Reads triage routes
// from .atelier/config.yaml at the substrate's repo root; per-route polls
// the configured CommentSourceAdapter for new comments since the last
// watermark; routes each comment through routeProposal; advances watermark.

import { runOnce } from '../../../../../../scripts/sync/triage/run.ts';
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
    const result = await runOnce({ databaseUrl });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: 'triage_failed', message }, { status: 500 });
  }
}
