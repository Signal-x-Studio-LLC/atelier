import { FunctionComponent } from 'react';
import type { Surface } from '../lib/types';
import { composers, sessions } from '../fixtures/seed';

interface AuthorBadgeProps {
  sessionId: string;
  showName?: boolean;
}

/**
 * DP-2 — agents are a filter, not a destination. Authorship is metadata
 * surfaced as a small badge: avatar + surface chip. Same shape for human
 * composer and agent session; the surface chip and `agent` indicator
 * disambiguate.
 */
export const AuthorBadge: FunctionComponent<AuthorBadgeProps> = ({ sessionId, showName = false }) => {
  const session = sessions.find(s => s.id === sessionId);
  const composer = session ? composers.find(c => c.id === session.composer_id) : null;
  if (!session || !composer) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-ink-inverse"
        style={{ backgroundColor: composer.avatar_color }}
        title={`${composer.display_name} · ${session.surface}${session.author_kind === 'agent' ? ' (agent)' : ''}`}
      >
        {composer.display_name.charAt(0)}
      </span>
      {showName && (
        <span className="text-xs text-ink-muted">
          {composer.display_name}
          {session.author_kind === 'agent' && (
            <span className="label-eyebrow ml-1">agent</span>
          )}
        </span>
      )}
      <SurfaceChip surface={session.surface} />
    </span>
  );
};

const SurfaceChip: FunctionComponent<{ surface: Surface }> = ({ surface }) => (
  <span className="text-[9px] uppercase tracking-wider font-mono text-ink-subtle border border-rule rounded-sm px-1 py-0.5 leading-none">
    {surface}
  </span>
);
