#!/usr/bin/env -S npx tsx
//
// Smoke test: the DoD verdict fail-safe (ADR-061; candidate B). Covers the pure
// aggregation — the load-bearing rule is that absent / stale / unverifiable
// evidence can NEVER read COMPLIANT.
//
// Does NOT cover: live `atelier dod` git HEAD resolution + artifact read (the
// command is a thin wrapper around deriveDodVerdict, exercised manually).

import { deriveDodVerdict } from '../lib/dod-verdict.ts';

const HEAD = 'abc123';

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
  if (!ok) failures += 1;
}

const cap = (status: string) => ({ status });
const capRef = (status: string, reference: string) => ({ status, capability: { reference } });

// 1. No artifact -> MANUAL_REVIEW (never COMPLIANT).
{
  const r = deriveDodVerdict(null, HEAD);
  check('no artifact -> MANUAL_REVIEW', r.verdict === 'MANUAL_REVIEW', r.reason);
}

// 2. Stale artifact (as_of != HEAD) -> MANUAL_REVIEW, even if all capabilities pass.
{
  const r = deriveDodVerdict({ as_of_commit: 'OLD', capabilities: [cap('COMPLIANT')] }, HEAD);
  check('stale artifact -> MANUAL_REVIEW', r.verdict === 'MANUAL_REVIEW' && r.stale, r.reason);
}

// 3. All COMPLIANT, fresh -> COMPLIANT.
{
  const r = deriveDodVerdict({ as_of_commit: HEAD, capabilities: [cap('COMPLIANT'), cap('COMPLIANT')] }, HEAD);
  check('all COMPLIANT (fresh) -> COMPLIANT', r.verdict === 'COMPLIANT', r.reason);
}

// 4. ABSENT counts as pass (deliberate not-applicable).
{
  const r = deriveDodVerdict({ as_of_commit: HEAD, capabilities: [cap('COMPLIANT'), cap('ABSENT')] }, HEAD);
  check('COMPLIANT + ABSENT -> COMPLIANT', r.verdict === 'COMPLIANT', r.reason);
}

// 5. Any NON-COMPLIANT -> NON-COMPLIANT (definite red wins).
{
  const r = deriveDodVerdict({ as_of_commit: HEAD, capabilities: [cap('COMPLIANT'), cap('NON-COMPLIANT')] }, HEAD);
  check('one NON-COMPLIANT -> NON-COMPLIANT', r.verdict === 'NON-COMPLIANT', r.reason);
}

// 6. PARTIAL is blocking (not all checks pass = not done).
{
  const r = deriveDodVerdict({ as_of_commit: HEAD, capabilities: [cap('PARTIAL')] }, HEAD);
  check('PARTIAL -> NON-COMPLIANT', r.verdict === 'NON-COMPLIANT', r.reason);
}

// 7. Monotone rule: an indeterminate (ERROR/MANUAL_REVIEW) with no red still
//    cannot read COMPLIANT.
{
  const r = deriveDodVerdict({ as_of_commit: HEAD, capabilities: [cap('COMPLIANT'), cap('ERROR')] }, HEAD);
  check('COMPLIANT + ERROR -> MANUAL_REVIEW', r.verdict === 'MANUAL_REVIEW', r.reason);
}

// 8. Red beats indeterminate (blocking takes precedence over unknown).
{
  const r = deriveDodVerdict({ as_of_commit: HEAD, capabilities: [cap('ERROR'), cap('NON-COMPLIANT')] }, HEAD);
  check('ERROR + NON-COMPLIANT -> NON-COMPLIANT', r.verdict === 'NON-COMPLIANT', r.reason);
}

// --- Per-AC scoping (ADR-061) -------------------------------------------------

// 9. Scope to a trace id aggregates only its covering capabilities — an
//    unrelated red capability does not drag the scoped verdict down.
{
  const r = deriveDodVerdict({ as_of_commit: HEAD, capabilities: [
    capRef('NON-COMPLIANT', 'docs/functional/BRD.md § Epic-9 (unrelated)'),
    capRef('COMPLIANT', 'docs/functional/BRD.md § Epic-2 (Agent interop endpoint)'),
  ] }, HEAD, { traceIds: ['BRD:Epic-2'] });
  check('scope Epic-2 ignores unrelated Epic-9 red -> COMPLIANT', r.verdict === 'COMPLIANT' && r.scope === 'per-ac', r.reason);
}

// 10. Scope isolates the OTHER direction too: the covering capability is red.
{
  const r = deriveDodVerdict({ as_of_commit: HEAD, capabilities: [
    capRef('COMPLIANT', '§ Epic-9'),
    capRef('NON-COMPLIANT', '§ Epic-2 (Agent interop)'),
  ] }, HEAD, { traceIds: ['BRD:Epic-2'] });
  check('scope Epic-2 with a red cover -> NON-COMPLIANT', r.verdict === 'NON-COMPLIANT', r.reason);
}

// 11. No capability references the AC -> coverage gap (cannot read done).
{
  const r = deriveDodVerdict({ as_of_commit: HEAD, capabilities: [capRef('COMPLIANT', '§ Epic-3')] },
    HEAD, { traceIds: ['BRD:Epic-7'] });
  check('uncovered AC -> MANUAL_REVIEW (coverage gap)', r.verdict === 'MANUAL_REVIEW' && /coverage gap/.test(r.reason), r.reason);
}

// 12. Word boundary: Epic-2 must NOT match Epic-20.
{
  const r = deriveDodVerdict({ as_of_commit: HEAD, capabilities: [capRef('COMPLIANT', '§ Epic-20 (decoy)')] },
    HEAD, { traceIds: ['BRD:Epic-2'] });
  check('Epic-2 does not match Epic-20 -> coverage gap', r.verdict === 'MANUAL_REVIEW' && /coverage gap/.test(r.reason), r.reason);
}

console.log(failures === 0 ? '\ndod.smoke: ALL PASS' : `\ndod.smoke: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
