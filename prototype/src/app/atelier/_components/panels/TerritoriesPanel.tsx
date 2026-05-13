// Territories — owned + consumed view, per ARCH 6.7 and territories.yaml.
// "Owned" lights up when the viewer's discipline matches owner_role.
//
// ADR-060 PR C: migrated to design-package primitives.

import type { TerritoryView } from '../../../../lib/atelier/lens-data.ts';
import { Panel } from '../../../../lib/atelier/design';
import {
  Affordance,
  PanelHeader,
  PanelList,
  PanelRow,
  RowHead,
  RowMeta,
  RowSub,
  RowTitle,
  Tag,
  Tags,
} from './panel-ui.tsx';

export default function TerritoriesPanel({
  territories,
}: {
  territories: TerritoryView[];
}) {
  const owned = territories.filter((t) => t.isOwned);
  const consumed = territories.filter((t) => !t.isOwned && t.contractsConsumed.length > 0);
  const other = territories.filter((t) => !t.isOwned && t.contractsConsumed.length === 0);
  return (
    <Panel tone="paper" className="flex min-w-0 flex-col gap-3 p-4">
      <PanelHeader
        title="Territories"
        count={`${owned.length} owned · ${consumed.length} consumed`}
      />
      {owned.length > 0 && (
        <PanelList>
          {owned.map((t) => (
            <TerritoryRow key={t.name} t={t} variant="owned" />
          ))}
        </PanelList>
      )}
      {consumed.length > 0 && (
        <>
          <Affordance>Consumed contracts:</Affordance>
          <PanelList>
            {consumed.map((t) => (
              <TerritoryRow key={t.name} t={t} variant="consumed" />
            ))}
          </PanelList>
        </>
      )}
      {other.length > 0 && (
        <>
          <Affordance>Other:</Affordance>
          <PanelList>
            {other.map((t) => (
              <TerritoryRow key={t.name} t={t} variant="other" />
            ))}
          </PanelList>
        </>
      )}
    </Panel>
  );
}

function TerritoryRow({ t, variant }: { t: TerritoryView; variant: 'owned' | 'consumed' | 'other' }) {
  return (
    <PanelRow>
      <RowHead>
        <RowTitle>
          {t.name}
          {variant === 'owned' && (
            <>
              {' '}
              <Tag tone="ok">owned</Tag>
            </>
          )}
        </RowTitle>
        <RowMeta>{t.scopeKind}</RowMeta>
      </RowHead>
      <RowSub>
        owner: {t.ownerRole}
        {t.reviewRole && t.reviewRole !== t.ownerRole && ` · review: ${t.reviewRole}`}
      </RowSub>
      {t.contractsPublished.length > 0 && (
        <Tags>
          {t.contractsPublished.map((c) => (
            <Tag key={c} tone="accent">
              {c}
            </Tag>
          ))}
        </Tags>
      )}
      {t.contractsConsumed.length > 0 && (
        <Tags>
          {t.contractsConsumed.map((c) => (
            <Tag key={`c-${c}`}>← {c}</Tag>
          ))}
        </Tags>
      )}
    </PanelRow>
  );
}
