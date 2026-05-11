import { FunctionComponent } from 'react';
import { sessions, composers } from '../fixtures/seed';
import { AuthorBadge } from '../components/AuthorBadge';
import { Icon, type IconName } from '../components/Icon';
import { timeAgo } from '../lib/format';

/**
 * Connect (`/connect`) — Q5 resolution.
 *
 * Three anchored sub-surfaces, one route:
 *   #presence — who's online, what surface
 *   #systems  — external integrations (GitHub / Figma / Supabase Auth) health
 *   #chat     — embedded MCP chat (Q1: also reachable via global ⌘K)
 *
 * The chat surface is rendered as a primary anchored section here AND
 * accessible from any surface via keyboard shortcut. Per Q1 trigger:
 * if telemetry shows >70% of MCP chat invocations originate from
 * non-Connect surfaces, promote chat to a global drawer.
 */
export const Connect: FunctionComponent = () => {
  return (
    <div className="py-6 space-y-12">
      <header>
        <h1 className="font-display text-h1 font-semibold text-ink mb-1">Connect</h1>
        <p className="text-sm text-ink-muted max-w-prose">
          Presence, external integrations, and direct conversation with the substrate. The MCP chat
          surface eats own dogfood — explore Atelier's 18-tool surface in natural language.
        </p>
      </header>

      <Presence />
      <Systems />
      <Chat />
    </div>
  );
};

const Presence: FunctionComponent = () => (
  <section id="presence" className="scroll-mt-24">
    <header className="mb-3 pb-2 border-b border-rule">
      <h2 className="font-display text-h3 font-semibold text-ink">
        Presence
        <span className="ml-2 text-sm font-mono text-ink-subtle font-normal">{sessions.length}</span>
      </h2>
      <p className="text-xs text-ink-subtle mt-1">Sessions tiered by last activity.</p>
    </header>
    <ul className="border border-rule rounded-lg overflow-hidden bg-paper">
      {sessions.map((s, i) => {
        const c = composers.find(x => x.id === s.composer_id)!;
        return (
          <li key={s.id} className={`px-4 py-3 flex items-center gap-3 ${i > 0 ? 'border-t border-rule' : ''}`}>
            <span className="w-2 h-2 rounded-full bg-success" title="live" />
            <AuthorBadge sessionId={s.id} showName />
            <span className="text-xs text-ink-subtle ml-2 font-mono">
              {c.discipline}
            </span>
            {s.trace_ids && s.trace_ids.length > 0 && (
              <span className="text-xs text-ink-subtle font-mono">· {s.trace_ids.join(', ')}</span>
            )}
            <span className="ml-auto text-xs text-ink-subtle font-mono">{timeAgo(s.last_activity_at)}</span>
          </li>
        );
      })}
    </ul>
  </section>
);

const Systems: FunctionComponent = () => {
  const integrations: Array<{ name: string; icon: IconName; status: string; last: string; events: number }> = [
    { name: 'GitHub',         icon: 'Code2',    status: 'healthy', last: '32s ago',  events: 14 },
    { name: 'Figma',          icon: 'PenTool',  status: 'healthy', last: '4m ago',   events: 3 },
    { name: 'Supabase Auth',  icon: 'KeyRound', status: 'healthy', last: '12s ago',  events: 8 },
    { name: 'Cloudflare D1',  icon: 'Cloud',    status: 'pending', last: 'never',    events: 0 },
  ];
  return (
    <section id="systems" className="scroll-mt-24">
      <header className="mb-3 pb-2 border-b border-rule">
        <h2 className="font-display text-h3 font-semibold text-ink">External systems</h2>
        <p className="text-xs text-ink-subtle mt-1">Webhook + sync health for canonical-side-of-the-line tools.</p>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {integrations.map(i => (
          <div key={i.name} className="border border-rule rounded-lg bg-paper p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name={i.icon} size="md" className="text-ink-muted" />
              <p className="text-h4 font-semibold text-ink">{i.name}</p>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-1.5 h-1.5 rounded-full ${i.status === 'healthy' ? 'bg-success' : 'bg-warning'}`} />
              <span className="text-xs text-ink-muted capitalize">{i.status}</span>
            </div>
            <p className="text-xs text-ink-subtle nums-tabular">last sync · {i.last}</p>
            <p className="text-xs text-ink-subtle nums-tabular">{i.events} events / 1h</p>
          </div>
        ))}
      </div>
    </section>
  );
};

const Chat: FunctionComponent = () => (
  <section id="chat" className="scroll-mt-24">
    <header className="mb-3 pb-2 border-b border-rule flex items-baseline justify-between">
      <h2 className="font-display text-h3 font-semibold text-ink">MCP chat</h2>
      <span className="text-xs font-mono text-ink-subtle">⌘K from anywhere</span>
    </header>
    <div className="border border-rule rounded-lg bg-paper">
      <div className="p-4 border-b border-rule bg-raised">
        <p className="text-sm text-ink-muted">
          Talk to the substrate. The chat speaks Atelier's 18-tool MCP surface natively — ask it for
          context, propose a brainstorm, search the corpus, log a decision.
        </p>
      </div>
      <div className="p-6 space-y-4 min-h-[200px]">
        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-full bg-raised flex items-center justify-center text-xs font-mono text-ink-subtle shrink-0">A</div>
          <div className="flex-1">
            <p className="text-sm text-ink-muted">
              <span className="font-medium text-ink">atelier:</span> Hi. I have context on this project's contributions, decisions, and proposals. Try:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-ink-muted">
              <li><code className="font-mono text-xs bg-raised px-1.5 py-0.5 rounded">what's open in the broadcast territory?</code></li>
              <li><code className="font-mono text-xs bg-raised px-1.5 py-0.5 rounded">summarize the SSE proposal options</code></li>
              <li><code className="font-mono text-xs bg-raised px-1.5 py-0.5 rounded">find decisions about CF Workers</code></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="p-4 border-t border-rule">
        <input
          type="text"
          placeholder="Ask the substrate…"
          className="w-full px-3 py-2 border border-rule rounded-md bg-paper text-ink placeholder:text-ink-subtle"
        />
        <p className="text-xs text-ink-subtle mt-2 font-mono">PROPOSED · wires to Atelier MCP endpoint when deployed</p>
      </div>
    </div>
  </section>
);
