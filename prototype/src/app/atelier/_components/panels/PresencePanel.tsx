// Presence — active composers in the project (heartbeat <15min).
// Per ARCH 6.8 session.presence_changed event surface. The live-update
// surface lands at M4 via the LiveUpdater island in the lens shell:
// session.presence_changed events trigger router.refresh(), which
// re-runs this server component against the latest sessions table.
//
// ADR-060 PR C: migrated to design-package primitives.

import type { PresenceEntry } from '../../../../lib/atelier/lens-data.ts';
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

export default function PresencePanel({
  entries,
  viewerComposerId,
}: {
  entries: PresenceEntry[];
  viewerComposerId: string;
}) {
  return (
    <Panel tone="paper" className="flex min-w-0 flex-col gap-3 p-4">
      <PanelHeader title="Active participants" count={entries.length} />
      {entries.length === 0 ? (
        <PanelEmpty>No active sessions in the last 15 minutes.</PanelEmpty>
      ) : (
        <PanelList>
          {entries.map((p) => {
            const isViewer = p.composerId === viewerComposerId;
            return (
              <PanelRow key={p.composerId}>
                <RowHead>
                  <RowTitle>
                    {p.composerName}
                    {isViewer && (
                      <>
                        {' '}
                        <Tag tone="mine">you</Tag>
                      </>
                    )}
                  </RowTitle>
                  <RowMeta>{relativeMinutes(p.heartbeatAt)}</RowMeta>
                </RowHead>
                <Tags>
                  <Tag tone="accent">{p.discipline ?? 'no-discipline'}</Tag>
                  <Tag>{p.surface}</Tag>
                  {p.agentClient && <Tag>{p.agentClient}</Tag>}
                </Tags>
              </PanelRow>
            );
          })}
        </PanelList>
      )}
      <Affordance>
        Live updates via the broadcast substrate (ADR-016 / ARCH 6.8);
        session.presence_changed events trigger refresh within ~2s.
      </Affordance>
    </Panel>
  );
}

function relativeMinutes(d: Date): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  if (mins === 0) return 'just now';
  if (mins === 1) return '1m ago';
  return `${mins}m ago`;
}
