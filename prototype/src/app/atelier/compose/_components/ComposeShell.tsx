// ComposeShell - thin wrapper that mounts the prototype Compose surface
// into /atelier/compose with the auth-resolved viewer + initial
// proposal page in scope.
//
// Server component. Reads ComposeViewModel from the loader (PR 1) and
// renders the client-side Compose port from the dashboard-blueprint
// prototype unchanged. Initial proposals are surfaced through
// InitialProposals so PR 3's live wiring has a hook to thread them
// into the form's "past proposals" affordance.
//
// PR 2 scope: visual port only - the prototype Compose retains its
// fixture submit-handlers (no-ops). PR 3 replaces those with server
// actions that call the propose / react MCP tools.

import { Compose as PrototypeCompose } from '../../../../../../prototypes/dashboard-northstar/pages/Compose.tsx';
import type { ComposeViewModel } from '../../../../lib/atelier/compose-data.ts';
import { InitialProposals } from './InitialProposals.tsx';

export function ComposeShell({ viewModel }: { viewModel: ComposeViewModel }) {
  return (
    <>
      <InitialProposals
        proposals={viewModel.proposals}
        pageSize={viewModel.pageSize}
      />
      <PrototypeCompose />
    </>
  );
}
