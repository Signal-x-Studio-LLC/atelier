import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Check, CheckResult } from '../types.ts';

/**
 * Default location for SQL migration files. Override per-project by setting
 * the STATE_DERIVE_SCHEMA_DIR env var before running `derive`. Multiple
 * directories can be supplied as a colon-separated list.
 *
 * Examples:
 *   STATE_DERIVE_SCHEMA_DIR=apps/api/migrations/schema
 *   STATE_DERIVE_SCHEMA_DIR=supabase/migrations:db/seed
 */
const DEFAULT_SCHEMA_DIRS = ['supabase/migrations', 'apps/api/migrations/schema', 'migrations'];

function getSchemaDirs(): string[] {
  const envVal = process.env.STATE_DERIVE_SCHEMA_DIR;
  if (envVal) return envVal.split(':').filter(Boolean);
  return DEFAULT_SCHEMA_DIRS;
}

interface SchemaIndex {
  tables: Map<string, Set<string>>;
  evidence: Map<string, string[]>;
  schemaDirsScanned: string[];
}

let cached: { repoRoot: string; index: SchemaIndex } | null = null;

function buildSchemaIndex(repoRoot: string): SchemaIndex {
  const tables = new Map<string, Set<string>>();
  const evidence = new Map<string, string[]>();
  const schemaDirsScanned: string[] = [];

  const createRe = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\)\s*;/gi;
  // `ADD COLUMN [IF NOT EXISTS]` — the qualifier is optional in Postgres.
  // Without `IF NOT EXISTS` accommodated, the regex would grab the literal
  // word IF as the column name and silently corrupt the schema index.
  const alterAddRe = /ALTER\s+TABLE\s+([a-z_][a-z0-9_]*)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi;

  for (const schemaDir of getSchemaDirs()) {
    const dir = join(repoRoot, schemaDir);
    if (!existsSync(dir)) continue;
    schemaDirsScanned.push(schemaDir);

    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const fname of files) {
      const content = readFileSync(join(dir, fname), 'utf-8');

      for (const m of content.matchAll(createRe)) {
        const tableName = m[1];
        const body = m[2];
        const cols = new Set<string>();
        for (const rawLine of body.split('\n')) {
          const line = rawLine.trim();
          if (!line || line.startsWith('--')) continue;
          if (/^(PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CHECK|CONSTRAINT)\b/i.test(line)) continue;
          const colMatch = line.match(/^["`]?([a-z_][a-z0-9_]*)["`]?/i);
          if (colMatch) cols.add(colMatch[1]);
        }
        const existing = tables.get(tableName) ?? new Set<string>();
        for (const c of cols) existing.add(c);
        tables.set(tableName, existing);
        const ev = evidence.get(tableName) ?? [];
        ev.push(`${schemaDir}/${fname}: CREATE TABLE ${tableName} (${cols.size} columns)`);
        evidence.set(tableName, ev);
      }

      for (const m of content.matchAll(alterAddRe)) {
        const tableName = m[1];
        const colName = m[2];
        const existing = tables.get(tableName) ?? new Set<string>();
        existing.add(colName);
        tables.set(tableName, existing);
        const ev = evidence.get(tableName) ?? [];
        ev.push(`${schemaDir}/${fname}: ALTER TABLE ${tableName} ADD COLUMN ${colName}`);
        evidence.set(tableName, ev);
      }
    }
  }

  return { tables, evidence, schemaDirsScanned };
}

function getIndex(repoRoot: string): SchemaIndex {
  if (cached && cached.repoRoot === repoRoot) return cached.index;
  const index = buildSchemaIndex(repoRoot);
  cached = { repoRoot, index };
  return index;
}

/** Reset the cached schema index. Test-only. */
export function _resetSchemaCache(): void {
  cached = null;
}

export function schemaHasTable(
  repoRoot: string,
  check: Check & { type: 'schema_has_table' },
): CheckResult {
  const index = getIndex(repoRoot);
  const present = index.tables.has(check.table);
  const scannedHint = index.schemaDirsScanned.length
    ? `(scanned: ${index.schemaDirsScanned.join(', ')})`
    : `(no schema dirs found — set STATE_DERIVE_SCHEMA_DIR)`;
  const evidence = present
    ? (index.evidence.get(check.table) ?? [])
    : [`table "${check.table}" not found ${scannedHint}`];
  return { check, matched: present, evidence };
}

export function schemaHasColumn(
  repoRoot: string,
  check: Check & { type: 'schema_has_column' },
): CheckResult {
  const index = getIndex(repoRoot);
  const cols = index.tables.get(check.table);
  const scannedHint = index.schemaDirsScanned.length
    ? `(scanned: ${index.schemaDirsScanned.join(', ')})`
    : `(no schema dirs found — set STATE_DERIVE_SCHEMA_DIR)`;
  if (!cols) {
    return {
      check,
      matched: false,
      evidence: [`table "${check.table}" not found ${scannedHint}`],
    };
  }
  const present = cols.has(check.column);
  return {
    check,
    matched: present,
    evidence: present
      ? [`${check.table}.${check.column} found`, ...(index.evidence.get(check.table) ?? [])]
      : [`${check.table}.${check.column} not found (table has: ${[...cols].sort().join(', ')})`],
  };
}
