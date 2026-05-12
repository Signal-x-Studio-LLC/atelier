// Compose surface data loader (/atelier/compose) — Phase 2 Slice 1, PR 1.
//
// Pattern parallels loadLensViewModel: resolve the viewer via
// @supabase/ssr -> SECURITY DEFINER RPC (atelier_resolve_viewer +
// atelier_ensure_dashboard_session), then dispatch(get_proposals) via the
// MCP handler with the request-scoped bearer. Per ADR-051 the dispatch
// path engages RLS as atelier_runtime; per ADR-029 we stay vendor-neutral
// by reaching the substrate through dispatch + named Supabase adapter
// rather than touching pg.Pool directly.
//
// Scope of PR 1: enough state for the page to render auth-guarded shell
// with a count of open proposals. The UI port (PR 2) and the live wiring
// of writes (PR 3) layer on top of this loader.

import { dispatch } from '../../../../scripts/endpoint/lib/dispatch.ts';
import { getMcpDeps } from './mcp-deps.ts';
import {
  LensAuthError,
  resolveBearer,
  resolveLensViewer,
  getRequestSupabaseClient,
  type LensViewerContext,
} from './session.ts';
import type { ServerSupabaseClient, SsrCookieStore } from './adapters/supabase-ssr.ts';

export interface ProposalSummary {
  id: string;
  composerId: string;
  traceIds: string[];
  territoryId: string | null;
  title: string;
  bodyMarkdown: string;
  options: Array<{ id: string; label: string; tradeoffs?: string }>;
  state: 'open' | 'synthesized' | 'approved' | 'abandoned';
  createdAt: Date;
  synthesizedAt: Date | null;
  approvedAt: Date | null;
  approverComposerId: string | null;
  reactionCount: number;
}

export interface ComposeViewModel {
  viewer: LensViewerContext;
  proposals: ProposalSummary[];
  // Default filter state declared server-side (Phase 8 default-view rule).
  // Compose's primary action is "create" — the proposal list is a
  // secondary affordance ranked by recency. Returning a small page
  // honors the scale budget (paginate at 50 per DP-6).
  defaultStateFilter: 'open';
  pageSize: 50;
}

export type ComposeLoadResult =
  | { ok: true; viewModel: ComposeViewModel }
  | { ok: false; reason: 'no_bearer' | 'invalid_bearer' | 'no_composer'; message: string };

interface LoadOpts {
  cookies: SsrCookieStore | null;
  client?: ServerSupabaseClient;
}

export async function loadComposeViewModel(
  request: Request,
  opts: LoadOpts,
): Promise<ComposeLoadResult> {
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

  const bearer = (await resolveBearer(request, { cookies: opts.cookies })) ?? '';
  if (!bearer) {
    return {
      ok: false,
      reason: 'no_bearer',
      message: 'No Supabase Auth session present.',
    };
  }

  // Server-side filter + sort per Phase 8 dynamic-surface rule: the
  // client only receives rows it will render. state=open is the default
  // (Compose's reading affordance shows the currently-deliberating set;
  // synthesized/approved proposals belong to /inbox once that surface
  // lands). limit=50 honors the scale budget; virtualize beyond 500 is
  // a Phase 3 concern.
  const ctx = await dispatch(
    {
      tool: 'get_proposals',
      bearer,
      body: { session_id: viewer.sessionId, state: 'open', limit: 50 },
    },
    getMcpDeps(),
  );
  if (!ctx.ok) {
    return {
      ok: false,
      reason: 'invalid_bearer',
      message: `get_proposals failed: ${ctx.error.code}: ${ctx.error.message}`,
    };
  }
  const raw = ctx.data as {
    proposals: Array<{
      id: string;
      project_id: string;
      composer_id: string;
      trace_ids: string[];
      territory_id: string | null;
      title: string;
      body_markdown: string;
      options: Array<{ id: string; label: string; tradeoffs?: string }>;
      state: 'open' | 'synthesized' | 'approved' | 'abandoned';
      created_at: string;
      synthesized_at: string | null;
      approved_at: string | null;
      approver_composer_id: string | null;
      reaction_count: number;
    }>;
  };

  return {
    ok: true,
    viewModel: {
      viewer,
      proposals: raw.proposals.map((p) => ({
        id: p.id,
        composerId: p.composer_id,
        traceIds: p.trace_ids,
        territoryId: p.territory_id,
        title: p.title,
        bodyMarkdown: p.body_markdown,
        options: p.options,
        state: p.state,
        createdAt: new Date(p.created_at),
        synthesizedAt: p.synthesized_at ? new Date(p.synthesized_at) : null,
        approvedAt: p.approved_at ? new Date(p.approved_at) : null,
        approverComposerId: p.approver_composer_id,
        reactionCount: p.reaction_count,
      })),
      defaultStateFilter: 'open',
      pageSize: 50,
    },
  };
}
