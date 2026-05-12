// Activity surface data loader (/atelier/activity) - Phase 2 Slice 3, PR 1.
//
// Activity is DP-4's freshness-contract demonstration surface and the
// first webapp v2 surface to come off the 30s poll cycle: it subscribes
// to /api/events via SSE (per ADR-055, deployed in G2). The loader's job
// in PR 1 is to resolve the viewer + project so the page can hand the
// project_id to the prototype Activity client component for the
// EventSource subscription. Initial historical timeline (recent
// proposals / decisions / contributions joined by timestamp) wires in
// PR 3.
//
// Pattern parallels compose-data.ts + inbox-data.ts.

import {
  LensAuthError,
  resolveLensViewer,
  getRequestSupabaseClient,
  type LensViewerContext,
} from './session.ts';
import type { ServerSupabaseClient, SsrCookieStore } from './adapters/supabase-ssr.ts';

export interface ActivityViewModel {
  viewer: LensViewerContext;
  // Scale budget per DP-6: paginate at 50; virtualize at 500. Stored on
  // the view model so the prototype's "scale budget" callout (line ~98
  // of Activity.tsx) reflects substrate truth, not a fixture constant.
  scaleBudget: { paginate: 50; virtualize: 500 };
  // PR 3: count of substrate write events in the last 24h, sourced
  // from the proposals + contributions + decisions tables (the three
  // tables broadcast events on every write per ADR-055). Surfaces as
  // a freshness banner above the prototype Activity timeline so the
  // viewer sees substrate truth even before the first SSE envelope
  // arrives.
  freshness: {
    proposalsLast24h: number;
    contributionsLast24h: number;
    decisionsLast24h: number;
    windowHours: 24;
  };
}

export type ActivityLoadResult =
  | { ok: true; viewModel: ActivityViewModel }
  | { ok: false; reason: 'no_bearer' | 'invalid_bearer' | 'no_composer'; message: string };

interface LoadOpts {
  cookies: SsrCookieStore | null;
  client?: ServerSupabaseClient;
}

export async function loadActivityViewModel(
  _request: Request,
  opts: LoadOpts,
): Promise<ActivityLoadResult> {
  let supabase: ServerSupabaseClient;
  let viewer: LensViewerContext;
  try {
    supabase = opts.client ?? (await getRequestSupabaseClient());
    viewer = await resolveLensViewer(supabase);
  } catch (err) {
    if (err instanceof LensAuthError) {
      return { ok: false, reason: err.kind, message: err.message };
    }
    throw err;
  }

  // PR 3: count substrate write activity in the last 24h. Three queries
  // against proposals + contributions + decisions filtered by recency.
  // RLS already scopes results to the viewer's project.
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [proposalsCount, contributionsCount, decisionsCount] = await Promise.all([
    countSince(supabase, 'proposals', 'created_at', sinceIso),
    countSince(supabase, 'contributions', 'updated_at', sinceIso),
    countSince(supabase, 'decisions', 'created_at', sinceIso),
  ]);

  return {
    ok: true,
    viewModel: {
      viewer,
      scaleBudget: { paginate: 50, virtualize: 500 },
      freshness: {
        proposalsLast24h: proposalsCount,
        contributionsLast24h: contributionsCount,
        decisionsLast24h: decisionsCount,
        windowHours: 24,
      },
    },
  };
}

async function countSince(
  supabase: ServerSupabaseClient,
  table: string,
  column: string,
  sinceIso: string,
): Promise<number> {
  // Server-side time-window filter via gte. Caps at 500 because DP-6's
  // virtualize ceiling is the actionable bound; for higher write
  // volume a count(head:true) RPC is a v1.x consideration if this
  // banner becomes hot.
  const result = await supabase
    .from(table)
    .select('id')
    .gte(column, sinceIso)
    .limit(500);
  if (result.error) {
    console.warn(
      `[activity-data] count ${table} since ${sinceIso} failed: ${result.error.message}`,
    );
    return 0;
  }
  return (result.data ?? []).length;
}
