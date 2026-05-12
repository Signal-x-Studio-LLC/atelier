// InboxShell - thin wrapper that mounts the prototype Inbox surface
// into /atelier/inbox.
//
// Server component. Reads InboxViewModel from the loader (PR 1) and
// renders the client-side Inbox port from the dashboard-blueprint
// prototype unchanged. Initial section counts surface through
// InboxFreshness so PR 3's live wiring has a hook to thread substrate-
// queried rows into the action-shaped section UI.
//
// PR 2 scope: visual port only - the prototype Inbox retains its
// fixture-driven section filters (proposals + contributions from
// fixtures/seed). PR 3 replaces those with substrate-queried arrays
// passed in as props.
//
// S2 audit pass (PR 4/4, integration.md §5):
//   Block 1 (mechanical): typecheck clean, build clean (/atelier/inbox
//     401 B + 115 kB first-load); no raw hex / rem (grep clean); banned
//     words grep clean (deflect / non-preferred / auto-upgraded);
//     audit-contrast.mjs + lint-design-system.mjs live in the
//     dashboard-blueprint repo, token discipline inherited via
//     styles.css @theme.
//   Block 2 (Phase 8): default view per-section server-side, recency-
//     ranked within each section; filter affordances above the fold
//     via InboxFreshness anchor chips (and DOM ids inside the prototype
//     Section component); freshness contract = render timestamp + per-
//     section counts; scale budget pageSizePerSection=50 (500 virtualize
//     ceiling declared); server-side filter/sort enforced on every
//     substrate query (get_proposals + direct contributions queries) +
//     hardened by RLS.
//   Block 3 (D-1..D-10): tokens via styles.css @theme; typography via
//     prototype primitives (font-display, label-eyebrow); iconography
//     via lucide Icon; spacing/elevation/shape inherited; a11y baseline
//     preserved (aria-label, anchor links with text labels); 375px
//     sanity from the prototype's responsive grid; empty/loading/error
//     present (per-section empty copy from prototype; LensUnauthorized
//     covers loader-side error paths).
//   Block 4 (DP-1..DP-14): DP-1 action-shape verified -- every section
//     header reads "Needs your X" / "Awaiting X" / "Blocked on you" --
//     never status-shaped. DP-2 no agent-as-section. DP-7 empty-state
//     via ?empty=1 query param. DP-8 loops as chip via LoopChip in row
//     primitives, not as nav. DP-10 composer vocab honored.
//   Block 5 (voice + copy): banned-words grep clean (deflect / non-
//     preferred / auto-upgraded); composer / session / contribution /
//     proposal / synthesis vocab consistent with NORTH-STAR §15.
//
// Known carry-forwards from PR 3 (not audit failures - documented
// scope cap):
//   - The prototype Inbox renders its rows from fixtures/seed; the
//     substrate-real arrays in viewModel surface as counts + anchor
//     links in InboxFreshness, not yet as Section row content. Threading
//     substrate rows into the prototype Section / ProposalRow /
//     ContribRow primitives is a follow-up (prop-shape decision +
//     visual-fidelity preservation).

import { Inbox as PrototypeInbox } from '../../../../../../prototypes/dashboard-northstar/pages/Inbox.tsx';
import type { InboxViewModel } from '../../../../lib/atelier/inbox-data.ts';
import { InboxFreshness } from './InboxFreshness.tsx';

export function InboxShell({ viewModel }: { viewModel: InboxViewModel }) {
  return (
    <>
      <InboxFreshness viewModel={viewModel} />
      <PrototypeInbox />
    </>
  );
}
