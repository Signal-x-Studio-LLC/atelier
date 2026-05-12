'use client';

import { FunctionComponent, useEffect, useRef, useState, useTransition } from 'react';
import { Link } from '../lib/nav';
import { Icon, type IconName } from '../components/Icon';
import { composers } from '../fixtures/seed';

// Substrate-wire shape for the Propose action. The /atelier/compose mount
// passes onPropose to forward submissions to the propose MCP tool; the
// ADR-057 harness mount at /prototype/[project]/compose omits the prop
// and the form falls back to fixture-only no-op (DP-7 PROPOSED label
// surfaces in the sidebar).
export interface ComposeProposeSubmit {
  title: string;
  bodyMarkdown: string;
  territoryId: string | null;
  traceIds: string[];
  options: Array<{ id: string; label: string; tradeoffs?: string }>;
}
export interface ComposeProposeResult {
  ok: boolean;
  proposalId: string | null;
  error: { code: string; message: string } | null;
}
// Substrate-real presence row shape for the avatar stack. Provided by
// the /atelier/compose mount; the harness mount at /prototype/[project]/
// compose omits the prop and PresenceStack falls back to the fixture
// composers from fixtures/seed.
export interface ComposePresenceEntry {
  id: string;
  initial: string;
  displayName: string;
  color: string;
}

// Substrate-real read-mode proposal shape. When provided, ReadModeCanvas
// renders this proposal's title + options + reaction-count instead of
// the hardcoded SSE-fanout example. The /atelier/compose Phase 3 polish
// loader fetches the most-recent open proposal (or one selected via
// ?id=... in a future iteration) and threads it here.
export interface ComposeReadModeProposal {
  id: string;
  title: string;
  bodyMarkdown: string;
  options: Array<{ id: string; label: string; tradeoffs?: string }>;
  reactionCount: number;
  traceIds: string[];
  territoryId: string | null;
}

export interface ComposeProps {
  onPropose?: (input: ComposeProposeSubmit) => Promise<ComposeProposeResult>;
  presenceCoAuthors?: ComposePresenceEntry[];
  readModeProposal?: ComposeReadModeProposal | null;
}

/**
 * Compose (`/compose`) — the wedge per DP-7.
 *
 * Q2 resolution: unified Compose surface with action-type selector at top.
 * Four actions, one route, tabs to switch between forms. Matches Hive's
 * empirical pattern; lower IA cost than four separate routes.
 *
 * DP-3 — every brainstorm primitive surfaces as a structured artifact, not
 * a thread. The Propose form has structured fields (title + options),
 * never a free-form text body.
 *
 * PROPOSED: depends on Atelier substrate brainstorm pipeline (~2 wk per
 * substrate-inventory.md). Submit handlers are no-ops in the prototype;
 * forms validate locally and would `POST /api/mcp/propose` etc. against
 * the eventual substrate.
 */

type ActionType = 'propose' | 'claim' | 'log_decision' | 'checkpoint';

const ACTIONS: Array<{ id: ActionType; label: string; loop: 'brainstorm' | 'execute' | 'continuity'; desc: string; icon: IconName }> = [
  { id: 'propose',      label: 'Propose',      loop: 'brainstorm', icon: 'MessageSquarePlus', desc: 'Post a structured option set with tradeoffs.' },
  { id: 'claim',        label: 'Claim',        loop: 'execute',    icon: 'Hand',              desc: 'Take ownership of a contribution. Acquire locks.' },
  { id: 'log_decision', label: 'Log Decision', loop: 'continuity', icon: 'FileText',          desc: 'Write an ADR to the repo + datastore atomically.' },
  { id: 'checkpoint',   label: 'Checkpoint',   loop: 'continuity', icon: 'Bookmark',          desc: 'Save session state for resume across hours.' },
];

export const Compose: FunctionComponent<ComposeProps> = ({
  onPropose,
  presenceCoAuthors,
  readModeProposal,
}) => {
  const [action, setAction] = useState<ActionType>('propose');
  // DP-13 canvas-vs-chrome contract (Makeswift-derived).
  // Edit  = chrome visible (tabs + sidebar + structured form fields).
  // Read  = chrome collapsed; artifact reads as the eventual published shape.
  const [mode, setMode] = useState<'edit' | 'read'>('edit');

  // DP-13 multiplayer presence -- overlapping avatar stack of co-authors.
  // Substrate-real entries arrive via the presenceCoAuthors prop; absence
  // falls back to the prototype fixture so the harness mount stays
  // visually intact without substrate dependence.
  const coAuthors: ComposePresenceEntry[] = presenceCoAuthors
    ? presenceCoAuthors
    : composers.slice(0, 3).map((c) => ({
        id: c.id,
        initial: c.display_name.charAt(0),
        displayName: c.display_name,
        color: c.avatar_color,
      }));

  if (mode === 'read') {
    return (
      <ReadModeView mode={mode} onModeChange={setMode} coAuthors={coAuthors} proposal={readModeProposal ?? null} />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 py-6">
      <section className="lg:col-span-2">
        <header className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 mb-2">
            <h1 className="font-display text-h1 font-semibold text-ink">Compose</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <PresenceStack coAuthors={coAuthors} />
              <ModeToggle mode={mode} onModeChange={setMode} />
            </div>
          </div>
          <p className="text-sm text-ink-muted max-w-prose">
            Author into the substrate. Every action lands as a queryable artifact — proposals are structured
            with options and tradeoffs; decisions are markdown to the repo; checkpoints save your seat.
          </p>
        </header>

        {/* Action-type selector — Q2 resolution */}
        <div className="border-b border-rule mb-6 flex gap-1 -mx-1 overflow-x-auto">
          {ACTIONS.map(a => (
            <button
              key={a.id}
              type="button"
              data-testid={`compose-action-tab-${a.id}`}
              role="tab"
              aria-selected={action === a.id}
              onClick={() => setAction(a.id)}
              className={[
                'px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors inline-flex items-center gap-2',
                action === a.id
                  ? 'border-primary text-ink font-semibold'
                  : 'border-transparent text-ink-muted hover:text-ink',
              ].join(' ')}
            >
              <Icon name={a.icon} size="sm" />
              <span className={`loop-dot loop-dot--${a.loop}`} />
              {a.label}
            </button>
          ))}
        </div>

        {action === 'propose' && <ProposeForm onSubmit={onPropose} />}
        {action === 'claim' && <ClaimForm />}
        {action === 'log_decision' && <DecisionForm />}
        {action === 'checkpoint' && <CheckpointForm />}
      </section>

      <aside className="lg:col-span-1 space-y-4">
        <div className="border border-rule rounded-lg bg-paper p-5">
          <h3 className="text-h4 font-semibold text-ink mb-2">{ACTIONS.find(a => a.id === action)?.label}</h3>
          <p className="text-sm text-ink-muted leading-relaxed mb-4">{ACTIONS.find(a => a.id === action)?.desc}</p>
          <div className="label-eyebrow">
            <span>substrate tool</span>
            <span className="mx-1 opacity-50">·</span>
            <span className="font-mono normal-case tracking-normal">{action === 'log_decision' ? 'log_decision' : action}</span>
          </div>
        </div>
        {action === 'propose' && (
          <div className="border border-rule rounded-lg bg-raised p-5 text-sm text-ink-muted leading-relaxed">
            <p className="font-medium text-ink mb-1">Why structured?</p>
            <p>
              Per DP-3, brainstorm primitives are structured deliberation, not chat. Title + options + tradeoffs
              produce auditable artifacts; reactions land inline; syntheses are derived canvases.
            </p>
            <p className="mt-3">
              <Link to="/atlas?facet=proposal" className="text-primary no-underline hover:underline">See past proposals →</Link>
            </p>
          </div>
        )}
        <div className="text-xs text-ink-subtle font-mono leading-relaxed">
          <p className="label-eyebrow mb-1">PROPOSED</p>
          <p>This surface depends on the brainstorm pipeline shipping in the Atelier substrate (~2 wk per substrate-inventory.md). The prototype validates locally; no network calls.</p>
        </div>
      </aside>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Propose — the brainstorm primitive (ADR-054)
// ---------------------------------------------------------------------------
interface ProposeFormProps {
  onSubmit?: (input: ComposeProposeSubmit) => Promise<ComposeProposeResult>;
}

const ProposeForm: FunctionComponent<ProposeFormProps> = ({ onSubmit }) => {
  const [title, setTitle] = useState('');
  const [territory, setTerritory] = useState('strategy');
  const [traceId, setTraceId] = useState('');
  const [options, setOptions] = useState<Array<{ label: string; tradeoffs: string }>>([
    { label: '', tradeoffs: '' },
    { label: '', tradeoffs: '' },
  ]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const addOption = () => setOptions(o => [...o, { label: '', tradeoffs: '' }]);
  const removeOption = (i: number) => setOptions(o => o.filter((_, idx) => idx !== i));
  const updateOption = (i: number, key: 'label' | 'tradeoffs', value: string) =>
    setOptions(o => o.map((opt, idx) => (idx === i ? { ...opt, [key]: value } : opt)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmit) return;
    setError(null);
    setSuccess(null);
    const payload: ComposeProposeSubmit = {
      title,
      bodyMarkdown: body,
      // Territory is a UI affordance only in S1 -- the form's dropdown
      // is a slug, not a substrate territory_id. PR 3 forwards null and
      // lets the substrate place the proposal in the project's default
      // territory bucket; territory-id wiring follows when /atelier/inbox
      // surfaces territory affordances in Slice 2.
      territoryId: null,
      traceIds: traceId.trim().length > 0 ? [traceId.trim()] : [],
      options: options
        .filter(o => o.label.trim().length > 0)
        .map((o, i) => ({
          id: String.fromCharCode(65 + i),
          label: o.label,
          ...(o.tradeoffs.trim().length > 0 ? { tradeoffs: o.tradeoffs } : {}),
        })),
    };
    startTransition(async () => {
      const result = await onSubmit(payload);
      if (result.ok) {
        setSuccess('Proposal posted.');
        setTitle('');
        setBody('');
        setTraceId('');
        setOptions([{ label: '', tradeoffs: '' }, { label: '', tradeoffs: '' }]);
      } else {
        setError(result.error?.message ?? 'Unknown error.');
      }
    });
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Field label="Title" hint="One sentence. The question, not a vibe.">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="SSE fan-out: in-memory subscriber map vs. Durable Object"
          className="w-full px-3 py-2 border border-rule rounded-md bg-paper text-ink placeholder:text-ink-subtle"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Territory">
          <select
            value={territory}
            onChange={(e) => setTerritory(e.target.value)}
            className="w-full px-3 py-2 border border-rule rounded-md bg-paper text-ink"
          >
            <option value="strategy">strategy</option>
            <option value="auth">auth</option>
            <option value="broadcast">broadcast</option>
            <option value="design">design</option>
          </select>
        </Field>
        <Field label="Trace ID" hint="US-X.Y or BRD:Epic-N">
          <input
            type="text"
            value={traceId}
            onChange={(e) => setTraceId(e.target.value)}
            placeholder="US-9.1"
            className="w-full px-3 py-2 border border-rule rounded-md bg-paper text-ink font-mono text-sm placeholder:text-ink-subtle"
          />
        </Field>
      </div>

      <Field label="Body" hint="Markdown. Frame the problem; don't propose the solution here — that's the options.">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Current `BroadcastService` interface ships with no implementation in production…"
          className="w-full px-3 py-2 border border-rule rounded-md bg-paper text-ink placeholder:text-ink-subtle resize-none"
        />
      </Field>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <label className="text-sm font-medium text-ink">Options</label>
          <span className="text-xs text-ink-subtle">Minimum 2 · structured per DP-3</span>
        </div>
        <div className="space-y-3">
          {options.map((opt, i) => (
            <div key={i} className="border border-rule rounded-md bg-paper p-3 grid grid-cols-[auto_1fr_auto] gap-3 items-start">
              <span className="font-mono text-xs text-ink-subtle pt-2 w-6">{String.fromCharCode(65 + i)}</span>
              <div className="space-y-2">
                <input
                  type="text"
                  value={opt.label}
                  onChange={(e) => updateOption(i, 'label', e.target.value)}
                  placeholder="Option label"
                  className="w-full px-2 py-1.5 border border-rule rounded text-sm placeholder:text-ink-subtle"
                />
                <input
                  type="text"
                  value={opt.tradeoffs}
                  onChange={(e) => updateOption(i, 'tradeoffs', e.target.value)}
                  placeholder="Tradeoffs — what's good, what's not"
                  className="w-full px-2 py-1.5 border border-rule rounded text-xs text-ink-muted placeholder:text-ink-subtle"
                />
              </div>
              <button
                type="button"
                onClick={() => removeOption(i)}
                disabled={options.length <= 2}
                className="text-ink-subtle hover:text-error disabled:opacity-30 disabled:cursor-not-allowed text-sm pt-2"
                aria-label={`Remove option ${String.fromCharCode(65 + i)}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addOption}
          className="mt-3 text-sm text-primary hover:underline"
        >
          + Add option
        </button>
      </div>

      {error && (
        <div role="alert" className="border border-rule rounded-md bg-paper px-3 py-2 text-sm text-error">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="border border-rule rounded-md bg-paper px-3 py-2 text-sm text-success">
          {success}
        </div>
      )}
      <div className="flex items-center gap-3 pt-4 border-t border-rule">
        <button
          type="submit"
          disabled={!title || options.filter(o => o.label).length < 2 || isPending || !onSubmit}
          className="bg-primary text-ink-inverse px-4 py-2 rounded-md font-medium text-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? 'Posting...' : 'Post proposal'}
        </button>
        <span className="text-xs text-ink-subtle">
          {onSubmit
            ? <>Will broadcast to all sessions in territory <code className="font-mono">{territory}</code></>
            : <>Fixture form -- live wiring lives at <code className="font-mono">/atelier/compose</code></>}
        </span>
      </div>
    </form>
  );
};

// Lightweight placeholders for the other three actions — full Compose treatment in Stage 3 PR
const ClaimForm: FunctionComponent = () => (
  <PlaceholderForm
    title="Claim a contribution"
    body="Atomic create-and-claim per ADR-022. Pick an open contribution or create one with a content stub; the substrate enforces fencing-token locks on conflicting artifact scopes."
    cta="Claim"
  />
);

const DecisionForm: FunctionComponent = () => (
  <PlaceholderForm
    title="Log a decision"
    body="Writes an ADR to docs/architecture/decisions/ in the repo and a row to the decisions table atomically. find_similar runs against the new entry on submit."
    cta="Log decision"
  />
);

const CheckpointForm: FunctionComponent = () => (
  <PlaceholderForm
    title="Checkpoint this session"
    body="Save session state hash + token-budget marker so the session can resume across hours. Borrowed pattern from Hive's session_checkpoints; missing in current Atelier substrate."
    cta="Save checkpoint"
  />
);

const PlaceholderForm: FunctionComponent<{ title: string; body: string; cta: string }> = ({ title, body, cta }) => (
  <div className="border border-rule rounded-lg bg-paper p-6">
    <h3 className="font-display text-h3 font-semibold text-ink mb-2">{title}</h3>
    <p className="text-sm text-ink-muted leading-relaxed mb-5 max-w-prose">{body}</p>
    <button
      type="button"
      className="bg-primary text-ink-inverse px-4 py-2 rounded-md font-medium text-sm hover:bg-[var(--color-primary-hover)]"
    >
      {cta}
    </button>
    <p className="label-eyebrow mt-4">
      PROPOSED · full form in next prototype iteration
    </p>
  </div>
);

// ───────────────────────────────────────────────────────────────────────────
// DP-13 — canvas-vs-chrome contract primitives
// ───────────────────────────────────────────────────────────────────────────

// ReadModeView preserves keyboard focus on entry: the Read canvas root
// receives focus once on mount via the ref+useEffect below so the SR
// announces the document role and a keyboard user does not lose
// position when the Edit-mode toggle button unmounts.
const ReadModeView: FunctionComponent<{
  mode: 'edit' | 'read';
  onModeChange: (m: 'edit' | 'read') => void;
  coAuthors: ComposePresenceEntry[];
  proposal: ComposeReadModeProposal | null;
}> = ({ mode, onModeChange, coAuthors, proposal }) => {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    canvasRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      ref={canvasRef}
      tabIndex={-1}
      className="py-6 max-w-3xl mx-auto focus:outline-none"
      data-testid="compose-read-canvas"
      role="document"
    >
      <ReadModeToolbar mode={mode} onModeChange={onModeChange} coAuthors={coAuthors} />
      <ReadModeCanvas proposal={proposal} />
    </div>
  );
};

const ModeToggle: FunctionComponent<{ mode: 'edit' | 'read'; onModeChange: (m: 'edit' | 'read') => void }> = ({ mode, onModeChange }) => (
  <div className="inline-flex border border-rule rounded-md overflow-hidden bg-paper" role="group" aria-label="Compose view mode">
    <button
      type="button"
      data-testid="compose-mode-toggle-edit"
      onClick={() => onModeChange('edit')}
      aria-pressed={mode === 'edit'}
      className={`px-2.5 py-1 text-xs inline-flex items-center gap-1.5 ${mode === 'edit' ? 'bg-raised text-ink font-semibold' : 'text-ink-muted hover:text-ink'}`}
    >
      <Icon name="Pencil" size="xs" />
      Edit
    </button>
    <button
      type="button"
      data-testid="compose-mode-toggle-read"
      onClick={() => onModeChange('read')}
      aria-pressed={mode === 'read'}
      className={`px-2.5 py-1 text-xs inline-flex items-center gap-1.5 border-l border-rule ${mode === 'read' ? 'bg-raised text-ink font-semibold' : 'text-ink-muted hover:text-ink'}`}
    >
      <Icon name="Eye" size="xs" />
      Read
    </button>
  </div>
);

const PresenceStack: FunctionComponent<{ coAuthors: ComposePresenceEntry[] }> = ({ coAuthors }) => (
  <div className="inline-flex items-center" aria-label={`${coAuthors.length} co-authors on this canvas`}>
    <div className="flex -space-x-1.5" data-testid="compose-presence-stack">
      {coAuthors.map(c => (
        <div
          key={c.id}
          data-testid="compose-presence-avatar"
          aria-label={`${c.displayName}, co-authoring`}
          className="w-6 h-6 rounded-full ring-2 ring-paper flex items-center justify-center text-[10px] font-semibold text-ink-inverse"
          style={{ backgroundColor: c.color }}
          title={`${c.displayName} · co-authoring`}
        >
          {c.initial}
        </div>
      ))}
    </div>
    <span className="ml-2 text-xs text-ink-subtle nums-tabular">{coAuthors.length} editing</span>
  </div>
);

const ReadModeToolbar: FunctionComponent<{ mode: 'edit' | 'read'; onModeChange: (m: 'edit' | 'read') => void; coAuthors: ComposePresenceEntry[] }> = ({ mode, onModeChange, coAuthors }) => (
  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-6 pb-3 border-b border-rule">
    <div className="min-w-0">
      <p className="label-eyebrow mb-1">PROPOSAL · US-9.1 · broadcast</p>
      <p className="text-xs text-ink-muted">DP-13 read mode — chrome collapsed; canvas reads as the published shape</p>
    </div>
    <div className="flex items-center gap-3 flex-wrap">
      <PresenceStack coAuthors={coAuthors} />
      <ModeToggle mode={mode} onModeChange={onModeChange} />
    </div>
  </div>
);

// Read-mode canvas. When a substrate-real proposal arrives via the
// readModeProposal prop, render its title + body + options + reaction
// count. Without the prop (harness mount), the SSE-fanout fixture
// content displays as a visual reference for DP-13 read shape.
const ReadModeCanvas: FunctionComponent<{ proposal: ComposeReadModeProposal | null }> = ({ proposal }) => {
  if (proposal) {
    return (
      <article className="prose-like">
        {proposal.traceIds.length > 0 && (
          <p className="label-eyebrow mb-2">PROPOSAL · {proposal.traceIds.join(' · ')}</p>
        )}
        <h1 className="font-display text-h1 font-semibold leading-tight text-ink mb-3">
          {proposal.title}
        </h1>
        {proposal.bodyMarkdown && (
          <p className="text-base text-ink-muted leading-relaxed mb-8 whitespace-pre-line">
            {proposal.bodyMarkdown}
          </p>
        )}
        {proposal.options.length > 0 && (
          <>
            <h2 className="font-display text-h2 font-semibold text-ink mb-3">Options</h2>
            <ol className="space-y-3 mb-8">
              {proposal.options.map((opt) => (
                <li key={opt.id} className="border border-rule rounded-md bg-paper p-4">
                  <p className="font-medium text-ink mb-0.5">
                    <span className="font-mono text-sm text-ink-subtle mr-2">{opt.id}</span>
                    {opt.label}
                  </p>
                  {opt.tradeoffs && (
                    <p className="text-sm text-ink-muted">{opt.tradeoffs}</p>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
        <p className="label-eyebrow mb-2 nums-tabular">
          {proposal.reactionCount === 0
            ? 'no reactions yet'
            : `${proposal.reactionCount} reaction${proposal.reactionCount === 1 ? '' : 's'}`}
        </p>
      </article>
    );
  }
  return (
    <article className="prose-like">
      <h1 className="font-display text-h1 font-semibold leading-tight text-ink mb-3">
        SSE fan-out: in-memory subscriber map vs. Durable Object
      </h1>
      <p className="text-base text-ink-muted leading-relaxed mb-8">
        Current <code className="font-mono text-sm bg-raised px-1.5 py-0.5 rounded">BroadcastService</code> interface ships with no implementation in production. We need to pick the SSE fan-out shape before <code className="font-mono text-sm bg-raised px-1.5 py-0.5 rounded">/api/events</code> lands.
      </p>
      <h2 className="font-display text-h2 font-semibold text-ink mb-3">Options</h2>
      <ol className="space-y-3 mb-8">
        {[
          { id: 'A', label: 'Durable Object per project', tradeoffs: 'Higher cold-start; clean isolation; ready for multi-isolate scale.' },
          { id: 'B', label: 'In-memory map per Worker isolate', tradeoffs: 'Simpler; matches Hive\'s pattern; needs upgrade path documented.' },
          { id: 'C', label: 'Pub/sub via external (Upstash etc.)', tradeoffs: 'Adds vendor; cleanest fan-out; conflicts with ADR-052 CF-primary.' },
        ].map(opt => (
          <li key={opt.id} className="border border-rule rounded-md bg-paper p-4">
            <p className="font-medium text-ink mb-0.5">
              <span className="font-mono text-sm text-ink-subtle mr-2">{opt.id}</span>
              {opt.label}
            </p>
            <p className="text-sm text-ink-muted">{opt.tradeoffs}</p>
          </li>
        ))}
      </ol>
      <p className="label-eyebrow mb-2">3 reactions</p>
      <ul className="space-y-2 text-sm text-ink-muted">
        <li>· <strong className="text-ink">Rae</strong> raised a concern: &ldquo;B unblocks v1; A is right but ships in v1.x.&rdquo;</li>
        <li>· <strong className="text-ink">Jun</strong> endorsed option B.</li>
        <li>· <strong className="text-ink">Rae (agent)</strong> asked: &ldquo;What is the latency budget for option C?&rdquo;</li>
      </ul>
    </article>
  );
};

const Field: FunctionComponent<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block">
    <span className="text-sm font-medium text-ink mb-1 block">{label}</span>
    {children}
    {hint && <span className="text-xs text-ink-subtle mt-1 block">{hint}</span>}
  </label>
);
