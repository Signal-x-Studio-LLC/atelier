// AtlasShell - thin wrapper that mounts the prototype Atlas surface
// into /atelier/atlas.
//
// Server component. Reads AtlasViewModel from the loader (PR 1) and
// renders the client-side Atlas port from dashboard-blueprint
// unchanged. find_similar server-action wiring lands in PR 3.

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
