// ActivityShell - PR 1 scaffold render.
//
// Renders the viewer header + SSE channel coordinates. The prototype
// Activity UI port lands in PR 2; initial-timeline substrate queries
// (recent proposals + decisions + contributions joined by timestamp)
// land in PR 3.

import type { ActivityViewModel } from '../../../../lib/atelier/activity-data.ts';

export function ActivityShell({ viewModel }: { viewModel: ActivityViewModel }) {
  const { viewer, scaleBudget } = viewModel;
  return (
    <main className="min-h-screen bg-canvas text-ink py-6 px-6 lg:px-10">
      <header className="max-w-5xl mx-auto mb-8">
        <p className="label-eyebrow mb-1">
          {viewer.projectName} / atelier / activity
        </p>
        <h1 className="font-display text-h1 font-semibold text-ink mb-1">Activity</h1>
        <p className="text-sm text-ink-muted">
          Three loops, one timeline. Live via SSE per ADR-055.
        </p>
      </header>

      <section
        className="max-w-5xl mx-auto border border-rule rounded-lg bg-paper p-5"
        aria-label="Slice 3 scaffold"
      >
        <p className="label-eyebrow mb-3">slice 3 - pr 1 - scaffold</p>
        <ul className="space-y-2 text-sm text-ink">
          <li className="flex items-baseline justify-between gap-4">
            <span>SSE channel</span>
            <code className="font-mono text-xs text-ink-subtle">
              /api/events?project_id={viewer.projectId.slice(0, 8)}…
            </code>
          </li>
          <li className="flex items-baseline justify-between gap-4">
            <span>Paginate at</span>
            <span className="font-mono nums-tabular text-ink-subtle">
              {scaleBudget.paginate}
            </span>
          </li>
          <li className="flex items-baseline justify-between gap-4">
            <span>Virtualize at</span>
            <span className="font-mono nums-tabular text-ink-subtle">
              {scaleBudget.virtualize}
            </span>
          </li>
        </ul>
        <p className="text-xs text-ink-subtle mt-4">
          Prototype Activity UI ports in PR 2; initial-timeline substrate
          queries in PR 3; audit pass in PR 4.
        </p>
      </section>
    </main>
  );
}
