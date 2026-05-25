import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Check, CheckResult } from '../types.ts';

export function fileExists(repoRoot: string, check: Check & { type: 'file_exists' }): CheckResult {
  const absPath = join(repoRoot, check.path);
  const present = existsSync(absPath);
  return {
    check,
    matched: present,
    evidence: present
      ? [`${check.path} exists (${statSync(absPath).isDirectory() ? 'directory' : 'file'})`]
      : [`${check.path} not found`],
  };
}

export function fileAbsent(repoRoot: string, check: Check & { type: 'file_absent' }): CheckResult {
  const absPath = join(repoRoot, check.path);
  const present = existsSync(absPath);
  return {
    check,
    matched: !present,
    evidence: present ? [`${check.path} exists (expected absent)`] : [`${check.path} confirmed absent`],
  };
}
