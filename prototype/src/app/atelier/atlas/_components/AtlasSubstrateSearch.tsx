'use client';

// AtlasSubstrateSearch - PR 3 substrate-real search using find_similar.
//
// Renders above the prototype Atlas. The prototype's local title-
// substring filter stays in place as a fast first-pass affordance;
// this component adds substrate-real semantic retrieval (hybrid
// vector + BM25 per ADR-042). Reuses the existing find-similar
// server action that was built for the dev lens panel.
//
// Search is on-demand (form submit / enter key), not as-you-type --
// embedding queries have non-trivial cost and the v1 advisory-tier
// gate per ADR-043 + ADR-047 doesn't justify continuous querying.

import { useState, useTransition, type FormEvent } from 'react';
import { runFindSimilar } from '../../_components/panels/find-similar-action.ts';
import type { FindSimilarMatch } from '../../../../../../scripts/endpoint/lib/find-similar.ts';

interface SearchState {
  status: 'idle' | 'pending' | 'ok' | 'error';
  query: string;
  primary: FindSimilarMatch[];
  weak: FindSimilarMatch[];
  degraded: boolean;
  thresholds: { default: number; weak: number } | null;
  error: { code: string; message: string } | null;
}

const INITIAL: SearchState = {
  status: 'idle',
  query: '',
  primary: [],
  weak: [],
  degraded: false,
  thresholds: null,
  error: null,
};

export function AtlasSubstrateSearch() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>(INITIAL);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length === 0) return;
    setState((s) => ({ ...s, status: 'pending', error: null }));
    startTransition(async () => {
      const result = await runFindSimilar(trimmed);
      if (result.error) {
        setState({
          status: 'error',
          query: trimmed,
          primary: [],
          weak: [],
          degraded: false,
          thresholds: null,
          error: result.error,
        });
        return;
      }
      const r = result.response;
      setState({
        status: 'ok',
        query: trimmed,
        primary: r?.primary_matches ?? [],
        weak: r?.weak_suggestions ?? [],
        degraded: r?.degraded ?? false,
        thresholds: r?.thresholds_used ?? null,
        error: null,
      });
    });
  };

  return (
    <section
      aria-label="Substrate semantic search"
      className="border-b border-rule bg-paper px-6 lg:px-10 py-4"
    >
      <div className="max-w-5xl mx-auto">
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <span className="label-eyebrow">Substrate search</span>
          <span className="text-xs text-ink-subtle">
            find_similar (hybrid retrieval, ADR-042)
          </span>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Free-form query against decisions / proposals / contributions..."
            className="flex-1 px-3 py-2 border border-rule rounded-md bg-paper text-ink placeholder:text-ink-subtle text-sm"
            aria-label="find_similar query"
          />
          <button
            type="submit"
            disabled={isPending || query.trim().length === 0}
            className="bg-primary text-ink-inverse px-4 py-2 rounded-md font-medium text-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? 'Searching...' : 'Search'}
          </button>
        </form>

        {state.status === 'error' && state.error && (
          <p role="alert" className="mt-3 text-sm text-error">
            {state.error.code}: {state.error.message}
          </p>
        )}

        {state.status === 'ok' && (
          <SubstrateResults
            primary={state.primary}
            weak={state.weak}
            degraded={state.degraded}
            thresholds={state.thresholds}
            query={state.query}
          />
        )}
      </div>
    </section>
  );
}

function SubstrateResults({
  primary,
  weak,
  degraded,
  thresholds,
  query,
}: {
  primary: FindSimilarMatch[];
  weak: FindSimilarMatch[];
  degraded: boolean;
  thresholds: { default: number; weak: number } | null;
  query: string;
}) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-baseline gap-3 text-xs text-ink-subtle">
        <span className="label-eyebrow">
          Results for &ldquo;{query}&rdquo;
        </span>
        <span className="nums-tabular">
          {primary.length} primary · {weak.length} weak
        </span>
        {degraded && (
          <span className="text-warning">degraded (keyword fallback)</span>
        )}
        {thresholds && (
          <span className="font-mono nums-tabular">
            threshold {thresholds.default.toFixed(3)} / weak{' '}
            {thresholds.weak.toFixed(3)}
          </span>
        )}
      </div>

      {primary.length === 0 && weak.length === 0 ? (
        <p className="text-sm text-ink-subtle italic">
          No matches above the advisory threshold.
        </p>
      ) : (
        <ul className="border border-rule rounded-lg overflow-hidden bg-paper">
          {primary.map((m) => (
            <SubstrateRow key={`p-${m.source_ref}`} match={m} tier="primary" />
          ))}
          {weak.map((m) => (
            <SubstrateRow key={`w-${m.source_ref}`} match={m} tier="weak" />
          ))}
        </ul>
      )}
    </div>
  );
}

function SubstrateRow({
  match,
  tier,
}: {
  match: FindSimilarMatch;
  tier: 'primary' | 'weak';
}) {
  return (
    <li className="px-4 py-3 border-b border-rule last:border-b-0">
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="label-eyebrow">{match.source_kind}</span>
          <code className="font-mono text-xs text-ink-subtle truncate">
            {match.source_ref}
          </code>
        </div>
        <span className="text-xs font-mono nums-tabular text-ink-subtle whitespace-nowrap">
          {tier} · {match.score.toFixed(3)}
        </span>
      </div>
      {match.trace_ids.length > 0 && (
        <p className="text-xs text-ink-subtle mb-1 font-mono">
          {match.trace_ids.join(' · ')}
        </p>
      )}
      <p className="text-sm text-ink leading-relaxed">{match.excerpt}</p>
    </li>
  );
}
