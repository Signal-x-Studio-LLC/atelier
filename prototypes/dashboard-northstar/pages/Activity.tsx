'use client';

import { FunctionComponent, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Loop } from '../lib/types';
import { activity } from '../fixtures/seed';
import { LoopChip } from '../components/LoopChip';
import { AuthorBadge } from '../components/AuthorBadge';
import { SkeletonRow } from '../components/Skeleton';
import { timeAgo } from '../lib/format';

/**
 * Activity (`/activity`) — three-loop timeline.
 *
 * DP-4: per-actor freshness signal + trend-weighted-as-default option.
 * DP-6: declared scale budget — paginate at 50, virtualize at 500.
 * DP-8: three-loop framing surfaces as filter chips, not as nav.
 *
 * The default sort is recency-desc with a trend-weighted toggle (open
 * question Q from blueprint.yml; locked in DP-4). Filter chips for loop +
 * surface live above the fold.
 */

type SortMode = 'recency' | 'trend';

export const Activity: FunctionComponent = () => {
  const [activeLoops, setActiveLoops] = useState<Set<Loop>>(new Set(['brainstorm', 'execute', 'continuity']));
  const [authorFilter, setAuthorFilter] = useState<'all' | 'composer' | 'agent'>('all');
  const [sort, setSort] = useState<SortMode>('recency');

  // DP-9 loading-state pattern. Reactive via the harness reviewer drawer
  // (Slice 2): toggling Scenario→Loading rewrites the URL and re-renders.
  // In production the substrate SSE reconnect gates this for a moment
  // after navigation.
  const searchParams = useSearchParams();
  const forceLoading = searchParams.has('loading');
  const [loading, setLoading] = useState(forceLoading);
  useEffect(() => {
    if (!forceLoading) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, [forceLoading]);

  const toggleLoop = (l: Loop) => {
    const next = new Set(activeLoops);
    if (next.has(l)) next.delete(l);
    else next.add(l);
    if (next.size === 0) return; // never empty — at least one loop active
    setActiveLoops(next);
  };

  // Map event kind → loop
  const eventLoop = (kind: string): Loop => {
    if (kind.startsWith('proposal') || kind.startsWith('synthesis') || kind.startsWith('plan')) return 'brainstorm';
    if (kind.startsWith('contribution') || kind.startsWith('lock')) return 'execute';
    return 'continuity';
  };

  let filtered = activity.filter(e => activeLoops.has(eventLoop(e.kind)));

  if (sort === 'recency') {
    filtered = [...filtered].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  } else {
    // Trend-weighted: very rough proxy — score = recency × event-volume in last hour.
    // Real implementation reads server-side aggregates; the prototype demonstrates the surface.
    filtered = [...filtered].sort((a, b) => {
      const aScore = trendScore(a, filtered);
      const bScore = trendScore(b, filtered);
      return bScore - aScore;
    });
  }

  return (
    <div className="py-6">
      <header className="mb-6">
        <h1 className="font-display text-h1 font-semibold text-ink mb-1">Activity</h1>
        <p className="text-sm text-ink-muted">Three loops, one timeline. Live via SSE when the substrate ships <code className="font-mono text-xs">/api/events</code>.</p>
      </header>

      {/* Filter toolbar — DP-8 + DP-6 above-fold filter affordances */}
      <div className="flex flex-wrap items-center gap-3 mb-6 pb-4 border-b border-rule">
        <span className="label-eyebrow mr-1">loops</span>
        {(['brainstorm', 'execute', 'continuity'] as Loop[]).map(l => (
          <LoopChip key={l} loop={l} active={activeLoops.has(l)} onClick={() => toggleLoop(l)} />
        ))}

        <span className="label-eyebrow ml-4 mr-1">authors</span>
        <SegBtn label="All"     active={authorFilter === 'all'}      onClick={() => setAuthorFilter('all')} />
        <SegBtn label="Composers" active={authorFilter === 'composer'} onClick={() => setAuthorFilter('composer')} />
        <SegBtn label="Agents"  active={authorFilter === 'agent'}     onClick={() => setAuthorFilter('agent')} />

        <div className="ml-auto flex items-center gap-2">
          <span className="label-eyebrow">sort</span>
          <SegBtn label="Recency" active={sort === 'recency'} onClick={() => setSort('recency')} />
          <SegBtn label="Trend"   active={sort === 'trend'}   onClick={() => setSort('trend')} />
        </div>
      </div>

      {/* Scale budget callout */}
      <p className="text-xs text-ink-subtle mb-4 flex items-center gap-2">
        <span className="label-eyebrow">scale budget</span>
        <span className="nums-tabular">showing {loading ? '—' : filtered.length} · paginate at 50 · virtualize at 500</span>
      </p>

      {loading ? (
        <div className="border border-rule rounded-lg overflow-hidden bg-paper divide-y divide-[var(--color-rule)]" role="status" aria-busy="true" aria-label="Loading activity feed">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : (
      <ol className="border border-rule rounded-lg overflow-hidden bg-paper">
        {filtered.map((e, i) => (
          <li key={i} className={`px-4 py-3 flex items-center gap-3 text-sm ${i > 0 ? 'border-t border-rule' : ''}`}>
            <span className={`loop-dot loop-dot--${eventLoop(e.kind)}`} />
            <span className="label-eyebrow font-mono normal-case tracking-normal w-28 truncate">{e.kind}</span>
            <span className="flex-1 text-ink truncate">{describe(e)}</span>
            {sessionIdFromEvent(e) && <AuthorBadge sessionId={sessionIdFromEvent(e)!} />}
            <span className="text-xs text-ink-subtle font-mono whitespace-nowrap w-16 text-right">{timeAgo(e.at)}</span>
          </li>
        ))}
      </ol>
      )}
    </div>
  );
};

const SegBtn: FunctionComponent<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'px-2.5 py-1 text-xs rounded-md border transition-colors',
      active ? 'bg-ink text-ink-inverse border-ink' : 'bg-paper text-ink-muted border-rule hover:text-ink hover:border-rule-strong',
    ].join(' ')}
  >
    {label}
  </button>
);

function describe(e: typeof activity[number]): string {
  switch (e.kind) {
    case 'proposal.created':     return e.proposal.title;
    case 'proposal.reacted':     return `${e.reaction.kind} on "${e.proposal.title}"`;
    case 'synthesis.created':    return `Synthesis · ${e.proposal.title}`;
    case 'plan.approved':        return `Plan approved · ${e.proposal.title}`;
    case 'contribution.claimed': return e.contribution.title;
    case 'contribution.released': return `Released · ${e.contribution.title}`;
    case 'decision.logged':      return e.decision.title;
    case 'lock.acquired':        return e.lock.artifact_scope;
    case 'lock.released':        return `Released lock · ${e.lock.artifact_scope}`;
    case 'session.registered':   return `Session registered · surface=${e.session.surface}`;
  }
}

function sessionIdFromEvent(e: typeof activity[number]): string | null {
  if ('session' in e && e.session) return e.session.id;
  if ('contribution' in e && e.contribution) return e.contribution.author_session_id;
  if ('proposal' in e && e.proposal) return e.proposal.author_session_id;
  if ('reaction' in e && e.reaction) return e.reaction.session_id;
  return null;
}

function trendScore(e: typeof activity[number], all: typeof activity): number {
  const t = new Date(e.at).getTime();
  const hourMs = 60 * 60 * 1000;
  const sameHourCount = all.filter(x => Math.abs(new Date(x.at).getTime() - t) < hourMs).length;
  const recencyDecay = Math.exp(-((Date.now() - t) / (24 * hourMs)));
  return sameHourCount * recencyDecay;
}
