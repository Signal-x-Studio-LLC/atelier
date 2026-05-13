// Review queue — contributions in state=review whose territory routes to
// the viewer's discipline (per ADR-025: territories.review_role determines
// which lens surfaces a review).
//
// ADR-060 PR C: migrated to design-package primitives.

import type { ReviewQueueEntry } from '../../../../lib/atelier/lens-data.ts';
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

export default function ReviewQueuePanel({
  entries,
  viewerDiscipline,
}: {
  entries: ReviewQueueEntry[];
  viewerDiscipline: string | null;
}) {
  return (
    <Panel tone="paper" className="col-[1/-1] flex min-w-0 flex-col gap-3 p-4">
      <PanelHeader title="Review queue" count={entries.length} />
      {viewerDiscipline === null ? (
        <PanelEmpty>
          No discipline assigned — review routing is keyed off composer.discipline.
        </PanelEmpty>
      ) : entries.length === 0 ? (
        <PanelEmpty>Nothing routed to {viewerDiscipline} review at this time.</PanelEmpty>
      ) : (
        <PanelList>
          {entries.map((c) => (
            <PanelRow key={c.id}>
              <RowHead>
                <RowTitle>{c.contentRef}</RowTitle>
                <StatePill tone="review">review</StatePill>
              </RowHead>
              <RowSub>
                {c.territoryName} · review_role: {c.reviewRole ?? c.territoryName} · author:{' '}
                {c.authorName ?? 'unowned'}
              </RowSub>
              <Tags>
                {c.traceIds.map((tid) => (
                  <Tag key={tid} tone="accent">
                    {tid}
                  </Tag>
                ))}
                <Tag tone="warm">kind:{c.kind}</Tag>
              </Tags>
            </PanelRow>
          ))}
        </PanelList>
      )}
      <Affordance>
        Routing per ADR-025: <Mono>territory.review_role</Mono> determines which lens surfaces the review.
      </Affordance>
    </Panel>
  );
}
