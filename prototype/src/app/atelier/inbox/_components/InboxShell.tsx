// InboxShell - PR 1 scaffold render.
//
// Renders the viewer header + per-section counts returned by the
// loader. The action-shaped section UI (DP-1) ports from
// prototypes/dashboard-northstar/pages/Inbox.tsx in PR 2; the
// contributions-side substrate queries (awaiting-review + blocked-on-
// you) land in PR 3.
//
// Phase 8 dynamic-surface declarations carried inline so future readers
// auditing the surface see them without grepping the loader:
//   - default view: each section's own server-side query (recency-ranked)
//   - filter affordances: section anchors above the fold (PR 2 ports
//     them); the URL fragment lands directly on the section a viewer
//     was asked to act on
//   - freshness contract: per-row timestamps in PR 2; "last sync"
//     header in PR 3
//   - scale budget: paginate at 50 per section; virtualize at 500
//     (Phase 3)
//   - server-side filter/sort: get_proposals + (PR 3) contributions
//     queries enforce

import type { InboxViewModel } from '../../../../lib/atelier/inbox-data.ts';

export function InboxShell({ viewModel }: { viewModel: InboxViewModel }) {
  const { viewer, needsReaction, awaitingApproval, awaitingReview, blockedOnYou } = viewModel;
  const sections = [
    { id: 'needs-reaction', label: 'Needs your reaction', count: needsReaction.length },
    { id: 'awaiting-approval', label: 'Awaiting your approval', count: awaitingApproval.length },
    { id: 'awaiting-review', label: 'Awaiting review', count: awaitingReview.length, pending: 'PR 3' },
    { id: 'blocked-on-you', label: 'Blocked on you', count: blockedOnYou.length, pending: 'PR 3' },
  ];
  return (
    <main className="min-h-screen bg-canvas text-ink py-6 px-6 lg:px-10">
      <header className="max-w-5xl mx-auto mb-8">
        <p className="label-eyebrow mb-1">
          {viewer.projectName} / atelier / inbox
        </p>
        <h1 className="font-display text-h1 font-semibold text-ink mb-1">Inbox</h1>
        <p className="text-sm text-ink-muted">
          What needs your attention, organized by what you're being asked to do.
        </p>
      </header>

      <section
        className="max-w-5xl mx-auto border border-rule rounded-lg bg-paper p-5"
        aria-label="Action-section counts"
      >
        <p className="label-eyebrow mb-3">slice 2 - pr 1 - scaffold</p>
        <ul className="space-y-2">
          {sections.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-ink">{s.label}</span>
              <span className="text-sm font-mono nums-tabular text-ink-subtle">
                {s.count}
                {s.pending ? ` (${s.pending})` : ''}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-subtle mt-4">
          Section UI ports from the prototype in PR 2; contributions-side
          legs (awaiting-review, blocked-on-you) wire to the substrate in
          PR 3.
        </p>
      </section>
    </main>
  );
}
