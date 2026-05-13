// Sessions section - heartbeat health timeline, surface breakdown,
// reaper activity. Per ARCH 8.2 first row.

import type {
  SessionsViewModel,
} from '../../../../../lib/atelier/observability-data.ts';
import type { ObservabilityThresholds } from '../../../../../lib/atelier/observability-config.ts';
import {
  Capitalized,
  Card,
  Empty,
  MetricCard,
  Row,
  RowHead,
  RowList,
  RowMeta,
  relativeTime,
} from './_ui.tsx';

export default function SessionsSection({
  data,
  thresholds,
}: {
  data: SessionsViewModel;
  thresholds: ObservabilityThresholds;
}) {
  return (
    <>
      <MetricCard
        title="Active sessions (project)"
        value={data.activeNow}
        envelope={thresholds.sessionsActivePerProject}
        suffix="active in last 15min"
      />
      <MetricCard
        title="Active sessions (guild)"
        value={data.guildActiveNow}
        envelope={thresholds.sessionsActivePerGuild}
        suffix="across all projects"
      />
      <MetricCard
        title="Reaped (lookback window)"
        value={data.reapedLastWindow}
        suffix="dead sessions cleaned"
        sub="Source: telemetry action='session.reaped'. Healthy at low absolute counts; spikes hint at network or platform issues."
      />
      <Card title="Surface breakdown">
        {Object.keys(data.activeBySurface).length === 0 ? (
          <Empty>No active sessions in the last 15 minutes.</Empty>
        ) : (
          <RowList>
            {Object.entries(data.activeBySurface).map(([surface, count]) => (
              <Row key={surface}>
                <RowHead>
                  <Capitalized>{surface}</Capitalized>
                  <RowMeta>{count}</RowMeta>
                </RowHead>
              </Row>
            ))}
          </RowList>
        )}
      </Card>
      <Card title="Recent registrations" wide sub={`last ${data.recentRegistrations.length} entries in window`}>
        {data.recentRegistrations.length === 0 ? (
          <Empty>No sessions registered in the lookback window.</Empty>
        ) : (
          <RowList>
            {data.recentRegistrations.map((r, idx) => (
              <Row key={`${r.at.toISOString()}-${idx}`}>
                <RowHead>
                  <span>
                    <Capitalized>{r.surface}</Capitalized>
                    {r.agentClient ? <RowMeta> · {r.agentClient}</RowMeta> : null}
                  </span>
                  <RowMeta>{relativeTime(r.at)}</RowMeta>
                </RowHead>
              </Row>
            ))}
          </RowList>
        )}
      </Card>
    </>
  );
}
