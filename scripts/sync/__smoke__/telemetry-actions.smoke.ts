#!/usr/bin/env -S npx tsx
//
// Telemetry action registry smoke.
//
// Enumerates every `action: '<literal>'` emit-site across the substrate
// codebase (scripts/sync, scripts/endpoint, scripts/coordination) and
// diffs against the registry at scripts/sync/lib/telemetry-actions.ts.
//
// Regression seam recommended by BB initiative Stage 4 Claim 3 fact-check:
// "add an action-name registry + smoke that enumerates expected action
// strings."
//
// Pass criteria:
//   - Every literal action: '<x>' emitted from substrate code is in
//     TELEMETRY_ACTIONS.
//   - Every TELEMETRY_ACTIONS entry has at least one emit-site EXCEPT
//     transport.sse_reconnect (registered for the SSE handler forecast
//     by ADR-055; no callsite today).
//
// Does NOT scan __smoke__ test files or eval harness scripts (which can
// emit synthetic action strings for harness telemetry without polluting
// the registry).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TELEMETRY_ACTIONS } from '../lib/telemetry-actions.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '../../..');

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  const status = ok ? 'PASS' : 'FAIL';
  const suffix = detail ? `  -- ${detail}` : '';
  console.log(`  ${status}  ${label}${suffix}`);
  if (!ok) failures += 1;
}

// ============================================================================
// Source walk
// ============================================================================

const SCAN_DIRS = [
  'scripts/sync',
  'scripts/endpoint',
  'scripts/coordination',
];

const EXCLUDE_DIRS = new Set([
  '__smoke__',
  '__tests__',
  'node_modules',
  'eval',
  'test',
]);

const EXCLUDE_FILES = new Set<string>([
  // The action-name registry itself contains the literals as a const tuple,
  // not as `action: '<x>'` syntax. The regex below would not match it
  // regardless, but be explicit.
  'scripts/sync/lib/telemetry-actions.ts',
  // Per BB Stage 4 validate doc: embed-pipeline.ts:60-63 uses
  // `action: 'inserted'|'updated'|'skipped'|'failed'` as TypeScript
  // discriminated-union tags for the embed-pipeline result, NOT telemetry
  // rows. Excluding to avoid false-positives.
  'scripts/coordination/lib/embed-pipeline.ts',
]);

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) {
      const rel = relative(REPO_ROOT, full);
      if (!EXCLUDE_FILES.has(rel)) out.push(full);
    }
  }
}

const files: string[] = [];
for (const d of SCAN_DIRS) {
  walk(join(REPO_ROOT, d), files);
}

// ============================================================================
// Action extraction
// ============================================================================

// Match `action: 'literal'` (object-literal property syntax) and
// `: TelemetryAction = 'literal'` (typed local-variable assignment).
// Captures the literal between quotes.
const ACTION_RES = [
  /\baction\s*:\s*['"]([a-z][a-z0-9_.]*)['"]/g,
  /:\s*TelemetryAction\s*=\s*['"]([a-z][a-z0-9_.]*)['"]/g,
];

const emittedActions = new Map<string, string[]>(); // action -> file paths

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  for (const re of ACTION_RES) {
    for (const match of content.matchAll(re)) {
      const action = match[1]!;
      const rel = relative(REPO_ROOT, file);
      if (!emittedActions.has(action)) emittedActions.set(action, []);
      emittedActions.get(action)!.push(rel);
    }
  }
}

// ============================================================================
// Diff against registry
// ============================================================================

console.log('Telemetry action registry smoke');
console.log('================================\n');

console.log(`Scanned ${files.length} substrate source files`);
console.log(`Registry: ${TELEMETRY_ACTIONS.length} declared actions`);
console.log(`Found: ${emittedActions.size} unique action literals\n`);

const registrySet = new Set<string>(TELEMETRY_ACTIONS);

// 1. Every emitted action must be in the registry
const unregistered: string[] = [];
for (const [action, sites] of emittedActions) {
  if (!registrySet.has(action)) {
    unregistered.push(`${action} (at ${sites.join(', ')})`);
  }
}
check(
  'Every emitted action is in the registry',
  unregistered.length === 0,
  unregistered.length > 0 ? `unregistered: ${unregistered.join('; ')}` : undefined,
);

// 2. Every registered action has an emit-site (except the forecast)
const FORECAST_NO_EMIT = new Set<string>(['transport.sse_reconnect']);
const orphans: string[] = [];
for (const action of TELEMETRY_ACTIONS) {
  if (FORECAST_NO_EMIT.has(action)) continue;
  if (!emittedActions.has(action)) {
    orphans.push(action);
  }
}
check(
  'Every registered action has at least one emit-site (excluding ADR-055 forecast)',
  orphans.length === 0,
  orphans.length > 0 ? `no emit-site: ${orphans.join(', ')}` : undefined,
);

// 3. The three Claim 3 actions are present in the registry
const CLAIM_3_ADDITIONS = ['lock.conflict', 'find_similar.degraded', 'transport.sse_reconnect'];
const missingClaim3 = CLAIM_3_ADDITIONS.filter((a) => !registrySet.has(a));
check(
  'BB Stage 4 Claim 3 — three actions registered',
  missingClaim3.length === 0,
  missingClaim3.length > 0 ? `missing from registry: ${missingClaim3.join(', ')}` : undefined,
);

// 4. lock.conflict + find_similar.degraded have emit-sites
const CLAIM_3_EMITTED = ['lock.conflict', 'find_similar.degraded'];
const missingEmit = CLAIM_3_EMITTED.filter((a) => !emittedActions.has(a));
check(
  'BB Stage 4 Claim 3 — lock.conflict + find_similar.degraded emit-sites wired',
  missingEmit.length === 0,
  missingEmit.length > 0 ? `no emit-site: ${missingEmit.join(', ')}` : undefined,
);

// ============================================================================
// Summary
// ============================================================================

console.log('');
if (failures === 0) {
  console.log(`PASS: telemetry-action registry smoke (${TELEMETRY_ACTIONS.length} registered, ${emittedActions.size} emit-sites)`);
  process.exit(0);
} else {
  console.error(`FAIL: ${failures} check(s) failed`);
  process.exit(1);
}
