// ConnectShell - PR 1 scaffold render.
//
// Renders viewer header + substrate presence count + scale budget. The
// prototype Connect UI (anchored presence/systems/chat sections) ports
// in PR 2; live SSE-driven presence push wires in PR 3.

import type { ConnectViewModel } from '../../../../lib/atelier/connect-data.ts';

export function ConnectShell({ viewModel }: { viewModel: ConnectViewModel }) {
  const { viewer, presence, presenceWindowMinutes, scaleBudget } = viewModel;
  return (
    <main className="min-h-screen bg-canvas text-ink py-6 px-6 lg:px-10">
      <header className="max-w-5xl mx-auto mb-8">
        <p className="label-eyebrow mb-1">
          {viewer.projectName} / atelier / connect
        </p>
        <h1 className="font-display text-h1 font-semibold text-ink mb-1">Connect</h1>
        <p className="text-sm text-ink-muted max-w-prose">
          Presence, external integrations, and direct conversation with the
          substrate.
        </p>
      </header>

      <section
        className="max-w-5xl mx-auto border border-rule rounded-lg bg-paper p-5"
        aria-label="Slice 5 scaffold"
      >
        <p className="label-eyebrow mb-3">slice 5 - pr 1 - scaffold</p>
        <ul className="space-y-2 text-sm text-ink">
          <li className="flex items-baseline justify-between gap-4">
            <span>Active sessions ({presenceWindowMinutes}m window)</span>
            <span className="font-mono nums-tabular text-ink-subtle">
              {presence.length}
            </span>
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
          Prototype Connect UI ports in PR 2; live SSE-driven presence push
          in PR 3; audit pass in PR 4.
        </p>
      </section>
    </main>
  );
}
