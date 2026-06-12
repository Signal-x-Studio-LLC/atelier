import { describe, expect, it } from 'vitest';
import { extractAcs, slugify, normalizeVitest, normalizePlaywright, buildResults } from './index.ts';

describe('extractAcs', () => {
  it('pulls all story.ac refs from a scenario name, deduped', () => {
    expect(extractAcs('Example: signup → active (BRD §US-1.1 / US-9.2 / US-1.1)')).toEqual(['US-1.1', 'US-9.2']);
  });
  it('returns [] when no AC ref present', () => {
    expect(extractAcs('Root path redirects directly to /home @runnable')).toEqual([]);
  });
});

describe('slugify', () => {
  it('lowercases, collapses non-alnum, caps length', () => {
    expect(slugify('Example: annual subscription signup flow')).toBe('example-annual-subscription-signup-flow');
  });
});

describe('normalizeVitest', () => {
  it('explodes a multi-AC scenario into one run per AC; maps status', () => {
    const json = {
      testResults: [
        {
          name: 'apps/api/test/scenarios/example-flow.scenario.ts',
          assertionResults: [
            { ancestorTitles: ['Example: signup (BRD §US-1.1 / US-9.2)'], title: 'full scenario', status: 'passed' },
            { ancestorTitles: ['Example: OOS block (BRD §US-15.1)'], title: 'full scenario', status: 'failed' },
          ],
        },
      ],
    };
    const runs = normalizeVitest(json, '2026-06-10T00:00:00Z');
    expect(runs).toHaveLength(3); // US-1.1, US-9.2, US-15.1
    expect(runs.find((r) => r.ac === 'US-1.1')).toMatchObject({ status: 'passed', suite: 'api-scenarios' });
    expect(runs.find((r) => r.ac === 'US-15.1')?.status).toBe('failed');
  });

  it('records a scenario with no AC ref keyed by slug', () => {
    const runs = normalizeVitest(
      { testResults: [{ name: 'x.ts', assertionResults: [{ ancestorTitles: ['Some untagged scenario'], title: 'full scenario', status: 'passed' }] }] },
      'now',
    );
    expect(runs).toHaveLength(1);
    expect(runs[0].ac).toBe('some-untagged-scenario');
  });
});

describe('normalizePlaywright', () => {
  it('walks nested suites → specs and aggregates test attempts (failed wins)', () => {
    const json = {
      suites: [
        {
          file: 'e2e/behavior/legacy-url-redirect.feature.spec.js',
          specs: [
            { title: 'redirect /products (US-1.1)', tests: [{ status: 'expected' }] },
            { title: 'flaky one', tests: [{ status: 'passed' }, { status: 'failed' }] },
          ],
          suites: [{ specs: [{ title: 'nested @runnable no-ac', tests: [{ status: 'skipped' }] }] }],
        },
      ],
    };
    const runs = normalizePlaywright(json, 'now');
    expect(runs.find((r) => r.ac === 'US-1.1')).toMatchObject({ status: 'passed', suite: 'bdd-e2e' });
    expect(runs.find((r) => r.scenario === 'flaky-one')?.status).toBe('failed'); // failed wins
    expect(runs.find((r) => r.scenario === 'nested-runnable-no-ac')?.status).toBe('skipped');
  });
});

describe('buildResults', () => {
  it('stamps schema + commit and sorts runs deterministically', () => {
    const r = buildResults(
      [
        { ac: 'US-9.2', scenario: 'b', suite: 'api-scenarios', status: 'passed', ranAt: 'n', source: 'x' },
        { ac: 'US-1.1', scenario: 'a', suite: 'api-scenarios', status: 'passed', ranAt: 'n', source: 'x' },
      ],
      'abc123',
    );
    expect(r.schemaVersion).toBe('1.0');
    expect(r.as_of_commit).toBe('abc123');
    expect(r.runs.map((x) => x.ac)).toEqual(['US-1.1', 'US-9.2']); // sorted
  });
});
