// Locks section - acquisition/release ledger with fencing tokens,
// conflict rate. Per ARCH 8.2.

import type { LocksViewModel } from '../../../../../lib/atelier/observability-data.ts';
import type { ObservabilityThresholds } from '../../../../../lib/atelier/observability-config.ts';
import { Mono } from '../../../../../lib/atelier/design';
import {
  Card,
  CardHead,
  CardShell,
  CardSub,
  CardTitle,
  Empty,
  MetricCard,
  MonoText,
  Row,
  RowHead,
  RowList,
  RowMeta,
  SeverityPill,
  relativeTime,
} from './_ui.tsx';
import { severityFor } from '../../../../../lib/atelier/observability-config.ts';

export default function LocksSection({
  data,
  thresholds,
}: {
  data: LocksViewModel;
  thresholds: ObservabilityThresholds;
}) {
  const conflictPct = (data.conflictRate * 100).toFixed(1);
  const conflictSeverity = severityFor(data.conflictRate, 0.2); // >20% conflict rate is alert
  return (
    <>
      <MetricCard
        title="Locks held now"
        value={data.heldNow}
        envelope={thresholds.locksHeldConcurrentPerProject}
        suffix="active"
        sub="Concurrent fenced acquisitions per ARCH 6.1.1."
      />
      <MetricCard
        title="Acquisitions (window)"
        value={data.recentAcquisitions}
        suffix="lock.acquired events"
      />
      <MetricCard
        title="Releases (window)"
        value={data.recentReleases}
        suffix="lock.released events"
      />
      <CardShell>
        <CardHead>
          <CardTitle>Conflict rate</CardTitle>
          <SeverityPill severity={conflictSeverity} />
        </CardHead>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[28px] leading-none font-semibold text-ink nums-tabular">
            {conflictPct}%
          </span>
          <Mono className="text-[13px] text-ink-subtle">contested acquisitions / window</Mono>
        </div>
        <CardSub>
          Proxy: telemetry rows with action='lock.acquired' AND outcome='error'.
          Sustained &gt;20% suggests territory boundaries need re-examining.
        </CardSub>
      </CardShell>
      <Card title="Recent ledger" wide sub={`last ${data.recentLedger.length} entries in window`}>
        {data.recentLedger.length === 0 ? (
          <Empty>No lock activity in the lookback window.</Empty>
        ) : (
          <RowList>
            {data.recentLedger.map((r, idx) => (
              <Row key={`${r.at.toISOString()}-${idx}`} testid="lock-ledger">
                <RowHead>
                  <span>
                    <MonoText>{r.action}</MonoText>
                    {r.holderName ? <RowMeta> · {r.holderName}</RowMeta> : null}
                    {r.fencingToken ? (
                      <RowMeta> · token {r.fencingToken}</RowMeta>
                    ) : null}
                  </span>
                  <RowMeta>{relativeTime(r.at)}</RowMeta>
                </RowHead>
                {r.artifactScope.length > 0 && (
                  <RowMeta breakAll>{r.artifactScope.join(', ')}</RowMeta>
                )}
              </Row>
            ))}
          </RowList>
        )}
      </Card>
    </>
  );
}
