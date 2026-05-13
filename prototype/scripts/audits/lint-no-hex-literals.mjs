#!/usr/bin/env node
/**
 * lint-no-hex-literals (ADR-060 PR A) — fail any TSX / TS / CSS file
 * outside the allowed source-of-truth slots that contains a hex literal
 * or a Tailwind arbitrary-hex value.
 *
 * Allowed slots (auto-exempt):
 *   - prototype/src/lib/atelier/__bundled__/**   (codegen output)
 *   - prototype/src/lib/atelier/design/tokens.ts (the canonical hex source)
 *   - prototype/src/lib/atelier/design/globals.css (the @theme block + dark swap)
 *   - node_modules/**, .next/**
 *   - prototype/scripts/audits/**                (this file declares hex regexes literally)
 *   - prototypes/dashboard-northstar/components/Icon.tsx (no hex; lucide registry)
 *
 * Additional exemptions are read from `design-system-waivers.ts`; an
 * entry with `until_pr: 'B'|'C'|'D'|'E'` excuses the file from the gate
 * until the named migration PR retires it.
 *
 * Patterns flagged:
 *   - `#[0-9a-fA-F]{3,8}` outside string-as-regex contexts
 *   - Tailwind arbitrary values: `bg-[#abc]`, `text-[#abc]`, `border-[#abc]`, etc.
 *
 * Exit codes:
 *   0  no unwaived violations
 *   1  one or more files outside the waiver list contains a hex literal
 *
 * Usage: `node prototype/scripts/audits/lint-no-hex-literals.mjs`
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(process.cwd());

const SCAN_ROOTS = [
  'prototype/src/app',
  'prototype/src/lib/atelier',
  'prototypes',
];

const EXT_PATTERN = /\.(tsx?|css)$/;

const ALLOWED_SUFFIXES = [
  'prototype/src/lib/atelier/design/tokens.ts',
  'prototype/src/lib/atelier/design/globals.css',
  'prototypes/dashboard-northstar/components/Icon.tsx',
];

const ALLOWED_PREFIXES = [
  'prototype/src/lib/atelier/__bundled__/',
  'prototype/scripts/audits/',
  'node_modules/',
  '.next/',
];

const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/;
const TAILWIND_ARBITRARY_HEX = /\b(?:bg|text|border|fill|stroke|ring|outline|from|to|via|shadow|decoration|caret|accent|placeholder)-\[#[0-9a-fA-F]{3,8}/;

async function loadWaivers() {
  // Use Node's TS-importable path via tsx loader at the workspace root.
  // For pure-Node invocation here we parse the file with a regex pull —
  // sufficient because the waiver shape is line-oriented and we only
  // need `path` values. Avoids a tsx dependency at gate runtime.
  //
  // ADR-060 PR E: the waiver file is deleted at the end of the migration
  // sequence; absence means "all migrations complete; audit gates fully
  // enforced". Treat a missing file as an empty waiver set rather than
  // an error.
  const file = resolve(REPO_ROOT, 'prototype/scripts/audits/design-system-waivers.ts');
  const paths = new Set();
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return paths;
    throw err;
  }
  const pathRe = /path:\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = pathRe.exec(src)) !== null) paths.add(m[1]);
  return paths;
}

function walk(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      if (name === 'node_modules' || name === '.next' || name === '__bundled__') continue;
      walk(full, acc);
    } else if (s.isFile() && EXT_PATTERN.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

function isAllowed(rel) {
  if (ALLOWED_SUFFIXES.some((s) => rel.endsWith(s))) return true;
  if (ALLOWED_PREFIXES.some((p) => rel.startsWith(p))) return true;
  return false;
}

async function main() {
  const waivers = await loadWaivers();
  const files = [];
  for (const root of SCAN_ROOTS) walk(resolve(REPO_ROOT, root), files);

  const violations = [];

  for (const abs of files) {
    const rel = relative(REPO_ROOT, abs).replace(/\\/g, '/');
    if (isAllowed(rel)) continue;
    if ([...waivers].some((w) => rel.endsWith(w))) continue;

    const content = readFileSync(abs, 'utf8');
    const lines = content.split('\n');
    const hits = [];
    lines.forEach((line, i) => {
      // Strip block + line comments before testing so explanatory comments
      // containing hex examples don't trip the gate.
      const stripped = line.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '');
      if (HEX_LITERAL.test(stripped) || TAILWIND_ARBITRARY_HEX.test(stripped)) {
        hits.push({ line: i + 1, text: line.trim().slice(0, 120) });
      }
    });
    if (hits.length) {
      violations.push({ path: rel, hits });
    }
  }

  if (violations.length === 0) {
    console.log('lint-no-hex-literals: PASS  no unwaived violations');
    process.exit(0);
  }

  console.log(`lint-no-hex-literals: FAIL  ${violations.length} file(s) outside waiver list contain hex literals\n`);
  for (const v of violations) {
    console.log(`  ${v.path}`);
    for (const hit of v.hits.slice(0, 5)) {
      console.log(`    L${hit.line}: ${hit.text}`);
    }
    if (v.hits.length > 5) {
      console.log(`    ...and ${v.hits.length - 5} more`);
    }
  }
  console.log(
    '\nTo resolve: migrate the file to use design tokens (`var(--color-*)` or the' +
      ' design package primitives), OR add an entry to' +
      ' prototype/scripts/audits/design-system-waivers.ts with `until_pr` set.',
  );
  process.exit(1);
}

main().catch((err) => {
  console.error('lint-no-hex-literals: internal error', err);
  process.exit(2);
});
