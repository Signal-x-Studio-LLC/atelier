import type { Capability, CapabilityResult, Check, CheckResult, Status } from './types.ts';
import { fileExists, fileAbsent } from './checks/file.ts';
import { grepCount, grepPresent, grepAbsent } from './checks/grep.ts';
import { schemaHasTable, schemaHasColumn } from './checks/schema.ts';
import { commitMessageGrep } from './checks/commit.ts';

export function runCheck(repoRoot: string, check: Check): CheckResult {
  try {
    switch (check.type) {
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
  const matched = results.filter((r) => r.matched).length;
  if (matched === results.length) return invert ? 'NON-COMPLIANT' : 'COMPLIANT';
  if (matched === 0) {
    return invert ? 'COMPLIANT' : 'NON-COMPLIANT';
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
