'use client';

import { FunctionComponent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Link } from '../lib/nav';
import { proposals, contributions, sessions, ME } from '../fixtures/seed';
import { AuthorBadge } from '../components/AuthorBadge';
import { LoopChip } from '../components/LoopChip';
import { Icon, type IconName } from '../components/Icon';
import { EmptyState } from '../components/EmptyState';
import { timeAgo } from '../lib/format';

/**
 * Inbox (`/inbox`) — DP-1 action-shaped sections.
 *
 * Every section header is action-shaped (`Needs your X`), not status-shaped.
 * Each section is a server-side query in the eventual substrate; in the
 * prototype, we filter fixtures locally to demonstrate the IA.
 *
 * Sections (in default order):
 *   1. Needs your reaction       — open proposals where ME hasn't reacted
 *   2. Awaiting your approval    — syntheses awaiting approve_plan from ME (territory.review_role)
 *   3. Awaiting review           — contributions in `review` state in territories where ME is review_role
 *   4. Blocked on you            — contributions in `blocked` state authored by sessions ME owns
 */
export const Inbox: FunctionComponent = () => {
  // Section 1 — proposals where ME hasn't reacted
  const meSessionIds = sessions.filter(s => s.composer_id === ME.id).map(s => s.id);
  const needsReaction = proposals.filter(
    p => p.state === 'open' && !p.reactions.some(r => meSessionIds.includes(r.session_id)),
  );

  // Section 2 — syntheses awaiting approve_plan
  const awaitingApproval = proposals.filter(p => p.state === 'synthesized');

  // Section 3 — contributions in review (assume ME is the review_role for `strategy`, `design`)
  const myReviewTerritories = ['strategy', 'design'];
  const awaitingReview = contributions.filter(
    c => c.state === 'review' && myReviewTerritories.includes(c.territory),
  );

  // Section 4 — blocked contributions authored by ME
  const blockedOnMe = contributions.filter(
    c => c.state === 'blocked' && meSessionIds.includes(c.author_session_id),
  );

  // ?empty=1 — DP-7 empty-state pass; the cold-Tuesday view where nothing
  // is yet asking for you. Reactive via the harness reviewer drawer
  // (Slice 2): toggling Scenario rewrites the URL and this re-renders.
  const searchParams = useSearchParams();
  const isEmpty = searchParams.has('empty');

  if (isEmpty) {
    return (
      <div className="py-6">
        <header className="mb-6">
          <h1 className="font-display text-h1 font-semibold text-ink mb-1">Inbox</h1>
          <p className="text-sm text-ink-muted">What needs your attention, organized by what you're being asked to do.</p>
        </header>
        <EmptyState
          icon="Inbox"
          heading="Nothing waiting on you"
          body="No proposals need your reaction, no syntheses await approval, nothing's blocked on you. Quiet stretch."
          cta={
            <Link
              to="/compose"
              className="inline-flex items-center gap-2 bg-primary text-ink-inverse px-4 py-2 rounded-md font-medium text-sm hover:bg-[var(--color-primary-hover)] no-underline"
            >
              Compose something
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="py-6">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-semibold text-ink mb-1">Inbox</h1>
          <p className="text-sm text-ink-muted">What needs your attention, organized by what you're being asked to do.</p>
        </div>
        <div className="text-xs text-ink-subtle font-mono nums-tabular">last sync · 18s ago</div>
      </header>

      <div className="space-y-8">
        <Section
          anchor="needs-reaction"
          icon="Zap"
          label="Needs your reaction"
          count={needsReaction.length}
          empty="No open proposals waiting on you. Quiet stretch."
          link={{ to: '/atlas?facet=proposal', label: 'See all open proposals' }}
        >
          {needsReaction.map(p => (
            <ProposalRow
              key={p.id}
              title={p.title}
              territory={p.territory}
              loop="brainstorm"
              authorSessionId={p.author_session_id}
              meta={`${p.options.length} options · ${p.reactions.length} reactions`}
              age={timeAgo(p.created_at)}
              cta="React"
              ctaTo={`/compose?reply=${p.id}`}
            />
          ))}
        </Section>

        <Section
          anchor="awaiting-approval"
          icon="CheckCheck"
          label="Awaiting your approval"
          count={awaitingApproval.length}
          empty="Nothing waiting on your approve_plan."
          link={{ to: '/atlas?facet=synthesis', label: 'See all syntheses' }}
        >
          {awaitingApproval.map(p => (
            <ProposalRow
              key={p.id}
              title={p.title}
              territory={p.territory}
              loop="brainstorm"
              authorSessionId={p.author_session_id}
              meta={`Synthesized ${timeAgo(p.synthesized_at!)}`}
              age={timeAgo(p.created_at)}
              cta="Approve"
              ctaTo={`/compose?approve=${p.id}`}
            />
          ))}
        </Section>

        <Section
          anchor="awaiting-review"
          icon="Eye"
          label="Awaiting review"
          count={awaitingReview.length}
          empty="No contributions in review for your territories."
          link={{ to: '/activity?state=review', label: 'See all in review' }}
        >
          {awaitingReview.map(c => (
            <ContribRow
              key={c.id}
              title={c.title}
              territory={c.territory}
              loop={c.loop}
              authorSessionId={c.author_session_id}
              traceId={c.trace_id}
              age={timeAgo(c.updated_at)}
              cta="Review"
              ctaTo={`/atlas?contribution=${c.id}`}
            />
          ))}
        </Section>

        <Section
          anchor="blocked-on-you"
          icon="OctagonAlert"
          label="Blocked on you"
          count={blockedOnMe.length}
          empty="Nothing blocked on you. Keep moving."
          link={{ to: '/activity?state=blocked', label: 'See all blocked' }}
        >
          {blockedOnMe.map(c => (
            <ContribRow
              key={c.id}
              title={c.title}
              territory={c.territory}
              loop={c.loop}
              authorSessionId={c.author_session_id}
              traceId={c.trace_id}
              age={timeAgo(c.updated_at)}
              cta="Unblock"
              ctaTo={`/compose?unblock=${c.id}`}
            />
          ))}
        </Section>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
const Section: FunctionComponent<{
  anchor: string;
  icon: IconName;
  label: string;
  count: number;
  empty: string;
  link: { to: string; label: string };
  children: React.ReactNode;
}> = ({ anchor, icon, label, count, empty, link, children }) => (
  <section
    id={anchor}
    data-testid={`inbox-section-${anchor}`}
    tabIndex={-1}
    aria-labelledby={`inbox-section-heading-${anchor}`}
    className="scroll-mt-24 focus:outline-none"
  >
    <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3 pb-2 border-b border-rule">
      <h2
        id={`inbox-section-heading-${anchor}`}
        className="font-display text-h3 font-semibold text-ink inline-flex items-center gap-2.5 min-w-0"
      >
        <Icon name={icon} size="md" className="text-ink-muted" />
        <span className="truncate">{label}</span>
        <span className="text-sm font-mono nums-tabular text-ink-subtle font-normal align-middle">{count}</span>
      </h2>
      <Link to={link.to} className="text-xs text-primary no-underline hover:underline whitespace-nowrap">
        {link.label} →
      </Link>
    </header>
    {count === 0 ? (
      <p className="text-sm text-ink-subtle italic py-4">{empty}</p>
    ) : (
      <ul className="border border-rule rounded-lg overflow-hidden bg-paper">{children}</ul>
    )}
  </section>
);

const ProposalRow: FunctionComponent<{
  title: string;
  territory: string;
  loop: 'brainstorm' | 'execute' | 'continuity';
  authorSessionId: string;
  meta: string;
  age: string;
  cta: string;
  ctaTo: string;
}> = ({ title, territory, loop, authorSessionId, meta, age, cta, ctaTo }) => (
  <li className="px-4 py-3 flex items-center gap-4 border-b border-rule last:border-b-0 hover:bg-raised">
    <LoopChip loop={loop} size="sm" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-ink truncate">{title}</p>
      <p className="text-xs text-ink-subtle mt-0.5">
        <span className="font-mono">{territory}</span> · {meta}
      </p>
    </div>
    <AuthorBadge sessionId={authorSessionId} />
    <span className="text-xs text-ink-subtle font-mono w-12 text-right">{age}</span>
    <Link
      to={ctaTo}
      className="bg-primary text-ink-inverse px-3 py-1 rounded text-xs font-medium hover:bg-[var(--color-primary-hover)] no-underline"
    >
      {cta}
    </Link>
  </li>
);

const ContribRow: FunctionComponent<{
  title: string;
  territory: string;
  loop: 'brainstorm' | 'execute' | 'continuity';
  authorSessionId: string;
  traceId: string;
  age: string;
  cta: string;
  ctaTo: string;
}> = ({ title, territory, loop, authorSessionId, traceId, age, cta, ctaTo }) => (
  <li className="px-4 py-3 flex items-center gap-4 border-b border-rule last:border-b-0 hover:bg-raised">
    <LoopChip loop={loop} size="sm" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-ink truncate">{title}</p>
      <p className="text-xs text-ink-subtle mt-0.5">
        <span className="font-mono">{traceId}</span> · <span className="font-mono">{territory}</span>
      </p>
    </div>
    <AuthorBadge sessionId={authorSessionId} />
    <span className="text-xs text-ink-subtle font-mono w-12 text-right">{age}</span>
    <Link
      to={ctaTo}
      className="border border-rule-strong text-ink px-3 py-1 rounded text-xs font-medium hover:bg-raised no-underline"
    >
      {cta}
    </Link>
  </li>
);
