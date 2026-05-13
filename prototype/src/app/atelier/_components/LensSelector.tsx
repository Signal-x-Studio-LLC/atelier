// LensSelector — tab navigation across the five lenses.
//
// Server component (the active state is derived from the URL, which the
// parent already knows; no client interaction needed beyond Link). Each
// tab is a plain anchor so back/forward + middle-click + open-in-new-tab
// all work without JS.
//
// ADR-060 PR C: migrated to token utilities. The 5-lens shape requires
// path-segment links (not the Tabs primitive's button + onChange shape),
// so we render a token-styled tablist anchored on `<Link>` elements.

import Link from 'next/link';
import { LENS_IDS, LENS_CONFIGS, type LensId } from '../../../lib/atelier/lens-config.ts';

export default function LensSelector({ currentLens }: { currentLens: LensId }) {
  return (
    <nav
      className="-mb-px mb-4 flex flex-wrap gap-1 border-b border-rule"
      aria-label="Lens selector"
    >
      {LENS_IDS.map((lensId) => {
        const cfg = LENS_CONFIGS[lensId];
        const isActive = lensId === currentLens;
        return (
          <Link
            key={lensId}
            href={`/atelier/${lensId}`}
            aria-current={isActive ? 'page' : undefined}
            className={
              isActive
                ? '-mb-px inline-block rounded-t-sm border border-rule border-b-paper bg-paper px-3.5 py-2 text-[13px] font-medium text-ink no-underline transition-colors'
                : '-mb-px inline-block rounded-t-sm border border-transparent px-3.5 py-2 text-[13px] font-medium text-ink-subtle no-underline transition-colors hover:bg-paper hover:text-ink'
            }
          >
            {cfg.label}
          </Link>
        );
      })}
    </nav>
  );
}
