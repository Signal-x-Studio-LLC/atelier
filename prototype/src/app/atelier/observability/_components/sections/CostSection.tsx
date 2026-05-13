// Cost section - tokens / USD aggregates from telemetry payloads.
// Per ARCH 8.1 token-usage telemetry + 8.2 cost breakdown.

import type { CostViewModel } from '../../../../../lib/atelier/observability-data.ts';
import type { ObservabilityThresholds } from '../../../../../lib/atelier/observability-config.ts';
import { Mono } from '../../../../../lib/atelier/design';
import {
  Callout,
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
} from './_ui.tsx';
import { severityFor } from '../../../../../lib/atelier/observability-config.ts';

export default function CostSection({
  data,
  thresholds,
}: {
  data: CostViewModel;
  thresholds: ObservabilityThresholds;
}) {
  const days = Math.max(1, data.windowSeconds / 86400);
  const usdPerDay = data.totalUsd / days;
  const dailyEnvelope = thresholds.costUsdPerDayPerProject;
  const severity = severityFor(usdPerDay, dailyEnvelope);
  return (
    <>
      <CardShell>
        <CardHead>
          <CardTitle>Cost per day (window)</CardTitle>
          <SeverityPill severity={severity} />
        </CardHead>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[28px] leading-none font-semibold text-ink nums-tabular">
            ${usdPerDay.toFixed(2)}
          </span>
          <Mono className="text-[13px] text-ink-subtle">
            / ${dailyEnvelope.toFixed(2)} envelope
          </Mono>
        </div>
        <CardSub>
          Window: {(data.windowSeconds / 3600).toFixed(0)}h · total ${data.totalUsd.toFixed(2)}.
          v1 visibility-only (per ARCH 8.1); active enforcement is v1.x scope.
        </CardSub>
      </CardShell>
      <MetricCard
        title="Tokens input (window)"
        value={data.totalTokensInput}
        suffix="prompt tokens"
      />
      <MetricCard
        title="Tokens output (window)"
        value={data.totalTokensOutput}
        suffix="completion tokens"
      />
      {data.signal === 'no_data' ? (
        <CardShell wide>
          <CardHead>
            <CardTitle>Cost telemetry not yet populated</CardTitle>
          </CardHead>
          <Callout warn>
            No telemetry rows with the <Mono>cost_usd</Mono> metadata field landed in
            the lookback window. Per ARCH 8.1 cost is recorded by callers that consume
            LLM tokens (find_similar embedding generation, transcript classification,
            triage drafting). Populate by configuring{' '}
            <Mono>.atelier/config.yaml: telemetry.model_prices</Mono> and ensuring the
            embed pipeline + triage drafter emit cost on each call. Visibility ships
            at v1; active enforcement (per-composer budgets) is v1.x scope.
          </Callout>
        </CardShell>
      ) : (
        <>
          <Card title="By action class" wide sub="top USD contributors in window">
            {data.byActionClass.length === 0 ? (
              <Empty>No cost-bearing actions in window.</Empty>
            ) : (
              <RowList>
                {data.byActionClass.map((a) => (
                  <Row key={a.actionClass}>
                    <RowHead>
                      <MonoText>{a.actionClass}</MonoText>
                      <RowMeta>${a.usd.toFixed(2)}</RowMeta>
                    </RowHead>
                    <RowMeta>
                      in {a.tokensInput} · out {a.tokensOutput}
                    </RowMeta>
                  </Row>
                ))}
              </RowList>
            )}
          </Card>
          <Card title="By composer" wide sub="top USD attribution in window">
            {data.byComposer.length === 0 ? (
              <Empty>No composer-attributed cost in window.</Empty>
            ) : (
              <RowList>
                {data.byComposer.map((c) => (
                  <Row key={c.composerName}>
                    <RowHead>
                      <span>{c.composerName}</span>
                      <RowMeta>${c.usd.toFixed(2)}</RowMeta>
                    </RowHead>
                  </Row>
                ))}
              </RowList>
            )}
          </Card>
        </>
      )}
    </>
  );
}
