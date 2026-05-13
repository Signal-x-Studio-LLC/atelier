/**
 * Seed demo data for the prototype.
 *
 * DP-7 + Q6 resolution: cold visitors land on a populated dashboard with a
 * removable banner ("Demo data. Run `atelier seed --remove` to clear.").
 * This counters the failure mode named in for-reviewers.md ("/atelier
 * dashboard is empty in the live deploy").
 *
 * The seed is shaped to demonstrate the principles in action:
 *   - Action-shaped Inbox sections each populate (DP-1)
 *   - Mix of human + agent authorship to exercise the filter (DP-2)
 *   - Brainstorm + execute + continuity loop coverage (DP-8)
 *   - Velocity high enough that trend-weighting matters (DP-4)
 */

import type {
  Composer,
  Session,
  Contribution,
  Proposal,
  Reaction,
  Decision,
  Lock,
  ActivityEvent,
} from '../lib/types';

// ADR-060 PR E: avatar_color values reference design tokens via CSS
// custom properties (`var(--color-*)`). The discipline -> tone mapping
// mirrors prototype/src/lib/atelier/compose-data.ts:pickAvatarColor's
// AVATAR_PALETTE but binds each composer to a stable token so the demo
// reads consistently with the substrate's live composer avatars.
// Tokens are emitted by prototype/src/lib/atelier/design/globals.css
// and swap under .dark for free.
export const composers: Composer[] = [
  { id: 'c-nino', display_name: 'Nino Chavez', handle: 'nino', discipline: 'analyst', avatar_color: 'var(--color-primary)' },
  { id: 'c-rae',  display_name: 'Rae Ortega',  handle: 'rae',  discipline: 'dev',      avatar_color: 'var(--color-error)' },
  { id: 'c-jun',  display_name: 'Jun Park',    handle: 'jun',  discipline: 'pm',       avatar_color: 'var(--color-loop-execute)' },
  { id: 'c-ada',  display_name: 'Ada Wren',    handle: 'ada',  discipline: 'designer', avatar_color: 'var(--color-loop-continuity)' },
];

export const sessions: Session[] = [
  { id: 's-1', composer_id: 'c-nino', surface: 'web',      author_kind: 'composer', last_activity_at: '2026-05-10T19:42:00Z' },
  { id: 's-2', composer_id: 'c-rae',  surface: 'ide',      author_kind: 'composer', last_activity_at: '2026-05-10T19:39:00Z' },
  { id: 's-3', composer_id: 'c-jun',  surface: 'web',      author_kind: 'composer', last_activity_at: '2026-05-10T19:35:00Z' },
  { id: 's-4', composer_id: 'c-rae',  surface: 'ide',      author_kind: 'agent',    last_activity_at: '2026-05-10T19:41:00Z', trace_ids: ['US-3.2'] },
  { id: 's-5', composer_id: 'c-nino', surface: 'terminal', author_kind: 'agent',    last_activity_at: '2026-05-10T19:30:00Z', trace_ids: ['US-7.1'] },
  { id: 's-6', composer_id: 'c-ada',  surface: 'passive',  author_kind: 'composer', last_activity_at: '2026-05-10T19:18:00Z' },
];

export const contributions: Contribution[] = [
  { id: 'co-1', trace_id: 'US-3.2', kind: 'implementation', state: 'in_progress', territory: 'auth',     title: 'Wire AsyncLocalStorage role propagation through MCP dispatch', author_session_id: 's-2', loop: 'execute',    created_at: '2026-05-10T17:02:00Z', updated_at: '2026-05-10T19:39:00Z' },
  { id: 'co-2', trace_id: 'US-3.2', kind: 'implementation', state: 'claimed',     territory: 'auth',     title: 'RLS policy parity audit for proposal_reactions', author_session_id: 's-4', loop: 'execute',    created_at: '2026-05-10T18:11:00Z', updated_at: '2026-05-10T19:41:00Z' },
  { id: 'co-3', trace_id: 'US-7.1', kind: 'research',       state: 'review',      territory: 'strategy', title: 'Sentry trend-weighted sort — applicability to Activity feed', author_session_id: 's-5', loop: 'continuity', created_at: '2026-05-10T16:45:00Z', updated_at: '2026-05-10T19:08:00Z' },
  { id: 'co-4', trace_id: 'US-2.5', kind: 'design',         state: 'review',      territory: 'design',   title: 'Coordination strip — typographic treatment in dark mode', author_session_id: 's-6', loop: 'execute',    created_at: '2026-05-10T15:22:00Z', updated_at: '2026-05-10T18:50:00Z' },
  { id: 'co-5', trace_id: 'US-9.1', kind: 'implementation', state: 'blocked',     territory: 'broadcast', title: '/api/events SSE endpoint — Cloudflare Worker stream limits', author_session_id: 's-2', loop: 'execute',    created_at: '2026-05-09T22:18:00Z', updated_at: '2026-05-10T11:04:00Z' },
];

export const reactions: Reaction[] = [
  { id: 'r-1', proposal_id: 'pr-1', session_id: 's-3', kind: 'endorse',       created_at: '2026-05-10T17:30:00Z' },
  { id: 'r-2', proposal_id: 'pr-1', session_id: 's-2', kind: 'concern',       body_markdown: 'B unblocks v1; A is right but ships in v1.x.', created_at: '2026-05-10T17:42:00Z' },
  { id: 'r-3', proposal_id: 'pr-1', session_id: 's-4', kind: 'clarification', body_markdown: 'What is the latency budget for option C?', created_at: '2026-05-10T18:01:00Z' },
  { id: 'r-4', proposal_id: 'pr-2', session_id: 's-1', kind: 'vote',          vote_for_option_id: 'opt-b', created_at: '2026-05-10T19:20:00Z' },
];

export const proposals: Proposal[] = [
  {
    id: 'pr-1',
    trace_id: 'US-9.1',
    territory: 'broadcast',
    title: 'SSE fan-out: in-memory subscriber map vs. Durable Object',
    body_markdown:
      'Current `BroadcastService` interface ships with no implementation in production. We need to pick the SSE fan-out shape before /api/events lands.',
    options: [
      { id: 'opt-a', label: 'Durable Object per project',         tradeoffs: 'Higher cold-start; clean isolation; ready for multi-isolate scale.' },
      { id: 'opt-b', label: 'In-memory map per Worker isolate',   tradeoffs: 'Simpler; matches Hive\'s pattern; needs upgrade path documented.' },
      { id: 'opt-c', label: 'Pub/sub via external (Upstash etc.)', tradeoffs: 'Adds vendor; cleanest fan-out; conflicts with ADR-052 CF-primary.' },
    ],
    state: 'open',
    author_session_id: 's-1',
    reactions: [],
    created_at: '2026-05-10T17:15:00Z',
  },
  {
    id: 'pr-2',
    trace_id: 'US-7.1',
    territory: 'strategy',
    title: 'Activity feed default sort: recency vs. trend-weighted',
    body_markdown:
      'Stage 1 research lands DP-4 (trend-weighting mandatory at velocity). Locking Activity\'s default sort: trend-weighted vs. recency vs. user-toggle-with-recency-default.',
    options: [
      { id: 'opt-a', label: 'Trend-weighted default',     tradeoffs: 'Right at high N; cold projects look stale.' },
      { id: 'opt-b', label: 'Recency default, trend opt', tradeoffs: 'Fits cold-start; loses signal at high velocity.' },
      { id: 'opt-c', label: 'Adaptive (event volume)',     tradeoffs: 'Clever; less predictable; harder to test.' },
    ],
    state: 'open',
    author_session_id: 's-3',
    reactions: [],
    created_at: '2026-05-10T19:02:00Z',
  },
  {
    id: 'pr-3',
    trace_id: 'US-2.5',
    territory: 'design',
    title: 'Coordination strip — should locks count include released-in-last-N-min?',
    body_markdown:
      'DP-5 strip shows `locks: N held`. Open question: do we include locks released in the last 60s (showing churn) or only currently-held?',
    options: [
      { id: 'opt-a', label: 'Currently-held only', tradeoffs: 'Matches Hive; cleaner; loses churn signal.' },
      { id: 'opt-b', label: 'Held + recent-60s',   tradeoffs: 'Shows lock churn; more useful for dev lens; adds complexity.' },
    ],
    state: 'synthesized',
    author_session_id: 's-6',
    reactions: [],
    created_at: '2026-05-10T15:48:00Z',
    synthesized_at: '2026-05-10T18:10:00Z',
  },
];

// Wire reactions into proposals (FK denormalization for client convenience)
proposals[0]!.reactions = reactions.filter(r => r.proposal_id === 'pr-1');
proposals[1]!.reactions = reactions.filter(r => r.proposal_id === 'pr-2');

export const decisions: Decision[] = [
  { id: 'd-1', trace_id: 'US-9.1', category: 'architecture', title: 'Adopt SSE push, supersede Supabase Realtime',           body_markdown: 'Per ADR-055.', composer_id: 'c-nino', created_at: '2026-05-10T00:00:00Z' },
  { id: 'd-2', trace_id: 'BRD:Epic-2', category: 'architecture', title: 'Adopt brainstorm primitives from Hive (12→18 tools)', body_markdown: 'Per ADR-054.', composer_id: 'c-nino', created_at: '2026-05-10T00:00:00Z' },
  { id: 'd-3', trace_id: 'BRD:Epic-1', category: 'strategic',  title: 'Atelier and Hive paired-by-design',                    body_markdown: 'Per ADR-053.', composer_id: 'c-nino', created_at: '2026-05-10T00:00:00Z' },
];

export const locks: Lock[] = [
  { id: 'lk-1', artifact_scope: 'src/auth/dispatch.ts',   fencing_token: 47, held_by_session_id: 's-2', acquired_at: '2026-05-10T19:31:00Z' },
  { id: 'lk-2', artifact_scope: 'docs/architecture/ARCHITECTURE.md#section-6.8', fencing_token: 12, held_by_session_id: 's-4', acquired_at: '2026-05-10T19:38:00Z' },
];

// Activity feed — chronologically ordered, mixed events
export const activity: ActivityEvent[] = [
  { kind: 'proposal.reacted',     at: '2026-05-10T19:20:00Z', proposal: proposals[1]!, reaction: reactions[3]! },
  { kind: 'lock.acquired',        at: '2026-05-10T19:38:00Z', lock: locks[1]! },
  { kind: 'contribution.claimed', at: '2026-05-10T19:41:00Z', contribution: contributions[1]! },
  { kind: 'proposal.created',     at: '2026-05-10T19:02:00Z', proposal: proposals[1]! },
  { kind: 'synthesis.created',    at: '2026-05-10T18:10:00Z', proposal: proposals[2]! },
  { kind: 'proposal.reacted',     at: '2026-05-10T18:01:00Z', proposal: proposals[0]!, reaction: reactions[2]! },
  { kind: 'proposal.reacted',     at: '2026-05-10T17:42:00Z', proposal: proposals[0]!, reaction: reactions[1]! },
  { kind: 'proposal.reacted',     at: '2026-05-10T17:30:00Z', proposal: proposals[0]!, reaction: reactions[0]! },
  { kind: 'proposal.created',     at: '2026-05-10T17:15:00Z', proposal: proposals[0]! },
  { kind: 'lock.acquired',        at: '2026-05-10T19:31:00Z', lock: locks[0]! },
  { kind: 'session.registered',   at: '2026-05-10T19:18:00Z', session: sessions[5]! },
  { kind: 'decision.logged',      at: '2026-05-10T16:30:00Z', decision: decisions[0]! },
];

/**
 * Q7 resolution: ?scale=N clones entities N× with rewritten FK maps.
 * Gates ux-ui-auditor Phase 8 scale-budget validation in CI.
 *
 * For prototype simplicity we only scale the activity feed + contributions;
 * proposals stay singular so the deliberation surface stays comprehensible
 * at any scale.
 */
export function scaleSeed(scale: number) {
  if (scale <= 1) return { contributions, activity };
  const out = {
    contributions: [] as Contribution[],
    activity: [] as ActivityEvent[],
  };
  for (let i = 0; i < scale; i++) {
    const offset = i * 1000;
    contributions.forEach((c, idx) => {
      out.contributions.push({ ...c, id: `co-${offset + idx + 1}`, title: `${c.title} (${i + 1})` });
    });
    activity.forEach(e => out.activity.push({ ...e }));
  }
  return out;
}

export const SESSION = sessions[0]!;   // pretend the current viewer is Nino
export const ME = composers[0]!;
