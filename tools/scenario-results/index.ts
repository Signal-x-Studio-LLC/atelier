/**
 * tools/scenario-results — the gate-G4 reporter/normalizer.
 *
 * Reads the JSON output of the scenario suites (Jest/Vitest "json" reporter for
 * programmatic api-scenarios; Playwright "json" reporter for the bdd-e2e suite)
 * and emits the normalized `_scenario-results.json` artifact that the
 * state-derive `scenario_passes` check consumes. See
 * docs/methodology/dod-verification-ladder-pattern.md.
 *
 * It NEVER runs tests — it parses recorded evidence. The artifact is
 * automation-owned (the no-state-files gate keeps it uncommitted); the
 * derive-on-main job produces it ephemerally before state-derive runs.
 *
 * AC mapping: acceptance criteria are extracted from the scenario NAME by the
 * `§story.ac` prose convention (e.g. `BRD §US-1.1`) already used across the
 * suites. The machine-readable upgrade is explicit `acs:` / `@ac:` tags; when
 * those land the reporter prefers them. A scenario with no AC ref is still
 * recorded, keyed by its slug, so a tag can attach the AC without re-plumbing.
 *
 * Usage:
 *   tsx tools/scenario-results/index.ts \
 *     --vitest <jest-or-vitest-results.json> \
 *     --playwright <playwright-results.json> \
 *     --out docs/audits/derived/_scenario-results.json \
 *     [--commit <sha>]
 *
 * Any input flag may be omitted; absent inputs contribute no runs.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, relative } from 'node:path';
import type { ScenarioResults, ScenarioRun } from '../state-derive/types.ts';

const AC_RE = /\bUS-\d+\.\d+/g;

export function extractAcs(name: string): string[] {
  const matches = name.match(AC_RE);
  return matches ? Array.from(new Set(matches)) : [];
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

type Suite = ScenarioRun['suite'];

/** Map a raw status string from either reporter to the contract enum. */
function normStatus(raw: string): ScenarioRun['status'] {
  const s = raw.toLowerCase();
  if (s === 'passed' || s === 'pass' || s === 'expected') return 'passed';
  if (s === 'failed' || s === 'fail' || s === 'unexpected' || s === 'timedout') return 'failed';
  return 'skipped'; // skipped / pending / todo / disabled / flaky-unknown
}

/** Emit one run per AC ref; if a scenario names no AC, key it by its slug. */
function runsFor(name: string, status: ScenarioRun['status'], suite: Suite, source: string, ranAt: string): ScenarioRun[] {
  const scenario = slugify(name);
  const acs = extractAcs(name);
  const keys = acs.length > 0 ? acs : [scenario];
  return keys.map((ac) => ({ ac, scenario, suite, status, ranAt, source }));
}

/** Parse Jest/Vitest "json" reporter output. */
export function normalizeVitest(json: unknown, ranAt: string): ScenarioRun[] {
  const root = json as { testResults?: Array<{ name?: string; assertionResults?: Array<{ ancestorTitles?: string[]; title?: string; status?: string }> }> };
  const out: ScenarioRun[] = [];
  for (const file of root.testResults ?? []) {
    const source = relativize(file.name ?? '');
    for (const a of file.assertionResults ?? []) {
      // Scenario identity = the describe path (ancestorTitles). When a scenario
      // helper makes the leaf title boilerplate (e.g. 'full scenario'), the
      // describe path carries the AC-bearing name; fall back to the leaf only for
      // a top-level test() with no describe block.
      const ancestors = (a.ancestorTitles ?? []).filter(Boolean);
      const name = ancestors.length > 0 ? ancestors.join(' > ') : (a.title ?? '');
      if (!name) continue;
      out.push(...runsFor(name, normStatus(a.status ?? 'skipped'), 'api-scenarios', source, ranAt));
    }
  }
  return out;
}

/** Parse Playwright "json" reporter output (recursive suites → specs → tests). */
export function normalizePlaywright(json: unknown, ranAt: string): ScenarioRun[] {
  const out: ScenarioRun[] = [];
  type PwSuite = { title?: string; file?: string; specs?: PwSpec[]; suites?: PwSuite[] };
  type PwSpec = { title?: string; file?: string; tests?: Array<{ results?: Array<{ status?: string }>; status?: string }> };
  const walk = (suite: PwSuite) => {
    for (const spec of suite.specs ?? []) {
      const name = spec.title ?? '';
      if (!name) continue;
      const statuses = (spec.tests ?? []).map(
        (t) => t.status ?? (t.results ?? []).map((r) => r.status ?? '').slice(-1)[0] ?? 'skipped',
      );
      // Aggregate a spec's test attempts: failed if any failed, else passed if any passed.
      const status: ScenarioRun['status'] = statuses.some((s) => normStatus(s) === 'failed')
        ? 'failed'
        : statuses.some((s) => normStatus(s) === 'passed')
          ? 'passed'
          : 'skipped';
      out.push(...runsFor(name, status, 'bdd-e2e', relativize(spec.file ?? suite.file ?? ''), ranAt));
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  const root = json as { suites?: PwSuite[] };
  for (const s of root.suites ?? []) walk(s);
  return out;
}

/** Make a source path repo-relative (against cwd) so the artifact is portable. */
function relativize(p: string): string {
  if (!p) return p;
  try {
    const rel = relative(process.cwd(), p);
    return rel && !rel.startsWith('..') ? rel : p;
  } catch {
    return p;
  }
}

function readJson(path: string): unknown | null {
  if (!path || !existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function headCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

export function buildResults(runs: ScenarioRun[], commit: string): ScenarioResults {
  // Stable ordering for a deterministic, diff-friendly artifact.
  const sorted = [...runs].sort((a, b) => a.ac.localeCompare(b.ac) || a.scenario.localeCompare(b.scenario));
  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    as_of_commit: commit,
    runs: sorted,
  };
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] ?? '';
  }
  return out;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const out = args.out ?? 'docs/audits/derived/_scenario-results.json';
  const commit = args.commit || headCommit();
  const ranAt = new Date().toISOString();

  const runs: ScenarioRun[] = [];
  const vitest = readJson(args.vitest ?? '');
  if (vitest) runs.push(...normalizeVitest(vitest, ranAt));
  const playwright = readJson(args.playwright ?? '');
  if (playwright) runs.push(...normalizePlaywright(playwright, ranAt));

  const results = buildResults(runs, commit);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(results, null, 2)}\n`, 'utf8');

  const acs = new Set(runs.map((r) => r.ac));
  const passed = new Set(runs.filter((r) => r.status === 'passed').map((r) => r.ac));
  const failed = new Set(runs.filter((r) => r.status === 'failed').map((r) => r.ac));
  console.log(`scenario-results → ${out}`);
  console.log(`  runs: ${runs.length}  ·  ACs: ${acs.size}  ·  passed-ACs: ${passed.size}  ·  failed-ACs: ${failed.size}  ·  as_of ${commit.slice(0, 8) || '(no git)'}`);
}

// Run as CLI when invoked directly (tsx index.ts ...).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
