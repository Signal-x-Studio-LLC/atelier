'use client';

// "Before you start" — find_similar surface (M5 / ARCH 6.4 + ADR-006 + US-6.5).
//
// Calls the in-process server action runFindSimilar() which dispatches to
// the production handler. Renders ARCH 6.4.1's two-band response: primary
// matches above the default threshold prominently, weak suggestions in a
// labeled secondary region. Surfaces degraded=true via the same banner
// pattern other panels use, so the analyst knows when keyword fallback
// served the response (US-6.5).
//
// ADR-060 PR C: migrated to design-package primitives.

import { useState, useTransition } from 'react';

import { Button, Mono, Panel } from '../../../../lib/atelier/design';
import { runFindSimilar, type FindSimilarActionResult } from './find-similar-action.ts';
import {
  Affordance,
  DegradedCallout,
  PanelEmpty,
  PanelHeader,
  PanelList,
  PanelRow,
  RowHead,
  RowTitle,
  Tag,
  Tags,
} from './panel-ui.tsx';

export default function FindSimilarPanel() {
  const [query, setQuery] = useState('');
  const [traceId, setTraceId] = useState('');
  const [result, setResult] = useState<FindSimilarActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: { preventDefault(): void }): void {
    e.preventDefault();
    const q = query;
    const t = traceId;
    startTransition(async () => {
      const r = await runFindSimilar(q, t);
      setResult(r);
    });
  }

  const response = result?.response ?? null;
  const primary = response?.primary_matches ?? [];
  const weak = response?.weak_suggestions ?? [];
  const degraded = response?.degraded ?? false;
  const thresholds = response?.thresholds_used ?? null;

  return (
    <Panel tone="paper" className="flex min-w-0 flex-col gap-3 p-4">
      <PanelHeader
        title="Before you start (find_similar)"
        count={
          response
            ? `${primary.length} primary${weak.length > 0 ? ` · ${weak.length} weak` : ''}`
            : undefined
        }
      />

      <form className="flex flex-col gap-1.5" onSubmit={onSubmit}>
        <div className="flex items-stretch gap-1.5">
          <input
            type="text"
            placeholder="Describe the work you're considering"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={pending}
            aria-label="find_similar query"
            className="h-9 flex-1 rounded-sm border border-rule bg-canvas px-2.5 text-[13px] text-ink placeholder:text-ink-subtle focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex items-stretch gap-1.5">
          <input
            type="text"
            placeholder="Trace scope"
            value={traceId}
            onChange={(e) => setTraceId(e.target.value)}
            disabled={pending}
            aria-label="optional trace_id scope"
            className="h-9 w-[120px] rounded-sm border border-rule bg-canvas px-2.5 text-[13px] text-ink placeholder:text-ink-subtle focus:border-primary focus:outline-none"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={pending || query.trim().length === 0}
            className="uppercase tracking-wider"
          >
            {pending ? 'Running' : 'Search'}
          </Button>
        </div>
      </form>

      {result?.error && (
        <div className="border-l-[3px] border-error bg-raised px-2 py-1 text-[12px] text-error">
          {result.error.code}: {result.error.message}
        </div>
      )}

      {degraded && response && (
        <DegradedCallout>
          Semantic search is degraded — keyword fallback served this response (US-6.5). Set
          <Mono> OPENAI_API_KEY </Mono>or whichever{' '}
          <Mono>find_similar.embeddings.api_key_env</Mono> the project configures, then re-run.
        </DegradedCallout>
      )}

      {response && primary.length === 0 && weak.length === 0 && (
        <PanelEmpty>
          No matches at thresholds {thresholds ? `${thresholds.default} / ${thresholds.weak}` : ''}.
          {result?.trace_id ? ` Trace scope: ${result.trace_id}.` : ''}
        </PanelEmpty>
      )}

      {primary.length > 0 && (
        <>
          <div className="mt-2 mb-1 text-[11px] uppercase tracking-wider text-ink-subtle">
            Primary matches
          </div>
          <PanelList>
            {primary.map((m) => (
              <PanelRow key={`primary-${m.source_ref}`}>
                <RowHead>
                  <RowTitle>{m.source_ref}</RowTitle>
                  <Mono className="text-[11px] text-success">{m.score.toFixed(3)}</Mono>
                </RowHead>
                <Mono className="text-[12px] leading-[1.4] text-ink-muted">{m.excerpt}</Mono>
                <Tags>
                  {m.trace_ids.map((tid) => (
                    <Tag key={tid} tone="accent">
                      {tid}
                    </Tag>
                  ))}
                  <Tag>{m.source_kind}</Tag>
                </Tags>
              </PanelRow>
            ))}
          </PanelList>
        </>
      )}

      {weak.length > 0 && (
        <>
          <div className="mt-2 mb-1 text-[11px] uppercase tracking-wider text-ink-subtle">
            Weak suggestions
          </div>
          <PanelList>
            {weak.map((m) => (
              <PanelRow key={`weak-${m.source_ref}`}>
                <RowHead>
                  <RowTitle>{m.source_ref}</RowTitle>
                  <Mono className="text-[11px] text-warning">{m.score.toFixed(3)}</Mono>
                </RowHead>
                <Mono className="text-[12px] leading-[1.4] text-ink-muted">{m.excerpt}</Mono>
                <Tags>
                  {m.trace_ids.map((tid) => (
                    <Tag key={tid}>{tid}</Tag>
                  ))}
                  <Tag>{m.source_kind}</Tag>
                </Tags>
              </PanelRow>
            ))}
          </PanelList>
        </>
      )}

      <Affordance>
        Per ARCH 6.4.1 thresholds and ADR-006 / ADR-041. Index repopulates from the corpus via{' '}
        <Mono>npm run embed:run</Mono>; eval gate runs via{' '}
        <Mono>npm run eval:find_similar</Mono>.
      </Affordance>
    </Panel>
  );
}
