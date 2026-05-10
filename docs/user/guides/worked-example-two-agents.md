# Worked example: two agents collaborate without colliding

A concrete narrative of two MCP-client agents working on the same repo simultaneously, coordinating through the Atelier substrate. Shows the actual MCP calls + how the dashboard renders + what would have gone wrong without coordination.

This walkthrough assumes the substrate is running locally per [`first-10-minutes.md`](../tutorials/first-10-minutes.md). You can replay it yourself by spawning two Claude Code sessions in two terminals, both wired to the same local substrate.

**Caveat (honesty):** this narrative is illustrative — it shows what the substrate *enables*, derived from the tool surface and observed substrate behavior, not from a recorded production session. Real-world workflows will surface friction this narrative doesn't model. The first time you actually run two agents through this is the first time anyone has — see "the dogfood gap" at the bottom.

---

## The scenario

You're working on a feature: add a new `/api/health` endpoint that checks the database connection. The work splits into two pieces:

1. **The route handler** at `prototype/src/app/api/health/route.ts`
2. **An updated observability section** at `prototype/src/app/atelier/observability/_components/sections/HealthSection.tsx`

You spawn two Claude Code sessions. Agent A takes the route handler; Agent B takes the dashboard section. Both reference the same trace ID `BRD:Epic-2.health-endpoint`.

Both agents are wired to the same Atelier substrate (via separate bearers per their composer identity).

---

## Phase 1: discovery

**Agent A** opens its session and calls `get_context`:

```json
{
  "tool": "get_context",
  "arguments": {
    "scope_files": ["prototype/src/app/api/health/route.ts"]
  }
}
```

Substrate response:

```json
{
  "session": { "id": "session-A-uuid", "composer": "agent-A", "project_id": "..." },
  "active_contributions": [],
  "held_locks": [],
  "recent_decisions": [
    { "id": "ADR-051", "label": "RLS engagement via AsyncLocalStorage", "at": "2026-05-08..." }
  ],
  "overlapping_active": []
}
```

The `overlapping_active: []` tells Agent A: nobody else is currently working on `prototype/src/app/api/health/route.ts`. Safe to claim.

**Agent A** then calls `find_similar` against its task:

```json
{
  "tool": "find_similar",
  "arguments": {
    "query": "Add a health check endpoint that verifies database connectivity",
    "limit": 3
  }
}
```

Response: 3 contributions related to past health-check work, plus 1 ADR about endpoint conventions. Agent A reads them; learns the project convention is `Response.json({ status: 'ok' | 'degraded' })` rather than HTTP status code variations.

**Agent B** does the same dance for its file. Sees no overlap with Agent A (different file), claims it independently.

---

## Phase 2: claim

**Agent A** calls `claim`:

```json
{
  "tool": "claim",
  "arguments": {
    "kind": "implementation",
    "trace_ids": ["BRD:Epic-2.health-endpoint"],
    "territory_id": "<api-routes-territory-uuid>",
    "content_ref": "prototype/src/app/api/health/route.ts",
    "artifact_scope": ["prototype/src/app/api/health/route.ts"]
  }
}
```

Substrate response:

```json
{
  "contribution_id": "contrib-A-uuid",
  "lock_id": "lock-A-uuid",
  "fencing_token": 4521,
  "state": "claimed",
  "requires_owner_approval": false
}
```

Two things happened atomically:
- A `contributions` row was created with state `claimed`
- A `locks` row was created on `prototype/src/app/api/health/route.ts` with fencing token `4521`

**Agent B** does the same for its file:

```json
{
  "contribution_id": "contrib-B-uuid",
  "lock_id": "lock-B-uuid",
  "fencing_token": 4522,
  "state": "claimed"
}
```

Different file, different lock, no collision.

Now refresh `http://localhost:3030/atelier`. The dashboard shows:

- Two active contributions (A and B), each with their composer name + scope + claim time
- Two held locks, each with their fencing token
- A "recent activity" feed showing the claim events

A human watching the dashboard now knows: 2 agents are working in parallel on the health-endpoint feature; their scopes don't overlap; both are in `claimed` state.

---

## Phase 3: what if Agent C tried to claim Agent A's file?

Imagine a third agent spawns now and tries to claim `prototype/src/app/api/health/route.ts`:

```json
{
  "tool": "claim",
  "arguments": {
    "kind": "implementation",
    "content_ref": "prototype/src/app/api/health/route.ts",
    "artifact_scope": ["prototype/src/app/api/health/route.ts"],
    ...
  }
}
```

Substrate response:

```json
{
  "error": {
    "code": "scope_conflict",
    "message": "Cannot acquire lock on prototype/src/app/api/health/route.ts: held by composer agent-A (lock-A-uuid, fencing_token=4521, acquired 2 minutes ago)"
  }
}
```

Agent C now knows: someone else is on this. It can:
- Wait + retry
- Pick a different file
- Coordinate with Agent A out-of-band

What does NOT happen: Agent C overwrites Agent A's work. The collision is detected at claim time, before any code is written.

---

## Phase 4: working

Agent A writes the route handler. Agent B writes the dashboard section. Both periodically heartbeat (handled automatically by the MCP client most of the time).

Mid-work, Agent A notices the existing health-check pattern uses a shared helper. Agent A makes a decision:

```json
{
  "tool": "log_decision",
  "arguments": {
    "category": "convention",
    "label": "Health endpoints use shared checkDatabase() helper",
    "trace_ids": ["BRD:Epic-2.health-endpoint"],
    "rationale": "Avoids per-endpoint pg.Client setup; matches pattern in /api/cron/* handlers added in PR #92"
  }
}
```

Substrate response:

```json
{
  "decision_id": "D55",
  "repo_path": "docs/architecture/decisions/D055-health-endpoints-use-shared-helper.md",
  "datastore_row_id": "..."
}
```

Two writes happened atomically:
- A new markdown file in the repo at `docs/architecture/decisions/D055-...md`
- A `decisions` row in the datastore for query

Now Agent B, working on the dashboard section, calls `get_context` again to refresh state. It sees the new decision in `recent_decisions[]`. Agent B updates its dashboard component to reference the same `checkDatabase()` helper Agent A is using.

**This is the coordination win.** Without Atelier, Agent B would have re-derived its own approach, possibly inventing a parallel helper. With Atelier, Agent B sees Agent A's decision in real time and aligns automatically.

---

## Phase 5: review and release

Agent A finishes the route handler. Updates state:

```json
{ "tool": "update", "arguments": { "contribution_id": "contrib-A-uuid", "state": "review" } }
```

Dashboard shows contribution A flip to `review`. The territory's `review_role` (set in `territories.yaml`) determines who reviews — say it's the `architect` role. The dashboard surfaces this in the architect lens as "1 contribution awaiting your review."

A human (or AI auto-reviewer per BRD §21 v1.x) reviews + approves. Agent A then releases:

```json
{ "tool": "release", "arguments": { "contribution_id": "contrib-A-uuid", "state": "merged" } }
```

Substrate response:

```json
{ "ok": true, "released_locks": ["lock-A-uuid"] }
```

The lock disappears. The contribution flips to `merged`. The dashboard's recent-activity feed shows the merge event.

Agent B follows the same lifecycle for its piece.

---

## What the dashboard showed throughout

A human glancing at `/atelier` over the course of this scenario sees:

| Time | Dashboard state |
|---|---|
| T+0 | Empty |
| T+1m | 2 active contributions (A, B); 2 held locks; "claimed" badges |
| T+5m | 1 new decision (D055); both contributions now "in_progress" |
| T+15m | Contribution A in "review"; contribution B still "in_progress" |
| T+18m | Contribution A "merged"; lock A released; contribution B in "review" |
| T+22m | Both "merged"; no held locks; D055 in recent decisions |

At any point, the human could have:
- Clicked into a contribution to see its scope, composer, history
- Seen the active locks panel to understand what's currently mutable vs frozen
- Filtered the recent-decisions feed to see context for a specific trace ID
- Switched to the observability lens to see queue depths, sync lag, alert states

---

## What Atelier prevented

Without Atelier:
- Agent C would have edited Agent A's file simultaneously → merge conflict, lost work
- Agent B would have invented a parallel `checkDatabase()` helper → codebase has two helpers doing the same job, future maintenance pain
- The human had no real-time visibility — they'd have to read Slack, check git, ask "what are you working on?" via DM
- The decision (D055) would have lived only in Agent A's head; Agent B and future agents would need to re-derive

With Atelier, all of these resolved automatically through the substrate.

---

## The dogfood gap

This narrative is **derived from substrate capability, not observed from production use**. The first team to actually run two agents through this exact scenario will surface friction this narrative doesn't anticipate:

- Maybe `find_similar` doesn't return the relevant past work because the corpus is too sparse
- Maybe the territory configuration is too coarse and agents claim overlapping scopes by accident
- Maybe agents forget to call `update` and the dashboard goes stale
- Maybe two agents both want to call `log_decision` on the same topic concurrently and one wins

The 12-tool surface is designed to handle these cases (territories prevent over-broad claims; advisory locks prevent duplicate decisions; heartbeats catch stale sessions). But the actual ergonomics — does this *feel* coordinated, or does it feel like ceremony? — only emerge from real use.

If you're the first team to run this for real: please file what bites you. The friction list is more valuable than the success story.

---

## Try it yourself

To run this scenario locally:

1. Complete [`first-10-minutes.md`](../tutorials/first-10-minutes.md) — substrate running, one Claude Code session wired
2. Issue a second bearer for a second composer (re-run `seed-composer.ts` with a different email + `issue-bearer.ts` for that user)
3. In a second terminal, set up a separate working directory with its own `.mcp.json` pointing at the same `http://localhost:3030/api/mcp` but with the second bearer
4. Spawn a second `claude` session there
5. Have each session work on a different file in the same feature; watch the dashboard in a browser tab

The substrate doesn't care that they're on the same machine — it sees two distinct sessions with two distinct bearers. The same setup works for two humans on two laptops, or two agents in two cloud environments.

---

## Cross-references

- [`first-10-minutes.md`](../tutorials/first-10-minutes.md) — get the substrate running
- [`wire-claude-code.md`](./wire-claude-code.md) — wire your MCP client
- [`docs/architecture/protocol/`](../../architecture/protocol/) — full 12-tool spec
- [`docs/architecture/ARCHITECTURE.md`](../../architecture/ARCHITECTURE.md) — substrate design depth
