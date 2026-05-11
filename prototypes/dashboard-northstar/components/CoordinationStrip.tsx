import { FunctionComponent } from 'react';
import { Link } from '../lib/nav';
import { sessions, contributions, locks, proposals } from '../fixtures/seed';
import { Icon, type IconName } from './Icon';

/**
 * CoordinationStrip — DP-5.
 *
 * Persistent thin strip below the top nav. Renders four counters:
 *   sessions live · contributions in flight · locks held · brainstorms awaiting reaction
 *
 * Each is a Link that drills into the appropriate filtered surface. This is
 * the chrome that frames Atelier as a coordination substrate at first
 * glance — Hive's `renderCoordStrip` (production-proven) is the reference.
 */
export const CoordinationStrip: FunctionComponent = () => {
  const sessionsLive = sessions.filter(s => isLive(s.last_activity_at)).length;
  const contributionsInFlight = contributions.filter(c => c.state === 'claimed' || c.state === 'in_progress').length;
  const locksHeld = locks.length;
  const brainstormsOpen = proposals.filter(p => p.state === 'open').length;

  return (
    <div className="border-t border-rule bg-raised">
      <div className="max-w-[1280px] mx-auto px-6 h-9 flex items-center gap-6 text-xs text-ink-muted overflow-x-auto">
        <Counter to="/connect#presence"               icon="Users"         label="sessions live"                value={sessionsLive} />
        <Counter to="/activity?state=in-flight"       icon="GitBranch"     label="contributions in flight"      value={contributionsInFlight} />
        <Counter to="/activity?filter=locks"          icon="Lock"          label="locks held"                   value={locksHeld} />
        <Counter to="/inbox#needs-reaction"           icon="MessagesSquare" label="brainstorms awaiting reaction" value={brainstormsOpen} highlight />
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono nums-tabular text-ink-subtle whitespace-nowrap">
          <Icon name="Radio" size="xs" />
          last broadcast event · 18s ago
        </span>
      </div>
    </div>
  );
};

interface CounterProps {
  to: string;
  icon: IconName;
  label: string;
  value: number;
  highlight?: boolean;
}

const Counter: FunctionComponent<CounterProps> = ({ to, icon, label, value, highlight }) => (
  <Link
    to={to}
    className="inline-flex items-center gap-1.5 hover:text-ink no-underline whitespace-nowrap"
  >
    <Icon name={icon} size="xs" className="text-ink-subtle" />
    <span className={`font-mono nums-tabular font-semibold ${highlight && value > 0 ? 'text-primary' : 'text-ink'}`}>{value}</span>
    <span>{label}</span>
  </Link>
);

function isLive(iso: string): boolean {
  // Treat sessions with activity in the last 10 min as "live" — placeholder
  // until heartbeat ledger ships per substrate-inventory.md.
  const now = new Date('2026-05-10T19:42:00Z').getTime();   // pinned for prototype determinism
  const then = new Date(iso).getTime();
  return now - then < 10 * 60 * 1000;
}
