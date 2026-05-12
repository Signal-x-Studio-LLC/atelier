// Connect surface data loader (/atelier/connect) - Phase 2 Slice 5.
//
// Connect has three anchored sub-surfaces (Q5 resolution):
//   #presence  - who's online, what surface
//   #systems   - external integrations health (fixture in v2; substrate
//                webhooks-health endpoint is Phase 3+ work)
//   #chat      - embedded MCP chat affordance (Q1: also reachable via
//                global ⌘K)
//
// Presence reuses the existing loadPresenceData() reader (built for the
// ADR-057 harness rail) -- same project-wide 15-minute window, same
// row shape. Connect uses G2 SSE per ADR-055 + G3 session checkpoints
// per ADR-058 indirectly: presence rows are driven by the sessions
// heartbeat write path that G2 broadcasts on. Live presence push wires
// in PR 3.

import {
  LensAuthError,
  resolveLensViewer,
  getRequestSupabaseClient,
  type LensViewerContext,
} from './session.ts';
import type { ServerSupabaseClient, SsrCookieStore } from './adapters/supabase-ssr.ts';
import { loadPresenceData } from './presence-data.ts';
import type { PresenceEntry } from './lens-data.ts';

export interface ConnectViewModel {
  viewer: LensViewerContext;
  presence: PresenceEntry[];
  presenceWindowMinutes: 15;
  // Scale budget per DP-6 (Connect tier): paginate at 30 sessions per
  // surface bucket; virtualize at 300 across all surfaces. Presence
  // lists rarely cross this scale in v1 but the budget is declared so
  // the surface conforms to the same Phase 8 rules as the others.
  scaleBudget: { paginate: 30; virtualize: 300 };
}

export type ConnectLoadResult =
  | { ok: true; viewModel: ConnectViewModel }
  | { ok: false; reason: 'no_bearer' | 'invalid_bearer' | 'no_composer'; message: string };

interface LoadOpts {
  cookies: SsrCookieStore | null;
  client?: ServerSupabaseClient;
}

export async function loadConnectViewModel(
  _request: Request,
  opts: LoadOpts,
): Promise<ConnectLoadResult> {
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

  // Reuse the existing presence reader -- same project-wide 15-min
  // heartbeat window, same row shape. loadPresenceData degrades to
  // empty list on auth failure rather than erroring; we surface the
  // empty case via the panel's empty-state copy.
  const presenceResult = await loadPresenceData();
  const presence = presenceResult.sessions ?? [];

  return {
    ok: true,
    viewModel: {
      viewer,
      presence,
      presenceWindowMinutes: 15,
      scaleBudget: { paginate: 30, virtualize: 300 },
    },
  };
}
