// Vector index section - row count, source-kind breakdown, recent
// inserts, model versions in use. Per ARCH 8.2.

import type { VectorViewModel } from '../../../../../lib/atelier/observability-data.ts';
import type { ObservabilityThresholds } from '../../../../../lib/atelier/observability-config.ts';
import {
  Card,
  Empty,
  MetricCard,
  MonoText,
  Row,
  RowHead,
  RowList,
  RowMeta,
} from './_ui.tsx';

export default function VectorSection({
  data,
  thresholds,
}: {
  data: VectorViewModel;
  thresholds: ObservabilityThresholds;
}) {
  return (
    <>
      <MetricCard
        title="Embeddings rows"
        value={data.rowCount}
        envelope={thresholds.vectorIndexRowsPerGuild}
        suffix="indexed corpus items"
        sub="Per ADR-041 default vector(1536); ARCH 9.8 envelope 100k per guild."
      />
      <MetricCard
        title="Recent inserts (window)"
        value={data.recentInserts}
        suffix="newly embedded items"
      />
      <Card title="By source kind">
        {Object.keys(data.bySourceKind).length === 0 ? (
          <Empty>No embeddings populated yet. Run the embed pipeline to seed the index.</Empty>
        ) : (
          <RowList>
            {Object.entries(data.bySourceKind).map(([kind, count]) => (
              <Row key={kind}>
                <RowHead>
                  <MonoText>{kind}</MonoText>
                  <RowMeta>{count}</RowMeta>
                </RowHead>
              </Row>
            ))}
          </RowList>
        )}
      </Card>
      <Card title="Model versions in use">
        {data.modelVersions.length === 0 ? (
          <Empty>No model versions recorded.</Empty>
        ) : (
          <RowList>
            {data.modelVersions.map((m) => (
              <Row key={m}>
                <MonoText>{m}</MonoText>
              </Row>
            ))}
          </RowList>
        )}
      </Card>
    </>
  );
}
