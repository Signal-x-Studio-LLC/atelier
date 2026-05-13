// Contributions section - by-state count, recent state-transition audit
// log, throughput per territory. Per ARCH 8.2.

import type { ContributionsViewModel } from '../../../../../lib/atelier/observability-data.ts';
import type { ObservabilityThresholds } from '../../../../../lib/atelier/observability-config.ts';
import {
  Capitalized,
  Card,
  Empty,
  MetricCard,
  MonoText,
  Row,
  RowHead,
  RowList,
  RowMeta,
  relativeTime,
} from './_ui.tsx';

export default function ContributionsSection({
  data,
  thresholds,
}: {
  data: ContributionsViewModel;
  thresholds: ObservabilityThresholds;
}) {
  return (
    <>
      <MetricCard
        title="Lifetime contributions"
        value={data.lifetime}
        envelope={thresholds.contributionsLifetimePerProject}
        suffix="all states"
        sub="Beyond envelope: archive policy + tier upgrade per ARCH 9.8."
      />
      <Card title="By state">
        {Object.keys(data.byState).length === 0 ? (
          <Empty>No contributions in this project yet.</Empty>
        ) : (
          <RowList>
            {Object.entries(data.byState).map(([state, count]) => (
              <Row key={state}>
                <RowHead>
                  <Capitalized>{state.replace(/_/g, ' ')}</Capitalized>
                  <RowMeta>{count}</RowMeta>
                </RowHead>
              </Row>
            ))}
          </RowList>
        )}
      </Card>
      <Card title="Throughput by territory" sub="window count of new contributions">
        {data.throughputByTerritory.length === 0 ? (
          <Empty>No contribution activity in the lookback window.</Empty>
        ) : (
          <RowList>
            {data.throughputByTerritory.map((t) => (
              <Row key={t.territory}>
                <RowHead>
                  <span>{t.territory}</span>
                  <RowMeta>{t.count}</RowMeta>
                </RowHead>
              </Row>
            ))}
          </RowList>
        )}
      </Card>
      <Card title="Recent state transitions" wide sub={`last ${data.recentTransitions.length} events in window`}>
        {data.recentTransitions.length === 0 ? (
          <Empty>No state transitions recorded in the lookback window.</Empty>
        ) : (
          <RowList>
            {data.recentTransitions.map((t, idx) => (
              <Row key={`${t.at.toISOString()}-${idx}`} testid="recent-transition">
                <RowHead>
                  <span>
                    <MonoText>{t.action}</MonoText>
                    {t.composerName ? <RowMeta> · {t.composerName}</RowMeta> : null}
                    {t.contributionId ? (
                      <RowMeta> · {t.contributionId.slice(0, 8)}…</RowMeta>
                    ) : null}
                  </span>
                  <RowMeta>{relativeTime(t.at)}</RowMeta>
                </RowHead>
              </Row>
            ))}
          </RowList>
        )}
      </Card>
    </>
  );
}
