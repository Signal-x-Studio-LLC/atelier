import { FunctionComponent } from 'react';
import { Link } from '../lib/nav';
import { activity } from '../fixtures/seed';
import { AuthorBadge } from '../components/AuthorBadge';
import { timeAgo } from '../lib/format';

/**
 * Home (`/`) — Q3 cold-visitor view.
 *
 * What it shows:
 *   - Brand statement (one paragraph, editorial weight)
 *   - Compose action launcher (the wedge — DP-7)
 *   - Read-only Activity preview (last 6 events)
 *   - Prominent Connect link for chat exploration
 *
 * Detection model: cold = no `composer_id` cookie or `last_seen_at` >7d.
 * Returning composer is redirected to `/inbox` upstream of this component
 * (handled in App.tsx for the prototype; in production the redirect is
 * server-side per ADR-052 CF Worker request shape).
 */
export const Home: FunctionComponent = () => {
  const recent = activity.slice(0, 6);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 py-6">
      <section className="md:col-span-2">
        <h1 className="font-display text-display font-semibold leading-tight tracking-tight text-ink mb-4">
          The studio where humans and agents author one canonical artifact.
        </h1>
        <p className="text-base text-ink-muted max-w-prose mb-8 leading-relaxed">
          Atelier is a self-hostable coordination substrate for mixed teams. Brainstorm primitives produce
          structured deliberation, not chat threads. Locks prevent collisions, contracts prevent decision
          drift, and every decision lands in the repo as markdown. The dashboard surfaces what's open,
          what's in flight, and what needs your reaction — without burying the signal in a feed.
        </p>
        <div className="flex flex-wrap gap-3 mb-12">
          <Link
            to="/compose"
            className="inline-flex items-center gap-2 bg-primary text-ink-inverse px-4 py-2.5 rounded-md font-medium text-sm hover:bg-[var(--color-primary-hover)] no-underline"
          >
            Compose <span className="opacity-60">→</span>
          </Link>
          <Link
            to="/inbox"
            className="inline-flex items-center gap-2 border border-rule-strong text-ink px-4 py-2.5 rounded-md font-medium text-sm hover:bg-raised no-underline"
          >
            See the inbox
          </Link>
          <Link
            to="/connect#chat"
            className="inline-flex items-center gap-2 text-ink-muted px-4 py-2.5 rounded-md text-sm hover:text-ink no-underline"
          >
            Talk to the substrate <span className="font-mono text-xs opacity-60">⌘K</span>
          </Link>
        </div>

        <h2 className="font-display text-h3 font-semibold text-ink mb-3">What's happening right now</h2>
        <p className="text-xs text-ink-subtle mb-4">
          Read-only preview · last 6 events · last broadcast 18s ago
        </p>
        <ol className="border border-rule rounded-lg overflow-hidden bg-paper">
          {recent.map((e, i) => (
            <li key={i} className={`px-4 py-3 flex items-center gap-3 text-sm ${i > 0 ? 'border-t border-rule' : ''}`}>
              <EventTag kind={e.kind} />
              <span className="flex-1 text-ink truncate">{describeEvent(e)}</span>
              {'session' in e && e.session && <AuthorBadge sessionId={e.session.id} />}
              {'contribution' in e && e.contribution && <AuthorBadge sessionId={e.contribution.author_session_id} />}
              {'proposal' in e && e.proposal && <AuthorBadge sessionId={e.proposal.author_session_id} />}
              <span className="text-xs text-ink-subtle font-mono whitespace-nowrap w-16 text-right">{timeAgo(e.at)}</span>
            </li>
          ))}
        </ol>
      </section>

      <aside className="md:col-span-1 space-y-6">
        <div className="border border-rule rounded-lg bg-paper p-5">
          <h3 className="text-h4 font-semibold text-ink mb-2">For reviewers</h3>
          <p className="text-sm text-ink-muted leading-relaxed">
            This prototype is the output of a BigBlueprint Stage 2 design phase. It supersedes
            <code className="font-mono text-xs ml-1 bg-raised px-1 rounded">for-reviewers.md</code> as
            the primary "show to people" surface for Atelier's webapp direction.
          </p>
        </div>
        <div className="border border-rule rounded-lg bg-raised p-5">
          <h3 className="text-h4 font-semibold text-ink mb-2">Five surfaces, one substrate</h3>
          <ul className="text-sm text-ink-muted space-y-1.5">
            <li><span className="font-medium text-ink">Compose</span> — author primitives</li>
            <li><span className="font-medium text-ink">Inbox</span> — what needs your attention</li>
            <li><span className="font-medium text-ink">Activity</span> — three-loop timeline</li>
            <li><span className="font-medium text-ink">Atlas</span> — historical projection</li>
            <li><span className="font-medium text-ink">Connect</span> — presence + integrations + chat</li>
          </ul>
        </div>
        <div className="text-xs text-ink-subtle leading-relaxed">
          <p className="label-eyebrow mb-1">Substrate gates</p>
          <p>Three substrate gaps block real wiring. The prototype renders against fixtures matching the eventual schema.</p>
        </div>
      </aside>
    </div>
  );
};

function describeEvent(e: typeof activity[number]): string {
  switch (e.kind) {
    case 'proposal.created':     return `New proposal · ${e.proposal.title}`;
    case 'proposal.reacted':     return `Reaction · ${reactionLabel(e.reaction.kind)} on "${e.proposal.title}"`;
    case 'synthesis.created':    return `Synthesis · ${e.proposal.title}`;
    case 'plan.approved':        return `Plan approved · ${e.proposal.title}`;
    case 'contribution.claimed': return `Claimed · ${e.contribution.title}`;
    case 'contribution.released': return `Released · ${e.contribution.title}`;
    case 'decision.logged':      return `Decision · ${e.decision.title}`;
    case 'lock.acquired':        return `Lock acquired · ${e.lock.artifact_scope}`;
    case 'lock.released':        return `Lock released · ${e.lock.artifact_scope}`;
    case 'session.registered':   return `Session registered · ${e.session.surface}`;
  }
}

function reactionLabel(k: string): string {
  return k.charAt(0).toUpperCase() + k.slice(1);
}

const EventTag: FunctionComponent<{ kind: string }> = ({ kind }) => {
  const tag = kind.split('.')[0];
  const colorClass = (() => {
    switch (tag) {
      case 'proposal':
      case 'synthesis':
      case 'plan':
        return 'bg-[color:var(--color-loop-brainstorm)]';
      case 'contribution':
      case 'lock':
        return 'bg-[color:var(--color-loop-execute)]';
      case 'decision':
      case 'session':
        return 'bg-[color:var(--color-loop-continuity)]';
      default:
        return 'bg-ink-subtle';
    }
  })();
  return (
    <span className="label-eyebrow inline-flex items-center gap-1.5 w-24">
      <span className={`w-1.5 h-1.5 rounded-full ${colorClass}`} />
      {tag}
    </span>
  );
};
