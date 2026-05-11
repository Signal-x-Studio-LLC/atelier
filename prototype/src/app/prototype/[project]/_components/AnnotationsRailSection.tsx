'use client';

// Rail-side companion to AnnotationOverlay (ADR-057 Slice 7).
//
// Renders inside the harness rail. Shows the count of pins on the
// current surface and a toggle for annotate mode. Toggle state is
// shared with the overlay via the module-level annotation-mode store.

import { FunctionComponent } from 'react';
import { usePathname } from 'next/navigation';

import type { AnnotationLoadResult } from '../../../../lib/atelier/annotations-data';
import { useAnnotateMode } from './annotation-mode-store';

interface AnnotationsRailSectionProps {
  projectName: string;
  data: AnnotationLoadResult;
}

function resolveSurfaceRoute(pathname: string, projectName: string): string {
  const prefix = `/prototype/${projectName}`;
  if (!pathname.startsWith(prefix)) return '/';
  const rest = pathname.slice(prefix.length);
  return rest === '' ? '/' : rest;
}

export const AnnotationsRailSection: FunctionComponent<AnnotationsRailSectionProps> = ({
  projectName,
  data,
}) => {
  const pathname = usePathname();
  const surfaceRoute = resolveSurfaceRoute(pathname, projectName);
  const pinsHere = data.pinsByRoute[surfaceRoute] ?? [];
  const [annotateMode, setAnnotateMode] = useAnnotateMode();

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <div className="label-eyebrow text-ink-muted">Annotations</div>
        <div
          className="text-[10px] text-ink-subtle nums-tabular"
          data-testid="annotation-count"
        >
          {pinsHere.length} on this surface
        </div>
      </div>
      {!data.ok ? (
        <p className="text-[11px] text-ink-subtle opacity-70 italic">
          {data.reason === 'no_bearer' || data.reason === 'no_composer'
            ? 'Sign in to drop pins.'
            : `Couldn't load pins: ${data.message}`}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setAnnotateMode(!annotateMode)}
          className={`w-full text-[11px] rounded px-2 py-1 border transition-colors ${
            annotateMode
              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              : 'bg-raised text-ink-default border-rule hover:bg-base'
          }`}
          data-testid="annotation-toggle"
          aria-pressed={annotateMode}
        >
          {annotateMode ? 'Annotate mode: ON (Esc to exit)' : '+ Annotate mode'}
        </button>
      )}
      <p className="text-[10px] text-ink-subtle opacity-70 leading-snug">
        Click anywhere on the surface to drop a pin. Pin clicks open
        notes.
      </p>
    </div>
  );
};
