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

  return {
    ok: true,
    viewModel: {
      viewer,
      scaleBudget: { paginate: 50, virtualize: 500 },
    },
  };
}
