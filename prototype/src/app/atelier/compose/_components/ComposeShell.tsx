// ComposeShell - server wrapper for /atelier/compose.
//
// Renders InitialProposals (loader-fed banner) + the prototype Compose
// client component with the submitProposal server action threaded in as
// onPropose. The action calls the propose MCP tool via dispatch + RLS
// (atelier_runtime, ADR-051). The ADR-057 harness mount at
// /prototype/[project]/compose continues to render the same Compose
// component without the prop -- the form falls back to fixture-only
// no-op.
//
// S1 audit pass (PR 4/4, integration.md §5):
//   Block 1 (mechanical): typecheck clean, build clean (/atelier/compose
//     399 B + 116 kB first-load); no raw hex / rem in the surface files;
//     audit-contrast.mjs + lint-design-system.mjs live in dashboard-
//     blueprint repo (token discipline inherited via styles.css @theme).
//   Block 2 (Phase 8): default state=open ranked by recency (server-
//     side, compose-data.ts); filter chips above the fold
//     (StateFilterChips); freshness contract via InitialProposals
//     most-recent timestamp; scale budget 50/500 declared on
//     ComposeViewModel.pageSize; get_proposals enforces server-side.
//   Block 3 (D-1..D-10): tokens via styles.css @theme; typography via
//     prototype primitives; iconography via lucide Icon component;
//     spacing/elevation/shape inherited; a11y baseline preserved
//     (aria-label, aria-current on filter chips, role=alert/status on
//     submit feedback); 375px sanity preserved by the prototype's
//     responsive grid; empty / loading / error states present
//     (InitialProposals empty case, isPending state, inline error
//     alert).
//   Block 4 (DP-1..DP-14): DP-7 wedge surface; DP-3 structured propose
//     form (min 2 options enforced server-side); DP-13 chrome/canvas
//     mode toggle preserved; no status-shaped headers (DP-1); no
//     agent-as-section (DP-2); loops surface as eyebrow chip on
//     action tabs, not nav (DP-8); composer vocab honored (DP-10).
//   Block 5 (voice + copy): no banned words (deflect / non-preferred /
//     auto-upgraded grep clean); composer / session / contribution /
//     proposal / synthesis vocab consistent with NORTH-STAR §15.

import { Compose as PrototypeCompose } from '../../../../../../prototypes/dashboard-northstar/pages/Compose.tsx';
import type { ComposeViewModel } from '../../../../lib/atelier/compose-data.ts';
import { InitialProposals } from './InitialProposals.tsx';
import { StateFilterChips } from './StateFilterChips.tsx';
import { submitProposal } from './compose-actions.ts';

export function ComposeShell({ viewModel }: { viewModel: ComposeViewModel }) {
  // Phase 3 polish: thread substrate-real co-authors + most-recent
  // proposal into the prototype Compose. presenceCoAuthors drives the
  // DP-13 overlapping avatar stack; readModeProposal replaces the
  // ReadModeCanvas fixture content when the viewer flips to Read mode.
  const readMode = viewModel.readModeProposal
    ? {
        id: viewModel.readModeProposal.id,
        title: viewModel.readModeProposal.title,
        bodyMarkdown: viewModel.readModeProposal.bodyMarkdown,
        options: viewModel.readModeProposal.options,
        reactionCount: viewModel.readModeProposal.reactionCount,
        traceIds: viewModel.readModeProposal.traceIds,
        territoryId: viewModel.readModeProposal.territoryId,
      }
    : null;
  return (
    <>
      <InitialProposals
        proposals={viewModel.proposals}
        pageSize={viewModel.pageSize}
        activeState={viewModel.activeState}
      />
      <StateFilterChips activeState={viewModel.activeState} />
      <PrototypeCompose
        onPropose={submitProposal}
        presenceCoAuthors={viewModel.presenceCoAuthors}
        readModeProposal={readMode}
      />
    </>
  );
}
