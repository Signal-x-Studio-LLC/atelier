// Annotation overlay data reader (ADR-057 Slice 7).
//
// Reads existing kind:'design' contributions whose trace_ids include the
// canonical per-surface trace id (`prototype:<project>:<surface_route>`)
// so the harness annotation overlay can render pins on the rendered
// surface.
//
// STORAGE SHAPE (v1, mirrors strategy-panel approach):
//   The `claim` tool body does NOT have a structured anchor field. Pin
//   anchor + body are embedded as a fenced marker inside `content_ref`:
//
//     <atelier:anchor>{"selector":"...","x_pct":0.42,"y_pct":0.18,"v":1}</atelier:anchor>
//     <atelier:label>One-line label</atelier:label>
//     <freeform body comment here>
//
//   The marker is regex-extracted on read. New marker keys can be added
//   in a backward-compatible way (unknown keys are ignored). The `v` key
//   is a schema version for future evolution.
//
// READ PATH:
//   Direct PostgREST query against `contributions` filtered by
//   project_id + kind=design + trace_ids overlap with the surface trace
//   ids declared in the manifest. Mirrors the presence-data direct-query
//   pattern (RLS scopes results to the viewer's project automatically).
//
// AUTH DEGRADATION: when there's no bearer / no composer, the panel
// still renders (empty list) so existing pins don't appear to vanish on
// sign-out. RLS would reject the query anyway.

import { surfaceTraceId } from './strategy-panel-data.ts';
import {
  getRequestSupabaseClient,
  resolveLensViewer,
  LensAuthError,
} from './session.ts';
import type { ServerSupabaseClient } from './adapters/supabase-ssr.ts';

export interface AnnotationAnchor {
  /** CSS selector of an ancestor with [data-surface-anchor]. */
  selector: string | null;
  /** Scroll-normalized position within data-harness="content" (0..1). */
  xPct: number;
  yPct: number;
  /** Schema version; tolerate forward-incompatible bumps. */
  v: number;
}

export interface AnnotationPin {
  id: string;
  label: string;
  body: string;
  anchor: AnnotationAnchor;
  authorComposerId: string | null;
  createdAt: string; // ISO; client component, Dates don't serialize
  /** Original trace id this pin was claimed against (for debugging). */
  traceId: string;
}

export type AnnotationLoadResult =
  | {
      ok: true;
      viewerComposerId: string;
      projectId: string;
      /** Bucketed by surface route — same shape as strategy-panel-data. */
      pinsByRoute: Record<string, AnnotationPin[]>;
    }
  | {
      ok: false;
      reason: 'no_bearer' | 'invalid_bearer' | 'no_composer' | 'query_failed';
      message: string;
      /** Empty bucketed map so the overlay can render empty without ok-branching. */
      pinsByRoute: Record<string, AnnotationPin[]>;
    };

const ANCHOR_RE = /<atelier:anchor>([\s\S]*?)<\/atelier:anchor>/;
const LABEL_RE = /<atelier:label>([\s\S]*?)<\/atelier:label>/;

/**
 * Build the canonical content_ref payload for a new annotation pin.
 * Writers MUST use this so readers regex-extract reliably.
 */
export function buildAnnotationContentRef(input: {
  label: string;
  body: string;
  anchor: AnnotationAnchor;
}): string {
  const anchorJson = JSON.stringify({
    selector: input.anchor.selector,
    x_pct: input.anchor.xPct,
    y_pct: input.anchor.yPct,
    v: input.anchor.v,
  });
  // Newlines OK; markers are non-greedy regex so they tolerate line breaks.
  return [
    `<atelier:anchor>${anchorJson}</atelier:anchor>`,
    `<atelier:label>${input.label}</atelier:label>`,
    input.body,
  ].join('\n');
}

interface RawAnchorPayload {
  selector?: string | null;
  x_pct?: number;
  y_pct?: number;
  v?: number;
}

/** Parse a contributions.content_ref into a structured pin. Null on malformed. */
function parseContentRef(
  contentRef: string,
): { anchor: AnnotationAnchor; label: string; body: string } | null {
  const am = contentRef.match(ANCHOR_RE);
  if (!am) return null;
  let raw: RawAnchorPayload;
  try {
    raw = JSON.parse(am[1]!) as RawAnchorPayload;
  } catch {
    return null;
  }
  const xPct = typeof raw.x_pct === 'number' ? raw.x_pct : NaN;
  const yPct = typeof raw.y_pct === 'number' ? raw.y_pct : NaN;
  if (!Number.isFinite(xPct) || !Number.isFinite(yPct)) return null;
  const lm = contentRef.match(LABEL_RE);
  const label = lm ? lm[1]!.trim() : '(no label)';
  // Body = whatever's left after stripping both markers (and the leading newlines).
  const body = contentRef
    .replace(ANCHOR_RE, '')
    .replace(LABEL_RE, '')
    .replace(/^\s+/, '')
    .trim();
  return {
    anchor: {
      selector: typeof raw.selector === 'string' ? raw.selector : null,
      xPct,
      yPct,
      v: typeof raw.v === 'number' ? raw.v : 1,
    },
    label,
    body,
  };
}

interface RawContributionRow {
  id: string;
  trace_ids: string[];
  content_ref: string;
  author_composer_id: string | null;
  created_at: string;
}

/**
 * Load all annotation pins for the prototype project's declared surfaces.
 * Returns a bucketed map keyed by surface route, same pattern as
 * loadStrategyPanelData. Auth failures degrade to an empty map.
 */
export async function loadAnnotationsData(
  projectName: string,
  surfaceRoutes: readonly string[],
): Promise<AnnotationLoadResult> {
  const emptyByRoute: Record<string, AnnotationPin[]> = {};
  for (const route of surfaceRoutes) emptyByRoute[route] = [];

  let supabase: ServerSupabaseClient;
  try {
    supabase = await getRequestSupabaseClient();
  } catch (err) {
    return {
      ok: false,
      reason: 'no_bearer',
      message: err instanceof Error ? err.message : 'failed to construct supabase client',
      pinsByRoute: emptyByRoute,
    };
  }

  let projectId: string;
  let viewerComposerId: string;
  try {
    const viewer = await resolveLensViewer(supabase);
    projectId = viewer.projectId;
    viewerComposerId = viewer.composerId;
  } catch (err) {
    if (err instanceof LensAuthError) {
      return {
        ok: false,
        reason: err.kind,
        message: err.message,
        pinsByRoute: emptyByRoute,
      };
    }
    throw err;
  }

  const surfaceTraceIds = surfaceRoutes.map((r) => surfaceTraceId(projectName, r));

  // PostgREST `overlaps` for text[]; cast through unknown to reach the
  // chainable supabase-js builder (the thin ServerSupabaseClient interface
  // doesn't type .overlaps()).
  const fluent = supabase as unknown as {
    from(table: string): {
      select(columns: string): {
        eq(column: string, value: string): {
          eq(column: string, value: string): {
            overlaps(column: string, values: string[]): {
              order(
                column: string,
                opts?: { ascending?: boolean },
              ): Promise<{
                data: RawContributionRow[] | null;
                error: { message: string; code?: string } | null;
              }>;
            };
          };
        };
      };
    };
  };

  const { data, error } = await fluent
    .from('contributions')
    .select('id, trace_ids, content_ref, author_composer_id, created_at')
    .eq('project_id', projectId)
    .eq('kind', 'design')
    .overlaps('trace_ids', surfaceTraceIds)
    .order('created_at', { ascending: true });

  if (error) {
    return {
      ok: false,
      reason: 'query_failed',
      message: `contributions query failed: ${error.message}`,
      pinsByRoute: emptyByRoute,
    };
  }

  const pinsByRoute: Record<string, AnnotationPin[]> = { ...emptyByRoute };

  for (const row of data ?? []) {
    if (!Array.isArray(row.trace_ids)) continue;
    const parsed = parseContentRef(row.content_ref ?? '');
    if (!parsed) continue; // Skip non-annotation design contributions.
    for (const tid of row.trace_ids) {
      // Find which declared surface this trace id matches.
      const idx = surfaceTraceIds.indexOf(tid);
      if (idx < 0) continue;
      const route = surfaceRoutes[idx]!;
      const bucket = pinsByRoute[route];
      if (!bucket) continue;
      bucket.push({
        id: row.id,
        label: parsed.label,
        body: parsed.body,
        anchor: parsed.anchor,
        authorComposerId: row.author_composer_id,
        createdAt: row.created_at,
        traceId: tid,
      });
    }
  }

  return {
    ok: true,
    viewerComposerId,
    projectId,
    pinsByRoute,
  };
}
