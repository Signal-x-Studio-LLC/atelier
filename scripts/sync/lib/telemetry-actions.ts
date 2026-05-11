/**
 * Telemetry action registry.
 *
 * Per BB initiative Stage 4 fact-check (Claim 3), the substrate emits
 * telemetry action strings as free-text scattered across `write.ts` +
 * the endpoint handlers. This module is the single grep-target so
 * doc-writers can enumerate the surface without spelunking.
 *
 * To add a new action:
 *   1. Add the literal to `TELEMETRY_ACTIONS` below.
 *   2. Emit it at the new callsite using the literal string (TypeScript
 *      narrows to `TelemetryAction` via the union).
 *   3. The `telemetry-action-registry.smoke.ts` smoke greps the codebase
 *      for `action: '<literal>'` and diffs against this registry --
 *      additions land green only when the smoke knows about them.
 *
 * Per ADR-013 / ADR-040: the MCP tool surface is locked at 18 tools
 * post-ADR-054. Telemetry actions are NOT subject to that lock --
 * additions here are additive observability, not tool-surface changes.
 * The narrowness on telemetry is editorial (one grep-target), not
 * load-bearing.
 */

export const TELEMETRY_ACTIONS = [
  // Session lifecycle (scripts/sync/lib/write.ts ~lines 519, 620)
  'session.created',
  'session.deregistered',

  // Contribution lifecycle (scripts/sync/lib/write.ts ~lines 973-1532)
  'contribution.claimed',
  'contribution.updated',
  'contribution.plan_submitted',
  'contribution.plan_resubmitted',
  'contribution.plan_approved',
  'contribution.plan_rejected',
  'contribution.approval_recorded',
  'contribution.released',

  // Lock lifecycle (scripts/sync/lib/write.ts ~lines 1640, 1679)
  'lock.acquired',
  'lock.released',
  /**
   * BB Stage 4 Claim 3 — emitted at acquireLock's overlap-detected throw
   * path (write.ts ~line 1607). Captures requested_scope + existing
   * holder so operators can surface lock-contention hotspots.
   */
  'lock.conflict',

  // Decision lifecycle (scripts/sync/lib/write.ts ~line 1768)
  'decision.logged',

  /**
   * BB Stage 4 Claim 3 — emitted at find_similar's keyword-fallback
   * entry (endpoint/lib/find-similar.ts ~line 204). Operators get a
   * direct signal that the vector path is unavailable rather than
   * inferring it from response shape.
   */
  'find_similar.degraded',

  /**
   * BB Stage 4 Claim 3 — registered for the SSE keep-alive handler
   * forecast by ADR-055 (SSE supersedes Supabase Realtime). No
   * emit-site today; the transport layer (endpoint/lib/transport.ts)
   * does not yet implement SSE. When the SSE handler lands, it emits
   * this action on each client reconnect.
   */
  'transport.sse_reconnect',

  // ADR-054 brainstorm primitives (G1 / webapp v2 integration.md).
  // Each emit-site lives in scripts/sync/lib/write.ts in the
  // corresponding propose/react/synthesize/approvePlan method.
  'proposal.created',
  'proposal.reacted',
  'proposal.synthesized',
  'plan.approved',
] as const;

export type TelemetryAction = (typeof TELEMETRY_ACTIONS)[number];

/**
 * Helper: assert a free-text string is a registered action. Used at
 * callsites that build the action string dynamically (e.g., from
 * configuration). Throws at runtime if the string isn't in the
 * registry -- prevents silent registry drift.
 *
 * Static emit-sites should use the literal string directly so TypeScript
 * narrows; this helper is for the rare dynamic case.
 */
export function asTelemetryAction(value: string): TelemetryAction {
  if ((TELEMETRY_ACTIONS as readonly string[]).includes(value)) {
    return value as TelemetryAction;
  }
  throw new Error(
    `Unknown telemetry action '${value}' -- add to scripts/sync/lib/telemetry-actions.ts`,
  );
}
