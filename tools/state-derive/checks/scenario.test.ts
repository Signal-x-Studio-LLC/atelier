import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scenarioPasses } from './scenario.ts';
import { aggregateStatus } from '../derive.ts';
import type { Check, ScenarioResults } from '../types.ts';

const RESULTS_REL = 'docs/audits/derived/_scenario-results.json';

function writeResults(root: string, results: ScenarioResults): void {
  const dir = join(root, 'docs/audits/derived');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(root, RESULTS_REL), JSON.stringify(results), 'utf8');
}

function check(ac: string): Check & { type: 'scenario_passes' } {
  return { type: 'scenario_passes', ac };
}

function results(runs: ScenarioResults['runs'], asOf = ''): ScenarioResults {
  return { schemaVersion: '1.0', generatedAt: new Date().toISOString(), as_of_commit: asOf, runs };
}

describe('scenario_passes primitive (gate G4)', () => {
  let root: string;
  beforeEach(() => {
    // Non-git temp dir → `git rev-parse HEAD` fails → staleness guard skipped.
    root = mkdtempSync(join(tmpdir(), 'scenpass-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('UNKNOWN when the artifact is absent (never COMPLIANT)', () => {
    const r = scenarioPasses(root, check('US-1.1'));
    expect(r.unknown).toBe(true);
    expect(r.matched).toBe(false);
    expect(aggregateStatus([r])).toBe('MANUAL_REVIEW');
  });

  it('UNKNOWN when no run is recorded for the AC', () => {
    writeResults(root, results([{ ac: 'US-9.9', scenario: 's', suite: 'api-scenarios', status: 'passed', ranAt: '', source: 'x' }]));
    const r = scenarioPasses(root, check('US-1.1'));
    expect(r.unknown).toBe(true);
    expect(aggregateStatus([r])).toBe('MANUAL_REVIEW');
  });

  it('COMPLIANT when ≥1 passed and 0 failed', () => {
    writeResults(root, results([{ ac: 'US-1.1', scenario: 'signup-happy-path', suite: 'api-scenarios', status: 'passed', ranAt: '', source: 'x' }]));
    const r = scenarioPasses(root, check('US-1.1'));
    expect(r.matched).toBe(true);
    expect(r.unknown).toBeFalsy();
    expect(aggregateStatus([r])).toBe('COMPLIANT');
  });

  it('NON-COMPLIANT when any run failed (not unknown — a real fail)', () => {
    writeResults(root, results([
      { ac: 'US-1.1', scenario: 'a', suite: 'api-scenarios', status: 'passed', ranAt: '', source: 'x' },
      { ac: 'US-1.1', scenario: 'b', suite: 'api-scenarios', status: 'failed', ranAt: '', source: 'x' },
    ]));
    const r = scenarioPasses(root, check('US-1.1'));
    expect(r.matched).toBe(false);
    expect(r.unknown).toBeFalsy();
    expect(aggregateStatus([r])).toBe('NON-COMPLIANT');
  });

  it('UNKNOWN when only skipped runs exist', () => {
    writeResults(root, results([{ ac: 'US-1.1', scenario: 's', suite: 'bdd-e2e', status: 'skipped', ranAt: '', source: 'x' }]));
    const r = scenarioPasses(root, check('US-1.1'));
    expect(r.unknown).toBe(true);
    expect(aggregateStatus([r])).toBe('MANUAL_REVIEW');
  });

  it('UNKNOWN (stale) when as_of_commit != HEAD', () => {
    // Real git repo so `git rev-parse HEAD` returns a real sha that won't match.
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 't@t'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
    writeFileSync(join(root, 'f'), 'x');
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'init'], { cwd: root });
    writeResults(root, results(
      [{ ac: 'US-1.1', scenario: 'happy-path', suite: 'api-scenarios', status: 'passed', ranAt: '', source: 'x' }],
      '0000000000000000000000000000000000000000',
    ));
    const r = scenarioPasses(root, check('US-1.1'));
    expect(r.unknown).toBe(true);
    expect(r.matched).toBe(false);
    expect(aggregateStatus([r])).toBe('MANUAL_REVIEW');
  });

  it('monotone: a passing presence check + an unknown G4 → MANUAL_REVIEW (cannot claim done)', () => {
    const presence = { check: { type: 'file_exists', path: 'x' } as Check, matched: true, evidence: [] };
    const g4unknown = scenarioPasses(root, check('US-1.1')); // absent → unknown
    expect(aggregateStatus([presence, g4unknown])).toBe('MANUAL_REVIEW');
  });
});
