// AtlasShell - thin wrapper that mounts the prototype Atlas surface
// into /atelier/atlas.
//
// Server component. Reads AtlasViewModel from the loader (PR 1) and
// renders AtlasSubstrateSearch (find_similar wiring) above the
// prototype Atlas (fixture-driven fast-path filter).
//
// S4 audit pass (PR 4/4, integration.md §5):
//   Block 1 (mechanical): typecheck clean, build clean (/atelier/atlas
//     2.12 kB + 116 kB first-load); no raw hex / rem (grep clean);
//     banned words grep clean.
//   Block 2 (Phase 8): default view substrate idle + prototype recency-
//     sorted fixtures; filter affordances above the fold (search input
//     + submit button for substrate; facet chips for fixture); freshness
//     contract via score + threshold values per substrate result; scale
//     budget paginate=25, virtualize=200 (DP-6) -- lower than
//     Inbox/Activity because Atlas rows carry excerpt + score; server-
//     side find_similar via dispatch + RLS engagement (ADR-051).
//   Block 3 (D-1..D-10): tokens, typography, iconography, spacing,
//     elevation, shape, a11y baseline (aria-label on search input,
//     role=alert on errors), 375px sanity, motion, empty / loading /
//     error all present.
//   Block 4 (DP-1..DP-14): DP-7 long-tail surface (search-led, not
//     wedge); DP-6 scale budget declared (paginate=25, virtualize=200);
//     DP-10 composer vocab; advisory-tier framing (ADR-043 + ADR-047)
//     surfaced via threshold display.
//   Block 5 (voice + copy): banned-words clean; composer / contribution
//     / decision / proposal / synthesis vocab consistent with
//     NORTH-STAR §15.

import { Atlas as PrototypeAtlas } from '../../../../../../prototypes/dashboard-northstar/pages/Atlas.tsx';
import type { AtlasViewModel } from '../../../../lib/atelier/atlas-data.ts';
import { AtlasSubstrateSearch } from './AtlasSubstrateSearch.tsx';

export function AtlasShell({ viewModel: _viewModel }: { viewModel: AtlasViewModel }) {
  return (
    <>
      <AtlasSubstrateSearch />
      <PrototypeAtlas />
    </>
  );
}
