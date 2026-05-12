// Activity surface layout - PR 1.
//
// Scopes the prototype's Tailwind v4 stylesheet + design tokens to the
// /atelier/activity subtree (parity with /atelier/compose and
// /atelier/inbox).

import type { ReactNode } from 'react';

import '../../../../../prototypes/dashboard-northstar/styles.css';

export default function ActivityLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
