// Atlas surface data loader (/atelier/atlas) - Phase 2 Slice 4, PR 1.
//
// Atlas is DP-7's long-tail: search-led; no wedge primacy. Cold-load
// renders an empty search shell; the search itself is on-demand via
// find_similar (hybrid retrieval per ADR-042). The loader's job in PR 1
// is auth + viewer resolve; the search server action wires in PR 3.
//
// Pattern parallels compose-data.ts + inbox-data.ts + activity-data.ts.

import {
  LensAuthError,
  resolveLensViewer,
  getRequestSupabaseClient,
  type LensViewerContext,
} from './session.ts';
import type { ServerSupabaseClient, SsrCookieStore } from './adapters/supabase-ssr.ts';

export interface AtlasViewModel {
  viewer: LensViewerContext;
  // Scale budget per DP-6: paginate at 25, virtualize at 200. Atlas's
  // virtualize ceiling is lower than Inbox/Activity (200 vs 500)
  // because each row carries excerpt text + score, not just metadata.
  scaleBudget: { paginate: 25; virtualize: 200 };
}

export type AtlasLoadResult =
  | { ok: true; viewModel: AtlasViewModel }
  | { ok: false; reason: 'no_bearer' | 'invalid_bearer' | 'no_composer'; message: string };

interface LoadOpts {
  cookies: SsrCookieStore | null;
  client?: ServerSupabaseClient;
}

export async function loadAtlasViewModel(
  _request: Request,
  opts: LoadOpts,
): Promise<AtlasLoadResult> {
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
      scaleBudget: { paginate: 25, virtualize: 200 },
    },
  };
}
