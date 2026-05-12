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
import { loadPresenceData } from './presence-data.ts';
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

export type ProposalState = 'open' | 'synthesized' | 'approved';

// Phase 3 polish: read-mode proposal payload + presence avatar stack
// shape. Mirrors the ComposePresenceEntry + ComposeReadModeProposal
// types declared on the prototype Compose component; redeclared here
// so the loader can build them without importing the client-side
// prototype module on the server path.
export interface ComposePresenceCoAuthor {
  id: string;
  initial: string;
  displayName: string;
  color: string;
}

export interface ComposeViewModel {
  viewer: LensViewerContext;
  proposals: ProposalSummary[];
  // Active filter state -- driven by ?state= URL param; falls back to
  // 'open' (Phase 8 default-view rule). Compose's primary action is
  // "create"; the proposal list is a secondary affordance ranked by
  // recency. Returning a small page honors the scale budget (paginate
  // at 50 per DP-6).
  activeState: ProposalState;
  pageSize: 50;
  // Phase 3 polish (integration.md §3): substrate-real co-authors for
  // the DP-13 overlapping avatar stack in the Compose toolbar. Sourced
  // from the same 15-min heartbeat window as /atelier/connect; capped
  // at 5 for the toolbar's visual budget.
  presenceCoAuthors: ComposePresenceCoAuthor[];
  // Phase 3 polish: substrate-real proposal to render in DP-13 read
  // mode. Defaults to the most-recent open proposal; null when none
  // exist (read mode falls back to the prototype fixture content).
  readModeProposal: ProposalSummary | null;
}

export type ComposeLoadResult =
  | { ok: true; viewModel: ComposeViewModel }
  | { ok: false; reason: 'no_bearer' | 'invalid_bearer' | 'no_composer'; message: string };

interface LoadOpts {
  cookies: SsrCookieStore | null;
  client?: ServerSupabaseClient;
  state?: ProposalState;
}

export async function loadComposeViewModel(
  request: Request,
  opts: LoadOpts,
): Promise<ComposeLoadResult> {
  const activeState: ProposalState = opts.state ?? 'open';
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
  // client only receives rows it will render. activeState comes from
  // the ?state= URL param (or 'open' default per the Phase 8 default-
  // view rule). limit=50 honors the scale budget; virtualize beyond
  // 500 is a Phase 3 concern.
  const ctx = await dispatch(
    {
      tool: 'get_proposals',
      bearer,
      body: { session_id: viewer.sessionId, state: activeState, limit: 50 },
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

  const proposals = raw.proposals.map((p) => ({
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
  }));

  // Phase 3 polish: presence + read-mode proposal. Presence reuses the
  // shared loadPresenceData() reader (15-min heartbeat window, project-
  // wide, RLS-scoped); we cap at 5 for the toolbar's visual budget and
  // exclude the current viewer's own sessions (avatar stack shows
  // OTHER active composers).
  const presenceResult = await loadPresenceData();
  const seenComposerIds = new Set<string>();
  const presenceCoAuthors: ComposePresenceCoAuthor[] = [];
  for (const session of presenceResult.sessions ?? []) {
    if (session.composerId === viewer.composerId) continue;
    if (seenComposerIds.has(session.composerId)) continue;
    seenComposerIds.add(session.composerId);
    presenceCoAuthors.push({
      id: session.composerId,
      initial: (session.composerName || '?').charAt(0).toUpperCase(),
      displayName: session.composerName,
      // Deterministic accent color from the composerId so the avatar
      // stays stable across renders without a dedicated avatar_color
      // column on the substrate composers table.
      color: pickAvatarColor(session.composerId),
    });
    if (presenceCoAuthors.length >= 5) break;
  }

  // Read-mode proposal: when activeState is 'open' we default to the
  // most-recent open proposal; for the synthesized / approved chips we
  // default to the most-recent of that bucket. null = no proposal yet,
  // ReadModeCanvas falls back to the prototype's fixture example.
  const readModeProposal = proposals.length > 0 ? proposals[0]! : null;

  return {
    ok: true,
    viewModel: {
      viewer,
      proposals,
      activeState,
      pageSize: 50,
      presenceCoAuthors,
      readModeProposal,
    },
  };
}

// Avatar color picker - deterministic over the composer id so the
// overlapping stack stays stable across renders. Six colors chosen
// from the prototype's @theme palette (no raw hex - these match the
// declared --color-loop-* + accent values in styles.css).
const AVATAR_PALETTE = [
  'var(--color-loop-brainstorm)',
  'var(--color-loop-execute)',
  'var(--color-loop-continuity)',
  'var(--color-primary)',
  'var(--color-success)',
  'var(--color-info)',
];
function pickAvatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]!;
}
