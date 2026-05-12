// /atelier/connect - Phase 2 Slice 5, PR 1 (route scaffold + RLS loader).
//
// Connect anchors three sub-surfaces (Q5): #presence, #systems, #chat.
// Presence is the substrate-real wedge for v2; systems + chat ride on
// the prototype's illustrative renderings. PR 1 scaffolds auth + viewer
// + presence; UI port in PR 2; live SSE wiring + presence push in PR 3.

import { cookies, headers } from 'next/headers';
import LensUnauthorized from '../_components/LensUnauthorized.tsx';
import { loadConnectViewModel } from '../../../lib/atelier/connect-data.ts';
import { nextCookieAdapter } from '../../../lib/atelier/adapters/next-cookies.ts';
import { ConnectShell } from './_components/ConnectShell.tsx';

export const dynamic = 'force-dynamic';

export default async function ConnectPage() {
  const reqHeaders = await headers();
  const cookieStore = await cookies();
  const request = new Request('http://internal/atelier/connect', {
    headers: reqHeaders,
  });
  const result = await loadConnectViewModel(request, {
    cookies: nextCookieAdapter(cookieStore),
  });
  if (!result.ok) {
    return (
      <LensUnauthorized
        lensId="connect"
        reason={result.reason}
        message={result.message}
      />
    );
  }
  return <ConnectShell viewModel={result.viewModel} />;
}
