// InboxFreshness - Phase 8 freshness banner above the prototype Inbox.
//
// Surfaces the per-section substrate counts (live from the PR 1 loader)
// so the viewer sees the "what changed since I last looked" signal
// before the action-shaped sections render with their fixture-driven
// rows. PR 3 swaps the prototype's fixture filters for these substrate
// arrays and removes the redundancy.

import type { InboxViewModel } from '../../../../lib/atelier/inbox-data.ts';

export function InboxFreshness({ viewModel }: { viewModel: InboxViewModel }) {
  const buckets = [
    { id: 'needs-reaction', label: 'react', count: viewModel.needsReaction.length },
    { id: 'awaiting-approval', label: 'approve', count: viewModel.awaitingApproval.length },
    { id: 'awaiting-review', label: 'review', count: viewModel.awaitingReview.length },
    { id: 'blocked-on-you', label: 'unblock', count: viewModel.blockedOnYou.length },
  ];
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  return (
    <section
      className="border-b border-rule bg-paper py-3 px-6 lg:px-10"
      aria-label="Substrate counts by action"
    >
      <div className="max-w-7xl mx-auto flex items-baseline justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="label-eyebrow">Substrate</span>
          <span className="text-sm text-ink-muted nums-tabular">
            {total === 0 ? 'nothing waiting on you' : `${total} asking for action`}
          </span>
        </div>
        <ul className="flex items-baseline gap-3 text-xs text-ink-subtle">
          {buckets.map((b) => (
            <li key={b.id} className="nums-tabular">
              <a
                href={`#${b.id}`}
                className="no-underline hover:text-ink"
              >
                <span className="font-mono">{b.count}</span>{' '}
                <span className="ml-0.5">{b.label}</span>
              </a>
            </li>
          ))}
        </ul>
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
