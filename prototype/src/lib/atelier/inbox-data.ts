// Inbox surface data loader (/atelier/inbox) - Phase 2 Slice 2, PR 1.
//
// Inbox is DP-1 "action-shaped sections" - every section header is
// shaped by what the viewer must do, not by status. PR 1 scaffolds the
// loader + resolves the viewer; the proposals legs (needs-reaction +
// awaiting-approval) come through get_proposals via dispatch + RLS
// (atelier_runtime, ADR-051). Contributions legs (awaiting-review +
// blocked-on-you) wire in PR 3 once the section UI is in place.
//
// Pattern parallels compose-data.ts (the S1 loader).

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

export interface InboxProposalRow {
  id: string;
  composerId: string;
  traceIds: string[];
  territoryId: string | null;
  title: string;
  options: Array<{ id: string; label: string; tradeoffs?: string }>;
  state: 'open' | 'synthesized';
  createdAt: Date;
  synthesizedAt: Date | null;
  reactionCount: number;
}

export interface InboxViewModel {
  viewer: LensViewerContext;
  // Section 1: open proposals - PR 3 narrows to "not reacted by me".
  needsReaction: InboxProposalRow[];
  // Section 2: syntheses awaiting approve_plan.
  awaitingApproval: InboxProposalRow[];
  // Sections 3 + 4 wire in PR 3 (contributions read path).
  awaitingReview: ContributionRow[];
  blockedOnYou: ContributionRow[];
  // Scale budget per DP-6: paginate at 50 per section; virtualize at
  // 500 (Phase 3 concern). All sections share the same ceiling so the
  // page-level scroll cost is bounded.
  pageSizePerSection: 50;
}

// PR 1 stub - the contribution row shape lands here so PR 3's wiring is
// purely a substrate-query addition, no view-model reshape.
export interface ContributionRow {
  id: string;
  title: string;
  territoryName: string | null;
  traceIds: string[];
  authorSessionId: string | null;
  updatedAt: Date;
}

export type InboxLoadResult =
  | { ok: true; viewModel: InboxViewModel }
  | { ok: false; reason: 'no_bearer' | 'invalid_bearer' | 'no_composer'; message: string };

interface LoadOpts {
  cookies: SsrCookieStore | null;
  client?: ServerSupabaseClient;
}

export async function loadInboxViewModel(
  request: Request,
  opts: LoadOpts,
): Promise<InboxLoadResult> {
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

  // Parallel substrate queries: open + synthesized proposals. Server-side
  // filter + sort per Phase 8 dynamic-surface rule; the client only
  // receives rows it will render. Page size enforced server-side.
  const [openResult, synthesizedResult] = await Promise.all([
    dispatch(
      {
        tool: 'get_proposals',
        bearer,
        body: { session_id: viewer.sessionId, state: 'open', limit: 50 },
      },
      getMcpDeps(),
    ),
    dispatch(
      {
        tool: 'get_proposals',
        bearer,
        body: { session_id: viewer.sessionId, state: 'synthesized', limit: 50 },
      },
      getMcpDeps(),
    ),
  ]);

  if (!openResult.ok) {
    return {
      ok: false,
      reason: 'invalid_bearer',
      message: `get_proposals(open) failed: ${openResult.error.code}: ${openResult.error.message}`,
    };
  }
  if (!synthesizedResult.ok) {
    return {
      ok: false,
      reason: 'invalid_bearer',
      message: `get_proposals(synthesized) failed: ${synthesizedResult.error.code}: ${synthesizedResult.error.message}`,
    };
  }

  const mapRow = (p: RawProposal): InboxProposalRow => ({
    id: p.id,
    composerId: p.composer_id,
    traceIds: p.trace_ids,
    territoryId: p.territory_id,
    title: p.title,
    options: p.options,
    state: p.state as 'open' | 'synthesized',
    createdAt: new Date(p.created_at),
    synthesizedAt: p.synthesized_at ? new Date(p.synthesized_at) : null,
    reactionCount: p.reaction_count,
  });

  return {
    ok: true,
    viewModel: {
      viewer,
      needsReaction: (openResult.data as { proposals: RawProposal[] }).proposals.map(mapRow),
      awaitingApproval: (synthesizedResult.data as { proposals: RawProposal[] }).proposals.map(mapRow),
      // Contribution-side sections land in PR 3 once the action-shaped UI
      // is in place to render them. Empty arrays preserve the section
      // shape so the empty-state copy from the prototype displays.
      awaitingReview: [],
      blockedOnYou: [],
      pageSizePerSection: 50,
    },
  };
}

interface RawProposal {
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
}
