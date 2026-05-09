// OpenNext Cloudflare adapter configuration for the Atelier prototype.
//
// Per ADR-052 (Cloudflare-primary infrastructure pivot, 2026-05-09).
// Minimal config: no incremental cache, no on-demand revalidation queue,
// no tag cache — Atelier routes are explicitly `force-dynamic` (per
// ADR-051 RLS engagement requires per-request transaction context;
// caching would break tenant isolation). The substrate's read paths
// hit Postgres directly through the Hyperdrive binding; cache is in
// Hyperdrive's connection-pool layer (caching disabled per ADR-052
// for the same RLS-correctness reason), not in OpenNext's overrides.
//
// If a future capability genuinely needs ISR (e.g., a public-facing
// landing page that doesn't carry composer identity), add the
// `incrementalCache: kvIncrementalCache` override at that time and
// scope it to the specific route via OpenNext's per-route config.

import { defineCloudflareConfig, type OpenNextConfig } from '@opennextjs/cloudflare';

const cloudflareConfig = defineCloudflareConfig({
  // No overrides — accept all OpenNext defaults. Defaults route through
  // in-memory cache only (no KV / DO bindings required), which matches
  // Atelier's force-dynamic posture.
});

const config: OpenNextConfig = {
  buildCommand: 'node_modules/.bin/next build',
  ...cloudflareConfig,
};

export default config;
