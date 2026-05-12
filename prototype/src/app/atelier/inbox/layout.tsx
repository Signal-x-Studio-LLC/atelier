// Inbox surface layout - PR 1.
//
// Scopes the prototype's Tailwind v4 stylesheet + design tokens to the
// /atelier/inbox subtree only. Same pattern as /atelier/compose/layout
// and /prototype/[project]/layout. Next.js only injects the CSS for
// routes that import it transitively.

import type { ReactNode } from 'react';

import '../../../../../prototypes/dashboard-northstar/styles.css';
import { DarkModeToggle } from '../_components/DarkModeToggle.tsx';

export default function InboxLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DarkModeToggle />
      {children}
    </>
  );
}
