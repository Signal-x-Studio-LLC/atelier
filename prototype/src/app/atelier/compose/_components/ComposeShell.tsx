// ComposeShell - server wrapper for /atelier/compose.
//
// Renders InitialProposals (loader-fed banner) + the prototype Compose
// client component with the submitProposal server action threaded in as
// onPropose. The action calls the propose MCP tool via dispatch + RLS
// (atelier_runtime, ADR-051). The ADR-057 harness mount at
// /prototype/[project]/compose continues to render the same Compose
// component without the prop -- the form falls back to fixture-only
// no-op.

import { Compose as PrototypeCompose } from '../../../../../../prototypes/dashboard-northstar/pages/Compose.tsx';
import type { ComposeViewModel } from '../../../../lib/atelier/compose-data.ts';
import { InitialProposals } from './InitialProposals.tsx';
import { StateFilterChips } from './StateFilterChips.tsx';
import { submitProposal } from './compose-actions.ts';

export function ComposeShell({ viewModel }: { viewModel: ComposeViewModel }) {
  return (
    <>
      <InitialProposals
        proposals={viewModel.proposals}
        pageSize={viewModel.pageSize}
        activeState={viewModel.activeState}
      />
      <StateFilterChips activeState={viewModel.activeState} />
      <PrototypeCompose onPropose={submitProposal} />
    </>
  );
}
