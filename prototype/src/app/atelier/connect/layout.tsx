// Connect surface layout - PR 1. Scopes prototype Tailwind stylesheet
// + design tokens to /atelier/connect subtree (parity with S1-S4
// layouts).

import type { ReactNode } from 'react';

import '../../../../../prototypes/dashboard-northstar/styles.css';

export default function ConnectLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
