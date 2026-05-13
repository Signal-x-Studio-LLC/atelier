// Observability dashboard shell.
//
// Header (project + viewer + snapshot meta + manual refresh) plus the
// section tab bar plus the active section's panel. Section selection
// keyed off the ?tab= search param the page resolved before mount.
//
// The 5-lens precedent (LensSelector) used path-segment routing because
// each lens is a complete reorientation. Observability sections share
// one canonical view-model and one viewer; the search-param tab keeps
// routing cheap (single page file) while preserving the bookmarkable
// affordance of separate URLs per section.
//
// ADR-060 PR C: migrated to design-package primitives. Observability.css
// retires; token cascade handles light/dark via html.dark.

import Link from 'next/link';
import type { ObservabilityViewModel } from '../../../../lib/atelier/observability-data.ts';
import { Body, Eyebrow, Heading, Mono, Surface } from '../../../../lib/atelier/design';
import { SECTIONS, type SectionId } from '../sections.ts';
import Refresher from './Refresher.tsx';
import SessionsSection from './sections/SessionsSection.tsx';
import ContributionsSection from './sections/ContributionsSection.tsx';
import LocksSection from './sections/LocksSection.tsx';
import DecisionsSection from './sections/DecisionsSection.tsx';
import TriageSection from './sections/TriageSection.tsx';
import SyncSection from './sections/SyncSection.tsx';
import VectorSection from './sections/VectorSection.tsx';
import CostSection from './sections/CostSection.tsx';

const TAB_LABELS: Record<SectionId, string> = {
  sessions: 'Sessions',
  contributions: 'Contributions',
  locks: 'Locks',
  decisions: 'Decisions',
  triage: 'Triage',
  sync: 'Sync',
  vector: 'Vector index',
  cost: 'Cost',
};

export default function ObservabilityShell({
  tab,
  viewer,
  viewModel,
}: {
  tab: SectionId;
  viewer: { composerName: string; projectName: string; sessionIdShort: string };
  viewModel: ObservabilityViewModel;
}) {
  return (
    <Surface
      tone="canvas"
      as="main"
      className="mx-auto max-w-[1280px] px-6 py-6 pb-16"
    >
      <header className="mb-4 flex items-start justify-between gap-6 border-b border-rule pb-4 max-md:flex-col">
        <div>
          <Eyebrow className="mb-1 text-ink-subtle">
            {viewer.projectName} · /atelier/observability
          </Eyebrow>
          <Heading as="h1" scale="headingLg" className="m-0 mb-2 text-ink">
            Observability
          </Heading>
          <Body scale="bodySm" className="m-0 max-w-[720px] text-ink-muted">
            Operator-gated monitoring of the eight substrate dimensions per ARCH 8.2.
            Threshold pills color yellow at 80% of envelope and red at 100%
            (.atelier/config.yaml: observability.thresholds). Out-of-band alert
            delivery (Slack/Teams/Discord) deferred to v1.x per BRD-OPEN-QUESTIONS §29.
          </Body>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold text-ink">{viewer.composerName}</div>
          <Mono className="mb-2 block text-[12px] text-ink-subtle">
            admin · session {viewer.sessionIdShort}…
          </Mono>
          <Refresher staleAsOf={viewModel.staleAsOf.toISOString()} />
        </div>
      </header>

      <nav
        className="mb-4 flex flex-wrap gap-1 border-b border-rule"
        aria-label="Observability section selector"
      >
        {SECTIONS.map((id) => {
          const isActive = id === tab;
          return (
            <Link
              key={id}
              href={`/atelier/observability?tab=${id}`}
              aria-current={isActive ? 'page' : undefined}
              className={
                isActive
                  ? 'border-b-2 border-primary px-3.5 py-2 text-[13px] text-ink no-underline'
                  : 'border-b-2 border-transparent px-3.5 py-2 text-[13px] text-ink-subtle no-underline hover:text-ink-muted'
              }
            >
              {TAB_LABELS[id]}
            </Link>
          );
        })}
      </nav>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
        {renderSection(tab, viewModel)}
      </div>
    </Surface>
  );
}

function renderSection(tab: SectionId, vm: ObservabilityViewModel) {
  switch (tab) {
    case 'sessions':
      return <SessionsSection data={vm.sessions} thresholds={vm.thresholds} />;
    case 'contributions':
      return <ContributionsSection data={vm.contributions} thresholds={vm.thresholds} />;
    case 'locks':
      return <LocksSection data={vm.locks} thresholds={vm.thresholds} />;
    case 'decisions':
      return <DecisionsSection data={vm.decisions} thresholds={vm.thresholds} />;
    case 'triage':
      return <TriageSection data={vm.triage} thresholds={vm.thresholds} />;
    case 'sync':
      return <SyncSection data={vm.sync} thresholds={vm.thresholds} />;
    case 'vector':
      return <VectorSection data={vm.vector} thresholds={vm.thresholds} />;
    case 'cost':
      return <CostSection data={vm.cost} thresholds={vm.thresholds} />;
  }
}
