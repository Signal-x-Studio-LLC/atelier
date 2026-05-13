// Prototype manifest loader (ADR-057 Slice 3; ADR-059 Workers port).
//
// Returns the parsed manifest from .atelier/prototype.yaml. Per ADR-059,
// the manifest is read at codegen time (scripts/build/generate-bundled-config.ts)
// and bundled into the Workers bundle as a typed TS module. Request-time
// code imports the bundled value directly — no node:fs, no process.cwd().
//
// Validation runs at codegen time. The bundled module is the canonical
// runtime shape; if it's wrong, codegen failed and the build broke.
//
// Per ADR-057 v1.x:
//   - one project per Atelier instance
//   - the URL segment under /prototype/<segment> MUST equal manifest.name
//   - traceability_source fields are optional; surfaces[] is the
//     substantive content the harness consumes in later slices.

import { BUNDLED_PROTOTYPE_MANIFEST } from './__bundled__/prototype-manifest.bundled';

export interface PrototypeSurface {
  route: string;
  strategy_notes: string;
  dps: string[];
}

export type PrototypeDesignTheme = 'inherit' | 'override';

export interface PrototypeDesign {
  // ADR-060 PR E — `inherit` (default) consumes the substrate's tokens
  // via the global cascade; `override` lets the prototype declare its
  // own @theme block. See docs/user/reference/prototype-design-contract.md.
  theme: PrototypeDesignTheme;
}

export interface PrototypeManifest {
  name: string;
  content_path: string;
  design?: PrototypeDesign;
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

// The bundle is a `as const` literal; widen its readonly arrays back to
// the public PrototypeManifest interface so callers don't need to know
// about the bundle internals.
export function loadPrototypeManifest(): PrototypeManifest {
  const b = BUNDLED_PROTOTYPE_MANIFEST as unknown as PrototypeManifest;
  // ADR-060 PR E — backwards-compatible default: when the bundled
  // manifest predates the `design` block, treat the prototype as an
  // `inherit`-mode consumer (the v1 dashboard-northstar behavior).
  if (!b.design) {
    return { ...b, design: { theme: 'inherit' } };
  }
  return b;
}

// Backwards-compatible no-op. The cache used to live in this module's
// scope; the bundle is itself a module-scope constant, so the cache is
// implicit. Kept exported for any tests that imported it.
export function _resetManifestCacheForTesting(): void {
  // no-op under bundled-import shape (ADR-059)
}
