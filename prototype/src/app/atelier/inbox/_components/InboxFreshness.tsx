// InboxFreshness - Phase 8 freshness banner above the prototype Inbox.
//
// Surfaces the per-section substrate counts (live from the PR 1 loader)
// so the viewer sees the "what changed since I last looked" signal
// before the action-shaped sections render with their fixture-driven
// rows. PR 3 swaps the prototype's fixture filters for these substrate
// arrays and removes the redundancy.

import type { InboxViewModel } from '../../../../lib/atelier/inbox-data.ts';

export function InboxFreshness({ viewModel }: { viewModel: InboxViewModel }) {
  const total =
    viewModel.needsReaction.length +
    viewModel.awaitingApproval.length +
    viewModel.awaitingReview.length +
    viewModel.blockedOnYou.length;
  return (
    <section
      className="border-b border-rule bg-paper py-3 px-6 lg:px-10"
      aria-label="Inbox freshness summary"
    >
      <div className="max-w-7xl mx-auto flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="label-eyebrow">Substrate counts</span>
          <span className="text-sm text-ink-muted nums-tabular">
            {total === 0
              ? 'nothing waiting on you'
              : `${total} asking for action`}
          </span>
        </div>
        <span className="text-xs text-ink-subtle nums-tabular">
          rendered {formatTime(new Date())}
        </span>
      </div>
    </section>
  );
}

function formatTime(d: Date): string {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
