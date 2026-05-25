import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Check, CheckResult } from '../types.ts';

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.svelte-kit',
  'dist',
  'build',
  '.turbo',
  '.wrangler',
  '.worktrees',
  '.vercel',
  'coverage',
]);

/**
 * Walks a path (file or directory) and returns every file under it,
 * skipping common build/vendor dirs.
 */
function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const stats = statSync(root);
  if (stats.isFile()) return [root];

  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (!IGNORE_DIRS.has(e.name)) stack.push(full);
      } else if (e.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}

interface MatchEvidence {
  count: number;
  hits: { file: string; line: number; text: string }[];
}

function grepFiles(
  repoRoot: string,
  searchPath: string,
  pattern: string,
  flags: string,
  maxHits = 20,
): MatchEvidence {
  const re = new RegExp(pattern, flags);
  const absRoot = join(repoRoot, searchPath);
  const files = walkFiles(absRoot);
  let count = 0;
  const hits: MatchEvidence['hits'] = [];
  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      re.lastIndex = 0;
      if (re.test(lines[i])) {
        count++;
        if (hits.length < maxHits) {
          const rel = relative(repoRoot, file);
          hits.push({ file: rel, line: i + 1, text: lines[i].trim().slice(0, 200) });
        }
      }
    }
  }
  return { count, hits };
}

function evidenceLines(searchPath: string, ev: MatchEvidence): string[] {
  if (ev.count === 0) return [`${searchPath}: 0 matches`];
  const head = [`${searchPath}: ${ev.count} match${ev.count === 1 ? '' : 'es'}`];
  for (const h of ev.hits.slice(0, 5)) {
    head.push(`  ${h.file}:${h.line}: ${h.text}`);
  }
  if (ev.count > 5) head.push(`  … ${ev.count - 5} more`);
  return head;
}

export function grepCount(repoRoot: string, check: Check & { type: 'grep_count' }): CheckResult {
  const flags = check.flags ?? '';
  const ev = grepFiles(repoRoot, check.path, check.pattern, flags);
  const min = check.expect_min ?? 1;
  const max = check.expect_max ?? Infinity;
  const matched = ev.count >= min && ev.count <= max;
  return {
    check,
    matched,
    evidence: [
      `expected ${min}${max === Infinity ? '+' : `..${max}`}, got ${ev.count}`,
      ...evidenceLines(check.path, ev),
    ],
  };
}

export function grepPresent(repoRoot: string, check: Check & { type: 'grep_present' }): CheckResult {
  const flags = check.flags ?? '';
  const ev = grepFiles(repoRoot, check.path, check.pattern, flags);
  return {
    check,
    matched: ev.count > 0,
    evidence: evidenceLines(check.path, ev),
  };
}

export function grepAbsent(repoRoot: string, check: Check & { type: 'grep_absent' }): CheckResult {
  const flags = check.flags ?? '';
  const ev = grepFiles(repoRoot, check.path, check.pattern, flags);
  return {
    check,
    matched: ev.count === 0,
    evidence:
      ev.count === 0
        ? [`${check.path}: 0 matches (expected absent)`]
        : evidenceLines(check.path, ev),
  };
}
