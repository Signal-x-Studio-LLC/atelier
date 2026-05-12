// /atelier/compose - Phase 2 Slice 1, PR 1 (route scaffold + RLS loader).
//
// Compose is the DP-7 wedge surface - cold visitors land here. Returning
// composers default to /inbox (Q3 resolution in
// dashboard-blueprint/docs/content/research.md); the /atelier root
// redirect still resolves to the role-aware lens for now. PR 4 will
// revisit the cold-vs-returning split once /inbox lands in Slice 2.
//
// This PR scaffolds the route, the loader, and the auth-guarded empty
// state. The UI port from prototypes/dashboard-blueprint lands in PR 2;
// live write wiring (propose / react) in PR 3; audit pass in PR 4.

import { cookies, headers } from 'next/headers';
import LensUnauthorized from '../_components/LensUnauthorized.tsx';
import { loadComposeViewModel } from '../../../lib/atelier/compose-data.ts';
import { nextCookieAdapter } from '../../../lib/atelier/adapters/next-cookies.ts';
import { ComposeShell } from './_components/ComposeShell.tsx';

export const dynamic = 'force-dynamic';

export default async function ComposePage() {
  const reqHeaders = await headers();
  const cookieStore = await cookies();
  const request = new Request('http://internal/atelier/compose', {
    headers: reqHeaders,
  });
  const result = await loadComposeViewModel(request, {
    cookies: nextCookieAdapter(cookieStore),
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
