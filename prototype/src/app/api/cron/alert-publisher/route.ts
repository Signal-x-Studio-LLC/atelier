// /api/cron/alert-publisher
//
// Per ARCH §8.3 + BRD-OPEN-QUESTIONS §37 PR 2 (ADR-052 migration).
// Schedule: */5 * * * * (every 5 minutes).
//
// Wraps the existing `runOnce()` from scripts/observability/alert-publisher.ts.
// Same logic; the route exists so cron triggers (Vercel cron during the
// migration overlap; CF Cron Triggers post-cutover) have an HTTP entry.

import { runOnceFromConfig } from '../../../../../../scripts/observability/alert-publisher.ts';
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
      { error: 'database_url_not_configured', detail: 'POSTGRES_URL or DATABASE_URL required' },
      { status: 503 },
    );
  }

  try {
    const result = await runOnceFromConfig({ databaseUrl });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: 'alert_publisher_failed', message }, { status: 500 });
  }
}
