// Observability dashboard config loader (ARCH 8.2 / 8.3; ADR-059 Workers port).
//
// Returns the observability block from .atelier/config.yaml, merged onto
// defaults. Per ADR-059, the YAML is read at codegen time and bundled into
// the Workers bundle; this module reads from the bundle, not from node:fs.
//
// Adopter overrides for the observability envelope happen at codegen time
// (edit the YAML, regenerate). Find_similar config is a separate concern
// and stays runtime-env-driven per ADR-041.

import { BUNDLED_OBSERVABILITY_CONFIG } from './__bundled__/observability-config.bundled';

export interface ObservabilityThresholds {
  sessionsActivePerProject: number;
  sessionsActivePerGuild: number;
  contributionsLifetimePerProject: number;
  contributionsLifetimePerGuild: number;
  decisionsLifetimePerProject: number;
  locksHeldConcurrentPerProject: number;
  vectorIndexRowsPerGuild: number;
  triagePendingBacklog: number;
  syncLagSecondsP95: number;
  costUsdPerDayPerProject: number;
}

export interface ObservabilityConfig {
  thresholds: ObservabilityThresholds;
  lookbackSeconds: number;
}

// Preserved for callers that import it directly; the bundled module
// already merges defaults so this is informational.
export const DEFAULT_OBSERVABILITY_CONFIG: ObservabilityConfig = {
  thresholds: {
    sessionsActivePerProject: 20,
    sessionsActivePerGuild: 100,
    contributionsLifetimePerProject: 10000,
    contributionsLifetimePerGuild: 50000,
    decisionsLifetimePerProject: 500,
    locksHeldConcurrentPerProject: 20,
    vectorIndexRowsPerGuild: 100000,
    triagePendingBacklog: 25,
    syncLagSecondsP95: 300,
    costUsdPerDayPerProject: 10,
  },
  lookbackSeconds: 86400,
};

// The signature retains the unused `repoRoot` parameter for backwards
// compatibility with existing callers (e.g., observability-data.ts).
// The argument is ignored — codegen already resolved the repo root.
export function loadObservabilityConfig(_repoRoot?: string): ObservabilityConfig {
  return BUNDLED_OBSERVABILITY_CONFIG as ObservabilityConfig;
}

export { severityFor, type Severity } from '../../../../scripts/lib/severity.ts';
