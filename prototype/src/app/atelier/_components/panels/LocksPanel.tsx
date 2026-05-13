// Active locks. Per ARCH 7.4 + ADR-026: fencing tokens are mandatory; lock
// rows carry the holder + scope + token for observability.
//
// ADR-060 PR C: migrated to design-package primitives.

import type { LockEntry } from '../../../../lib/atelier/lens-data.ts';
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

export default function LocksPanel({ locks }: { locks: LockEntry[] }) {
  return (
    <Panel tone="paper" className="flex min-w-0 flex-col gap-3 p-4">
      <PanelHeader title="Active locks" count={locks.length} />
      {locks.length === 0 ? (
        <PanelEmpty>No active locks.</PanelEmpty>
      ) : (
        <PanelList>
          {locks.map((l) => (
            <PanelRow key={l.id}>
              <RowHead>
                <RowTitle>{l.holderComposerName}</RowTitle>
                <RowMeta>token {l.fencingToken}</RowMeta>
              </RowHead>
              <Tags>
                {l.artifactScope.map((s) => (
                  <Tag key={s}>{s}</Tag>
                ))}
              </Tags>
            </PanelRow>
          ))}
        </PanelList>
      )}
      <Affordance>
        Fencing per ADR-004; conflict detection via GIN scope-overlap (ARCH 7.4.1).
      </Affordance>
    </Panel>
  );
}
