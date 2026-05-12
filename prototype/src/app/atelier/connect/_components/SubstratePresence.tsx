// SubstratePresence - substrate-real presence rows above the prototype
// Connect surface.
//
// Renders the actual `sessions` table rows (15-min heartbeat window,
// loadPresenceData() reader) so the viewer sees who's truly online
// before the prototype's fixture-driven Presence section below.
//
// PR 2 surfaces the rows as a count + compact list; live SSE-driven
// updates (subscribe to session.* events on /api/events) land in PR 3.

import type { ConnectViewModel } from '../../../../lib/atelier/connect-data.ts';

export function SubstratePresence({ viewModel }: { viewModel: ConnectViewModel }) {
  const { presence, presenceWindowMinutes } = viewModel;
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
          <span className="text-xs text-ink-subtle">live via /api/events (PR 3)</span>
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

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.round(diffMin / 60)}h ago`;
}
