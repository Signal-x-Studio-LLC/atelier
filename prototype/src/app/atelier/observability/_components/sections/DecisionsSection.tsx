// Decisions section - lifetime ADR count, find_similar match-rate
// signal. Per ARCH 8.2.

import type { DecisionsViewModel } from '../../../../../lib/atelier/observability-data.ts';
import type { ObservabilityThresholds } from '../../../../../lib/atelier/observability-config.ts';
import { Mono } from '../../../../../lib/atelier/design';
import {
  Callout,
  CardHead,
  CardShell,
  CardSub,
  CardTitle,
  MetricCard,
  relativeTime,
} from './_ui.tsx';

export default function DecisionsSection({
  data,
  thresholds,
}: {
  data: DecisionsViewModel;
  thresholds: ObservabilityThresholds;
}) {
  return (
    <>
      <MetricCard
        title="Lifetime decisions"
        value={data.lifetime}
        envelope={thresholds.decisionsLifetimePerProject}
        suffix="ADRs logged"
        sub="Per-ADR file split per ADR-030. Vector index handles comfortably at envelope."
      />
      <MetricCard
        title="Recent (lookback window)"
        value={data.recentCount}
        suffix="new ADRs"
      />
      <CardShell wide>
        <CardHead>
          <CardTitle>find_similar signal</CardTitle>
          <CardSub inline>last harness run</CardSub>
        </CardHead>
        {data.findSimilarSignal === 'no_data' ? (
          <Callout warn>
            <strong className="text-ink">No find_similar measurement signal recorded yet.</strong> The signal
            populates when the eval harness runs against the deployed substrate (per
            scripts/test/scale/load-runner.ts) or when find_similar emits per-call
            telemetry. Run <Mono>npm run eval -- find_similar</Mono> to populate the
            advisory-tier precision/recall trail (per ADR-043 / ADR-047 advisory
            informational-default).
          </Callout>
        ) : (
          <Callout>
            Last find_similar event: <strong className="text-ink">{relativeTime(data.findSimilarLastRunAt)}</strong>.
            Per ADR-043 / ADR-047 the gate is advisory at v1; precision/recall history
            populates from the eval harness writing telemetry rows under
            <Mono> action LIKE 'find_similar.%' </Mono> or <Mono> action LIKE 'scale_test.%find_similar%'</Mono>.
          </Callout>
        )}
      </CardShell>
    </>
  );
}
