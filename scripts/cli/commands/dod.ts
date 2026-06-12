// `atelier dod` — definition-of-done completion gate.
//
// Candidate B of the Blueprint↔hive wiring contract (ADR-061): "the coordinator's
// task-completion reads the DoD verdict." It runs where the state-derive artifact
// lives — a checkout / CI — NOT inside the live MCP endpoint, which is a pure
// Postgres write path with no repo on disk (write.ts § update). Atelier's real
// completion is the git merge (contribution_state -> merged), so the gate belongs
// at the CI/merge layer that already owns that transition.

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readDodVerdict } from '../lib/dod-verdict.ts';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');

export const dodUsage = `atelier dod — definition-of-done completion gate

Reads the state-derive verdict (docs/state/_state.json) and reports whether the
repo's acceptance capabilities are done. The coordinator side of the Blueprint↔
hive contract: "completion reads the DoD verdict" (ADR-061). Wire it into CI
before merge — a contribution's git merge (state -> merged) is atelier's real
completion, and that is where the verdict gate belongs.

Usage:
  atelier dod [--trace-id <id>]... [--strict] [--json]

Options:
  --trace-id Scope the verdict to a contribution's acceptance capabilities
             (its trace_ids, e.g. BRD:Epic-2). Repeatable, and accepts a
             comma-separated list. Omitted = repo-level (every capability). An
             AC with no covering capability is a coverage gap -> MANUAL_REVIEW.
  --strict   Treat MANUAL_REVIEW (absent / stale / unverifiable / uncovered) as
             a failure (exit 1). Default: MANUAL_REVIEW warns but exits 0; only a
             definite NON-COMPLIANT blocks.
  --json     Emit the full verdict as JSON.

Exit codes:
  0  COMPLIANT (or MANUAL_REVIEW without --strict)
  1  NON-COMPLIANT (or MANUAL_REVIEW with --strict)

Fail-safe: an absent or stale artifact never reads COMPLIANT — it reads
MANUAL_REVIEW, so a missing state-derive run can never look like done.
`;

function parseTraceIds(args: readonly string[]): string[] {
  const ids: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === undefined) continue;
    let raw: string | undefined;
    if (a.startsWith('--trace-id=')) raw = a.slice('--trace-id='.length);
    else if (a === '--trace-id') raw = args[++i];
    if (raw) ids.push(...raw.split(',').map((s) => s.trim()).filter(Boolean));
  }
  return ids;
}

export async function runDod(args: readonly string[]): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(dodUsage);
    return 0;
  }
  const strict = args.includes('--strict');
  const json = args.includes('--json');
  const traceIds = parseTraceIds(args);

  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (head.status !== 0) {
    console.error('atelier dod: could not resolve git HEAD');
    return 1;
  }
  const result = await readDodVerdict(REPO_ROOT, head.stdout.trim(), { traceIds });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const mark = result.verdict === 'COMPLIANT' ? 'OK' : result.verdict === 'NON-COMPLIANT' ? 'BLOCK' : 'REVIEW';
    console.log(`atelier dod — ${result.verdict}  [${mark}]  (${result.scope}${traceIds.length ? `: ${traceIds.join(', ')}` : ''})`);
    console.log(`  ${result.reason}`);
    console.log(`  capabilities: ${result.counts.pass} pass · ${result.counts.blocking} blocking · ${result.counts.indeterminate} indeterminate (of ${result.counts.total})`);
    if (result.asOfCommit) {
      console.log(`  artifact as_of ${result.asOfCommit}${result.stale ? `  (stale; HEAD ${result.headCommit})` : ''}`);
    }
  }

  if (result.verdict === 'NON-COMPLIANT') return 1;
  if (result.verdict === 'MANUAL_REVIEW') return strict ? 1 : 0;
  return 0;
}
