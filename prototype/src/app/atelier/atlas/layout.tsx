// Atlas surface layout - PR 1.
//
// Scopes the prototype's Tailwind v4 stylesheet to /atelier/atlas
// (parity with S1/S2/S3 layouts).

import type { ReactNode } from 'react';

import '../../../../../prototypes/dashboard-northstar/styles.css';

export default function AtlasLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
