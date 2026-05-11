'use client';

import { FunctionComponent, useState } from 'react';

/**
 * DP-7 + Q6 resolution: persistent banner on every prototype surface.
 * Counters the failure mode named in for-reviewers.md
 * ("/atelier dashboard is empty in the live deploy").
 */
export const DemoBanner: FunctionComponent = () => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="bg-ink text-ink-inverse text-xs">
      <div className="max-w-[1280px] mx-auto px-6 h-8 flex items-center gap-3">
        <span className="label-eyebrow text-ink-subtle">demo</span>
        <span>This dashboard renders against fixture data shaped to match Atelier's eventual schema.</span>
        <span className="hidden sm:inline text-ink-subtle">
          Run <code className="font-mono">atelier seed --remove</code> on a real deploy to clear.
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="ml-auto text-ink-subtle hover:text-ink-inverse text-lg leading-none"
          aria-label="Dismiss demo data banner"
        >
          ×
        </button>
      </div>
    </div>
  );
};
