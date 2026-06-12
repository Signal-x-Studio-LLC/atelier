import type { Capability, CapabilityResult, Check, CheckResult, Status } from './types.ts';
import { fileExists, fileAbsent } from './checks/file.ts';
import { grepCount, grepPresent, grepAbsent } from './checks/grep.ts';
import { schemaHasTable, schemaHasColumn } from './checks/schema.ts';
import { commitMessageGrep } from './checks/commit.ts';
import { scenarioPasses } from './checks/scenario.ts';

export function runCheck(repoRoot: string, check: Check): CheckResult {
  try {
    switch (check.type) {
      case 'scenario_passes':
        return scenarioPasses(repoRoot, check);
      case 'file_exists':
        return fileExists(repoRoot, check);
      case 'file_absent':
        return fileAbsent(repoRoot, check);
      case 'grep_count':
        return grepCount(repoRoot, check);
      case 'grep_present':
        return grepPresent(repoRoot, check);
      case 'grep_absent':
        return grepAbsent(repoRoot, check);
      case 'schema_has_table':
        return schemaHasTable(repoRoot, check);
      case 'schema_has_column':
        return schemaHasColumn(repoRoot, check);
      case 'commit_message_grep':
        return commitMessageGrep(repoRoot, check);
    }
  } catch (err) {
    return { check, matched: false, evidence: [], error: (err as Error).message };
  }
}

export function aggregateStatus(results: CheckResult[], invert = false): Status {
  if (results.length === 0) return 'NON-COMPLIANT';
  if (results.some((r) => r.error)) return 'ERROR';
  // Behavioral (G4) checks may be INDETERMINATE: `unknown` = "no recorded
  // pass/fail evidence yet". An unknown is neither a pass nor a fail — it must
  // never read COMPLIANT and must not be punished as NON-COMPLIANT. Split the
  // determinate checks from the unknowns (dod-verification-ladder fail-safe).
  // Backward-compatible: presence checks never set `unknown`, so determinate ===
  // results and the original logic below is preserved exactly.
  const determinate = results.filter((r) => !r.unknown);
  const hasUnknown = determinate.length !== results.length;
  if (determinate.length === 0) return 'MANUAL_REVIEW';
  const matched = determinate.filter((r) => r.matched).length;
  if (matched === 0) {
    return invert ? 'COMPLIANT' : 'NON-COMPLIANT';
  }
  if (matched === determinate.length) {
    // All determinate checks pass. If a behavioral gate is still indeterminate
    // we cannot claim COMPLIANT (monotone rule) — surface MANUAL_REVIEW instead.
    if (hasUnknown) return 'MANUAL_REVIEW';
    return invert ? 'NON-COMPLIANT' : 'COMPLIANT';
  }
  return 'PARTIAL';
}

export function deriveCapability(repoRoot: string, capability: Capability): CapabilityResult {
  const results = capability.derivation.map((check) => runCheck(repoRoot, check));
  const mechanicalStatus = aggregateStatus(results, capability.invert);
  const status: Status = capability.manual_review ? 'MANUAL_REVIEW' : mechanicalStatus;
  return { capability, status, results };
}

export function deriveAll(repoRoot: string, capabilities: Capability[]): CapabilityResult[] {
  return capabilities.map((c) => deriveCapability(repoRoot, c));
}
