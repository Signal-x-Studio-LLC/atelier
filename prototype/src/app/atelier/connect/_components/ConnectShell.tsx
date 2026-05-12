// ConnectShell - thin wrapper that mounts the prototype Connect
// surface into /atelier/connect with a substrate-real PresenceBanner
// above it.
//
// Server component. Reads ConnectViewModel from the loader (PR 1).
// Renders SubstratePresence above the prototype Connect: substrate-
// real session rows surface above the fold; the prototype Connect's
// fixture-driven presence/systems/chat sections render below.
//
// S5 audit pass (PR 4/4, integration.md §5):
//   Block 1 (mechanical): typecheck clean, build clean
//     (/atelier/connect 2.04 kB + 108 kB first-load); no raw hex /
//     rem (grep clean); banned words clean.
//   Block 2 (Phase 8): default view substrate-real rows above the
//     fold + prototype Connect below; filter affordances surface
//     the scale budget (30-row cap on presence); freshness via
//     per-row relative heartbeat + live SSE refresh on session.*
//     envelopes; scale budget paginate=30 / virtualize=300 (DP-6
//     Connect tier); server-side SSE channel scoped per project_id
//     via Durable Object (ADR-055); presence query scoped via RLS.
//   Block 3 (D-1..D-10): tokens, typography, iconography, spacing,
//     elevation, shape, a11y (aria-label on section), 375px sanity,
//     motion (live-dot indicator), empty / loading / error all
//     present.
//   Block 4 (DP-1..DP-14): DP-4 freshness via SSE refresh;
//     DP-6 scale budget declared; DP-10 composer vocab; Q5 (Connect
//     IA) honored -- substrate-real wedge is presence; systems +
//     chat preserve prototype illustrative rendering for v2 with
//     substrate sources documented as Phase 3+ work.
//   Block 5 (voice + copy): banned-words clean; composer / session /
//     contribution / proposal / synthesis vocab per NORTH-STAR §15.
//
// Known carry-forward (Phase 3+ scope cap, not an audit failure):
// systems-health endpoint + MCP chat backend live in dashboard-
// blueprint Phase 3 polish. Systems uses fixture integration list
// in prototype; chat surface is illustrative. Both remain as
// pickup points for the next slice arc.

import { Connect as PrototypeConnect } from '../../../../../../prototypes/dashboard-northstar/pages/Connect.tsx';
import type { ConnectViewModel } from '../../../../lib/atelier/connect-data.ts';
import { SubstratePresence } from './SubstratePresence.tsx';

export function ConnectShell({ viewModel }: { viewModel: ConnectViewModel }) {
  return (
    <>
      <SubstratePresence viewModel={viewModel} />
      <PrototypeConnect />
    </>
  );
}
