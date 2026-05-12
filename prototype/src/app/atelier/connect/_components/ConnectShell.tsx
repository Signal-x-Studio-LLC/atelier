// ConnectShell - thin wrapper that mounts the prototype Connect
// surface into /atelier/connect with a substrate-real PresenceBanner
// above it.
//
// Server component. Reads ConnectViewModel from the loader (PR 1).
// Renders SubstratePresence above the prototype Connect: substrate-
// real session rows surface above the fold; the prototype Connect's
// fixture-driven presence/systems/chat sections render below.

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
