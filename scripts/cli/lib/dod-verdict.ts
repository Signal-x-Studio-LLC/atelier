// DoD verdict reader — the coordinator side of the Blueprint↔hive contract.
//
// Reads the state-derive artifact (docs/state/_state.json) and computes an
// aggregate "is this done?" verdict with a fail-safe borrowed from Blueprint's
// DoD verification ladder: never read COMPLIANT on absent / stale / unverifiable
// evidence. A "done" must be earned by passing evidence, not asserted by its
// absence. See ADR-061 and Blueprint METHODOLOGY-AMENDMENTS.md (2026-06-11,
// candidate B: coordinator task-completion reads the DoD verdict).
//
// Two modes:
//   - repo-level   (no traceIds): aggregate every acceptance capability.
//   - per-AC scoped (traceIds):   aggregate only the capabilities that cover a
//     contribution's trace_ids (e.g. ['BRD:Epic-2']), so a contribution gates
//     on ITS own acceptance, not the whole repo. The join is the capability's
//     prose `reference` (which cites the bare 'Epic-N' token), word-boundary
//     matched. An AC with no covering capability is a coverage gap -> it cannot
//     read done.
//
// Pure (deriveDodVerdict) + fs wrapper (readDodVerdict) split so the fail-safe
// logic is testable without a checkout.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type DodVerdict = 'COMPLIANT' | 'NON-COMPLIANT' | 'MANUAL_REVIEW';

export interface DodVerdictResult {
  verdict: DodVerdict;
  reason: string;
  asOfCommit: string | null;
  headCommit: string;
  stale: boolean;
  scope: 'repo' | 'per-ac';
  counts: { pass: number; blocking: number; indeterminate: number; total: number };
}

export interface DeriveOptions {
  /**
   * Scope the verdict to the capabilities covering any of these trace ids
   * (a contribution's trace_ids, e.g. ['BRD:Epic-2']). Omitted/empty = repo-level.
   */
  traceIds?: readonly string[];
}

// Minimal shape read from docs/state/_state.json. Kept local on purpose so the
// gate does not couple to tools/state-derive's package internals — it depends
// only on the artifact contract (as_of_commit + capabilities[].status, plus the
// capability.reference prose used for the per-AC join).
interface DerivedState {
  as_of_commit?: unknown;
  capabilities?: Array<{ status?: unknown; capability?: { reference?: unknown } }>;
}

export const STATE_PATH = 'docs/state/_state.json';

// Status taxonomy (tools/state-derive/types.ts § Status):
//   COMPLIANT | ABSENT      -> pass         (done, or deliberately not-applicable)
//   NON-COMPLIANT | PARTIAL -> blocking     (definitively not done)
//   ERROR | MANUAL_REVIEW   -> indeterminate(could not verify mechanically)
const PASS = new Set(['COMPLIANT', 'ABSENT']);
const BLOCKING = new Set(['NON-COMPLIANT', 'PARTIAL']);

/**
 * Does a capability's `reference` cover `traceId`? Contribution trace ids are
 * namespaced (BRD:Epic-2); references cite the bare token (§ Epic-2). Match on
 * the full id and its post-colon suffix, word-boundary anchored so 'Epic-2'
 * does not match 'Epic-20'.
 */
function referenceCoversTrace(reference: string, traceId: string): boolean {
  const i = traceId.indexOf(':');
  const candidates = i >= 0 ? [traceId, traceId.slice(i + 1)] : [traceId];
  return candidates.some((tok) => {
    if (!tok) return false;
    const esc = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${esc}\\b`).test(reference);
  });
}

/**
 * Aggregate a parsed state-derive artifact into one completion verdict.
 *
 * Fail-safe order (a missing/stale/uncertain signal can never read COMPLIANT):
 *   1. no artifact                          -> MANUAL_REVIEW
 *   2. per-AC scope, no covering capability -> MANUAL_REVIEW (coverage gap)
 *   3. as_of_commit != HEAD                 -> MANUAL_REVIEW (stale)
 *   4. any blocking capability              -> NON-COMPLIANT
 *   5. any indeterminate                    -> MANUAL_REVIEW (monotone rule)
 *   6. all pass                             -> COMPLIANT
 */
export function deriveDodVerdict(
  state: DerivedState | null,
  headCommit: string,
  opts: DeriveOptions = {},
): DodVerdictResult {
  const traceIds = opts.traceIds && opts.traceIds.length > 0 ? opts.traceIds : null;
  const scope: 'repo' | 'per-ac' = traceIds ? 'per-ac' : 'repo';
  const label = traceIds ? ` for ${traceIds.join(', ')}` : '';
  const zero = { pass: 0, blocking: 0, indeterminate: 0, total: 0 };

  if (!state || !Array.isArray(state.capabilities)) {
    return {
      verdict: 'MANUAL_REVIEW', headCommit, asOfCommit: null, stale: false, scope, counts: zero,
      reason: `no usable ${STATE_PATH} (run state-derive); completion cannot be verified`,
    };
  }

  const asOfCommit = typeof state.as_of_commit === 'string' ? state.as_of_commit : null;
  const stale = asOfCommit !== headCommit;

  // Scope to the contribution's acceptance capabilities. Coverage is structural
  // (which capabilities cite the AC) and so commit-independent — check it before
  // staleness, which only gates the status-based verdict below.
  let caps = state.capabilities;
  if (traceIds) {
    caps = caps.filter((c) => {
      const ref = typeof c?.capability?.reference === 'string' ? c.capability.reference : '';
      return ref !== '' && traceIds.some((t) => referenceCoversTrace(ref, t));
    });
    if (caps.length === 0) {
      return {
        verdict: 'MANUAL_REVIEW', headCommit, asOfCommit, stale, scope, counts: zero,
        reason: `no acceptance capability references${label}; DoD coverage gap`,
      };
    }
  }

  let pass = 0, blocking = 0, indeterminate = 0;
  for (const cap of caps) {
    const s = String(cap?.status ?? '');
    if (PASS.has(s)) pass++;
    else if (BLOCKING.has(s)) blocking++;
    else indeterminate++;
  }
  const counts = { pass, blocking, indeterminate, total: caps.length };

  if (stale) {
    return {
      verdict: 'MANUAL_REVIEW', headCommit, asOfCommit, stale: true, scope, counts,
      reason: `${STATE_PATH} is stale (as_of ${asOfCommit ?? 'unknown'} != HEAD ${headCommit}); re-run state-derive on HEAD`,
    };
  }
  if (blocking > 0) {
    return {
      verdict: 'NON-COMPLIANT', headCommit, asOfCommit, stale: false, scope, counts,
      reason: `${blocking}/${counts.total} capabilities not done (NON-COMPLIANT/PARTIAL)${label}`,
    };
  }
  if (indeterminate > 0) {
    return {
      verdict: 'MANUAL_REVIEW', headCommit, asOfCommit, stale: false, scope, counts,
      reason: `${indeterminate}/${counts.total} capabilities unverifiable (ERROR/MANUAL_REVIEW)${label}; cannot claim done`,
    };
  }
  return {
    verdict: 'COMPLIANT', headCommit, asOfCommit, stale: false, scope, counts,
    reason: `${counts.total}/${counts.total} capabilities COMPLIANT${label}`,
  };
}

/** Read + parse the artifact, then derive. Absent/unparseable -> fail-safe MANUAL_REVIEW. */
export async function readDodVerdict(
  repoRoot: string,
  headCommit: string,
  opts: DeriveOptions = {},
): Promise<DodVerdictResult> {
  let state: DerivedState | null = null;
  try {
    state = JSON.parse(await readFile(resolve(repoRoot, STATE_PATH), 'utf8')) as DerivedState;
  } catch {
    state = null;
  }
  return deriveDodVerdict(state, headCommit, opts);
}
