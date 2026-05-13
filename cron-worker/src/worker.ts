// Atelier cron Worker — dispatches CF cron triggers to the main app's
// HTTP cron route handlers.
//
// Per ADR-052 + BRD-OPEN-QUESTIONS §37 PR 2d.
//
// Each cron expression in wrangler.jsonc maps to one /api/cron/* handler
// in the main app. The Worker reads `event.cron` (the matching expression
// CF passes when firing scheduled()) and dispatches accordingly.
//
// Failure semantics:
//   - HTTP non-2xx from the main app: log + continue (don't throw, so the
//     Worker doesn't show as failed in CF dashboard for downstream errors
//     that are the app's responsibility to surface in its own observability)
//   - Network error / timeout: log + continue
//   - Unmapped cron expression: log error (indicates wrangler.jsonc and
//     this map are out of sync; surfaces as a CF Worker error)

interface Env {
  ATELIER_APP_URL: string;
  CRON_SECRET: string;
}

interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Cron expression -> /api/cron/* path. Keep in sync with wrangler.jsonc
// triggers.crons array. Each expression must be unique within the array.
const CRON_TO_PATH: Record<string, string> = {
  '*/5 * * * *':    '/api/cron/reaper',
  '*/2 * * * *':    '/api/cron/mirror-delivery',
  '15 * * * *':     '/api/cron/reconcile',
  '*/10 * * * *':   '/api/cron/triage',
  '2-57/5 * * * *': '/api/cron/alert-publisher',
};

export default {
  // Public-URL hits return 404 JSON. The Worker exists to receive CF cron
  // triggers, not browser traffic; a default 1101 page on root reads as a
  // deploy break when the Worker is actually healthy. Operators monitoring
  // via `wrangler tail` see cron firing on schedule regardless.
  async fetch(_request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    return new Response(
      JSON.stringify({
        worker: 'atelier-cron',
        purpose: 'CF cron trigger dispatcher per ARCH §6.1/§6.5/§6.6/§7.4/§8',
        public_traffic: 'unsupported',
      }),
      {
        status: 404,
        headers: { 'content-type': 'application/json' },
      },
    );
  },

  async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const path = CRON_TO_PATH[event.cron];
    if (!path) {
      console.error(`[atelier-cron] no path mapping for cron expression: ${event.cron}`);
      return;
    }

    if (env.ATELIER_APP_URL.includes('REPLACE_WITH_MAIN_APP_URL')) {
      console.error(`[atelier-cron] ATELIER_APP_URL is not configured — operator must set the deployed main-app URL via wrangler.jsonc vars`);
      return;
    }

    if (!env.CRON_SECRET) {
      console.error(`[atelier-cron] CRON_SECRET not configured — operator must run wrangler secret put CRON_SECRET`);
      return;
    }

    const url = `${env.ATELIER_APP_URL}${path}`;
    const start = Date.now();
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      });
      const durationMs = Date.now() - start;
      if (!response.ok) {
        const body = await response.text().catch(() => '<unreadable>');
        console.error(`[atelier-cron] ${path} non-2xx: ${response.status} duration_ms=${durationMs} body=${body.slice(0, 200)}`);
      } else {
        console.log(`[atelier-cron] ${path} ok status=${response.status} duration_ms=${durationMs}`);
      }
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[atelier-cron] ${path} dispatch failed: ${message} duration_ms=${durationMs}`);
    }
  },
};
