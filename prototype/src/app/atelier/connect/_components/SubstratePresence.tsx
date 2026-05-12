'use client';

// SubstratePresence - PR 3 live presence wiring.
//
// Server-rendered initial rows + client-side SSE subscription that
// triggers a server-action refresh on session.presence_changed
// envelopes. Same EventSource pattern as the Activity port; the
// router.refresh() call re-runs the page loader which re-reads
// loadPresenceData() and re-renders this section with the new row
// set.
//
// router.refresh() is preferred over maintaining client-side presence
// state because:
//   - presence rows include composer + session metadata that's costly
//     to keep in sync incrementally (composer lookup, surface change,
//     heartbeat drift)
//   - the substrate read is cheap (15-min window cap) and RLS-scoped
//   - refresh keeps SubstratePresence as a server component, preserving
//     the "substrate truth above the fold" guarantee even across
//     reconnects
//
// PR 3 audit-line: SSE channel scoped per project_id via Durable Object
// (ADR-055); refresh trigger is debounced so a burst of presence-change
// envelopes coalesces into one re-read.

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import type { ConnectViewModel } from '../../../../lib/atelier/connect-data.ts';

export function SubstratePresence({ viewModel }: { viewModel: ConnectViewModel }) {
  const { viewer, presence, presenceWindowMinutes } = viewModel;
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const projectId = viewer.projectId;
    if (!projectId) return;
    const es = new EventSource(
      `/api/events?project_id=${encodeURIComponent(projectId)}`,
    );
    es.onmessage = (ev) => {
      try {
        const env = JSON.parse(ev.data);
        // Only react to session-shaped events; presence-changed is
        // the canonical envelope but session.registered /
        // session.deregistered also imply a presence-list change.
        const kind: string = env.kind ?? '';
        if (!kind.startsWith('session.')) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        // 500ms coalesce window: a burst of envelopes on a new agent
        // session firing register + first heartbeat lands as one
        // refresh, not three.
        debounceRef.current = setTimeout(() => {
          router.refresh();
        }, 500);
      } catch {
        // ignore malformed envelope
      }
    };
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      es.close();
    };
  }, [viewer.projectId, router]);

  return (
    <section
      className="border-b border-rule bg-paper px-6 lg:px-10 py-4"
      aria-label="Substrate presence"
    >
      <div className="max-w-5xl mx-auto">
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <div className="flex items-baseline gap-3">
            <span className="label-eyebrow">Substrate presence</span>
            <span className="text-sm text-ink-muted nums-tabular">
              {presence.length === 0
                ? `no active sessions in the last ${presenceWindowMinutes}m`
                : `${presence.length} active in the last ${presenceWindowMinutes}m`}
            </span>
          </div>
          <span className="text-xs text-ink-subtle">
            live via /api/events
          </span>
        </div>

        {presence.length > 0 && (
          <ul className="border border-rule rounded-lg overflow-hidden bg-paper">
            {presence.slice(0, 30).map((s, i) => (
              <li
                key={`${s.composerId}-${s.surface}`}
                className={`px-4 py-2.5 flex items-center gap-3 ${i > 0 ? 'border-t border-rule' : ''}`}
              >
                <span className="w-2 h-2 rounded-full bg-success" title="live" />
                <span className="text-sm font-medium text-ink truncate">
                  {s.composerName}
                </span>
                <span className="text-xs font-mono text-ink-subtle">
                  {s.discipline ?? 'no-discipline'}
                </span>
                <span className="text-xs font-mono text-ink-subtle">
                  · {s.surface}
                </span>
                {s.agentClient && (
                  <span className="text-xs font-mono text-ink-subtle">
                    · {s.agentClient}
                  </span>
                )}
                <span className="ml-auto text-xs font-mono text-ink-subtle nums-tabular">
                  {formatRelative(s.heartbeatAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// PresenceEntry.heartbeatAt is typed as Date in the lens-data shape,
// but Next.js serializes Date to ISO string when a Server Component
// passes a prop to a Client Component. Accept either.
function formatRelative(value: Date | string): string {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  const diffSec = Math.round((Date.now() - ms) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.round(diffMin / 60)}h ago`;
}
