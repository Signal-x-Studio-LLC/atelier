/**
 * Atelier M1 foundations — agent interop endpoint + canonical artifact app +
 * core schema.
 *
 * Atelier already has an extensive traceability system at scripts/traceability/
 * which tracks BRD↔ADR↔doc links (222 entries as of catalog creation). This
 * state-derive catalog COMPLEMENTS traceability — traceability tracks what's
 * cross-referenced in the docs; state-derive tracks what's mechanically
 * shipped in code + schema.
 *
 * Catalog seed scope: M1 milestones — the foundations a downstream agent or
 * composer can rely on. Future milestones (M2 entry, M3-M6) get their own
 * catalog files as they ship.
 */

import type { Capability } from '../types.ts'

export const m1FoundationsCapabilities: Capability[] = [
  {
    id: 'mcp-static-bearer-endpoint',
    category: 'capability',
    description: 'Agent interop endpoint — MCP Streamable HTTP transport with static bearer auth (no OAuth discovery)',
    reference: 'docs/functional/BRD.md § Epic-2 (Agent interop endpoint), ADR-013, ADR-040',
    derivation: [
      { type: 'file_exists', path: 'prototype/src/app/api/mcp/route.ts' },
      {
        type: 'grep_present',
        path: 'prototype/src/app/api/mcp/route.ts',
        pattern: 'export const runtime = .nodejs.',
        description: 'route forces Node.js runtime per ADR-029 (pg over TCP)',
      },
      {
        type: 'grep_present',
        path: 'prototype/src/app/api/mcp/route.ts',
        pattern: 'handleMcpRequest',
        description: 'route delegates to handleMcpRequest transport',
      },
    ],
  },
  {
    id: 'mcp-oauth-discovery-endpoint',
    category: 'capability',
    description: 'Parallel MCP endpoint that publishes OAuth discovery for claude.ai / ChatGPT Connectors',
    reference: 'docs/functional/BRD.md § Epic-2, ADR-040',
    derivation: [
      { type: 'file_exists', path: 'prototype/src/app/oauth/api/mcp/route.ts' },
    ],
  },
  {
    id: 'canonical-artifact-prototype-app',
    category: 'capability',
    description: 'Canonical artifact — Next.js prototype web app with auth + atelier + prototype routes',
    reference: 'docs/functional/BRD.md § Epic-3 (Canonical artifact)',
    derivation: [
      { type: 'file_exists', path: 'prototype/src/app/layout.tsx' },
      { type: 'file_exists', path: 'prototype/src/app/page.tsx' },
      { type: 'file_exists', path: 'prototype/src/app/sign-in' },
      { type: 'file_exists', path: 'prototype/src/app/auth' },
      { type: 'file_exists', path: 'prototype/src/app/atelier' },
    ],
  },
  {
    id: 'm1-schema-core-tables',
    category: 'capability',
    description: 'M1 schema — core domain tables (projects, composers, sessions, territories, contributions, decisions, locks, contracts)',
    reference: 'supabase/migrations/20260428000001_atelier_m1_schema.sql',
    derivation: [
      { type: 'schema_has_table', table: 'projects' },
      { type: 'schema_has_table', table: 'composers' },
      { type: 'schema_has_table', table: 'sessions' },
      { type: 'schema_has_table', table: 'territories' },
      { type: 'schema_has_table', table: 'contributions' },
      { type: 'schema_has_table', table: 'decisions' },
      { type: 'schema_has_table', table: 'locks' },
      { type: 'schema_has_table', table: 'contracts' },
    ],
  },
  {
    id: 'm5-embeddings-schema',
    category: 'capability',
    description: 'M5 embeddings — pgvector-backed embeddings table with both 3072 and 1536 dimension variants',
    reference: 'supabase/migrations/20260501000006_atelier_m5_embeddings.sql + dim variants',
    derivation: [
      { type: 'file_exists', path: 'supabase/migrations/20260501000006_atelier_m5_embeddings.sql' },
      { type: 'file_exists', path: 'supabase/migrations/20260501000007_atelier_m5_embeddings_dim_3072.sql' },
      { type: 'file_exists', path: 'supabase/migrations/20260501000008_atelier_m5_embeddings_dim_1536.sql' },
    ],
  },
  {
    id: 'webhook-handlers-figma-github',
    category: 'capability',
    description: 'Webhook handlers for Figma + GitHub external systems',
    reference: 'docs/functional/BRD.md § Epic for external sources',
    derivation: [
      { type: 'file_exists', path: 'prototype/src/app/api/webhooks/figma' },
      { type: 'file_exists', path: 'prototype/src/app/api/webhooks/github' },
    ],
  },
  {
    id: 'broadcast-worker-cloudflare',
    category: 'capability',
    description: 'Broadcast worker — Cloudflare Worker for M4 fanout',
    reference: 'docs/functional/BRD.md § Epic-4 (Broadcast)',
    derivation: [
      { type: 'file_exists', path: 'broadcast-worker/wrangler.jsonc' },
      { type: 'file_exists', path: 'broadcast-worker/src' },
    ],
  },
  {
    id: 'traceability-registry',
    category: 'capability',
    description: 'Traceability registry — BRD↔ADR↔doc link tracking',
    reference: 'scripts/traceability/build-registry.ts + traceability.json',
    derivation: [
      { type: 'file_exists', path: 'scripts/traceability/build-registry.ts' },
      { type: 'file_exists', path: 'scripts/traceability/validate-refs.ts' },
      { type: 'file_exists', path: 'traceability.json' },
    ],
  },
]
