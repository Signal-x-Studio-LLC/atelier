import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import type { Check, CheckResult, ScenarioResults } from '../types.ts';

const DEFAULT_RESULTS_PATH = 'docs/audits/derived/_scenario-results.json';

/**
 * Gate G4 (behavior) — the only non-presence check primitive. Asserts that the
 * acceptance criterion named by `check.ac` has at least one runnable scenario
 * that PASSED, by reading the CI-produced `_scenario-results.json` artifact
 * (written by tools/scenario-results/). This check NEVER executes tests — it
 * parses recorded evidence. See docs/methodology/dod-verification-ladder-pattern.md.
 *
 * Fail-safe contract:
 *   - artifact absent / unparseable / no run for this AC  → `unknown` (→ MANUAL_REVIEW)
 *   - artifact stale (as_of_commit != current HEAD)        → `unknown` (→ MANUAL_REVIEW)
 *   - any recorded `failed` run for this AC                → matched=false (→ NON-COMPLIANT)
 *   - ≥1 `passed` and 0 `failed`                           → matched=true  (→ COMPLIANT)
 *   - only `skipped` runs                                  → `unknown` (→ MANUAL_REVIEW)
 *
 * An `unknown` result can never read COMPLIANT — a missing scenario must not look
 * like a passing one.
 */
export function scenarioPasses(
  repoRoot: string,
  check: Check & { type: 'scenario_passes' },
): CheckResult {
  const relPath = check.results_path ?? DEFAULT_RESULTS_PATH;
  const absPath = join(repoRoot, relPath);

  if (!existsSync(absPath)) {
    return {
      check,
      matched: false,
      unknown: true,
      evidence: [`G4 UNKNOWN — no scenario-results artifact at ${relPath} (run the scenario suites + tools/scenario-results)`],
    };
  }

  let results: ScenarioResults;
  try {
    results = JSON.parse(readFileSync(absPath, 'utf8')) as ScenarioResults;
  } catch (err) {
    return {
      check,
      matched: false,
      unknown: true,
      evidence: [`G4 UNKNOWN — could not parse ${relPath}: ${(err as Error).message}`],
    };
  }

  // Staleness guard: results that predate the current commit are not evidence for
  // the current code. Compare the artifact's as_of_commit to HEAD.
  let head = '';
  try {
    head = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'ignore'], // suppress "fatal: not a git repository" leak
    })
      .toString()
      .trim();
  } catch {
    /* not a git checkout (or git unavailable) — skip staleness, fall through */
  }
  if (head && results.as_of_commit && results.as_of_commit !== head) {
    return {
      check,
      matched: false,
      unknown: true,
      evidence: [
        `G4 UNKNOWN (stale) — results as_of ${results.as_of_commit.slice(0, 8)} != HEAD ${head.slice(0, 8)}; re-run the scenario suites`,
      ],
    };
  }

  const runs = (results.runs ?? []).filter((r) => r.ac === check.ac);
  if (runs.length === 0) {
    return {
      check,
      matched: false,
      unknown: true,
      evidence: [`G4 UNKNOWN — no scenario run recorded for ${check.ac}`],
    };
  }

  const failed = runs.filter((r) => r.status === 'failed');
  const passed = runs.filter((r) => r.status === 'passed');

  if (failed.length > 0) {
    return {
      check,
      matched: false,
      evidence: [`G4 FAILED — ${check.ac}: ${failed.map((r) => r.scenario).join(', ')} failed`],
    };
  }
  if (passed.length > 0) {
    return {
      check,
      matched: true,
      evidence: [`G4 passed — ${check.ac}: ${passed.map((r) => r.scenario).join(', ')}`],
    };
  }
  // Only skipped runs.
  return {
    check,
    matched: false,
    unknown: true,
    evidence: [`G4 UNKNOWN — ${check.ac}: only skipped runs (${runs.map((r) => r.scenario).join(', ')})`],
  };
}
