// ComposeShell - PR 1 scaffold render.
//
// Renders the auth-resolved viewer header + a count of open proposals
// returned from get_proposals via the canonical dispatch path. The form
// for authoring proposals (ProposeForm) ports from prototypes/dashboard-
// blueprint/prototype/src/pages/Compose.tsx in PR 2. Reaction badges +
// state-filter chips + live wiring land in PR 3.
//
// Phase 8 dynamic-surface declarations carried inline so future readers
// can audit without grepping the loader:
//   - default view: state=open, ranked by recency (server-side)
//   - filter affordances: chips above the fold (PR 2)
//   - freshness contract: per-proposal created_at; SSE wiring optional
//     (Compose proposals are user-initiated writes, not push events)
//   - scale budget: paginate at 50; virtualize at 500 (Phase 3)
//   - server-side filter/sort: get_proposals enforces

import type { ComposeViewModel } from '../../../../lib/atelier/compose-data.ts';
import styles from './ComposeShell.module.css';

export function ComposeShell({ viewModel }: { viewModel: ComposeViewModel }) {
  const { viewer, proposals } = viewModel;
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>
          {viewer.projectName} / atelier / compose
        </div>
        <h1 className={styles.title}>Compose</h1>
        <p className={styles.description}>
          Author into the substrate. Every action lands as a queryable
          artifact - proposals are structured with options and tradeoffs;
          decisions are markdown to the repo; checkpoints save your seat.
        </p>
      </header>

      <section className={styles.placeholder}>
        <div className={styles.placeholderEyebrow}>
          slice 1 - pr 1 - scaffold
        </div>
        <p>
          Route + RLS-respecting loader live. UI port from the
          dashboard-blueprint prototype lands in PR 2; live wiring of
          propose / react in PR 3; full audit pass in PR 4.
        </p>
      </section>

      <section className={styles.placeholder} style={{ marginTop: 16 }}>
        <div className={styles.proposalsHeader}>
          <span className={styles.proposalsLabel}>Open proposals</span>
          <span className={styles.proposalsCount}>
            {proposals.length} of {viewModel.pageSize} max
          </span>
        </div>
        {proposals.length === 0 ? (
          <p className={styles.empty}>
            No open proposals. The form to post one ships in PR 2.
          </p>
        ) : (
          <ul>
            {proposals.map((p) => (
              <li key={p.id}>
                {p.title}
                {p.reactionCount > 0 ? ` (${p.reactionCount} reactions)` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
