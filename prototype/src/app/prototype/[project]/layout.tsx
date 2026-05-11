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

// Project stylesheet — `@import "tailwindcss"` + design tokens (see
// prototypes/dashboard-northstar/styles.css). Loading at the layout level
// scopes the Tailwind utilities to this route's subtree because Next.js
// only injects the CSS for components actually rendered on a given page.
import '../../../../../prototypes/dashboard-northstar/styles.css';

// v1 single-project mount per ADR-057. The URL segment is reserved but
// not yet variable; only the declared project id resolves.
const KNOWN_PROJECTS = new Set(['dashboard-northstar']);

interface PrototypeLayoutProps {
  children: ReactNode;
  params: Promise<{ project: string }>;
}

export default async function PrototypeLayout({
  children,
  params,
}: PrototypeLayoutProps) {
  const { project } = await params;
  if (!KNOWN_PROJECTS.has(project)) notFound();

  return (
    <div className="grid grid-cols-[280px_1fr] min-h-screen">
      <aside
        data-harness="rail"
        className="border-r border-rule p-4 bg-raised"
      >
        <header className="label-eyebrow mb-4">Harness · {project}</header>
        <section data-harness="reviewer-drawer" className="mb-4">
          <div className="text-xs text-ink-subtle">Reviewer drawer</div>
          <div className="text-xs text-ink-subtle opacity-60">(Slice 2)</div>
        </section>
        <section data-harness="strategy-panel" className="mb-4">
          <div className="text-xs text-ink-subtle">Strategy notes</div>
          <div className="text-xs text-ink-subtle opacity-60">(Slice 4)</div>
        </section>
        <section data-harness="traceability" className="mb-4">
          <div className="text-xs text-ink-subtle">Traceability</div>
          <div className="text-xs text-ink-subtle opacity-60">(Slice 5)</div>
        </section>
        <section data-harness="presence" className="mb-4">
          <div className="text-xs text-ink-subtle">Presence</div>
          <div className="text-xs text-ink-subtle opacity-60">(Slice 6)</div>
        </section>
      </aside>
      <div data-harness="content">
        <ProjectChrome>{children}</ProjectChrome>
      </div>
    </div>
  );
}
