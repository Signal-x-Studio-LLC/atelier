// Lens shell.
//
// Renders the per-lens header (label + description + viewer + lens
// selector), then the panel grid in the order config.panels declares.
// Each panel is its own server component; the shell is purely composition.
//
// ADR-060 PR C: migrated to design-package primitives. Token-only styling
// inherits the html.dark cascade for dark-mode parity.

import Link from 'next/link';
import type { LensViewModel } from '../../../lib/atelier/lens-data.ts';
import { Body, Eyebrow, Heading, Mono, Surface } from '../../../lib/atelier/design';
import LensSelector from './LensSelector.tsx';
import LiveUpdater from './LiveUpdater.tsx';
import PanelHost from './PanelHost.tsx';

export default function Lens({ viewModel }: { viewModel: LensViewModel }) {
  const { config, viewer } = viewModel;
  return (
    <Surface tone="canvas" as="main" className="min-h-screen px-8 py-6 pb-16 max-md:px-4 max-md:pb-12">
      <LiveUpdater projectId={viewer.projectId} />
      <header className="mb-4 grid grid-cols-[1fr_auto] items-end gap-6 border-b border-rule pb-4 max-md:grid-cols-1">
        <div className="min-w-0">
          <Eyebrow className="text-ink-subtle">
            {viewer.projectName} &middot; /atelier
          </Eyebrow>
          <Heading as="h1" scale="headingLg" className="mt-1 mb-1.5 text-ink">
            {config.label} lens
          </Heading>
          <Body scale="bodyMd" className="m-0 max-w-[64ch] text-ink-muted">
            {config.description}
          </Body>
        </div>
        <div className="text-right text-ink-subtle max-md:text-left">
          <div className="text-[13px] font-semibold text-ink">{viewer.composerName}</div>
          <Mono as="div" className="mt-0.5 text-[11px] text-ink-subtle" data-testid="viewer-email">
            {viewer.composerEmail}
          </Mono>
          <Body scale="caption" as="div" className="mt-0.5 text-ink-subtle">
            {viewer.discipline ?? 'no-discipline'} &middot;{' '}
            {viewer.accessLevel ?? 'member'} &middot; session {viewer.sessionId.slice(0, 8)}…
          </Body>
          <Mono as="div" className="mt-1 text-[11px] text-ink-subtle opacity-60">
            Snapshot at {viewModel.staleAsOf.toISOString()}
          </Mono>
          <Link
            href="/sign-out"
            className="mt-2 inline-block text-[12px] text-ink-subtle underline hover:text-ink"
            data-testid="signout-link"
          >
            Sign out
          </Link>
        </div>
      </header>
      <LensSelector currentLens={config.id} />
      {!config.affordances.canWrite && (
        <div className="my-3 rounded-sm border border-rule border-l-[3px] border-l-warning bg-raised px-3.5 py-2 text-[13px] text-ink-muted">
          Read-only lens — no authoring affordances.
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(360px,1fr))] gap-4">
        {config.panels.map((panelId) => (
          <PanelHost key={panelId} panelId={panelId} viewModel={viewModel} />
        ))}
      </div>
    </Surface>
  );
}
