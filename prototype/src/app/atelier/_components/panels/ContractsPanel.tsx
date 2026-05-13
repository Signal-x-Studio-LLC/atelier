// Contracts — published contracts in the project, with breaking/additive
// classification per ARCH 6.6 and ADR-035 effective_decision.
//
// ADR-060 PR C: migrated to design-package primitives.

import type { ContractEntry, TerritoryView } from '../../../../lib/atelier/lens-data.ts';
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
  Tag,
  Tags,
} from './panel-ui.tsx';

export default function ContractsPanel({
  contracts,
  territories,
}: {
  contracts: ContractEntry[];
  territories: TerritoryView[];
}) {
  const consumedNames = new Set<string>(
    territories.filter((t) => t.isOwned === false && t.isConsumed).flatMap((t) => t.contractsConsumed),
  );
  return (
    <Panel tone="paper" className="flex min-w-0 flex-col gap-3 p-4">
      <PanelHeader title="Contracts" count={contracts.length} />
      {contracts.length === 0 ? (
        <PanelEmpty>
          No contracts published yet — territories declare contracts in territories.yaml; the first <Mono>propose_contract_change</Mono> publishes a row here.
        </PanelEmpty>
      ) : (
        <PanelList>
          {contracts.map((c) => {
            const consumesIt = consumedNames.has(c.name);
            return (
              <PanelRow key={c.id}>
                <RowHead>
                  <RowTitle>
                    {c.name}
                    {consumesIt && (
                      <>
                        {' '}
                        <Tag tone="warm">consumed by you</Tag>
                      </>
                    )}
                  </RowTitle>
                  <Mono className="shrink-0 text-[11px] text-ink-subtle">v{c.version}</Mono>
                </RowHead>
                <RowSub>
                  {c.territoryName} · published {c.publishedAt.toISOString().slice(0, 10)}
                </RowSub>
                <Tags>
                  <Tag tone={c.effectiveDecision === 'breaking' ? 'danger' : 'ok'}>
                    {c.effectiveDecision}
                  </Tag>
                </Tags>
              </PanelRow>
            );
          })}
        </PanelList>
      )}
      <Affordance>
        Breaking-change classifier per ARCH 6.6.1; override + justification per ADR-035.
      </Affordance>
    </Panel>
  );
}
