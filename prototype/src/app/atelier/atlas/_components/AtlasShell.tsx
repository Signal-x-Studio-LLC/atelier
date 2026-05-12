// AtlasShell - PR 1 scaffold render.
//
// Renders the viewer header + scale budget. The prototype Atlas UI
// port lands in PR 2; find_similar server-action wiring in PR 3.

import type { AtlasViewModel } from '../../../../lib/atelier/atlas-data.ts';

export function AtlasShell({ viewModel }: { viewModel: AtlasViewModel }) {
  const { viewer, scaleBudget } = viewModel;
  return (
    <main className="min-h-screen bg-canvas text-ink py-6 px-6 lg:px-10">
      <header className="max-w-5xl mx-auto mb-8">
        <p className="label-eyebrow mb-1">
          {viewer.projectName} / atelier / atlas
        </p>
        <h1 className="font-display text-h1 font-semibold text-ink mb-1">Atlas</h1>
        <p className="text-sm text-ink-muted max-w-prose">
          Hybrid retrieval over decisions, proposals, syntheses, contributions.
          Searches the substrate's queryable history via find_similar (ADR-042).
        </p>
      </header>

      <section
        className="max-w-5xl mx-auto border border-rule rounded-lg bg-paper p-5"
        aria-label="Slice 4 scaffold"
      >
        <p className="label-eyebrow mb-3">slice 4 - pr 1 - scaffold</p>
        <ul className="space-y-2 text-sm text-ink">
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
          Prototype Atlas UI ports in PR 2; find_similar wiring in PR 3;
          audit pass in PR 4.
        </p>
      </section>
    </main>
  );
}
