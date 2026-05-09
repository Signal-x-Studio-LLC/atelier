// Cron handler bearer-auth helper.
//
// Per ADR-052 (Cloudflare-primary infrastructure pivot, 2026-05-09) /
// BRD-OPEN-QUESTIONS §37 PR 2.
//
// Both Vercel Cron and Cloudflare Cron Triggers support bearer auth on
// the cron HTTP endpoint. Vercel sends `Authorization: Bearer <CRON_SECRET>`
// when CRON_SECRET is set. CF cron triggers fire `scheduled()` events
// directly to a Worker; the worker extension that maps schedules to
// route handlers (lands in PR 2d) injects the same bearer header so the
// handler logic is platform-agnostic.
//
// CRON_SECRET semantics:
//   - Required in production. Missing secret → all cron requests rejected
//     with 503 (configuration error, not 401 — the operator has to know).
//   - In local dev, missing secret → handler runs unauthenticated. This
//     matches the Vercel-cron local-dev pattern; CI smokes set the secret
//     explicitly so no path bypasses verification under test.

const RUNTIME_DEV = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

export type CronAuthOutcome =
  | { ok: true }
  | { ok: false; status: number; reason: string };

/**
 * Verify the request bearer matches CRON_SECRET. Use at the top of any
 * cron route handler:
 *
 *   const auth = verifyCronRequest(req);
 *   if (!auth.ok) return Response.json({ error: auth.reason }, { status: auth.status });
 */
export function verifyCronRequest(req: Request): CronAuthOutcome {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (RUNTIME_DEV) return { ok: true };
    return {
      ok: false,
      status: 503,
      reason: 'cron_secret_not_configured',
    };
  }

  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header) {
    return { ok: false, status: 401, reason: 'missing_authorization_header' };
  }

  const expected = `Bearer ${secret}`;
  if (!constantTimeEquals(header, expected)) {
    return { ok: false, status: 401, reason: 'invalid_bearer' };
  }

  return { ok: true };
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
