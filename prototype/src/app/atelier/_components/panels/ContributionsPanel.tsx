// Active contributions, weighted per the lens kind weights.
// State pill differentiates open / claimed / plan_review / in_progress / review.
// `mine` tag highlights the viewer's own contributions for orientation.
//
// ADR-060 PR C: migrated to design-package primitives.

import type { ContributionEntry } from '../../../../lib/atelier/lens-data.ts';
import type { ContributionKindWeight } from '../../../../lib/atelier/lens-config.ts';
import { Mono, Panel } from '../../../../lib/atelier/design';
import {
  Affordance,
  PanelEmpty,
  PanelHeader,
  PanelList,
  PanelRow,
  RowHead,
  RowSub,
  RowTitle,
  StatePill,
  Tag,
  Tags,
} from './panel-ui.tsx';

export default function ContributionsPanel({
  entries,
  byState,
  weights,
  canWrite,
}: {
  entries: ContributionEntry[];
  byState: Record<string, number>;
  weights: ContributionKindWeight;
  canWrite: boolean;
}) {
  const total = Object.values(byState).reduce((a, b) => a + b, 0);
  return (
    <Panel tone="paper" className="col-[1/-1] flex min-w-0 flex-col gap-3 p-4">
      <PanelHeader
        title="Active contributions"
        count={`${entries.length} shown · ${total} total`}
      />
      <Tags>
        {ORDERED_STATES.map((s) => (
          <Tag key={s}>
            {s}: {byState[s] ?? 0}
          </Tag>
        ))}
      </Tags>
      {entries.length === 0 ? (
        <PanelEmpty>No active contributions in this project.</PanelEmpty>
      ) : (
        <PanelList>
          {entries.map((c) => (
            <PanelRow key={c.id}>
              <RowHead>
                <RowTitle>
                  {c.contentRef}
                  {c.isMine && (
                    <>
                      {' '}
                      <Tag tone="mine">mine</Tag>
                    </>
                  )}
                </RowTitle>
                <StatePill tone={stateTone(c.state)}>{c.state}</StatePill>
              </RowHead>
              <RowSub>
                {c.territoryName} · kind:{c.kind} · {c.authorName ?? 'unowned'}
                {c.requiresOwnerApproval && ' · awaiting owner approval'}
                {c.blockedBy && ' · BLOCKED'}
              </RowSub>
              <Tags>
                {c.traceIds.map((tid) => (
                  <Tag key={tid} tone="accent">
                    {tid}
                  </Tag>
                ))}
              </Tags>
            </PanelRow>
          ))}
        </PanelList>
      )}
      <Affordance>
        Sorted by lens kind weights:{' '}
        impl×{weights.implementation} · research×{weights.research} · design×{weights.design}.{' '}
        {canWrite ? (
          <span>
            Authoring: <Mono>claim</Mono> via the endpoint or your agent client.
          </span>
        ) : (
          <span>Read-only lens — no claim affordance.</span>
        )}
      </Affordance>
    </Panel>
  );
}

const ORDERED_STATES = ['open', 'claimed', 'plan_review', 'in_progress', 'review', 'merged', 'rejected'] as const;

function stateTone(state: string): 'review' | 'inProgress' | 'default' {
  if (state === 'review') return 'review';
  if (state === 'in_progress') return 'inProgress';
  return 'default';
}
