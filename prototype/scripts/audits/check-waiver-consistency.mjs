#!/usr/bin/env node
/**
 * check-waiver-consistency (ADR-060 PR A).
 *
 * Two consistency checks for the design-system waiver list:
 *
 *   1. Every waiver entry has `until_pr` set to one of B|C|D|E.
 *      Catches a regression where an entry was added without a binding
 *      to the migration PR that retires it (would let the waiver
 *      live forever).
 *
 *   2. If the current branch matches `feat/design-system-pr-<letter>-*`
 *      then the waiver list MUST NOT contain any entries citing
 *      `until_pr: '<LETTER>'`. The branch is the migration PR for that
 *      letter; CI fails the PR if it does not retire its entries.
 *      Override with `ALLOW_UNRETIRED_WAIVERS=1` for partial-progress
 *      builds (rare; expected to be used only for draft PRs).
 *
 * Branch detection:
 *   - Reads `GITHUB_HEAD_REF` (PR branch on GitHub Actions) first,
 *     falls back to `git rev-parse --abbrev-ref HEAD`.
 *   - Outside the feat/design-system-pr-* shape, check 2 is skipped.
 *
 * Usage: `node prototype/scripts/audits/check-waiver-consistency.mjs`
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const REPO_ROOT = resolve(process.cwd());
const WAIVERS_TS = resolve(REPO_ROOT, 'prototype/scripts/audits/design-system-waivers.ts');

function parseWaivers() {
  // ADR-060 PR E: the waiver file is deleted at the end of the migration
  // sequence. Treat absence as the expected end state — all migrations
  // complete, audit gates fully enforced, no waivers remain.
  if (!existsSync(WAIVERS_TS)) return [];
  const src = readFileSync(WAIVERS_TS, 'utf8');
  // Match each object literal that contains `path:` AND `until_pr:` (or that
  // is missing one). We accumulate two streams: full entries and entries
  // that look like waivers but are missing `until_pr`.
  const entries = [];
  // Walk every top-level `{ ... }` block inside the `waivers: Waiver[] = [...]`.
  // The blocks are simple; a regex over the whole file suffices because each
  // entry is on its own multi-line block delimited by `},`.
  const blockRe = /\{\s*([\s\S]*?)\s*\}\s*,/g;
  let m;
  while ((m = blockRe.exec(src)) !== null) {
    const body = m[1];
    if (!/path:/.test(body)) continue;
    const pathMatch = body.match(/path:\s*['"`]([^'"`]+)['"`]/);
    const untilMatch = body.match(/until_pr:\s*['"`]([^'"`]+)['"`]/);
    entries.push({
      path: pathMatch ? pathMatch[1] : null,
      until_pr: untilMatch ? untilMatch[1] : null,
    });
  }
  return entries;
}

function currentBranch() {
  const env = process.env.GITHUB_HEAD_REF;
  if (env) return env;
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const VALID_LETTERS = new Set(['B', 'C', 'D', 'E']);

function main() {
  const waivers = parseWaivers();
  if (waivers.length === 0 && !existsSync(WAIVERS_TS)) {
    console.log(
      'check-waiver-consistency: PASS  waiver file absent (ADR-060 PR E end state; audit gates fully enforced)',
    );
    process.exit(0);
  }
  const errors = [];

  // Check 1 — every entry has until_pr set + valid letter
  for (const w of waivers) {
    if (!w.path) continue;
    if (!w.until_pr) {
      errors.push(`waiver for "${w.path}" is missing \`until_pr\``);
    } else if (!VALID_LETTERS.has(w.until_pr)) {
      errors.push(`waiver for "${w.path}" has invalid \`until_pr: '${w.until_pr}'\` (must be B|C|D|E)`);
    }
  }

  // Check 2 — migration branch retires its entries
  const branch = currentBranch();
  const branchMatch = branch.match(/^feat\/design-system-pr-([a-eA-E])(-|$)/);
  if (branchMatch && !process.env.ALLOW_UNRETIRED_WAIVERS) {
    const letter = branchMatch[1].toUpperCase();
    const unretired = waivers.filter((w) => w.until_pr === letter);
    if (unretired.length > 0 && letter !== 'A') {
      for (const w of unretired) {
        errors.push(
          `branch "${branch}" is the PR ${letter} migration but waiver "${w.path}" (until_pr: '${letter}') is not retired`,
        );
      }
    }
  }

  if (errors.length === 0) {
    console.log(`check-waiver-consistency: PASS  ${waivers.length} entr${waivers.length === 1 ? 'y' : 'ies'}`);
    process.exit(0);
  }

  console.log(`check-waiver-consistency: FAIL  ${errors.length} error(s)`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}

main();
