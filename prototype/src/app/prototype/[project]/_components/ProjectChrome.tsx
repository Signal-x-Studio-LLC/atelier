'use client';

// Per ADR-057 §"What this does NOT decide" + Slice 1 brief: the project's
// own AppShell (top nav + persistent coordination strip + demo banner)
// renders INSIDE the harness content pane, not replaced by it. The
// harness layout owns the outer chrome (left rail); the project owns the
// inner chrome (top nav). Subsequent slices keep this boundary —
// substrate primitives wire through the rail, not the AppShell.

import type { FunctionComponent, ReactNode } from 'react';
import { AppShell } from '../../../../../../prototypes/dashboard-northstar/components/AppShell';
import {
  proposals,
  contributions,
  sessions,
  ME,
} from '../../../../../../prototypes/dashboard-northstar/fixtures/seed';

// Inbox count = sum of action-shaped sections (DP-1). Ported verbatim
// from the standalone prototype's App.tsx so the badge stays stable.
function computeInboxCount(): number {
  const meSessions = sessions
    .filter(s => s.composer_id === ME.id)
    .map(s => s.id);
  return (
    proposals.filter(
      p =>
        p.state === 'open' &&
        !p.reactions.some(r => meSessions.includes(r.session_id)),
    ).length +
    proposals.filter(p => p.state === 'synthesized').length +
    contributions.filter(
      c => c.state === 'review' && ['strategy', 'design'].includes(c.territory),
    ).length +
    contributions.filter(
      c => c.state === 'blocked' && meSessions.includes(c.author_session_id),
    ).length
  );
}

export const ProjectChrome: FunctionComponent<{ children: ReactNode }> = ({
  children,
}) => {
  const inboxCount = computeInboxCount();
  return <AppShell inboxCount={inboxCount}>{children}</AppShell>;
};
