/**
 * Core types for the state-derive tool.
 *
 * A `Capability` is something we can mechanically check for in the codebase:
 * a shipped feature, a convention, an ADR commitment, a spec acceptance
 * criterion. Each carries one or more `Check` expressions that the tool runs
 * against the working tree. The tool computes a `Status` per capability from
 * its check results and writes the whole thing out as a `State` document with
 * an `as_of_commit` annotation.
 *
 * The canonical pattern: spec docs claim X is shipped → catalog encodes the
 * mechanical evidence for X → derive run says COMPLIANT/PARTIAL/NON-COMPLIANT.
 * No prose-claim audits. The codebase is the source of truth.
 */

export type Check =
  | { type: 'file_exists'; path: string; description?: string }
  | { type: 'file_absent'; path: string; description?: string }
  | {
      type: 'grep_count';
      pattern: string;
      path: string;
      expect_min?: number;
      expect_max?: number;
      flags?: string;
      description?: string;
    }
  | { type: 'grep_present'; pattern: string; path: string; flags?: string; description?: string }
  | { type: 'grep_absent'; pattern: string; path: string; flags?: string; description?: string }
  | { type: 'schema_has_table'; table: string; description?: string }
  | { type: 'schema_has_column'; table: string; column: string; description?: string }
  | { type: 'commit_message_grep'; pattern: string; since?: string; description?: string }
  // Gate G4 (behavior) — the ONLY non-presence primitive. Asserts the AC named by
  // `ac` has a passing recorded scenario, by reading the CI-produced results
  // artifact (default docs/audits/derived/_scenario-results.json, override via
  // results_path). It NEVER executes tests — it parses recorded evidence. See
  // docs/methodology/dod-verification-ladder-pattern.md.
  | { type: 'scenario_passes'; ac: string; results_path?: string; description?: string };

export type CapabilityCategory =
  /** A shipped product capability (user-facing feature or supporting infra). */
  | 'capability'
  /** A coding/architecture convention the codebase commits to. */
  | 'convention'
  /** A specific ADR or design commitment the codebase commits to. */
  | 'adr-commitment'
  /**
   * Code path gated behind a feature flag that must be retired once the
   * production implementation lands.
   */
  | 'feature_flag_inactive'
  /**
   * A BRD/spec acceptance criterion covered by an integration test. The static
   * checks here prove the test EXISTS, not that it passes — pass/fail evidence
   * belongs to the behavioral layer (DoD gate 4), not this tool.
   */
  | 'scenario-coverage';

export interface Capability {
  id: string;
  category: CapabilityCategory;
  description: string;
  derivation: Check[];
  /**
   * If true, `status` aggregation flips: `matched=true` for all checks means
   * NON-COMPLIANT (the thing we don't want is present). Useful for capabilities
   * expressed as "convention X is followed" where the check is "find sites
   * violating X". Defaults to false.
   */
  invert?: boolean;
  /**
   * When true, this capability cannot be fully verified mechanically. The
   * renderer marks it distinctly so reviewers know to verify by reading. The
   * derivation array may be empty or contain best-effort proxies; their
   * results are advisory rather than authoritative.
   */
  manual_review?: boolean;
  /** Free-text notes carried through to the rendered output. */
  notes?: string;
  /** Optional human-curated reference (ADR, PR, doc) for the capability. */
  reference?: string;
}

export type Status =
  /** All checks matched expectations. */
  | 'COMPLIANT'
  /** Some checks matched, some did not. */
  | 'PARTIAL'
  /** No checks matched expectations, but the capability could exist. */
  | 'NON-COMPLIANT'
  /** Capability is intentionally absent and the absence was confirmed. */
  | 'ABSENT'
  /** At least one check failed to run (e.g. directory missing). */
  | 'ERROR'
  /** Capability requires human review — mechanical checks alone are insufficient. */
  | 'MANUAL_REVIEW';

export interface CheckResult {
  check: Check;
  /**
   * For positive checks (file_exists, grep_present, grep_count meeting bounds,
   * etc.), true means the expectation was met. For negative checks
   * (file_absent, grep_absent), true means the absence was confirmed.
   */
  matched: boolean;
  /**
   * Behavioral (G4) checks may be INDETERMINATE: `unknown: true` means "no
   * recorded pass/fail evidence yet" (absent/stale results artifact, no run for
   * the AC, or only-skipped). An unknown is neither a pass nor a fail — it must
   * never read COMPLIANT and must not be punished as NON-COMPLIANT. Presence
   * checks never set this (so the original aggregation is preserved exactly).
   * See dod-verification-ladder-pattern.md § scenario_passes fail-safe.
   */
  unknown?: boolean;
  evidence: string[];
  error?: string;
}

export interface CapabilityResult {
  capability: Capability;
  status: Status;
  results: CheckResult[];
}

/**
 * The gate-G4 evidence contract. Produced by the scenario-results normalizer
 * (tools/scenario-results/) from the test runners' JSON reporters; consumed by
 * the `scenario_passes` check. Automation-owned (no-state-files gate); written
 * to docs/audits/derived/_scenario-results.json. It records evidence — it never
 * executes tests.
 */
export interface ScenarioRun {
  /** Join key — a story / acceptance-criterion id (e.g. 'US-1.1'). */
  ac: string;
  /** Human-traceable scenario id (slug of the scenario name). */
  scenario: string;
  /** Which suite produced this run. */
  suite: 'api-scenarios' | 'bdd-e2e';
  status: 'passed' | 'failed' | 'skipped';
  /** ISO8601 timestamp of the run. */
  ranAt: string;
  /** Source file the scenario lives in. */
  source: string;
}

export interface ScenarioResults {
  schemaVersion: '1.0';
  generatedAt: string;
  /** The commit the suites ran against. Staleness guard: != derive HEAD → UNKNOWN. */
  as_of_commit: string;
  runs: ScenarioRun[];
}

export interface State {
  schema_version: '1.0';
  generated_at: string;
  as_of_commit: string;
  repo_root: string;
  capabilities: CapabilityResult[];
}
