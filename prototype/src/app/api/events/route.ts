// SSE broadcast endpoint — per ADR-055 + ARCH §6.8.
//
// GET /api/events?project_id=<uuid>
// Headers: Authorization: Bearer <jwt>
//
// Behavior:
//   1. Validate bearer (jwksVerifierFromEnv) and resolve to composer + project.
//   2. Authorize: the composer's project_id MUST match the query param.
//      Per ADR-051 RLS pattern, project membership is enforced; cross-project
//      subscription attempts return 403.
//   3. Forward the upgraded request to the per-project Durable Object instance,
//      which holds the SSE stream open and writes envelopes as they arrive.
//
// Failure modes:
//   - Missing project_id query param: 400
//   - Missing/invalid bearer: 401
//   - Composer not in queried project: 403
//   - DO binding not configured (operator hasn't enabled CF deploy): 503
//
// Runtime: Node.js per OpenNext-on-CF (Workers compatibility). The DO
// binding is resolved through @opennextjs/cloudflare's getCloudflareContext
// which exposes the Workers env to the Next.js handler.

import { getMcpDeps, primeCloudflareDoNamespace } from '../../../lib/atelier/mcp-deps.ts';
import { authenticate } from '../../../../../scripts/endpoint/lib/auth.ts';
import { AtelierError } from '../../../../../scripts/sync/lib/write.ts';
import { resolveBearer } from '../../../lib/atelier/session.ts';
import { nextCookieAdapter } from '../../../lib/atelier/adapters/next-cookies.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CloudflareEnv {
  ATELIER_BROADCAST?: {
    idFromName(name: string): { toString(): string };
    get(id: { toString(): string }): {
      fetch(input: string, init?: { method?: string; headers?: Record<string, string> }): Promise<Response>;
    };
  };
}

async function getDoNamespace(): Promise<CloudflareEnv['ATELIER_BROADCAST'] | null> {
  // Lazy import so the route compiles in non-Workers environments (e.g.
  // `next dev`, the smoke harness running under tsx). Outside CF Workers,
  // getCloudflareContext throws; the catch returns null and the route
  // surfaces 503 to the subscriber.
  try {
    const mod = (await import('@opennextjs/cloudflare')) as {
      getCloudflareContext?: () => { env: CloudflareEnv } | null;
    };
    const ctx = mod.getCloudflareContext?.() ?? null;
    return ctx?.env.ATELIER_BROADCAST ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('project_id');
  if (!projectId) {
    return jsonError(400, 'project_id query parameter is required');
  }
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) {
    return jsonError(400, 'project_id must be a UUID');
  }

  // Bearer resolution order (mirrors _actions/log-decision.ts):
  //   1. Authorization: Bearer <jwt> header — used by curl + tooling
  //   2. Supabase Auth cookie — used by browser EventSource (cookies flow
  //      same-origin; the EventSource API does not allow custom headers)
  //   3. ATELIER_DEV_BEARER env opt-in for local dev
  const authHeader = request.headers.get('authorization') ?? '';
  let bearer = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  if (!bearer) {
    const { cookies: nextCookies } = await import('next/headers');
    const cookieStore = await nextCookies();
    const cookies = nextCookieAdapter(cookieStore);
    bearer = (await resolveBearer(request, { cookies })) ?? '';
  }
  if (!bearer) {
    return jsonError(401, 'missing bearer token');
  }

  const deps = getMcpDeps();
  let auth;
  try {
    // Mirror dispatch.ts:117-119: AtelierClient.pool is private; cast to
    // expose the underlying pg.Pool for the auth path. Both routes share
    // the same singleton client via mcp-deps.
    // Two-step cast: prototype + root resolve different @types/pg copies,
    // so the structural Pool types are not nominally compatible across
    // the boundary. The seam is internal; pg.Pool is duck-typed by
    // authenticate via .query() so the runtime contract holds.
    auth = await authenticate(
      bearer,
      deps.verifier,
      (deps.client as unknown as { pool: unknown }).pool as Parameters<typeof authenticate>[2],
    );
  } catch (err) {
    if (err instanceof AtelierError && err.code === 'FORBIDDEN') {
      return jsonError(401, err.message);
    }
    throw err;
  }
  if (auth.projectId !== projectId) {
    return jsonError(
      403,
      `composer ${auth.composerId} is not a member of project ${projectId}`,
    );
  }

  const ns = await getDoNamespace();
  if (!ns) {
    return jsonError(
      503,
      'ATELIER_BROADCAST Durable Object binding not configured; ' +
        'SSE broadcast requires deployment on Cloudflare Workers per ADR-052/055',
    );
  }
  // Prime mcp-deps with the resolved namespace so subsequent MCP writes
  // publish through the same DO instance the subscribers are listening
  // on. Idempotent; primes only once per process lifetime.
  primeCloudflareDoNamespace(ns);

  const id = ns.idFromName(projectId);
  const stub = ns.get(id);
  // The DO's /subscribe endpoint returns a streaming SSE Response; we
  // pass it through to the client unchanged. Workers' Response objects
  // are streamable and Next.js (under OpenNext) forwards the stream.
  return stub.fetch('https://atelier-do.internal/subscribe', {
    method: 'GET',
    headers: {
      // Forward the composer identity for DO-side observability; the DO
      // does not re-authenticate (route already did) but logs the bind.
      'X-Atelier-Composer-Id': auth.composerId,
    },
  });
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
