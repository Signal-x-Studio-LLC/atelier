/**
 * SSE envelope -> ActivityEvent bridge.
 *
 * The substrate emits BroadcastEnvelope shapes (per
 * scripts/coordination/lib/broadcast.ts). The dashboard fixture uses a
 * sibling ActivityEvent type tuned for prototype rendering. This module
 * converts envelopes to ActivityEvents for the Activity timeline.
 *
 * Why a separate translator: the substrate's event kinds are canonical
 * (`contribution.state_changed` covers claim/update/release transitions)
 * while the prototype's kinds are display-tuned (`contribution.claimed`,
 * `contribution.released`). The bridge lets us evolve the substrate
 * without breaking the prototype's existing fixture-driven shape.
 *
 * Fields not present on the substrate envelope (trace_id, title,
 * territory) are filled with placeholder values; the prototype shows
 * them as "<unknown>" until the Activity surface backfills via
 * canonical-state fetch (DP-4 reconcile contract on degraded reconnect).
 */
import type { ActivityEvent } from './types';

interface BroadcastEnvelopeShape {
  id: string;
  seq: string;
  published_at: string;
  kind: string;
  project_id: string;
  payload: Record<string, unknown>;
  degraded?: boolean;
}

export function envelopeToActivityEvent(env: BroadcastEnvelopeShape): ActivityEvent | null {
  const at = env.published_at;
  const p = env.payload;
  switch (env.kind) {
    case 'contribution.state_changed': {
      const newState = String(p.new_state ?? '');
      if (newState !== 'claimed') return null;
      return {
        kind: 'contribution.claimed',
        at,
        contribution: {
          id: String(p.contribution_id ?? env.id),
          trace_id: Array.isArray(p.trace_ids) && p.trace_ids[0] ? String(p.trace_ids[0]) : '<unknown>',
          kind: 'implementation',
          state: 'claimed',
          territory: '<unknown>',
          title: '<from substrate>',
          author_session_id: String(p.author_session_id ?? ''),
          loop: 'execute',
          created_at: at,
          updated_at: at,
        },
      };
    }
    case 'contribution.released':
      return {
        kind: 'contribution.released',
        at,
        contribution: {
          id: String(p.contribution_id ?? env.id),
          trace_id: '<unknown>',
          kind: 'implementation',
          state: 'open',
          territory: '<unknown>',
          title: '<from substrate>',
          author_session_id: String(p.prior_author_session_id ?? ''),
          loop: 'execute',
          created_at: at,
          updated_at: at,
        },
      };
    case 'decision.created':
      return {
        kind: 'decision.logged',
        at,
        decision: {
          id: String(p.decision_id ?? env.id),
          trace_id: Array.isArray(p.trace_ids) && p.trace_ids[0] ? String(p.trace_ids[0]) : '<unknown>',
          category: String(p.category ?? 'architecture'),
          title: String(p.summary ?? '<from substrate>'),
          body_markdown: '',
          composer_id: '',
          created_at: at,
        },
      };
    case 'lock.acquired':
      return {
        kind: 'lock.acquired',
        at,
        lock: {
          id: String(p.lock_id ?? env.id),
          artifact_scope: Array.isArray(p.artifact_scope) ? p.artifact_scope.join(', ') : '<unknown>',
          fencing_token: Number(p.fencing_token ?? 0),
          held_by_session_id: String(p.holder_session_id ?? ''),
          acquired_at: at,
        },
      };
    case 'lock.released':
      return {
        kind: 'lock.released',
        at,
        lock: {
          id: String(p.lock_id ?? env.id),
          artifact_scope: '<unknown>',
          fencing_token: 0,
          held_by_session_id: String(p.prior_holder_session_id ?? ''),
          acquired_at: at,
        },
      };
    case 'session.presence_changed':
      if (p.status !== 'active') return null;
      return {
        kind: 'session.registered',
        at,
        session: {
          id: String(p.session_id ?? env.id),
          composer_id: String(p.composer_id ?? ''),
          surface: (p.surface as 'ide' | 'web' | 'terminal' | 'passive') ?? 'web',
          author_kind: 'agent',
          last_activity_at: at,
        },
      };
    case 'proposal.created':
      return {
        kind: 'proposal.created',
        at,
        proposal: emptyProposal(String(p.proposal_id ?? env.id), String(p.title ?? '<from substrate>'), at),
      };
    case 'proposal.reacted':
      return {
        kind: 'proposal.reacted',
        at,
        proposal: emptyProposal(String(p.proposal_id ?? env.id), '<from substrate>', at),
        reaction: {
          id: String(p.reaction_id ?? env.id),
          proposal_id: String(p.proposal_id ?? env.id),
          session_id: '',
          kind: (p.kind as 'vote' | 'concern' | 'clarification' | 'endorse' | 'block') ?? 'vote',
          created_at: at,
        },
      };
    case 'proposal.synthesized':
      return {
        kind: 'synthesis.created',
        at,
        proposal: emptyProposal(String(p.proposal_id ?? env.id), '<from substrate>', at),
      };
    case 'plan.approved':
      return {
        kind: 'plan.approved',
        at,
        proposal: emptyProposal(String(p.proposal_id ?? env.id), '<from substrate>', at),
      };
    default:
      return null;
  }
}

function emptyProposal(id: string, title: string, at: string) {
  return {
    id,
    trace_id: '<unknown>',
    territory: '<unknown>',
    title,
    body_markdown: '',
    options: [],
    state: 'open' as const,
    author_session_id: '',
    reactions: [],
    created_at: at,
  };
}
