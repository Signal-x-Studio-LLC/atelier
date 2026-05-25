import { execSync } from 'node:child_process';
import type { Check, CheckResult } from '../types.ts';

/**
 * Searches `git log` for commit messages matching a pattern. Useful for
 * verifying that a stated capability was actually shipped (e.g. "Slice C
 * schema retrofit") even when the audit doc still calls it "in flight".
 */
export function commitMessageGrep(
  repoRoot: string,
  check: Check & { type: 'commit_message_grep' },
): CheckResult {
  const args = ['log', '--oneline'];
  if (check.since) args.push(`--since=${check.since}`);
  args.push(`--grep=${check.pattern}`);

  let stdout: string;
  try {
    stdout = execSync(`git ${args.map((a) => `'${a.replace(/'/g, `'\\''`)}'`).join(' ')}`, {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    return {
      check,
      matched: false,
      evidence: [],
      error: (err as Error).message,
    };
  }

  const lines = stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return {
    check,
    matched: lines.length > 0,
    evidence:
      lines.length === 0
        ? [`no commits matching /${check.pattern}/`]
        : [`${lines.length} matching commit${lines.length === 1 ? '' : 's'}`, ...lines.slice(0, 10)],
  };
}
