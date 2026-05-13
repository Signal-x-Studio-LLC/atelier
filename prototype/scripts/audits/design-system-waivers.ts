/**
 * Atelier design-system audit-gate waivers (ADR-060 PR A).
 *
 * The audit gates (`lint-no-hex-literals.mjs`, the expanded
 * `audit-contrast.mjs` + `lint-design-system.mjs` in PRs B/C/D)
 * enforce token discipline against every Atelier-authored route.
 * PR A lands the gates GLOBALLY on day one rather than per-surface;
 * the waiver list below makes the current-state violations explicit
 * and binds each to the migration PR (per ADR-060's "Migration
 * sequencing — package-first, waiver-pattern, five PRs") that
 * retires the entry.
 *
 * Contract:
 *
 * - `path` is repo-relative, glob-like; the audit scripts perform a
 *   suffix-or-prefix match against this string for each scanned file.
 * - `reason` describes what is being waived. Keep it specific — "inline
 *   hex literals in styles.shell + styles.card" beats "currently fails".
 * - `until_pr` cites the migration PR letter that retires the entry.
 *   Allowed values: `'B' | 'C' | 'D' | 'E'`. Per ADR-060:
 *
 *     B — Home + sign-in migration
 *     C — /atelier/* lenses + observability migration
 *     D — /prototype/* harness chrome migration
 *     E — Cleanup + generator (dashboard-northstar styles.css drop)
 *
 * CI enforcement (per .github/workflows/atelier-audit.yml):
 *
 * - Any PR adding a waiver without `until_pr` set fails.
 * - Any PR whose branch matches `feat/design-system-pr-<letter>-*`
 *   that does NOT retire the entries citing `<letter>` fails.
 *
 * Why a TS file (not JSON / YAML): the waiver list is interpreted by
 * Node scripts (audit gates) AND consumed by the CI consistency-check
 * job; a typed TS shape gives both consumers compile-time validation
 * (canonical-pattern-first carve-out: the canonical shape would be JSON,
 * but the consumer set is exclusively TypeScript and the typed shape
 * makes drift visible at build time rather than at gate-run time).
 */

export type WaiverPr = 'B' | 'C' | 'D' | 'E';

export interface Waiver {
  path: string;
  reason: string;
  until_pr: WaiverPr;
}

export const waivers: Waiver[] = [
  // ---- PR B retired (#TBD; home + sign-in now consume design package) ----

  // ---- PR C retires ------------------------------------------------------
  // (retired in feat/design-system-pr-c-lenses-observability; all entries
  // migrated to design-package primitives.)

  // ---- PR E retires ------------------------------------------------------
  {
    path: 'prototypes/dashboard-northstar/styles.css',
    reason:
      'overlapping `@theme` block with substrate globals.css; intentionally retained for the duration of the migration. PR E drops this in favor of importing the substrate globals.',
    until_pr: 'E',
  },
  {
    path: 'prototypes/dashboard-northstar/fixtures/seed.ts',
    reason:
      'composer avatar_color values are content, not styling — but render through inline style; PR E moves to a tokenized `avatar_tone` slot.',
    until_pr: 'E',
  },
  {
    path: 'prototypes/dashboard-northstar/pages/DesignSystem.tsx',
    reason:
      'design-system documentation page intentionally renders hex literals as content (swatch values). PR E moves hex display to read from the tokens module so the doc page mirrors `tokens.ts` automatically.',
    until_pr: 'E',
  },
];

/**
 * Returns true if `repoPath` (repo-relative, forward-slash) is waived.
 * Suffix-match: `repoPath.endsWith(waiver.path)` so callers may pass
 * absolute paths.
 */
export function isWaived(repoPath: string): Waiver | undefined {
  const normalized = repoPath.replace(/\\/g, '/');
  return waivers.find((w) => normalized.endsWith(w.path));
}
