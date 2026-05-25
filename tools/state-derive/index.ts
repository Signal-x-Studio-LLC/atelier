#!/usr/bin/env node
/**
 * CLI entry — derives current implementation state by running every
 * capability check in `./catalog/*.ts` against the repo working tree, and
 * writes the result to `docs/state/_state.json` + `docs/state/_state.md`.
 *
 * Usage (from repo root):
 *   cd tools/state-derive && npm run derive
 * Or directly:
 *   npx tsx tools/state-derive/index.ts
 *
 * Catalog discovery:
 *   - All `.ts` files in `./catalog/` (recursive, excluding `_*.ts`) are
 *     auto-imported. Each file must export at least one `Capability[]` array.
 *   - File names starting with `_` are treated as examples/notes (skipped).
 *
 * Environment overrides:
 *   STATE_DERIVE_SCHEMA_DIR  Colon-separated list of dirs containing *.sql
 *                            migration files (default tries supabase/migrations,
 *                            apps/api/migrations/schema, migrations).
 *   STATE_DERIVE_OUT         Output directory (default: docs/state).
 *   STATE_DERIVE_PROJECT     Project name used in the markdown title.
 *
 * Exit codes:
 *   0 — derivation completed (non-compliant capabilities are NOT errors).
 *   1 — derivation tool itself errored.
 *   2 — at least one check raised a runtime error.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import type { Capability, State } from './types.ts';
import { deriveAll } from './derive.ts';
import { writeJson, getCommitSha, writeMarkdown } from './render.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Repo root = two levels up from tools/state-derive/.
const REPO_ROOT = resolve(__dirname, '..', '..');
const CATALOG_DIR = join(__dirname, 'catalog');
const OUT_DIR = resolve(REPO_ROOT, process.env.STATE_DERIVE_OUT ?? 'docs/state');
const PROJECT_NAME = process.env.STATE_DERIVE_PROJECT ?? 'project';

function walkCatalog(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_')) continue; // examples / scratch
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkCatalog(full));
    else if (st.isFile() && name.endsWith('.ts')) out.push(full);
  }
  return out;
}

async function loadCatalog(): Promise<Capability[]> {
  const files = walkCatalog(CATALOG_DIR);
  if (!files.length) {
    console.warn(
      `[state-derive] no catalog files found in ${CATALOG_DIR}. ` +
        `Create catalog/<group>.ts files that export Capability[] arrays.`,
    );
    return [];
  }
  const capabilities: Capability[] = [];
  for (const file of files) {
    const mod = await import(pathToFileURL(file).href);
    for (const [exportName, val] of Object.entries(mod)) {
      if (Array.isArray(val) && val.every((v) => v && typeof v === 'object' && 'id' in v && 'derivation' in v)) {
        capabilities.push(...(val as Capability[]));
      }
    }
  }
  return capabilities;
}

async function main(): Promise<void> {
  const capabilities = await loadCatalog();
  const commitSha = getCommitSha(REPO_ROOT);

  const results = deriveAll(REPO_ROOT, capabilities);

  const state: State = {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    as_of_commit: commitSha,
    repo_root: REPO_ROOT,
    capabilities: results,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = join(OUT_DIR, '_state.json');
  const mdPath = join(OUT_DIR, '_state.md');
  writeJson(jsonPath, state);
  writeMarkdown(mdPath, state, REPO_ROOT, PROJECT_NAME);

  const summary = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`[state-derive] wrote ${jsonPath}`);
  console.log(`[state-derive] wrote ${mdPath}`);
  console.log(`[state-derive] as_of_commit ${commitSha.slice(0, 7)}`);
  console.log(`[state-derive] summary: ${JSON.stringify(summary)}`);

  if (results.some((r) => r.results.some((c) => c.error))) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error('[state-derive] failed:', err);
  process.exit(1);
});
