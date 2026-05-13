// Triage section - classifier confidence distribution, accept/reject
// rate. Per ARCH 8.2.

import type { TriageViewModel } from '../../../../../lib/atelier/observability-data.ts';
import type { ObservabilityThresholds } from '../../../../../lib/atelier/observability-config.ts';
import { Mono } from '../../../../../lib/atelier/design';
import {
  BarRow,
  Card,
  CardHead,
  CardShell,
  CardSub,
  CardTitle,
  Empty,
  MetricCard,
  SeverityPill,
} from './_ui.tsx';
import { severityFor } from '../../../../../lib/atelier/observability-config.ts';

export default function TriageSection({
  data,
  thresholds,
}: {
  data: TriageViewModel;
  thresholds: ObservabilityThresholds;
}) {
  const total = data.confidenceBuckets.low + data.confidenceBuckets.medium + data.confidenceBuckets.high;
  const max = Math.max(1, data.confidenceBuckets.low, data.confidenceBuckets.medium, data.confidenceBuckets.high);
  const acceptRate = (() => {
    const denom = data.acceptedLastWindow + data.rejectedLastWindow;
    return denom === 0 ? null : data.acceptedLastWindow / denom;
  })();
  const acceptSeverity = acceptRate === null ? 'ok' : severityFor(1 - acceptRate, 0.5); // >50% reject is alert
  return (
    <>
      <MetricCard
        title="Pending backlog"
        value={data.pendingCount}
        envelope={thresholds.triagePendingBacklog}
        suffix="awaiting human review"
        sub="Per ADR-018 triage never auto-merges; backlog reflects external comments awaiting routing."
      />
      <MetricCard
        title="Accepted (window)"
        value={data.acceptedLastWindow}
        suffix="approvals recorded"
      />
      <MetricCard
        title="Rejected (window)"
        value={data.rejectedLastWindow}
        suffix="triage.rejected"
      />
      <CardShell>
        <CardHead>
          <CardTitle>Accept rate</CardTitle>
          {acceptRate !== null && <SeverityPill severity={acceptSeverity} />}
        </CardHead>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[28px] leading-none font-semibold text-ink nums-tabular">
            {acceptRate === null ? '–' : `${(acceptRate * 100).toFixed(0)}%`}
          </span>
          <Mono className="text-[13px] text-ink-subtle">accepted / (accepted + rejected)</Mono>
        </div>
        <CardSub>
          Sustained low accept rate suggests classifier drift; tune thresholds or revisit
          the triage routing rules.
        </CardSub>
      </CardShell>
      <Card title="Classifier confidence distribution (pending)" wide sub={`${total} pending rows bucketed`}>
        {total === 0 ? (
          <Empty>No pending triage rows to bucket.</Empty>
        ) : (
          <div className="flex flex-col gap-1.5">
            <BarRow label="High (>=0.8)" count={data.confidenceBuckets.high} max={max} />
            <BarRow label="Medium (0.5-0.8)" count={data.confidenceBuckets.medium} max={max} severity="warn" />
            <BarRow label="Low (<0.5)" count={data.confidenceBuckets.low} max={max} severity="alert" />
          </div>
        )}
      </Card>
    </>
  );
}
