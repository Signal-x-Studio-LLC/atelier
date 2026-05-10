---
id: ADR-055
trace_id: BRD:Epic-1
category: architecture
session: 2026-05-10-hive-pairing-strategic-reframe
composer: nino-chavez
timestamp: 2026-05-10T00:00:00Z
---

# Three-loop coordination framing (brainstorm / execute / continuity) as IA scaffolding + SSE broadcast adoption

**Summary.** Atelier adopts the three-loop coordination framing from Hive's `ARCHITECTURE.md` as the canonical IA scaffolding for the webapp + the substrate's tool organization: **brainstorm** (minutes-to-hours; `propose / react / synthesize / approve_plan`), **execute** (minutes-to-days; `claim / update / release` + locks + contracts), **continuity** (continuous; `register / heartbeat / deregister / checkpoint / log_decision / get_context / find_similar`). The framing is borrowed from Hive's production-proven IA. Concurrently, Atelier supersedes the Supabase Realtime broadcast layer with SSE push (the same pattern Hive ships at ~1s latency); the broadcast service abstraction (per ARCH §6.8) makes the swap mechanical, not architectural. ADR-029's GCP-portability constraint preserved: SSE is HTTP standard, not vendor-specific.

**Rationale.**

Per ADR-053, Hive proved two things in production that Atelier should adopt:

**1. The three-loop framing.** Hive's `bc-subscriptions/.hive/docs/ARCHITECTURE.md` organizes its 21 tools into three time horizons:

| Loop | Tools | Horizon |
|---|---|---|
| Brainstorm | `propose`, `react`, `synthesize`, `approve_plan` | minutes-to-hours per cycle |
| Execute | `create_task`, `claim_task`, `update_task`, `acquire_lock`, `release_lock` | minutes-to-days per task |
| Continuity | `register_session`, `deregister_session`, `checkpoint`, `log_decision`, `get_context`, `heartbeat` | continuous; reaper sweeps stale every 60s |

This is clarifying IA. Atelier's existing tool surface (12, expanding to 18 per ADR-054) maps cleanly to the same three loops. The framing was implicit in Atelier's spec but never named as the organizing axis. Naming it makes the webapp v2 IA decisions follow naturally.

**2. SSE push at ~1s latency.** Hive's dashboard subscribes via `GET /api/events` (text/event-stream) to a fan-out per project; new proposals/syntheses/approvals appear within ~1 second, with toasts, badge counts, optional audible cue. No polling. The Worker's in-memory subscriber map is per-isolate; acceptable for hackathon-scale teams. For multi-isolate scale, the SSE manager moves into a Durable Object (Hive's `docs/specs/phase-2-agent-side-push.md`).

Atelier's current broadcast layer is Supabase Realtime (per ADR-029 capability mapping; wrapped in `BroadcastService` interface for portability). Supabase Realtime works but Hive's empirical signal is that SSE push is simpler, lower-latency, and matches the Cloudflare Workers deployment shape Atelier is migrating toward (per ADR-052).

**Decision.**

**Three-loop framing as canonical IA:**

Atelier's tool surface (post-ADR-054 expansion to 18) is organized into three loops:

- **Brainstorm loop (5 tools):** `propose`, `react`, `get_proposals`, `synthesize`, `approve_plan`
- **Execute loop (6 tools):** `claim`, `update`, `release`, `acquire_lock`, `release_lock`, `propose_contract_change`
- **Continuity loop (7 tools):** `register`, `heartbeat`, `deregister`, `checkpoint`, `log_decision`, `get_context`, `find_similar`

Documentation, dashboard IA, ADR organization, and any new tool addition should reference which loop the tool belongs to.

The webapp v2 reframe (Compose / Inbox / Activity / Atlas / Connect) integrates the three-loop framing as a layering axis:

- **Compose** lets a composer engage any of the three loops: post a `propose` (brainstorm), file a `claim` (execute), trigger a `checkpoint` (continuity)
- **Inbox** surfaces three-loop work that needs the composer's attention: brainstorms awaiting reaction, contributions awaiting review, sessions about to expire
- **Activity** shows the three loops side-by-side on the timeline: which proposals are open, which contributions are in flight, which sessions are active
- **Atlas** filters historical artifacts by loop: brainstorm syntheses, execute decisions, continuity logs

**SSE broadcast adoption:**

Atelier's broadcast layer (the `BroadcastService` interface defined in ARCH §6.8) gains an SSE-push implementation alongside the existing Supabase Realtime implementation. The default for new deployments becomes SSE; the Supabase Realtime adapter remains supported for adopters who chose it during the M2-M7 era.

Implementation:
- New endpoint: `GET /api/events?project_id=<uuid>` returns `text/event-stream` with bearer auth
- Event types match the existing broadcast topology: `contribution.claimed`, `contribution.updated`, `contribution.released`, `lock.acquired`, `lock.released`, `decision.logged`, `proposal.created` (new per ADR-054), `proposal.reacted` (new), `synthesis.created` (new), `plan.approved` (new), `session.registered`, `session.reaped`
- Fan-out: in-memory subscriber map per Worker isolate (Hive's pattern); Durable Object upgrade path documented for multi-isolate scale (matches Hive's phase-2 spec)
- Bearer + project scoping enforced per ADR-051 RLS pattern: subscriber's composer must have project membership; events filtered server-side before send

**Consequences.**

- ADR-040's surface lock framing carries over with the three-loop annotation: tools remain locked at 18 (post-ADR-054); each tool documented under its loop.
- ARCH §6.8 amends to name SSE as the canonical broadcast pattern; Supabase Realtime relegated to "supported alternative for M2-M7 era adopters."
- ADR-029's GCP-portability constraint preserved: SSE is HTTP standard; nothing vendor-specific. The Cloud Run + Cloud SQL migration mapping in ADR-029 remains valid (SSE works on any HTTP server).
- ADR-052's Cloudflare-primary positioning strengthens: SSE is native to Workers; in-memory subscriber maps + Durable Object upgrade path are CF-shaped patterns.
- Webapp v2 IA reframe (separate spec, lands as `docs/architecture/webapp-v2-spec.md` in a follow-up PR) is scaffolded by the three-loop framing.
- Documentation reorganization (`docs/architecture/protocol/` reorganizes by loop instead of by tool category) is filed as a follow-up doc-only PR.
- The `ux-ui-auditor` agent's Phase 8 dynamic-surface methodology (per `~/.claude/CLAUDE.md`) applies cleanly: each loop has a "default-view logic" question (what's the first item a cold user sees in this loop?), a "filter + sort affordances" question, etc.

**What this does NOT decide.**

- The Durable Object migration trigger — implementation will document the threshold (likely "subscriber count per project exceeds N" or "p95 fan-out latency exceeds 5s"); not a spec decision.
- The exact `text/event-stream` wire format — implementation matches Hive's pattern (`event: <type>\ndata: <json>\n\n`) unless a specific reason to diverge.
- Whether SSE replaces Supabase Realtime entirely (i.e., remove Realtime adapter) or remains a peer (keep both supported). Default: keep both; adopters choose. Reconsider when SSE adoption proves universal.
- Whether the dashboard's polling fallback (when EventSource isn't supported) is needed. Default: yes, a 5-second poll fallback for browser environments where SSE is blocked.

**Re-evaluation triggers.**

- SSE proves insufficient (e.g., load balancer drops long-lived connections; corporate proxies block text/event-stream) → file ADR for WebSocket fallback or alternative.
- The three-loop framing proves too coarse (e.g., "brainstorm" needs sub-loops for option-stage vs synthesis-stage) → revisit loop organization.
- Hive evolves to four loops (e.g., adds an "observation" loop for read-only telemetry) → consider follow-up ADR.
- Adopters consistently bypass one loop entirely (e.g., never use brainstorm; only execute) → revisit whether the three-loop framing matches actual workflows or whether Atelier should support disabling loops per-project.
