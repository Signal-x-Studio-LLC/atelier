'use server';

// Server action: log a decision from the harness strategy panel
// (ADR-057 Slice 4).
//
// Flow:
//   1. Resolve the composer bearer from the Supabase Auth cookie
//      (canonical pattern; same primitive lens-data.ts uses).
//   2. Resolve the lens viewer (composer + project + session_id) via
//      the canonical RPC path.
//   3. Dispatch log_decision against the in-process MCP handler with
//      the per-surface trace id stamped on `trace_ids`.
//   4. revalidatePath the harness route so the StrategyPanel re-fetches
//      with the new decision included.
//
// Returns a plain serializable object so the client form can render
// a success/error chip without round-tripping HTML.

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
import { nextCookieAdapter } from '../../../../lib/atelier/adapters/next-cookies.ts';

export type LogDecisionCategory =
  | 'architecture'
  | 'product'
  | 'design'
  | 'research';

export interface LogDecisionInput {
  projectName: string;
  surfaceRoute: string;
  pathToRevalidate: string;
  category: LogDecisionCategory;
  summary: string;
  rationale: string;
}

export type LogDecisionActionResult =
  | { ok: true; decisionId: string; adrId: string }
  | { ok: false; code: string; message: string };

export async function logDecisionFromPanel(
  input: LogDecisionInput,
): Promise<LogDecisionActionResult> {
  // Trim + minimal validation. The substrate enforces real validation;
  // these checks only prevent empty submissions from hitting the wire.
  const summary = input.summary.trim();
  const rationale = input.rationale.trim();
  if (summary.length === 0) {
    return { ok: false, code: 'INVALID_INPUT', message: 'Summary is required.' };
  }
  if (rationale.length === 0) {
    return { ok: false, code: 'INVALID_INPUT', message: 'Rationale is required.' };
  }

  const { cookies: nextCookies } = await import('next/headers');
  const cookieStore = await nextCookies();
  const cookies = nextCookieAdapter(cookieStore);

  // No synthetic Request needed; resolveBearer ignores the request arg
  // and reads from the cookie store directly.
  const fakeRequest = new Request('http://localhost/');
  const bearer = await resolveBearer(fakeRequest, { cookies });
  if (!bearer) {
    return {
      ok: false,
      code: 'NO_BEARER',
      message: 'Sign in to log a decision.',
    };
  }

  let viewer;
  try {
    const supabase = await getRequestSupabaseClient();
    viewer = await resolveLensViewer(supabase);
  } catch (err) {
    if (err instanceof LensAuthError) {
      return { ok: false, code: err.kind.toUpperCase(), message: err.message };
    }
    throw err;
  }

  const result = await dispatch(
    {
      tool: 'log_decision',
      bearer,
      body: {
        project_id: viewer.projectId,
        session_id: viewer.sessionId,
        category: input.category,
        summary,
        rationale,
        trace_ids: [surfaceTraceId(input.projectName, input.surfaceRoute)],
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

  const data = result.data as { decision_id: string; adr_id: string };
  revalidatePath(input.pathToRevalidate);
  return { ok: true, decisionId: data.decision_id, adrId: data.adr_id };
}
