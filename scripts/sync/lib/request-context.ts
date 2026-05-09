// Per-request auth context, propagated via Node AsyncLocalStorage.
//
// Per ADR-051. The MCP dispatcher enters this context once per tools/call
// after authenticate() resolves the AuthContext from the bearer JWT. The
// context flows transparently through every awaited call inside the
// handler, including AtelierClient methods, without touching public
// method signatures.
//
// AtelierClient.tx() reads the context and, when set, runs:
//   SELECT set_config('request.jwt.claims', $claims, true);
//   SET LOCAL ROLE atelier_runtime;
// after BEGIN. RLS policies engage on every statement inside the
// transaction.
//
// When no context is set (sync paths, schema-invariants smoke, M1 seed
// scripts), tx() runs as the pool's default role (postgres superuser),
// which has BYPASSRLS. Sync invariants do not regress.

import { AsyncLocalStorage } from 'node:async_hooks';

export interface AtelierRequestContext {
  /** identity_subject from the validated bearer JWT */
  sub: string;
  /** resolved composer.id (immortal per ADR-036) */
  composerId: string;
  /** resolved composer's project_id */
  projectId: string;
  /** optional email claim (passthrough; not used in RLS) */
  email?: string;
}

const storage = new AsyncLocalStorage<AtelierRequestContext>();

export function getRequestContext(): AtelierRequestContext | undefined {
  return storage.getStore();
}

export function runWithRequestContext<T>(
  ctx: AtelierRequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(ctx, fn);
}

/**
 * Build the JWT claims envelope that PostgreSQL `auth.jwt()` reads
 * from `request.jwt.claims`. The envelope is server-issued; only `sub`
 * is forwarded from the client bearer. composer_id and project_id are
 * server-resolved values from the authenticate() flow.
 */
export function claimsForContext(ctx: AtelierRequestContext): string {
  return JSON.stringify({
    sub: ctx.sub,
    composer_id: ctx.composerId,
    project_id: ctx.projectId,
    ...(ctx.email !== undefined ? { email: ctx.email } : {}),
  });
}
