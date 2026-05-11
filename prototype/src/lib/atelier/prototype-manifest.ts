// Prototype manifest loader (ADR-057 Slice 3).
//
// Reads .atelier/prototype.yaml from repo root, validates the shape, and
// surfaces a parsed manifest to the harness layout under
// /prototype/<name>. The loader is server-side only (uses node:fs) and
// runs once per request via Next.js's automatic module caching.
//
// Per ADR-057 v1.x:
//   - one project per Atelier instance
//   - the URL segment under /prototype/<segment> MUST equal manifest.name
//   - traceability_source fields are optional; surfaces[] is the
//     substantive content the harness consumes in later slices
//
// Shape validation is structural — types narrow but no business rules
// (e.g., that a surface's `route` resolves to an actual page.tsx). The
// route-resolution check happens implicitly in Next.js: an unknown route
// 404s. Adding a redundant validator here would couple the manifest to
// the filesystem layout, which the manifest is meant to ABSTRACT over.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const REPO_ROOT = join(process.cwd(), '..');
const MANIFEST_PATH = join(REPO_ROOT, '.atelier', 'prototype.yaml');

export interface PrototypeSurface {
  route: string;
  strategy_notes: string;
  dps: string[];
}

export interface PrototypeManifest {
  name: string;
  content_path: string;
  traceability_source?: {
    design_principles?: string;
    research_dir?: string;
  };
  surfaces: PrototypeSurface[];
}

export class PrototypeManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrototypeManifestError';
  }
}

// Cached parse — the manifest is read once and shared. Next.js's server
// component model already memoizes module-scope state per request worker,
// so this is essentially free across the layout + nested pages within a
// single render pass. Restart on file change is handled by Next dev's
// HMR; production is read-once.
let cached: PrototypeManifest | null = null;

export function loadPrototypeManifest(): PrototypeManifest {
  if (cached) return cached;

  if (!existsSync(MANIFEST_PATH)) {
    throw new PrototypeManifestError(
      `Prototype manifest not found at ${MANIFEST_PATH}. ` +
        `Create .atelier/prototype.yaml per ADR-057.`,
    );
  }

  const raw = readFileSync(MANIFEST_PATH, 'utf8');
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (cause) {
    throw new PrototypeManifestError(
      `Failed to parse .atelier/prototype.yaml as YAML: ${(cause as Error).message}`,
    );
  }

  cached = validateManifest(parsed);
  return cached;
}

// For tests + HMR scenarios where a stale cached value would be wrong.
// Not exported from the package boundary — internal use only.
export function _resetManifestCacheForTesting(): void {
  cached = null;
}

function validateManifest(raw: unknown): PrototypeManifest {
  if (!isObject(raw)) {
    throw new PrototypeManifestError('Manifest root must be an object.');
  }

  const name = raw['name'];
  if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new PrototypeManifestError(
      `manifest.name must be a URL-safe lowercase slug (got: ${JSON.stringify(name)}).`,
    );
  }

  const contentPath = raw['content_path'];
  if (typeof contentPath !== 'string' || contentPath.length === 0) {
    throw new PrototypeManifestError(
      `manifest.content_path must be a non-empty string (got: ${JSON.stringify(contentPath)}).`,
    );
  }

  const surfacesRaw = raw['surfaces'];
  if (!Array.isArray(surfacesRaw) || surfacesRaw.length === 0) {
    throw new PrototypeManifestError(
      'manifest.surfaces must be a non-empty array.',
    );
  }

  const surfaces: PrototypeSurface[] = surfacesRaw.map((entry, idx) => {
    if (!isObject(entry)) {
      throw new PrototypeManifestError(`surfaces[${idx}] must be an object.`);
    }
    const route = entry['route'];
    if (typeof route !== 'string' || !route.startsWith('/')) {
      throw new PrototypeManifestError(
        `surfaces[${idx}].route must start with '/' (got: ${JSON.stringify(route)}).`,
      );
    }
    const strategyNotes = entry['strategy_notes'];
    if (typeof strategyNotes !== 'string') {
      throw new PrototypeManifestError(
        `surfaces[${idx}].strategy_notes must be a string.`,
      );
    }
    const dpsRaw = entry['dps'];
    if (!Array.isArray(dpsRaw) || !dpsRaw.every(d => typeof d === 'string')) {
      throw new PrototypeManifestError(
        `surfaces[${idx}].dps must be an array of strings (got: ${JSON.stringify(dpsRaw)}).`,
      );
    }
    return {
      route,
      strategy_notes: strategyNotes,
      dps: dpsRaw as string[],
    };
  });

  const traceabilitySource = parseTraceabilitySource(raw['traceability_source']);

  return {
    name,
    content_path: contentPath,
    ...(traceabilitySource ? { traceability_source: traceabilitySource } : {}),
    surfaces,
  };
}

function parseTraceabilitySource(
  raw: unknown,
): PrototypeManifest['traceability_source'] {
  if (raw === undefined || raw === null) return undefined;
  if (!isObject(raw)) {
    throw new PrototypeManifestError(
      'manifest.traceability_source must be an object if present.',
    );
  }
  const dp = raw['design_principles'];
  const research = raw['research_dir'];
  if (dp !== undefined && typeof dp !== 'string') {
    throw new PrototypeManifestError(
      `traceability_source.design_principles must be a string if present.`,
    );
  }
  if (research !== undefined && typeof research !== 'string') {
    throw new PrototypeManifestError(
      `traceability_source.research_dir must be a string if present.`,
    );
  }
  return {
    ...(dp ? { design_principles: dp } : {}),
    ...(research ? { research_dir: research } : {}),
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
