# Atelier — for reviewers

This doc exists for one specific case: **you're someone whose opinion I respect, I want you to look at this, and I want real feedback.** Not "wow cool" — the kind of feedback that surfaces what's wrong.

5-minute read. Concrete, no marketing voice. Caveats are real.

---

## What I built

**A coordination substrate for human+AI teams working on one repo.** Self-hosted. MCP-native (the protocol Claude Code, claude.ai Connectors, ChatGPT Connectors all speak). Sits beneath the editor and above git.

The substrate exposes 12 tools over MCP:

- **Lifecycle:** `register`, `heartbeat`, `deregister`
- **Discovery:** `get_context`, `find_similar` (vector + BM25 hybrid retrieval)
- **Work:** `claim`, `update`, `release`
- **Locking:** `acquire_lock`, `release_lock` (with fencing tokens — Martin Kleppmann pattern, not advisory)
- **Decisions:** `log_decision` (writes ADR markdown to repo + datastore row atomically)
- **Contracts:** `propose_contract_change` (with classifier-driven breaking-change detection)

Plus a web dashboard at `/atelier` with five role-aware lenses (analyst / dev / PM / designer / stakeholder), an observability panel, RLS-engaged data access, and webhook receivers for GitHub / Figma / Supabase Auth.

## What it's for

You have one repo. You want N agents working in parallel — fixing bugs, building features, writing docs, debating architecture. Today this breaks down four ways:

1. **File collisions.** Two agents edit the same file. One overwrites the other.
2. **Decision drift.** Agent A picks library X. An hour later Agent B, working on something else, picks library Y for the same problem.
3. **Invisibility.** A human asks "what's everyone doing?" — answer: read git, check Slack, ask in DM.
4. **Lost exploration.** The same investigation runs three times because nobody (or no agent) remembers it ran before.

These are coordination problems, not capability problems. The agents are smart; they just can't see each other.

Atelier is the layer where they see each other. Locks prevent (1). Decisions queryable across sessions prevent (2). The dashboard solves (3). Vector retrieval against past contributions solves (4).

## Why this shape

The core conviction: **canonical state lives in the repo as markdown, mirrored to a datastore for query.** ADRs are files. Decisions are files. Contracts are files. The datastore is for "show me all decisions touching trace ID X in the last 30 days" — query convenience, never authority.

This means:
- Git is the source of truth (rolls back, forks, audits cleanly)
- Datastore can be rebuilt from the repo
- Agents that don't speak Atelier can still commit ADRs the normal way and Atelier picks them up via reconcile cron

Per ADR-001 + ADR-005. The substrate enforces consistency between the two; it doesn't replace either.

## Concrete substance

| Dimension | Number |
|---|---|
| TypeScript LOC (excl. node_modules) | ~49,000 across 212 files |
| Postgres migrations | 18 |
| ADRs (architectural decisions, append-only with reverses-frontmatter) | 52 |
| BRD epics (business requirements) | 16 |
| BRD stories with trace IDs | 106 |
| Smoke tests | 38 |
| MCP tools (locked surface per ADR-040) | 12 |
| RLS policies | 33 across 13 tables |
| Hybrid retrieval calibration (M5 measurement) | P=0.672, R=0.626 against 117 multi-author seeds |

This isn't a weekend project. It's a year-ish of spec-first design, ADR-disciplined implementation, and milestone-gated delivery (M0 through M8 closed, M9 in progress).

## What works (verified)

- **Local-bootstrap path** runs end-to-end: `supabase start` + `npm run dev` gives a working substrate in ~10 minutes from clone. Tutorial: [`docs/user/tutorials/first-10-minutes.md`](./user/tutorials/first-10-minutes.md).
- **MCP endpoint** (12 tools) callable from Claude Code via standard `.mcp.json` wiring. Static-bearer URL + OAuth-flow URL with discovery split.
- **Dashboard** renders live coordination state with five lenses + observability.
- **CI/CD** fast-checks + substrate audit + IA/UX Playwright + smokes on every PR.
- **Live deploy** at `https://atelier-three-coral.vercel.app` (migrating to Cloudflare Workers per ADR-052; runbook ready).
- **RLS engagement** on the MCP path via AsyncLocalStorage + per-tx `SET LOCAL ROLE` (ADR-051 closes the M8 audit's S09 finding).
- **Hybrid retrieval** (vector kNN + Postgres BM25 fused via Reciprocal Rank Fusion) calibrated against a real corpus (M5 + M7 wider-eval).

## What doesn't work yet (honest)

These are the gaps. I'm naming them so you don't waste time finding them yourself.

1. **Zero real users.** Including me. The substrate is built and runs cleanly, but the workflow around it is not yet exercised. I haven't been using Atelier to coordinate building Atelier. The recursive-eat-your-own-dogfood thing the spec keeps gesturing at hasn't actually happened. This is the next thing I'm fixing.

2. **The "first Tuesday" experience is undocumented.** I have a [worked-example](./user/guides/worked-example-two-agents.md) that's *illustrative* — derived from the substrate's tool surface, not recorded from production use. Real adopters will surface friction the doc doesn't anticipate. The friction list IS the next-iteration backlog.

3. **No adopter signal yet.** I haven't shown this to anyone except you. So everything in the spec about "what adopters want" is informed guessing. Real adopters will redirect this in ways I can't predict.

4. **Cron handlers exist but don't run anywhere.** I built reaper / mirror-delivery / reconcile / triage / alert-publisher last week. They're not yet firing in any deployment. Cutover happens at BRD §37 PR 4 (operator-driven).

5. **`/atelier` dashboard is empty in the live deploy.** Because no one's used it. First-time visitors see "no contributions yet." This is on the immediate to-fix list (seed-demo-data script).

6. **Hybrid retrieval clears advisory tier on the Atelier-internal corpus but not on a wider eval.** Per ADR-047 the gate is *informational* at v1; cross-encoder reranker is filed as v1.x with explicit activation criteria. This is honestly named, not hidden — but it means find_similar's "wedge" framing was demoted (ADR-045 + ADR-047).

7. **No production signal that the architecture decisions hold.** RLS, fencing tokens, the contract classifier, plan-review state — all designed carefully, all tested in smokes, none stress-tested by 10 concurrent agents in a real codebase.

## Where it could be wrong

The premises I'm least confident about:

- **"Multiple agents working concurrently" is a real workload that exists at scale.** Maybe most teams stay at 1-2 agents and the substrate's value doesn't materialize until 5+. If the curve is non-linear and the threshold is high, this is a long road.
- **MCP wins as the agent-interop protocol.** I bet on it (ADR-013). If MCP gets displaced by something else (Anthropic's own internal protocol, a Linear-pushed standard, etc.), the substrate is still useful but the integration story changes.
- **Self-hosted is what teams want.** The whole project rejects SaaS (ADR-007). If teams overwhelmingly prefer hosted-and-managed, that's a strategic mismatch. The hedge is `atelier deploy` to Cloudflare Workers takes 60 minutes and costs $5/mo — but it's still self-hosted, not managed.
- **The "no drift" framing is the value prop adopters care about.** Maybe what they actually care about is something else (cost, speed, observability, audit). I designed for drift-prevention; if that's not what hurts them, I'm solving the wrong problem.

## What I want from you

Five specific feedback prompts. Pick whichever land:

1. **Read [`what-is-atelier.md`](./user/what-is-atelier.md) (5 min) and tell me the first three things that confused you.** If something didn't land, that's a signal — not your fault, my doc.

2. **Look at the [`worked-example-two-agents.md`](./user/guides/worked-example-two-agents.md) and tell me where the workflow feels like ceremony vs. real value.** Bonus: tell me a step that would frustrate you if you had to do it 50 times a day.

3. **Imagine you're forking this for your team. What's the first thing you'd rip out?** That's probably overbuilt. (Past feedback already removed half a planned UI feature this way.)

4. **What's the killer use case I'm missing?** I designed for human+AI teams on a shared repo. If you can name a different use case where the substrate primitives (locks, decisions, contracts) would matter MORE than for the case I designed for, that's gold.

5. **What would have to be true for you to use this against your daily work?** Concrete blockers ("I'd need a hosted version," "I'd need integration with X," "I'd need 10 minutes of someone walking me through it") more useful than abstract critiques.

## Look at it

| Surface | URL |
|---|---|
| Live deploy | https://atelier-three-coral.vercel.app/atelier (sign in with GitHub OAuth via Supabase) |
| Repo | https://github.com/Signal-x-Studio-LLC/atelier |
| 10-min tutorial | [`docs/user/tutorials/first-10-minutes.md`](./user/tutorials/first-10-minutes.md) |
| What it is | [`docs/user/what-is-atelier.md`](./user/what-is-atelier.md) |
| Worked example | [`docs/user/guides/worked-example-two-agents.md`](./user/guides/worked-example-two-agents.md) |
| Architecture depth | [`docs/architecture/ARCHITECTURE.md`](./architecture/ARCHITECTURE.md) |
| Decision trail (52 ADRs) | [`docs/architecture/decisions/`](./architecture/decisions/) |
| Reference impl pivot | [`ADR-052`](./architecture/decisions/ADR-052-cloudflare-primary-infrastructure-pivot.md) |
| Methodology | [`docs/methodology/METHODOLOGY.md`](./methodology/METHODOLOGY.md) |

## What this is not

- Not a SaaS. Not selling anything.
- Not seeking funding.
- Not announcing publicly yet — sharing for feedback before that.
- Not claiming production-readiness. The substrate runs; the workflow around it is not yet validated by use.

If your reaction is "this is a solution looking for a problem" — say so. That's a real critique I'm trying to disprove with the dogfood pass. If your reaction is "this is exactly what I needed at $previous-job" — say that too, with the specifics, because that's the use case that proves the bet.
