// /atelier/inbox - Phase 2 Slice 2, PR 1 (route scaffold + RLS loader).
//
// Inbox is the highest-frequency return-visit surface (Q3 resolution:
// returning composer defaults to /inbox). DP-1 mandates action-shaped
// section headers ("Needs your X"), not status-shaped. Four sections:
// needs-reaction, awaiting-approval, awaiting-review, blocked-on-you.
//
// PR 1 scaffolds the route, loader, and auth-guarded empty state. UI
// port from prototypes/dashboard-blueprint lands in PR 2; contributions-
// side section wiring in PR 3; audit pass in PR 4.

import { cookies, headers } from 'next/headers';
import LensUnauthorized from '../_components/LensUnauthorized.tsx';
import { loadInboxViewModel } from '../../../lib/atelier/inbox-data.ts';
import { nextCookieAdapter } from '../../../lib/atelier/adapters/next-cookies.ts';
import { InboxShell } from './_components/InboxShell.tsx';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const reqHeaders = await headers();
  const cookieStore = await cookies();
  const request = new Request('http://internal/atelier/inbox', {
    headers: reqHeaders,
  });
  const result = await loadInboxViewModel(request, {
    cookies: nextCookieAdapter(cookieStore),
  });
  if (!result.ok) {
    return (
      <LensUnauthorized
        lensId="inbox"
        reason={result.reason}
        message={result.message}
      />
    );
  }
  return <InboxShell viewModel={result.viewModel} />;
}
