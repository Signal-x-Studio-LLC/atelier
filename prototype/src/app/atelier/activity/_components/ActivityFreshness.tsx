// ActivityFreshness - Phase 8 freshness banner above the prototype
// Activity timeline.
//
// Surfaces substrate-truth event counts (last 24h, from proposals +
// contributions + decisions) so the viewer sees real activity volume
// before the first SSE envelope arrives. DP-4 freshness contract:
// quantitative signal per-loop, declarative framing.

import type { ActivityViewModel } from '../../../../lib/atelier/activity-data.ts';

export function ActivityFreshness({ viewModel }: { viewModel: ActivityViewModel }) {
  const { freshness } = viewModel;
  const total =
    freshness.proposalsLast24h +
    freshness.contributionsLast24h +
    freshness.decisionsLast24h;
  return (
    <section
      className="border-b border-rule bg-paper py-3 px-6 lg:px-10"
      aria-label={`Substrate write activity, last ${freshness.windowHours} hours`}
    >
      <div className="max-w-7xl mx-auto flex items-baseline justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="label-eyebrow">Substrate</span>
          <span className="text-sm text-ink-muted nums-tabular">
            {total === 0
              ? `no writes in the last ${freshness.windowHours}h`
              : `${total} writes in the last ${freshness.windowHours}h`}
          </span>
        </div>
        <ul className="flex items-baseline gap-4 text-xs text-ink-subtle nums-tabular">
          <li>
            <span className="font-mono">{freshness.proposalsLast24h}</span>{' '}
            <span className="ml-0.5">proposals</span>
          </li>
          <li>
            <span className="font-mono">{freshness.contributionsLast24h}</span>{' '}
            <span className="ml-0.5">contributions</span>
          </li>
          <li>
            <span className="font-mono">{freshness.decisionsLast24h}</span>{' '}
            <span className="ml-0.5">decisions</span>
          </li>
        </ul>
        <span className="text-xs text-ink-subtle nums-tabular">
          live via /api/events
        </span>
      </div>
    </section>
  );
}
