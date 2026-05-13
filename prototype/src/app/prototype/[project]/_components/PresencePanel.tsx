'use client';

// Presence panel — substrate harness surface per ADR-057 Slice 6.
//
// Renders project-wide presence (active sessions for the current project,
// 15-minute heartbeat window). Server-loaded via loadPresenceData(); this
// component is a passive renderer plus a polling-based refresh.
//
// LIVE-UPDATE MECHANISM: client-side polling (router.refresh every 10s).
//
//   Rationale: the existing LiveUpdater (atelier/_components/LiveUpdater.tsx)
//   subscribes to the per-project broadcast channel `atelier:project:<id>:events`
//   and refreshes the lens shell on any event. It would work here too
//   structurally — same projectId, same supabase-browser client — but its
//   refresh-on-any-event semantics are tuned for the lens dashboard
//   (territories/contracts/contributions changing frequently); the prototype
//   harness only needs presence to be fresh, and heartbeat updates do NOT
//   currently emit broadcast events (sessions row updates are not in the
//   broadcast envelope contract). So even if LiveUpdater were mounted, it
//   wouldn't catch heartbeat-driven presence churn. Polling is the
//   pragmatic v1 mechanism.
//
//   SSE upgrade path: when the substrate gains a heartbeat-emit on
//   `atelier_session_heartbeat` (or a presence-specific channel), swap
//   the setInterval below for a LiveUpdater-style channel subscription.
//   Tracking note belongs in a future ADR; not blocking for Slice 6.

import { FunctionComponent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PresenceEntry } from '../../../../lib/atelier/lens-data';
import type { PresenceLoadResult } from '../../../../lib/atelier/presence-data';
import { Eyebrow, HelpTip } from '../../../../lib/atelier/design';

const POLL_INTERVAL_MS = 10_000;

interface PresencePanelProps {
  data: PresenceLoadResult;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const SURFACE_LABEL: Record<PresenceEntry['surface'], string> = {
  ide: 'IDE',
  web: 'WEB',
  terminal: 'TERM',
  passive: 'PASV',
};

export const PresencePanel: FunctionComponent<PresencePanelProps> = ({ data }) => {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);

  const { sessions, viewerComposerId } = data;
  const count = sessions.length;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-1.5">
          <Eyebrow className="text-ink-muted">Presence</Eyebrow>
          <HelpTip label="PRESENCE">
            Live count of other reviewers viewing this surface. Reads from
            the <code className="font-mono">sessions</code> table filtered
            by surface. Sign in to appear in the count.
          </HelpTip>
        </div>
        <div
          className="text-[10px] text-ink-subtle nums-tabular"
          data-testid="presence-count"
        >
          {count} active
        </div>
      </div>

      {count === 0 ? (
        <p className="text-[11px] text-ink-subtle opacity-70 italic">
          {data.ok
            ? 'No active sessions.'
            : data.reason === 'no_bearer' || data.reason === 'no_composer'
              ? 'Sign in to see who else is here.'
              : 'Presence unavailable.'}
        </p>
      ) : (
        <ul className="space-y-1" data-testid="presence-list">
          {sessions.map((s) => {
            const isViewer =
              viewerComposerId !== null && s.composerId === viewerComposerId;
            return (
              <li
                key={s.composerId}
                className={`flex items-center gap-2 text-[11px] leading-snug ${
                  isViewer ? 'text-ink-default' : 'text-ink-subtle'
                }`}
                data-testid="presence-chip"
                data-viewer={isViewer ? 'true' : undefined}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-mono ${
                    isViewer
                      ? 'border-ink-default bg-ink-default text-bg-base'
                      : 'border-rule bg-raised text-ink-muted'
                  }`}
                  aria-hidden="true"
                >
                  {initialsFor(s.composerName)}
                </span>
                <span className="truncate flex-1" title={s.composerEmail}>
                  {s.composerName}
                  {isViewer && (
                    <span className="ml-1 text-[10px] text-ink-subtle">(you)</span>
                  )}
                </span>
                <span
                  className="font-mono text-[9px] uppercase tracking-wide text-ink-subtle"
                  title={
                    s.agentClient
                      ? `surface=${s.surface} · agent=${s.agentClient}`
                      : `surface=${s.surface}`
                  }
                >
                  {SURFACE_LABEL[s.surface]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
