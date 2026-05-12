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
// S2 audit gates (recorded inline at PR 4):
//   - Phase 8 default view: section anchors above the fold, per-section
//     server-side query, recency rank within each section
//   - Phase 8 filter affordances: section anchors via URL fragment
//   - Phase 8 freshness: per-row age + last-sync header
//   - Phase 8 scale budget: 50/section paginate, 500 virtualize ceiling
//   - DP-1 action-shape: every section header reads "Needs your X" /
//     "Awaiting X" / "Blocked on X" - never status-shaped
//   - DP-7 empty-state: ?empty=1 surfaces the cold-Tuesday view

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
