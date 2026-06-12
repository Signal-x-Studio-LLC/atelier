/**
 * Atelier M2–M7 shipped surface — DoD catalog backfill.
 *
 * The seed catalog (m1-foundations.ts) covered 8 foundational capabilities. This
 * file extends coverage toward the full shipped surface (BRD epics 1–16, 106
 * stories) so `atelier dod` gates the product, not just the M1 foundations. Each
 * capability carries a `reference` citing its BRD epic, so per-AC scoping
 * (`atelier dod --trace-id BRD:Epic-N`, ADR-061) resolves a contribution to the
 * capabilities that prove its epic shipped.
 *
 * Discipline: presence checks (file_exists / grep_present / schema_has_table)
 * prove a capability SHIPPED, not that it WORKS — behavioral proof is the G4
 * scenario layer. Where a surface is present-but-stubbed, it is marked
 * `manual_review` rather than allowed to read COMPLIANT off a presence check
 * (the present-but-broken trap the ladder exists to catch).
 */

import type { Capability } from '../types.ts';

export const m2m7SurfaceCapabilities: Capability[] = [
  {
    id: 'epic1-scaffolding-lifecycle',
    category: 'capability',
    description: 'Project scaffolding & lifecycle — the CLI scaffolder + datastore/deploy lifecycle commands',
    reference: 'docs/functional/BRD.md § Epic-1 (project scaffolding & lifecycle), ADR-029, ADR-032',
    derivation: [
      { type: 'file_exists', path: 'scripts/cli/commands/init.ts' },
      { type: 'file_exists', path: 'scripts/cli/commands/datastore.ts' },
      { type: 'file_exists', path: 'scripts/cli/commands/deploy.ts' },
    ],
  },
  {
    id: 'epic4-contribution-model-code',
    category: 'capability',
    description: 'Territory + contribution model (behavior) — claim / update / release coordinator logic, beyond the schema tables',
    reference: 'docs/functional/BRD.md § Epic-4 (territory + contribution model), ADR-003, ADR-033',
    derivation: [
      { type: 'file_exists', path: 'scripts/sync/lib/write.ts' },
      { type: 'grep_present', path: 'scripts/sync/lib/write.ts', pattern: 'async claim', description: 'contribution claim lifecycle' },
      { type: 'grep_present', path: 'scripts/sync/lib/write.ts', pattern: 'async update', description: 'state-transition update with validateStateTransition' },
      { type: 'grep_present', path: 'scripts/sync/lib/write.ts', pattern: 'async release', description: 'release back to open' },
    ],
  },
  {
    id: 'epic5-decision-durability-code',
    category: 'capability',
    description: 'Decision durability (behavior) — write-first log_decision (repo append before datastore, per ADR-005)',
    reference: 'docs/functional/BRD.md § Epic-5 (decision durability), ADR-005, ADR-030',
    derivation: [
      { type: 'file_exists', path: 'scripts/sync/lib/write.ts' },
      { type: 'grep_present', path: 'scripts/sync/lib/write.ts', pattern: 'logDecision', description: 'repo-first decision logging with committer callback' },
    ],
  },
  {
    id: 'epic6-find-similar-eval',
    category: 'capability',
    description: 'Find_similar + eval harness — semantic search primitive (advisory tier) + precision/recall runner',
    reference: 'docs/functional/BRD.md § Epic-6 (find_similar + eval), ADR-006, ADR-042, ADR-043',
    derivation: [
      { type: 'file_exists', path: 'scripts/endpoint/lib/find-similar.ts' },
      { type: 'file_exists', path: 'scripts/eval/find_similar/runner.ts' },
    ],
  },
  {
    id: 'epic7-locks-fencing-code',
    category: 'capability',
    description: 'Locks + fencing tokens (behavior) — lock acquisition + monotonic fencing-token allocation/validation',
    reference: 'docs/functional/BRD.md § Epic-7 (locks + fencing tokens), ADR-007',
    derivation: [
      { type: 'file_exists', path: 'scripts/sync/lib/write.ts' },
      { type: 'grep_present', path: 'scripts/sync/lib/write.ts', pattern: 'acquireLock', description: 'lock acquisition' },
      { type: 'grep_present', path: 'scripts/sync/lib/write.ts', pattern: 'allocate_fencing_token', description: 'monotonic fencing-token allocation (ADR-007)' },
    ],
  },
  {
    id: 'epic8-territory-contracts-code',
    category: 'capability',
    description: 'Territory contracts (behavior) — propose_contract_change handler. STUBBED at M2 entry per ADR-040, so presence ≠ function.',
    reference: 'docs/functional/BRD.md § Epic-8 (territory contracts), ADR-035, ADR-040',
    manual_review: true,
    notes: 'propose_contract_change is stubbed at M2 (ADR-040). The handler is present; whether it enforces is a behavioral question — do not read COMPLIANT off presence.',
    derivation: [
      { type: 'file_exists', path: 'scripts/endpoint/lib/handlers.ts' },
      { type: 'grep_present', path: 'scripts/endpoint/lib/handlers.ts', pattern: 'propose_contract_change', description: 'contract-change handler present (stub)' },
    ],
  },
  {
    id: 'epic9-sync-substrate',
    category: 'capability',
    description: 'Sync substrate — all five scripts: publish-docs, publish-delivery, mirror-delivery, reconcile, triage',
    reference: 'docs/functional/BRD.md § Epic-9 (sync substrate), ADR-018',
    derivation: [
      { type: 'file_exists', path: 'scripts/sync/publish-docs.ts' },
      { type: 'file_exists', path: 'scripts/sync/publish-delivery.ts' },
      { type: 'file_exists', path: 'scripts/sync/mirror-delivery.ts' },
      { type: 'file_exists', path: 'scripts/sync/reconcile.ts' },
      { type: 'file_exists', path: 'scripts/sync/triage/run.ts' },
    ],
  },
  {
    id: 'epic11-cli-tooling',
    category: 'capability',
    description: 'CLI tooling — the atelier dispatcher + command registry covering the v1 command surface',
    reference: 'docs/functional/BRD.md § Epic-11 (CLI tooling)',
    derivation: [
      { type: 'file_exists', path: 'scripts/cli/atelier.ts' },
      { type: 'file_exists', path: 'scripts/cli/commands' },
      { type: 'grep_present', path: 'scripts/cli/atelier.ts', pattern: 'COMMANDS', description: 'command registry' },
    ],
  },
  {
    id: 'epic12-observability',
    category: 'capability',
    description: 'Observability — telemetry alert publisher + the admin observability dashboard surface',
    reference: 'docs/functional/BRD.md § Epic-12 (observability), ARCH 8.1',
    derivation: [
      { type: 'file_exists', path: 'scripts/observability/alert-publisher.ts' },
      { type: 'file_exists', path: 'prototype/src/app/atelier/observability/page.tsx' },
    ],
  },
  {
    id: 'epic13-security-model',
    category: 'capability',
    description: 'Security model — per-composer auth + row-level authorization (RLS runtime role per ADR-051)',
    reference: 'docs/functional/BRD.md § Epic-13 (security model), ADR-051',
    derivation: [
      { type: 'file_exists', path: 'scripts/endpoint/lib/auth.ts' },
      { type: 'grep_present', path: 'scripts/endpoint/lib/auth.ts', pattern: 'bearer', description: 'bearer-token auth path' },
    ],
  },
  {
    id: 'epic14-composer-lifecycle-code',
    category: 'capability',
    description: 'Composer lifecycle (behavior) — session create / heartbeat / deregister',
    reference: 'docs/functional/BRD.md § Epic-14 (composer lifecycle), ADR-038',
    derivation: [
      { type: 'file_exists', path: 'scripts/sync/lib/write.ts' },
      { type: 'grep_present', path: 'scripts/sync/lib/write.ts', pattern: 'createSession', description: 'session creation' },
      { type: 'grep_present', path: 'scripts/sync/lib/write.ts', pattern: 'heartbeat', description: 'session heartbeat' },
    ],
  },
  {
    id: 'epic15-role-aware-lenses',
    category: 'capability',
    description: 'Role-aware lenses — the dynamic [lens] route + lens shell composing role-filtered panels',
    reference: 'docs/functional/BRD.md § Epic-15 (role-aware lenses)',
    derivation: [
      { type: 'file_exists', path: 'prototype/src/app/atelier/[lens]/page.tsx' },
      { type: 'file_exists', path: 'prototype/src/app/atelier/_components/Lens.tsx' },
    ],
  },
  {
    id: 'epic16-remote-composer-support',
    category: 'capability',
    description: 'Remote composer support — the MCP dispatcher (18-tool surface) + streaming transport for non-local agents',
    reference: 'docs/functional/BRD.md § Epic-16 (remote composer support), ADR-009, ADR-050',
    derivation: [
      { type: 'file_exists', path: 'scripts/endpoint/lib/dispatch.ts' },
      { type: 'file_exists', path: 'scripts/endpoint/lib/transport.ts' },
      { type: 'grep_present', path: 'scripts/endpoint/lib/dispatch.ts', pattern: 'TOOL_NAMES', description: 'the locked tool surface' },
    ],
  },
];
