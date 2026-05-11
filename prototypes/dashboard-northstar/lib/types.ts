/**
 * Atelier substrate type shapes for the prototype.
 *
 * These mirror Atelier's actual schema (per ADR-040 + ADR-054 + the
 * substrate-inventory.md report). The prototype's data layer talks to
 * fixtures shaped like these — when the real substrate ships brainstorm
 * primitives + SSE + checkpoints, swap fixtures for API calls without
 * IA changes.
 */

export type Loop = 'brainstorm' | 'execute' | 'continuity';
export type Surface = 'ide' | 'web' | 'terminal' | 'passive';
export type AuthorKind = 'composer' | 'agent';

export interface Composer {
  id: string;
  display_name: string;
  handle: string;
  discipline: 'analyst' | 'dev' | 'pm' | 'designer' | 'stakeholder';
  avatar_color: string;
}

export interface Session {
  id: string;
  composer_id: string;
  surface: Surface;
  author_kind: AuthorKind;
  last_activity_at: string;  // ISO
  trace_ids?: string[];
}

export type ContributionState =
  | 'open' | 'claimed' | 'in_progress' | 'review' | 'merged' | 'rejected' | 'blocked';

export type ContributionKind =
  | 'implementation' | 'decision' | 'research' | 'design' | 'proposal';

export interface Contribution {
  id: string;
  trace_id: string;
  kind: ContributionKind;
  state: ContributionState;
  territory: string;
  title: string;
  author_session_id: string;
  loop: Loop;
  created_at: string;
  updated_at: string;
}

export type ProposalState = 'open' | 'synthesized' | 'approved' | 'abandoned';
export type ReactionKind = 'vote' | 'concern' | 'clarification' | 'endorse' | 'block';

export interface Proposal {
  id: string;
  trace_id: string;
  territory: string;
  title: string;
  body_markdown: string;
  options: Array<{ id: string; label: string; tradeoffs: string }>;
  state: ProposalState;
  author_session_id: string;
  reactions: Reaction[];
  created_at: string;
  synthesized_at?: string;
  approved_at?: string;
}

export interface Reaction {
  id: string;
  proposal_id: string;
  session_id: string;
  kind: ReactionKind;
  body_markdown?: string;
  vote_for_option_id?: string;
  created_at: string;
}

export interface Decision {
  id: string;
  trace_id: string;
  category: string;
  title: string;
  body_markdown: string;
  composer_id: string;
  created_at: string;
}

export interface Lock {
  id: string;
  artifact_scope: string;
  fencing_token: number;
  held_by_session_id: string;
  acquired_at: string;
}

export type ActivityEvent =
  | { kind: 'contribution.claimed'; at: string; contribution: Contribution }
  | { kind: 'contribution.released'; at: string; contribution: Contribution }
  | { kind: 'proposal.created'; at: string; proposal: Proposal }
  | { kind: 'proposal.reacted'; at: string; proposal: Proposal; reaction: Reaction }
  | { kind: 'synthesis.created'; at: string; proposal: Proposal }
  | { kind: 'plan.approved'; at: string; proposal: Proposal }
  | { kind: 'decision.logged'; at: string; decision: Decision }
  | { kind: 'lock.acquired'; at: string; lock: Lock }
  | { kind: 'lock.released'; at: string; lock: Lock }
  | { kind: 'session.registered'; at: string; session: Session };

export type InboxSection =
  | 'needs-reaction'
  | 'awaiting-approval'
  | 'awaiting-review'
  | 'blocked-on-you';
