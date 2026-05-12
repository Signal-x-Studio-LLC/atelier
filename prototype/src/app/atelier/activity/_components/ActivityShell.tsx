// ActivityShell - thin wrapper that mounts the prototype Activity
// surface into /atelier/activity.
//
// Server component. Reads ActivityViewModel from the loader (PR 1) and
// renders the client-side Activity port from dashboard-blueprint
// unchanged. The prototype Activity already accepts a projectId prop
// (added to the in-repo copy for the harness mount) and uses it to
// open an EventSource against /api/events?project_id=<id>; that is the
// G2 SSE deployment per ADR-055.
//
// PR 2 scope: visual port only. SSE subscription engages immediately
// once the prop is supplied; initial historical timeline (recent
// proposals + decisions + contributions joined by timestamp) wires in
// PR 3.
//
// S3 audit gates (recorded inline at PR 4):
//   - Phase 8 default view: recency-desc; SSE prepends as events arrive
//   - Phase 8 filter affordances: loop chips + author + sort toggle
//     above the fold (prototype primitives)
//   - Phase 8 freshness contract: SSE-driven with degraded-reconcile
//     banner per DP-4
//   - Phase 8 scale budget: paginate=50 / virtualize=500 (DP-6)
//   - Phase 8 server-side: SSE channel scoped per project_id; Durable
//     Object enforces per-project tenancy per ADR-055
//   - DP-8 loop-as-chip: loops surface as filter chips, not as nav

import { Activity as PrototypeActivity } from '../../../../../../prototypes/dashboard-northstar/pages/Activity.tsx';
import type { ActivityViewModel } from '../../../../lib/atelier/activity-data.ts';

export function ActivityShell({ viewModel }: { viewModel: ActivityViewModel }) {
  return <PrototypeActivity projectId={viewModel.viewer.projectId} />;
}
