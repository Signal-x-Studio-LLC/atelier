// Traceability resolver (ADR-057 Slice 5).
//
// Reads the project's design-principles.md from the path declared in
// .atelier/prototype.yaml's `traceability_source.design_principles` and
// parses it into a DP-id → {title, body_markdown} map. The harness rail's
// TraceabilityPanel consumes this once per request via the layout.
//
// Decision: server-side file read vs dispatch(get_context, scope_files).
// The ADR mentions `get_context(scope_files)`. For v1 we read directly
// with node:fs because:
//   - dispatch(get_context) routes through MCP auth + paging; the file is
//     in the project's content tree and we're already server-side. The
//     extra hop adds latency and auth surface for no gain at this scale.
//   - The manifest loader (Slice 3) already uses node:fs against repo
//     paths for the same class of read — be consistent.
// Re-evaluate (route through dispatch) if the project's
// design-principles.md ever lives outside this repo (cross-repo manifest).
//
// Parser shape (LOCKED for slice 5):
//
//   Each principle section begins with a level-3 heading of the form:
//
//     ### DP-<id> — <title>
//
//   where:
//     - `DP-<id>` matches /DP-[A-Za-z0-9]+/  (numeric ids today; the
//       regex tolerates future suffixes like `DP-7a`).
//     - The separator between the id and the title may be an em-dash
//       (—, U+2014), an en-dash (–, U+2013), or a plain hyphen (-).
//       Whitespace around the separator is flexible.
//     - The body is everything from the next line until the next `###`
//       heading at the start of a line, or end of file. Trailing blank
//       lines are trimmed; internal blank lines are preserved.
//
//   Sections that don't match this shape are skipped silently — the
//   document has prose sections (e.g., "## Locked principles", "## Resolved
//   open questions") that we don't index. The traceability resolver only
//   needs DP-N anchors.

import { readFileSync, existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import type { PrototypeManifest } from './prototype-manifest';

const REPO_ROOT = join(process.cwd(), '..');

export interface DpExcerpt {
  id: string;
  title: string;
  body_markdown: string;
}

export type DpExcerptMap = Record<string, DpExcerpt>;

export interface TraceabilityLoadResult {
  // The file path actually read (relative to repo root) or null when
  // the manifest doesn't declare a design_principles path.
  sourcePath: string | null;
  // Parsed map; empty when sourcePath is null or the file is missing.
  excerpts: DpExcerptMap;
  // Non-fatal load condition the panel can surface to the user.
  status: 'ok' | 'not_configured' | 'file_missing';
}

/**
 * Match a level-3 heading that introduces a DP section.
 *
 * Capture groups:
 *   1: full DP id including the `DP-` prefix (e.g., "DP-7", "DP-13", "DP-7a")
 *   2: title text (trimmed downstream)
 *
 * Anchored at line start with the `m` flag.
 */
const DP_HEADING_RE = /^###\s+(DP-[A-Za-z0-9]+)\s*[—–-]\s*(.+?)\s*$/gm;

export function parseDesignPrinciples(markdown: string): DpExcerptMap {
  const out: DpExcerptMap = {};
  // We need both the matches and the ranges between them. Collect match
  // positions first, then slice the body between consecutive headings.
  const matches: Array<{ id: string; title: string; bodyStart: number }> = [];
  for (const m of markdown.matchAll(DP_HEADING_RE)) {
    const id = m[1];
    const title = m[2];
    if (!id || title === undefined) continue;
    const idx = m.index ?? 0;
    const headingEnd = idx + m[0].length;
    matches.push({
      id,
      title: title.trim(),
      bodyStart: headingEnd,
    });
  }
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]!;
    const { id, title, bodyStart } = current;
    const next = matches[i + 1];
    const bodyEnd = next ? next.bodyStart : markdown.length;
    // The next-heading match started at its own `###` line — back up
    // to the start of that line so the previous body doesn't bleed past
    // the blank line before it.
    let sliceEnd = bodyEnd;
    if (next) {
      // Find the start of the next-heading line (the `###` token).
      // `bodyStart` of next entry points just after its full match;
      // walk back to find the line start of that heading.
      sliceEnd = markdown.lastIndexOf('\n###', bodyEnd);
      if (sliceEnd < bodyStart) sliceEnd = bodyEnd; // safety fallback
    }
    const body = markdown.slice(bodyStart, sliceEnd).replace(/^\n+/, '').replace(/\s+$/, '');
    out[id] = { id, title, body_markdown: body };
  }
  return out;
}

export function loadDpExcerpts(manifest: PrototypeManifest): TraceabilityLoadResult {
  const declared = manifest.traceability_source?.design_principles;
  if (!declared) {
    return { sourcePath: null, excerpts: {}, status: 'not_configured' };
  }
  const absolute = isAbsolute(declared) ? declared : join(REPO_ROOT, declared);
  if (!existsSync(absolute)) {
    return { sourcePath: declared, excerpts: {}, status: 'file_missing' };
  }
  const raw = readFileSync(absolute, 'utf8');
  return {
    sourcePath: declared,
    excerpts: parseDesignPrinciples(raw),
    status: 'ok',
  };
}
