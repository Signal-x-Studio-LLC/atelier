'use server';

// Server action: create an annotation pin from the harness overlay
// (ADR-057 Slice 7).
//
// Flow:
//   1. Resolve the composer bearer from the Supabase Auth cookie
//      (mirror log-decision.ts).
//   2. Resolve the lens viewer (composer + project + session_id).
//   3. Pick a territory_id under the viewer's project — annotation pins
//      do not own files, so any project-scoped territory satisfies the
//      claim NOT NULL constraint. Prefer a `designer`-owned territory
//      since kind=design; fall back to the first territory in the
//      project. v1 punt: a dedicated `annotations` territory would be
//      cleaner; not blocking for Slice 7.
//   4. Dispatch `claim` with kind='design', the per-surface trace id,
//      and a content_ref that embeds the anchor + label + body fenced
//      markers (see annotations-data.ts:buildAnnotationContentRef).
//   5. revalidatePath the harness route so the overlay re-fetches.

import { revalidatePath } from 'next/cache';

import { dispatch } from '../../../../../../scripts/endpoint/lib/dispatch.ts';
import { getMcpDeps } from '../../../../lib/atelier/mcp-deps.ts';
import {
  getRequestSupabaseClient,
  resolveBearer,
  resolveLensViewer,
  LensAuthError,
} from '../../../../lib/atelier/session.ts';
import { surfaceTraceId } from '../../../../lib/atelier/strategy-panel-data.ts';
import {
  buildAnnotationContentRef,
  type AnnotationAnchor,
} from '../../../../lib/atelier/annotations-data.ts';
import { nextCookieAdapter } from '../../../../lib/atelier/adapters/next-cookies.ts';

export interface CreateAnnotationInput {
  projectName: string;
  surfaceRoute: string;
  pathToRevalidate: string;
  label: string;
  body: string;
  anchor: AnnotationAnchor;
}

export type CreateAnnotationActionResult =
  | { ok: true; contributionId: string }
  | { ok: false; code: string; message: string };

export async function createAnnotationFromOverlay(
  input: CreateAnnotationInput,
): Promise<CreateAnnotationActionResult> {
  const label = input.label.trim();
  if (label.length === 0) {
    return { ok: false, code: 'INVALID_INPUT', message: 'Label is required.' };
  }
  if (label.length > 120) {
    return { ok: false, code: 'INVALID_INPUT', message: 'Label must be ≤120 chars.' };
  }

  const { cookies: nextCookies } = await import('next/headers');
  const cookieStore = await nextCookies();
  const cookies = nextCookieAdapter(cookieStore);

  const fakeRequest = new Request('http://localhost/');
  const bearer = await resolveBearer(fakeRequest, { cookies });
  if (!bearer) {
    return { ok: false, code: 'NO_BEARER', message: 'Sign in to drop a pin.' };
  }

  let viewer;
  let supabase;
  try {
    supabase = await getRequestSupabaseClient();
    viewer = await resolveLensViewer(supabase);
  } catch (err) {
    if (err instanceof LensAuthError) {
      return { ok: false, code: err.kind.toUpperCase(), message: err.message };
    }
    throw err;
  }

  // Resolve a territory for the claim. Prefer designer-owned, else any.
  // The thin ServerSupabaseClient interface doesn't type .or(); use cast.
  const fluent = supabase as unknown as {
    from(table: string): {
      select(columns: string): {
        eq(column: string, value: string): {
          order(
            column: string,
            opts?: { ascending?: boolean },
          ): {
            limit(n: number): Promise<{
              data: Array<{ id: string; owner_role: string }> | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };

  const { data: terrRows, error: terrErr } = await fluent
    .from('territories')
    .select('id, owner_role')
    .eq('project_id', viewer.projectId)
    .order('owner_role', { ascending: true })
    .limit(50);

  if (terrErr) {
    return {
      ok: false,
      code: 'TERRITORY_LOOKUP_FAILED',
      message: `territories lookup failed: ${terrErr.message}`,
    };
  }
  const rows = terrRows ?? [];
  if (rows.length === 0) {
    return {
      ok: false,
      code: 'NO_TERRITORY',
      message: 'Project has no territories; cannot claim an annotation.',
    };
  }
  const territoryId =
    (rows.find((r) => r.owner_role === 'designer')?.id) ?? rows[0]!.id;

  const contentRef = buildAnnotationContentRef({
    label,
    body: input.body,
    anchor: input.anchor,
  });

  const result = await dispatch(
    {
      tool: 'claim',
      bearer,
      body: {
        contribution_id: null,
        session_id: viewer.sessionId,
        kind: 'design',
        trace_ids: [surfaceTraceId(input.projectName, input.surfaceRoute)],
        territory_id: territoryId,
        // artifact_scope must be non-empty per substrate CHECK. Annotation
        // pins target a virtual harness artifact; use a stable synthetic
        // scope keyed on the surface route. This will not collide with
        // file-scoped contributions because the prefix is non-path-like.
        artifact_scope: [
          `prototype-harness:${input.projectName}:${input.surfaceRoute}`,
        ],
        content_ref: contentRef,
      },
    },
    getMcpDeps(),
  );

  if (!result.ok) {
    return {
      ok: false,
      code: result.error.code,
      message: result.error.message,
    };
  }

  const data = result.data as { contribution_id?: string; contributionId?: string };
  const contributionId = data.contribution_id ?? data.contributionId ?? '';
  revalidatePath(input.pathToRevalidate);
  return { ok: true, contributionId };
}
