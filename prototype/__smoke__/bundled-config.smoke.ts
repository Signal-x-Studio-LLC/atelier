// Smoke for the Workers-bundled config loaders (ADR-059).
//
// Exercises the three runtime loaders that previously read .atelier/*.yaml
// via node:fs and now consume from prototype/src/lib/atelier/__bundled__/.
// Goal is a single fast check that proves:
//   1. loadPrototypeManifest() returns a populated manifest with name,
//      content_path, and at least one surface.
//   2. loadObservabilityConfig() returns a config with finite numeric
//      thresholds (no NaN, no undefined) and a lookback window.
//   3. loadDpExcerpts() returns status='ok' with at least one DP entry
//      whose body_markdown is non-empty.
//
// No DB, no Supabase, no Workers runtime needed — this is a pure import
// check. It runs in milliseconds and protects against regression where
// the codegen output drifts or the runtime shims forget to widen the
// readonly `as const` literal back to the public interface.

import { loadPrototypeManifest } from '../src/lib/atelier/prototype-manifest';
import { loadObservabilityConfig } from '../src/lib/atelier/observability-config';
import { loadDpExcerpts } from '../src/lib/atelier/traceability-data';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`bundled-config.smoke FAIL: ${msg}`);
}

const manifest = loadPrototypeManifest();
assert(typeof manifest.name === 'string' && manifest.name.length > 0, 'manifest.name empty');
assert(
  typeof manifest.content_path === 'string' && manifest.content_path.length > 0,
  'manifest.content_path empty',
);
assert(Array.isArray(manifest.surfaces) && manifest.surfaces.length > 0, 'manifest.surfaces empty');
process.stdout.write(`  ok prototype-manifest -> ${manifest.name} (${manifest.surfaces.length} surfaces)\n`);

const obs = loadObservabilityConfig();
const thresholdValues = Object.values(obs.thresholds);
assert(
  thresholdValues.every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0),
  'observability thresholds malformed',
);
assert(
  typeof obs.lookbackSeconds === 'number' && obs.lookbackSeconds > 0,
  'observability lookbackSeconds missing',
);
process.stdout.write(`  ok observability-config -> ${thresholdValues.length} thresholds, lookback=${obs.lookbackSeconds}s\n`);

const trace = loadDpExcerpts(manifest);
assert(trace.status === 'ok', `traceability status not 'ok' (got '${trace.status}')`);
const ids = Object.keys(trace.excerpts);
assert(ids.length > 0, 'no DP excerpts parsed');
const first = trace.excerpts[ids[0]!]!;
assert(typeof first.body_markdown === 'string' && first.body_markdown.length > 0, 'DP body empty');
process.stdout.write(`  ok design-principles -> ${ids.length} DPs (first: ${first.id})\n`);

process.stdout.write('bundled-config.smoke: PASS\n');
