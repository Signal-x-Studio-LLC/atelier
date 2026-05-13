// Traceability resolver (ADR-057 Slice 5; ADR-059 Workers port).
//
// Returns the project's design-principles excerpts. Per ADR-059, the
// markdown is parsed at codegen time (scripts/build/generate-bundled-config.ts)
// from the path declared in .atelier/prototype.yaml's
// `traceability_source.design_principles` and bundled into the Workers
// bundle as a typed TS module. Request-time code imports the bundled
// value directly — no node:fs, no process.cwd().
//
// The parser shape (LOCKED for slice 5) lives in the codegen script so
// both build-time validation and a stand-alone test harness can call it
// without dragging the bundled artifact in. The runtime path here just
// returns the pre-parsed map.
//
// Parser shape recap (see scripts/build/generate-bundled-config.ts for the
// implementation):
//
//   ### DP-<id> — <title>
//
// Sections that don't match are skipped silently.

import { BUNDLED_DESIGN_PRINCIPLES } from './__bundled__/design-principles.bundled';
import type { PrototypeManifest } from './prototype-manifest';

export interface DpExcerpt {
  id: string;
  title: string;
  body_markdown: string;
}

export type DpExcerptMap = Record<string, DpExcerpt>;

export interface TraceabilityLoadResult {
  sourcePath: string | null;
  excerpts: DpExcerptMap;
  status: 'ok' | 'not_configured' | 'file_missing';
}

// Re-exported for tests + ad-hoc callers (e.g., the prototype's
// __smoke__ harness) that want to parse a string at runtime. The
// implementation is intentionally pure (no fs, no IO) so it works in
// any runtime.
//
// Kept in sync with scripts/build/generate-bundled-config.ts's
// parseDesignPrinciples — if you change one, change both. The codegen
// script is the canonical source for the production path.
const DP_HEADING_RE = /^###\s+(DP-[A-Za-z0-9]+)\s*[—–-]\s*(.+?)\s*$/gm;

export function parseDesignPrinciples(markdown: string): DpExcerptMap {
  const out: DpExcerptMap = {};
  const matches: Array<{ id: string; title: string; bodyStart: number }> = [];
  for (const m of markdown.matchAll(DP_HEADING_RE)) {
    const id = m[1];
    const title = m[2];
    if (!id || title === undefined) continue;
    const idx = m.index ?? 0;
    const headingEnd = idx + m[0].length;
    matches.push({ id, title: title.trim(), bodyStart: headingEnd });
  }
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]!;
    const next = matches[i + 1];
    let sliceEnd = next ? next.bodyStart : markdown.length;
    if (next) {
      sliceEnd = markdown.lastIndexOf('\n###', sliceEnd);
      if (sliceEnd < current.bodyStart) sliceEnd = next.bodyStart;
    }
    const body = markdown
      .slice(current.bodyStart, sliceEnd)
      .replace(/^\n+/, '')
      .replace(/\s+$/, '');
    out[current.id] = { id: current.id, title: current.title, body_markdown: body };
  }
  return out;
}

// The `manifest` parameter is preserved in the signature for backwards
// compatibility with callers, but its content is no longer consulted —
// the bundle already knows which file it was generated from (via the
// codegen reading the same manifest at build time).
export function loadDpExcerpts(_manifest: PrototypeManifest): TraceabilityLoadResult {
  const b = BUNDLED_DESIGN_PRINCIPLES as TraceabilityLoadResult;
  return {
    sourcePath: b.sourcePath,
    excerpts: b.excerpts,
    status: b.status,
  };
}
