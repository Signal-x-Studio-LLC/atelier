'use client';

import { FunctionComponent, useState } from 'react';
import { decisions, proposals, contributions } from '../fixtures/seed';
import { LoopChip } from '../components/LoopChip';
import { AuthorBadge } from '../components/AuthorBadge';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/EmptyState';
import { timeAgo } from '../lib/format';

/**
 * Atlas (`/atlas`) — the historical projection.
 *
 * DP-7: long tail, not the wedge. Search-led; relevance sort default.
 * DP-6: paginate at 25, virtualize at 200.
 *
 * Backed by `find_similar` (RRF: vector + BM25 hybrid retrieval) when the
 * substrate's brainstorm corpus is fully indexed. The prototype searches
 * locally over titles for demonstration.
 */

type Facet = 'all' | 'proposal' | 'synthesis' | 'decision' | 'contribution';

export const Atlas: FunctionComponent = () => {
  const [q, setQ] = useState('');
  const [facet, setFacet] = useState<Facet>('all');

  const all = [
    ...proposals.map(p => ({
      kind: p.state === 'synthesized' || p.state === 'approved' ? 'synthesis' : 'proposal',
      id: p.id, title: p.title, territory: p.territory, traceId: p.trace_id,
      date: p.created_at, sessionId: p.author_session_id,
      loop: 'brainstorm' as const,
    })),
    ...decisions.map(d => ({
      kind: 'decision', id: d.id, title: d.title, territory: '—', traceId: d.trace_id,
      date: d.created_at, sessionId: 's-1', loop: 'continuity' as const,
    })),
    ...contributions.filter(c => c.state === 'merged' || c.state === 'review').map(c => ({
      kind: 'contribution', id: c.id, title: c.title, territory: c.territory, traceId: c.trace_id,
      date: c.updated_at, sessionId: c.author_session_id, loop: c.loop,
    })),
  ];

  const filtered = all
    .filter(item => facet === 'all' || item.kind === facet)
    .filter(item => q === '' || item.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="py-6">
      <header className="mb-6">
        <h1 className="font-display text-h1 font-semibold text-ink mb-1">Atlas</h1>
        <p className="text-sm text-ink-muted max-w-prose">
          Hybrid retrieval over decisions, proposals, syntheses, contributions, and BRD/PRD sections.
          Searches the substrate's queryable history.
        </p>
      </header>

      <div className="mb-6 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none">
          <Icon name="Search" size="sm" />
        </span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search proposals, decisions, contributions… (find_similar via RRF when wired)"
          className="w-full pl-10 pr-4 py-3 border border-rule-strong rounded-lg bg-paper text-ink placeholder:text-ink-subtle text-base"
          aria-label="Search Atlas"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-rule">
        <span className="label-eyebrow mr-1">facets</span>
        {(['all', 'proposal', 'synthesis', 'decision', 'contribution'] as Facet[]).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFacet(f)}
            className={[
              'px-2.5 py-1 text-xs rounded-md border capitalize',
              facet === f ? 'bg-ink text-ink-inverse border-ink' : 'bg-paper text-ink-muted border-rule hover:text-ink',
            ].join(' ')}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs text-ink-subtle">
          {filtered.length} results · sort by relevance
        </span>
      </div>

      <ol className="border border-rule rounded-lg overflow-hidden bg-paper">
        {filtered.map((item, i) => (
          <li key={item.id} className={`px-4 py-3 ${i > 0 ? 'border-t border-rule' : ''}`}>
            <div className="flex items-center gap-3">
              <LoopChip loop={item.loop} size="sm" />
              <span className="label-eyebrow font-mono normal-case tracking-normal w-20 truncate">{item.kind}</span>
              <span className="font-medium text-ink flex-1 truncate">{item.title}</span>
              <AuthorBadge sessionId={item.sessionId} />
              <span className="text-xs text-ink-subtle font-mono w-16 text-right">{timeAgo(item.date)}</span>
            </div>
            <div className="text-xs text-ink-subtle mt-1 ml-[3.75rem]">
              <span className="font-mono">{item.traceId}</span>
              {item.territory !== '—' && (<>· <span className="font-mono">{item.territory}</span></>)}
            </div>
          </li>
        ))}
      </ol>
      {filtered.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon="SearchX"
            heading="No matches in Atlas"
            body={q ? `Nothing matches "${q}" in ${facet === 'all' ? 'any facet' : `the ${facet} facet`}. Try a different query or broaden the facet.` : 'Pick a facet or type a query to search proposals, syntheses, decisions, and contributions.'}
          />
        </div>
      )}
    </div>
  );
};
