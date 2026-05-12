'use server';

// Server actions for /atelier/compose - calls the propose handler
// in-process per the lens-side pattern (find-similar-action.ts). The
// dispatch path engages RLS as atelier_runtime via ADR-051.
//
// PR 3 scope: propose only. React + synthesize + approve_plan land in
// subsequent slices once /atelier/inbox exposes the reaction surface.

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { dispatch } from '../../../../../../scripts/endpoint/lib/dispatch.ts';
import { getMcpDeps } from '../../../../lib/atelier/mcp-deps.ts';
import { resolveBearer, resolveLensViewer } from '../../../../lib/atelier/session.ts';
import { nextCookieAdapter } from '../../../../lib/atelier/adapters/next-cookies.ts';

export interface ProposeInput {
  title: string;
  bodyMarkdown: string;
  territoryId: string | null;
  traceIds: string[];
  options: Array<{ id: string; label: string; tradeoffs?: string }>;
}

export interface ProposeActionResult {
  ok: boolean;
  proposalId: string | null;
  error: { code: string; message: string } | null;
}

export async function submitProposal(
  input: ProposeInput,
): Promise<ProposeActionResult> {
  const trimmedTitle = input.title.trim();
  if (trimmedTitle.length === 0) {
    return {
      ok: false,
      proposalId: null,
      error: { code: 'BAD_REQUEST', message: 'Title is required.' },
    };
  }
  const validOptions = input.options.filter((o) => o.label.trim().length > 0);
  if (validOptions.length < 2) {
    return {
      ok: false,
      proposalId: null,
      error: { code: 'BAD_REQUEST', message: 'At least two options with labels are required (DP-3 structured deliberation).' },
    };
  }

  const cookieStore = await cookies();
  const bearer = await resolveBearer(
    new Request('http://internal/atelier/compose/propose'),
    { cookies: nextCookieAdapter(cookieStore) },
  );
  if (!bearer) {
    return {
      ok: false,
      proposalId: null,
      error: { code: 'UNAUTHORIZED', message: 'Sign in to author a proposal.' },
    };
  }

  let sessionId: string;
  try {
    const viewer = await resolveLensViewer();
    sessionId = viewer.sessionId;
  } catch (err) {
    return {
      ok: false,
      proposalId: null,
      error: {
        code: 'UNAUTHORIZED',
        message: `Session resolve failed: ${(err as Error).message}`,
      },
    };
  }

  const result = await dispatch(
    {
      tool: 'propose',
      bearer,
      body: {
        session_id: sessionId,
        title: trimmedTitle,
        body_markdown: input.bodyMarkdown,
        trace_ids: input.traceIds,
        ...(input.territoryId !== null ? { territory_id: input.territoryId } : {}),
        options: validOptions,
      },
    },
    getMcpDeps(),
  );

  if (!result.ok) {
    return {
      ok: false,
      proposalId: null,
      error: { code: result.error.code, message: result.error.message },
    };
  }

  // Invalidate the route cache so the InitialProposals banner re-renders
  // with the new row on the next read. The SSE broadcast from the propose
  // handler will also push the event to subscribed surfaces (Activity in
  // Slice 3); revalidatePath covers the cold-load path here.
  revalidatePath('/atelier/compose');

  return {
    ok: true,
    proposalId: (result.data as { proposal_id: string }).proposal_id,
    error: null,
  };
}
