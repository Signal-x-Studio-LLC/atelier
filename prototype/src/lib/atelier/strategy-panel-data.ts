// Strategy-panel data reader (ADR-057 Slice 4).
//
// Reads recent log_decision rows that carry the per-surface trace id so
// the harness rail's strategy panel can show "decisions logged here"
// alongside the manifest's per-surface strategy_notes prose.
//
// Surface-trace-id convention (LOCKED for slice 4):
//
//   prototype:<project_name>:<surface_route>
//
//   examples:
//     prototype:dashboard-northstar:/compose
//     prototype:dashboard-northstar:/inbox
//     prototype:dashboard-northstar:/
//
// This shape mirrors the convention already in use elsewhere in the
// substrate (free-form colon-segmented strings; the `decisions.trace_ids`
// column is text[]). Locking the prefix as `prototype:<project>:` lets
// queries discriminate harness-side decisions from substrate-internal
// ones without a schema change. The trailing route segment matches the
// route exactly (leading slash, no trailing slash). Stored verbatim;
// readers compare with string equality.
//
// Read path: reuse `dispatch(get_context)` which already returns the 10
// most recent project-scoped decisions, then bucket client-side by the
// per-surface trace id. Per the brief: "Prefer reusing existing
// primitives over adding new RPCs." A dedicated RPC could be added
// later if the 10-row recency window proves insufficient; for v1 the
// harness panel is informational, not an audit log.

import { dispatch } from '../../../../scripts/endpoint/lib/dispatch.ts';
import { getMcpDeps } from './mcp-deps.ts';
import {
  getRequestSupabaseClient,
  resolveBearer,
  resolveLensViewer,
  LensAuthError,
  type LensViewerContext,
} from './session.ts';
import { nextCookieAdapter } from './adapters/next-cookies.ts';

export interface StrategyPanelDecision {
  id: string;
  summary: string;
  traceIds: string[];
  timestamp: string; // ISO; the panel is a client component, Dates don't serialize
  repoCommitSha: string | null;
}

export type StrategyPanelLoadResult =
  | {
      ok: true;
      viewer: {
        composerId: string;
        composerName: string;
        projectId: string;
      };
      // Bucketed by surface route. A route with no decisions has an
      // empty array; a route never declared in the manifest is absent.
      decisionsByRoute: Record<string, StrategyPanelDecision[]>;
    }
  | {
      ok: false;
      reason: 'no_bearer' | 'invalid_bearer' | 'no_composer' | 'dispatch_failed';
      message: string;
    };

/**
 * Build the canonical surface trace id for a route under a prototype
 * project mount. Callers MUST use this helper so writers + readers stay
 * in agreement on the encoding.
 */
export function surfaceTraceId(projectName: string, surfaceRoute: string): string {
  return `prototype:${projectName}:${surfaceRoute}`;
}

/**
 * Inverse of surfaceTraceId for read-path bucketing. Returns the
 * surface route if the trace id matches the canonical shape for the
 * given project, else null. Tolerates stray colons in the route
 * segment (none today, but the convention doesn't forbid them).
 */
export function parseSurfaceTraceId(
  traceId: string,
  projectName: string,
): string | null {
  const prefix = `prototype:${projectName}:`;
  if (!traceId.startsWith(prefix)) return null;
  return traceId.slice(prefix.length);
}

/**
 * Load the strategy-panel data for the current request.
 *
 * Returns a bucketed map keyed by surface route — the harness layout
 * loads this once per request and passes the full bucketed result to
 * the client StrategyPanel, which picks its bucket via usePathname().
 *
 * Auth-failure modes degrade gracefully: the caller renders the
 * manifest's strategy_notes (which need no auth) and shows a sign-in
 * hint instead of the decisions list / form.
 */
export async function loadStrategyPanelData(
  projectName: string,
  surfaceRoutes: readonly string[],
): Promise<StrategyPanelLoadResult> {
  const { cookies: nextCookies } = await import('next/headers');
  const cookieStore = await nextCookies();
  const cookies = nextCookieAdapter(cookieStore);

  const bearer = await resolveBearer(new Request('http://localhost/'), {
    cookies,
  });
  if (!bearer) {
    return {
      ok: false,
      reason: 'no_bearer',
      message: 'No Supabase Auth session present.',
    };
  }

  let viewer: LensViewerContext;
  try {
    const supabase = await getRequestSupabaseClient();
    viewer = await resolveLensViewer(supabase);
  } catch (err) {
    if (err instanceof LensAuthError) {
      return { ok: false, reason: err.kind, message: err.message };
    }
    throw err;
  }

  const ctxResult = await dispatch(
    { tool: 'get_context', bearer, body: { session_id: viewer.sessionId } },
    getMcpDeps(),
  );
  if (!ctxResult.ok) {
    return {
      ok: false,
      reason: 'dispatch_failed',
      message: `get_context failed: ${ctxResult.error.code}: ${ctxResult.error.message}`,
    };
  }
  const ctx = ctxResult.data as {
    recent_decisions: {
      direct: Array<{
        id: string;
        summary: string;
        trace_ids: string[];
        timestamp: string | Date;
        repo_path: string | null;
      }>;
    };
  };

  // Initialize every declared route to an empty bucket so the client
  // can distinguish "no decisions yet" from "route not in manifest".
  const decisionsByRoute: Record<string, StrategyPanelDecision[]> = {};
  for (const route of surfaceRoutes) decisionsByRoute[route] = [];

  for (const row of ctx.recent_decisions.direct) {
    if (!Array.isArray(row.trace_ids)) continue;
    for (const tid of row.trace_ids) {
      const route = parseSurfaceTraceId(tid, projectName);
      if (route === null) continue;
      const bucket = decisionsByRoute[route];
      if (!bucket) continue; // surface not in manifest — ignore for v1
      bucket.push({
        id: row.id,
        summary: row.summary,
        traceIds: row.trace_ids,
        timestamp:
          row.timestamp instanceof Date
            ? row.timestamp.toISOString()
            : new Date(row.timestamp).toISOString(),
        repoCommitSha: row.repo_path,
      });
    }
  }

  return {
    ok: true,
    viewer: {
      composerId: viewer.composerId,
      composerName: viewer.composerName,
      projectId: viewer.projectId,
    },
    decisionsByRoute,
  };
}
