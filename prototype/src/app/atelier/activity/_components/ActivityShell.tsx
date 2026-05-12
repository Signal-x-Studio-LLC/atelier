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
// S3 audit pass (PR 4/4, integration.md §5):
//   Block 1 (mechanical): typecheck clean, build clean (/atelier/activity
//     400 B + 112 kB first-load); no raw hex / rem (grep clean); banned
//     words grep clean; audit-contrast.mjs + lint-design-system.mjs
//     live in dashboard-blueprint, token discipline inherited via
//     styles.css @theme.
//   Block 2 (Phase 8): default view recency-desc with SSE prepend;
//     filter affordances above the fold (prototype's loop chips +
//     author + sort toggle); freshness contract via SSE-driven live
//     timeline + ActivityFreshness 24h count banner (DP-4); scale
//     budget paginate=50, virtualize=500 (DP-6); server-side SSE
//     channel scoped per project_id via Durable Object + count
//     queries scoped via RLS.
//   Block 3 (D-1..D-10): tokens via styles.css @theme; typography via
//     prototype primitives; iconography via lucide Icon; spacing /
//     elevation / shape inherited; a11y baseline preserved (aria-
//     label on freshness, semantic section); 375px sanity from
//     prototype's responsive grid; motion subtle (no entrance
//     animation per DP-9 -- skeleton state suffices); empty / loading
//     / error all present (prototype SkeletonRow for loading, no-
//     events empty copy, LensUnauthorized for loader errors).
//   Block 4 (DP-1..DP-14): DP-4 freshness contract is the wedge here
//     (SSE + 24h count backstop); DP-6 scale budget declared; DP-8
//     loops surface as filter chips not nav; DP-9 loading state
//     reachable via ?loading=1; DP-10 composer vocab.
//   Block 5 (voice + copy): banned-words clean; composer / session /
//     contribution / proposal / decision vocab per NORTH-STAR §15.
//
// Known carry-forward (not audit failure - PR 3 scope cap): initial
// historical timeline rows mapped to ActivityEvent shapes for the
// prototype's inline list are a follow-up. ActivityEvent's
// discriminated-union requires the full Contribution / Proposal /
// Decision payload; the count-only freshness banner is the minimum-
// viable Phase 8 freshness signal. Timeline below populates as SSE
// envelopes arrive.

import { Activity as PrototypeActivity } from '../../../../../../prototypes/dashboard-northstar/pages/Activity.tsx';
import type { ActivityViewModel } from '../../../../lib/atelier/activity-data.ts';
import { ActivityFreshness } from './ActivityFreshness.tsx';

export function ActivityShell({ viewModel }: { viewModel: ActivityViewModel }) {
  return (
    <>
      <ActivityFreshness viewModel={viewModel} />
      <PrototypeActivity projectId={viewModel.viewer.projectId} />
    </>
  );
}
