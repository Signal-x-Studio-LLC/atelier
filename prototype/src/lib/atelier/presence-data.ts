// Presence-panel data reader (ADR-057 Slice 6).
//
// Reads the project's active sessions (last 15-minute heartbeat window) so
// the harness rail's presence chip can show who else is currently working
// inside this prototype's project. Mirrors the `presence_rows` CTE in
// `atelier_lens_load` — same source-of-truth shape, same recency window —
// but issued as a direct PostgREST query rather than reusing the lens RPC.
//
// WHY NOT REUSE atelier_lens_load:
//   The lens RPC is a single-shot view-model that *also* writes a session
//   row tagged `surface='web', agent_client='atelier-dashboard'`. Calling
//   it from `/prototype/<project>` would imply the viewer is on the lens
//   dashboard and would pollute presence for everyone else with the wrong
//   agent_client. The lens RPC is the right tool for /atelier, not the
//   prototype harness. So Slice 6 reads `sessions` directly. The output
//   shape matches `PresenceEntry` (exported from lens-data.ts) so the
//   client component can be reused or aligned later.
//
// IMPORTANT semantic note on `sessions.surface` (per ADR-057 + brief):
//   `surface` is a CONNECTION TYPE (`ide` | `web` | `terminal` | `passive`),
//   NOT a content route. v1 of the presence chip therefore renders
//   project-wide presence — every active session for this project, not
//   filtered by current pathname. Per-surface presence (knowing who's
//   on /compose specifically) would require a new substrate concept and
//   is left to future work. Filed as future-work note here so the next
//   slice has a pointer:
//
//   FUTURE WORK: per-surface presence needs either a sessions.content_route
//   column or a separate ephemeral table (e.g. surface_visits) plus a
//   reaper. Until then, project-wide presence is the right v1 shape.
//
// Auth degradation: when there's no bearer / no composer the panel still
// renders project-public presence iff RLS permits — but because the
// `sessions` RLS policy filters by `atelier_current_project_ids()`,
// unauthenticated reads return an empty list. The panel handles that as
// the "no viewer" empty state.

import type { PresenceEntry } from './lens-data.ts';
import { getRequestSupabaseClient, resolveLensViewer, LensAuthError } from './session.ts';
import type { ServerSupabaseClient } from './adapters/supabase-ssr.ts';

const ACTIVE_HEARTBEAT_WINDOW_MINUTES = 15;

export type PresenceLoadResult =
  | {
      ok: true;
      sessions: PresenceEntry[];
      viewerComposerId: string | null;
      projectId: string | null;
    }
  | {
      ok: false;
      reason: 'no_bearer' | 'invalid_bearer' | 'no_composer' | 'query_failed';
      message: string;
      // Still ship an empty sessions list so the panel can render an
      // anonymous-mode empty state without branching on ok-ness for the
      // happy-path rendering. Presence is project-scoped, not viewer-bound.
      sessions: PresenceEntry[];
      viewerComposerId: null;
    };

/**
 * Internal shape of a row returned by the PostgREST embed query
 * `sessions` -> `composers` (one-to-one via FK).
 */
interface RawPresenceRow {
  composer_id: string;
  surface: PresenceEntry['surface'];
  agent_client: string | null;
  heartbeat_at: string;
  composers:
    | {
        display_name: string;
        email: string;
        discipline: string | null;
      }
    | null;
}

/**
 * Load presence rows for the current project. The viewer's `project_id`
 * is resolved via `resolveLensViewer`; we then query `sessions` filtered
 * by that project + active status + recent heartbeat.
 *
 * Per the brief: project-wide presence (not per-surface). The thin
 * `ServerSupabaseClient` interface only types a single `.eq()` filter, so
 * we cast the underlying client back to the supabase-js builder shape to
 * chain the heartbeat-window predicate. The runtime client returned by
 * `createServerSupabaseClient` is the real supabase-js client.
 */
export async function loadPresenceData(): Promise<PresenceLoadResult> {
  let supabase: ServerSupabaseClient;
  try {
    supabase = await getRequestSupabaseClient();
  } catch (err) {
    return {
      ok: false,
      reason: 'no_bearer',
      message: err instanceof Error ? err.message : 'failed to construct supabase client',
      sessions: [],
      viewerComposerId: null,
    };
  }

  let viewerComposerId: string | null = null;
  let projectId: string | null = null;
  try {
    const viewer = await resolveLensViewer(supabase);
    viewerComposerId = viewer.composerId;
    projectId = viewer.projectId;
  } catch (err) {
    if (err instanceof LensAuthError) {
      return {
        ok: false,
        reason: err.kind,
        message: err.message,
        sessions: [],
        viewerComposerId: null,
      };
    }
    throw err;
  }

  // Cast through unknown to the full supabase-js fluent builder shape.
  // The thin ServerSupabaseClient interface tightens the surface for
  // adapter swappability; for this read we need .gte() chaining.
  const fluent = supabase as unknown as {
    from(table: string): {
      select(columns: string): {
        eq(column: string, value: string): {
          eq(column: string, value: string): {
            gte(column: string, value: string): {
              order(column: string, opts?: { ascending?: boolean }): Promise<{
                data: RawPresenceRow[] | null;
                error: { message: string; code?: string } | null;
              }>;
            };
          };
        };
      };
    };
  };

  const cutoff = new Date(
    Date.now() - ACTIVE_HEARTBEAT_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();

  const { data, error } = await fluent
    .from('sessions')
    .select(
      'composer_id, surface, agent_client, heartbeat_at, composers!inner(display_name, email, discipline)',
    )
    .eq('project_id', projectId!)
    .eq('status', 'active')
    .gte('heartbeat_at', cutoff)
    .order('heartbeat_at', { ascending: false });

  if (error) {
    return {
      ok: false,
      reason: 'query_failed',
      message: `sessions query failed: ${error.message}`,
      sessions: [],
      viewerComposerId: null,
    };
  }

  // De-duplicate by composer_id (most-recent heartbeat wins — input is
  // ordered DESC by heartbeat_at). Mirrors the `DISTINCT ON (s.composer_id)`
  // in `atelier_lens_load`'s presence_rows CTE.
  const seen = new Set<string>();
  const sessions: PresenceEntry[] = [];
  for (const row of data ?? []) {
    if (seen.has(row.composer_id)) continue;
    seen.add(row.composer_id);
    const c = row.composers;
    if (!c) continue; // shouldn't happen due to !inner, but guard anyway
    sessions.push({
      composerId: row.composer_id,
      composerName: c.display_name,
      composerEmail: c.email,
      discipline: c.discipline,
      surface: row.surface,
      agentClient: row.agent_client,
      heartbeatAt: new Date(row.heartbeat_at),
    });
  }

  return {
    ok: true,
    sessions,
    viewerComposerId,
    projectId,
  };
}
