// Compose surface layout - PR 2.
//
// Scopes the prototype's Tailwind v4 stylesheet + design tokens
// (prototypes/dashboard-northstar/styles.css) to the /atelier/compose
// subtree only. Next.js loads the CSS for routes that import it
// transitively; /atelier and /atelier/[lens] continue using their CSS-
// module palette and are not affected.
//
// Pattern parallels prototype/src/app/prototype/[project]/layout.tsx,
// which mounts the same stylesheet for the ADR-057 harness surfaces.
// Token discipline (no raw hex / rem in components) is enforced by
// prototype/scripts/lint-design-system.mjs against components under
// prototypes/dashboard-northstar/.

import type { ReactNode } from 'react';

import '../../../../../prototypes/dashboard-northstar/styles.css';

export default function ComposeLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
