// Recent decisions — the project-wide direct band from get_context.
// Epic-sibling and contribution-linked bands light up at M3-late when
// get_context surfaces them. Truncation flag mirrors ARCH 6.7.1 contract.
//
// ADR-060 PR C: migrated to design-package primitives.

import type { RecentDecisionEntry } from '../../../../lib/atelier/lens-data.ts';
import { Panel } from '../../../../lib/atelier/design';
import {
  Affordance,
  PanelEmpty,
  PanelHeader,
  PanelList,
  PanelRow,
  RowHead,
  RowMeta,
  RowTitle,
  Tag,
  Tags,
} from './panel-ui.tsx';

export default function RecentDecisionsPanel({
  decisions,
  truncated,
}: {
  decisions: RecentDecisionEntry[];
  truncated: boolean;
}) {
  return (
    <Panel tone="paper" className="flex min-w-0 flex-col gap-3 p-4">
      <PanelHeader
        title="Recent decisions"
        count={`${decisions.length}${truncated ? '+' : ''}`}
      />
      {decisions.length === 0 ? (
        <PanelEmpty>No decisions yet.</PanelEmpty>
      ) : (
        <PanelList>
          {decisions.map((d) => (
            <PanelRow key={d.id}>
              <RowHead>
                <RowTitle>{d.summary}</RowTitle>
                <RowMeta>{d.repoCommitSha ? d.repoCommitSha.slice(0, 7) : 'no-sha'}</RowMeta>
              </RowHead>
              <Tags>
                {d.traceIds.map((tid) => (
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
        Direct band only at M3; epic-sibling + contribution-linked bands per ARCH 6.7.1.
      </Affordance>
    </Panel>
  );
}
