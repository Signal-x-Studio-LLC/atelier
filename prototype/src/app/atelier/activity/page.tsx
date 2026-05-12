// /atelier/activity - Phase 2 Slice 3, PR 1 (route scaffold + RLS loader).
//
// Activity is DP-4's freshness-contract demonstration surface and the
// first webapp v2 surface to come off the 30s poll cycle - SSE via
// /api/events (G2 deployment) drives the live timeline. PR 1 resolves
// the viewer for auth + project_id; UI port and initial-timeline
// substrate queries land in PR 2 + PR 3.

import { cookies, headers } from 'next/headers';
import LensUnauthorized from '../_components/LensUnauthorized.tsx';
import { loadActivityViewModel } from '../../../lib/atelier/activity-data.ts';
import { nextCookieAdapter } from '../../../lib/atelier/adapters/next-cookies.ts';
import { ActivityShell } from './_components/ActivityShell.tsx';

export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  const reqHeaders = await headers();
  const cookieStore = await cookies();
  const request = new Request('http://internal/atelier/activity', {
    headers: reqHeaders,
  });
  const result = await loadActivityViewModel(request, {
    cookies: nextCookieAdapter(cookieStore),
  });
  if (!result.ok) {
    return (
      <LensUnauthorized
        lensId="activity"
        reason={result.reason}
        message={result.message}
      />
    );
  }
  return <ActivityShell viewModel={result.viewModel} />;
}
