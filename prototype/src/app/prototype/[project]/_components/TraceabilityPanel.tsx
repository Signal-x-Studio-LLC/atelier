'use client';

// Traceability panel — substrate harness surface per ADR-057 Slice 5.
//
// Client component. Resolves the current surface from usePathname()
// against the manifest, renders the surface's DP chip list, and expands
// a single DP excerpt inline on click. Excerpts are pre-parsed server-
// side (loadDpExcerpts) and passed down as a map, so chip clicks are
// pure UI state — no fetches.
//
// Re-evaluation trigger (mirrors the data loader): if the project's
// design-principles.md ever lives outside this repo, swap the server
// loader to dispatch(get_context, {scope_files}) and keep this panel
// unchanged.

import { FunctionComponent, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { PrototypeManifest } from '../../../../lib/atelier/prototype-manifest';
import type {
  DpExcerptMap,
  TraceabilityLoadResult,
} from '../../../../lib/atelier/traceability-data';
import { Eyebrow, HelpTip } from '../../../../lib/atelier/design';

const TraceabilityHeader: FunctionComponent = () => (
  <div className="flex items-center gap-1.5">
    <Eyebrow className="text-ink-muted">Traceability</Eyebrow>
    <HelpTip label="TRACEABILITY">
      Design-principle chips for this surface. Click a chip to resolve the
      principle to its research excerpt via{' '}
      <code className="font-mono">get_context(scope_files)</code>.
    </HelpTip>
  </div>
);

interface TraceabilityPanelProps {
  manifest: PrototypeManifest;
  traceability: TraceabilityLoadResult;
}

function resolveSurfaceRoute(pathname: string, projectName: string): string {
  const prefix = `/prototype/${projectName}`;
  if (!pathname.startsWith(prefix)) return '/';
  const rest = pathname.slice(prefix.length);
  return rest === '' ? '/' : rest;
}

export const TraceabilityPanel: FunctionComponent<TraceabilityPanelProps> = ({
  manifest,
  traceability,
}) => {
  const pathname = usePathname();
  const surfaceRoute = resolveSurfaceRoute(pathname, manifest.name);
  const surface = manifest.surfaces.find((s) => s.route === surfaceRoute);

  const [activeDp, setActiveDp] = useState<string | null>(null);

  // Collapse the expanded excerpt when navigating to a surface whose
  // dps[] doesn't include the active id. Cheap inline guard — no effect
  // needed because the render derives from props each pathname change.
  const dps = surface?.dps ?? [];
  const effectiveActive = activeDp && dps.includes(activeDp) ? activeDp : null;

  if (traceability.status === 'not_configured') {
    return (
      <div className="space-y-1.5">
        <TraceabilityHeader />
        <p className="text-[11px] text-ink-subtle leading-snug italic opacity-70">
          Traceability not configured.
        </p>
      </div>
    );
  }

  if (traceability.status === 'file_missing') {
    return (
      <div className="space-y-1.5">
        <TraceabilityHeader />
        <p className="text-[11px] text-ink-subtle leading-snug italic opacity-70">
          design-principles.md not found at{' '}
          <code className="font-mono">{traceability.sourcePath}</code>.
        </p>
      </div>
    );
  }

  if (!surface) {
    return (
      <div className="space-y-1.5">
        <TraceabilityHeader />
        <p className="text-[11px] text-ink-subtle leading-snug italic opacity-70">
          Surface not declared in manifest.
        </p>
      </div>
    );
  }

  if (dps.length === 0) {
    return (
      <div className="space-y-1.5">
        <TraceabilityHeader />
        <p className="text-[11px] text-ink-subtle leading-snug italic opacity-70">
          No DPs declared for this surface.
        </p>
      </div>
    );
  }

  const activeExcerpt = effectiveActive ? traceability.excerpts[effectiveActive] : null;
  const activeMissing = effectiveActive && !activeExcerpt;

  return (
    <div className="space-y-2" data-testid="traceability-panel">
      <TraceabilityHeader />
      <ul className="flex flex-wrap gap-1" data-testid="dp-chip-list">
        {dps.map((id) => {
          const found = Boolean(traceability.excerpts[id]);
          const isActive = effectiveActive === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() =>
                  setActiveDp((prev) => (prev === id ? null : id))
                }
                aria-pressed={isActive}
                data-testid={`dp-chip-${id}`}
                className={[
                  'label-eyebrow font-mono px-1.5 py-0.5 rounded border transition-colors',
                  isActive
                    ? 'bg-ink-default text-bg-base border-ink-default'
                    : 'bg-raised text-ink-muted border-rule hover:text-ink-default hover:border-ink-muted',
                  found ? '' : 'line-through opacity-60',
                ].join(' ')}
                title={found ? undefined : `${id} not found in design-principles.md`}
              >
                {id}
                {!found && <span aria-hidden="true"> ?</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {effectiveActive && (
        <div
          className="pt-2 border-t border-rule space-y-1"
          data-testid="dp-excerpt"
        >
          {activeMissing ? (
            <p className="text-[11px] text-ink-subtle leading-snug italic">
              {effectiveActive} not found in design-principles.md
            </p>
          ) : (
            <>
              <div className="text-[11px] text-ink-default font-medium leading-snug">
                {activeExcerpt!.title}
              </div>
              <p className="text-[11px] text-ink-subtle leading-snug whitespace-pre-line">
                {activeExcerpt!.body_markdown}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Re-export the type for consumers that don't want to dig into the
// data-layer module — keeps the panel's surface area cohesive.
export type { DpExcerptMap };
