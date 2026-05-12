// InitialProposals - renders the server-side initial page of open
// proposals returned by the loader (PR 1).
//
// This is the live-data hook for PR 3: today the prototype Compose
// references "past proposals" via a static link in its sidebar. In PR 3
// the propose-form's submit handler will mutate this list optimistically
// and the live-wiring thread will replace the static banner with an
// SSE-driven counter.
//
// Token discipline: every color comes from the @theme block in
// prototypes/dashboard-northstar/styles.css (color-rule / color-paper /
// color-ink-muted). No raw hex.

import type { ProposalSummary } from '../../../../lib/atelier/compose-data.ts';

export function InitialProposals({
  proposals,
  pageSize,
  activeState,
}: {
  proposals: ProposalSummary[];
  pageSize: number;
  activeState: 'open' | 'synthesized' | 'approved';
}) {
  return (
    <section
      className="border-b border-rule bg-paper py-3 px-6 lg:px-10"
      aria-label={`${activeState} proposals`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 max-w-7xl mx-auto">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="label-eyebrow">{activeState} proposals</span>
          <span className="text-sm text-ink-muted nums-tabular">
            {proposals.length === 0
              ? 'none yet'
              : `${proposals.length} of ${pageSize} max`}
          </span>
        </div>
        {proposals.length > 0 && (
          <span className="text-xs text-ink-subtle nums-tabular">
            most recent: {formatRelative(proposals[0]!.createdAt)}
          </span>
        )}
      </div>
    </section>
  );
}

// Phase 8 freshness contract: the most-recent timestamp surfaces as a
// human-relative figure rather than a raw ISO string. Kept inline here
// rather than depending on the prototype's date-fns to avoid pulling a
// client-only dep into the server module.
function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}
