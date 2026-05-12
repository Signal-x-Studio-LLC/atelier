// /atelier/compose - Phase 2 Slice 1.
//
// Compose is the DP-7 wedge surface - cold visitors land here. Returning
// composers default to /inbox (Q3 resolution in
// dashboard-blueprint/docs/content/research.md); the /atelier root
// redirect still resolves to the role-aware lens for now. Phase 3 will
// revisit the cold-vs-returning split once /inbox lands in Slice 2.

import { cookies, headers } from 'next/headers';
import LensUnauthorized from '../_components/LensUnauthorized.tsx';
import {
  loadComposeViewModel,
  type ProposalState,
} from '../../../lib/atelier/compose-data.ts';
import { nextCookieAdapter } from '../../../lib/atelier/adapters/next-cookies.ts';
import { ComposeShell } from './_components/ComposeShell.tsx';

export const dynamic = 'force-dynamic';

const VALID_STATES = new Set<ProposalState>(['open', 'synthesized', 'approved']);

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const sp = await searchParams;
  const requested = sp.state;
  const activeState: ProposalState =
    requested && VALID_STATES.has(requested as ProposalState)
      ? (requested as ProposalState)
      : 'open';

  const reqHeaders = await headers();
  const cookieStore = await cookies();
  const request = new Request('http://internal/atelier/compose', {
    headers: reqHeaders,
  });
  const result = await loadComposeViewModel(request, {
    cookies: nextCookieAdapter(cookieStore),
    state: activeState,
  });
  if (!result.ok) {
    return (
      <LensUnauthorized
        lensId="compose"
        reason={result.reason}
        message={result.message}
      />
    );
  }
  return <ComposeShell viewModel={result.viewModel} />;
}
