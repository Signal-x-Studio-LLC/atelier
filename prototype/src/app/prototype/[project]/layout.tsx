// Substrate harness layout for ADR-057 — `/prototype/<project_id>`.
//
// Slice 1 scope: stub harness rail (labeled regions only). Substrate
// primitives — reviewer drawer, strategy notes, traceability, presence —
// land in subsequent slices (2-7). The content area renders the project's
// own AppShell (top nav + coordination strip + demo banner + pages) inside
// the right pane.
//
// The harness layout imports the project's global stylesheet so Tailwind
// v4 + the design tokens activate inside the route subtree without
// leaking into the rest of atelier (the lens-first /atelier surface and
// the public landing both rely on inline-style / CSS-modules patterns).

import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { ProjectChrome } from './_components/ProjectChrome';
import { ReviewerDrawer } from './_components/ReviewerDrawer';
import { StrategyPanel } from './_components/StrategyPanel';
import { TraceabilityPanel } from './_components/TraceabilityPanel';
import { PresencePanel } from './_components/PresencePanel';
import { AnnotationOverlay } from './_components/AnnotationOverlay';
import { AnnotationsRailSection } from './_components/AnnotationsRailSection';
import { HelpTip } from './_components/HelpTip';
import { loadPrototypeManifest } from '../../../lib/atelier/prototype-manifest';
import { loadStrategyPanelData } from '../../../lib/atelier/strategy-panel-data';
import { loadDpExcerpts } from '../../../lib/atelier/traceability-data';
import { loadPresenceData } from '../../../lib/atelier/presence-data';
import { loadAnnotationsData } from '../../../lib/atelier/annotations-data';

// Project stylesheet — `@import "tailwindcss"` + design tokens (see
// prototypes/dashboard-northstar/styles.css). Loading at the layout level
// scopes the Tailwind utilities to this route's subtree because Next.js
// only injects the CSS for components actually rendered on a given page.
import '../../../../../prototypes/dashboard-northstar/styles.css';

interface PrototypeLayoutProps {
  children: ReactNode;
  params: Promise<{ project: string }>;
}

export default async function PrototypeLayout({
  children,
  params,
}: PrototypeLayoutProps) {
  const { project } = await params;

  // v1 single-project mount per ADR-057. The valid project id is the
  // one declared in .atelier/prototype.yaml; any other segment 404s.
  // Loader throws on malformed manifest — surface that fast in dev
  // rather than silently degrading.
  const manifest = loadPrototypeManifest();
  if (project !== manifest.name) notFound();

  // Slice 4: load substrate-backed strategy-panel data once per request
  // and pass to the client StrategyPanel. The panel picks its surface
  // bucket via usePathname() so we don't re-query on intra-mount nav.
  // Auth failures degrade gracefully — strategy_notes still render.
  const strategyPanelData = await loadStrategyPanelData(
    manifest.name,
    manifest.surfaces.map((s) => s.route),
  );

  // Slice 5: parse the project's design-principles.md once per request
  // and pass the DP → excerpt map to the TraceabilityPanel. The panel
  // picks its current surface via usePathname(), same pattern as the
  // strategy panel — no need for a server/route-keyed bucket here
  // because the manifest itself encodes which DPs belong to which
  // surface.
  const traceability = loadDpExcerpts(manifest);

  // Slice 6: load project-wide presence (active sessions, 15-min window).
  // Direct `sessions` query — see presence-data.ts for the rationale on
  // why this doesn't reuse atelier_lens_load.
  const presence = await loadPresenceData();

  // Slice 7: load annotation pins (claim contributions with kind:'design'
  // and the per-surface trace id). Bucketed by surface route; the overlay
  // picks its bucket via usePathname().
  const annotations = await loadAnnotationsData(
    manifest.name,
    manifest.surfaces.map((s) => s.route),
  );
  const surfaceRoutes = manifest.surfaces.map((s) => s.route);

  return (
    <div className="grid grid-cols-[280px_1fr] min-h-screen">
      <aside
        data-harness="rail"
        className="border-r border-rule p-4 bg-raised flex flex-col"
      >
        <header className="label-eyebrow mb-4">Harness · {project}</header>
        <section data-harness="reviewer-drawer" className="mb-5">
          <div className="label-eyebrow mb-2 text-ink-muted">Reviewer drawer</div>
          <ReviewerDrawer />
        </section>
        <section data-harness="strategy-panel" className="mb-5">
          <StrategyPanel manifest={manifest} data={strategyPanelData} />
        </section>
        <section data-harness="traceability" className="mb-5">
          <TraceabilityPanel manifest={manifest} traceability={traceability} />
        </section>
        <section data-harness="presence" className="mb-5">
          <PresencePanel data={presence} />
        </section>
        <section data-harness="annotations" className="mb-4">
          <AnnotationsRailSection projectName={manifest.name} data={annotations} />
        </section>
        <section
          data-harness="mount-info"
          className="mt-auto pt-4 border-t border-rule"
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="label-eyebrow text-ink-muted">Mount</span>
            <HelpTip label="MOUNT">
              Source paths and manifest metadata for the mounted prototype.
              Read from <code className="font-mono">.atelier/prototype.yaml</code>.
              Implementer reference only — no UI interaction.
            </HelpTip>
          </div>
          <dl className="text-[11px] leading-snug space-y-0.5 text-ink-subtle">
            <div className="flex justify-between gap-2">
              <dt>name</dt>
              <dd className="font-mono text-ink-muted truncate">{manifest.name}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>surfaces</dt>
              <dd className="font-mono nums-tabular text-ink-muted">
                {manifest.surfaces.length}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>content</dt>
              <dd
                className="font-mono text-ink-muted truncate"
                title={manifest.content_path}
              >
                {manifest.content_path}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[10px] text-ink-subtle opacity-70 leading-snug">
            <code className="font-mono">.atelier/prototype.yaml</code>
          </p>
        </section>
      </aside>
      <div data-harness="content" className="relative">
        <ProjectChrome>{children}</ProjectChrome>
        <AnnotationOverlay
          projectName={manifest.name}
          surfaceRoutes={surfaceRoutes}
          data={annotations}
        />
      </div>
    </div>
  );
}
