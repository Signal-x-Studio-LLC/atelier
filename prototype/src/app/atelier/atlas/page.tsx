// /atelier/atlas - Phase 2 Slice 4, PR 1 (route scaffold + RLS loader).
//
// Atlas is DP-7's long tail: search-led; not the wedge. find_similar
// hybrid retrieval (ADR-042) is the search backbone; the v1 gate is
// advisory-tier per ADR-043 + ADR-047. PR 1 scaffolds auth + viewer;
// UI port in PR 2; find_similar server-action wiring in PR 3.

import { cookies, headers } from 'next/headers';
import LensUnauthorized from '../_components/LensUnauthorized.tsx';
import { loadAtlasViewModel } from '../../../lib/atelier/atlas-data.ts';
import { nextCookieAdapter } from '../../../lib/atelier/adapters/next-cookies.ts';
import { AtlasShell } from './_components/AtlasShell.tsx';

export const dynamic = 'force-dynamic';

export default async function AtlasPage() {
  const reqHeaders = await headers();
  const cookieStore = await cookies();
  const request = new Request('http://internal/atelier/atlas', {
    headers: reqHeaders,
  });
  const result = await loadAtlasViewModel(request, {
    cookies: nextCookieAdapter(cookieStore),
  });
  if (!result.ok) {
    return (
      <LensUnauthorized
        lensId="atlas"
        reason={result.reason}
        message={result.message}
      />
    );
  }
  return <AtlasShell viewModel={result.viewModel} />;
}
