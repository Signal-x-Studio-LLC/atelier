# What is Atelier?

A short, plain-language answer. No spec jargon. If you want depth, the rest of `docs/` has 50+ ADRs and a complete BRD.

## The one-sentence pitch

Atelier is a **shared coordination layer** that lets multiple AI agents (and humans) work on the same codebase concurrently — without stepping on each other's edits, re-litigating decisions, or losing track of who's doing what.

## The problem it solves

You have one repo. You want two, three, ten agents working on it in parallel — fixing bugs, building features, writing docs. Today, that breaks down fast:

- Agent A edits `src/foo.ts`. Agent B edits the same file simultaneously. One overwrites the other.
- Agent C decides "we're switching to library X." Agent D, working on something else, picks library Y for the same problem an hour later. Now the codebase has two libraries doing the same job.
- A human asks "what's everyone working on right now?" — and there's no answer except "go look at git."
- You re-run the same exploration three times because nobody remembered (or could see) that someone already did it.

These are coordination problems, not capability problems. The agents are smart. They just can't see each other.

## What Atelier provides

A **substrate** — a small running service plus a database — that gives agents a shared memory of:

- **Who's active** (sessions: which agent, which surface, last heartbeat)
- **What's claimed** (contributions: what each agent is working on, what scope it touches)
- **What's locked** (locks with fencing tokens: prevents two agents writing to the same file simultaneously, with detection if one ignores the lock)
- **What's been decided** (decisions: ADR-style records of "we chose X over Y because Z")
- **What's been built before** (vector search: semantic similarity to past contributions and decisions)
- **What contracts exist** (API/schema agreements between components)

Agents talk to it via the **MCP protocol** (Model Context Protocol — the open standard Claude Code, claude.ai Connectors, and ChatGPT Connectors all speak). Twelve tools cover the full lifecycle.

A **web dashboard** at `/atelier` renders the same state for humans, with five role-aware lenses (analyst, developer, PM, designer, stakeholder).

## What "using Atelier" looks like in practice

Before an agent starts work:

1. It calls `get_context` and sees: 2 other sessions are active, the auth module is locked by another agent, ADR-052 was decided 3 hours ago.
2. It calls `find_similar` with its task description; gets back the 3 most relevant past contributions and decisions.
3. It calls `claim` with a scope (`prototype/src/foo.ts`); the substrate creates a contribution row + acquires a lock with a fencing token. If another agent had a conflicting claim, this fails fast with a clear reason.

While working:
4. Periodic `heartbeat` keeps the session alive (the reaper sweeps dead sessions every 5 minutes).
5. `update` posts progress (`state: in_progress` → `state: review`).
6. If something ADR-worthy emerges, `log_decision` writes it to the repo as a markdown file AND records it in the datastore for query.

On done:
7. `release` marks the contribution merged/rejected and releases the lock.

A human watching `/atelier` sees all of this in real time.

## What it is not

- **Not a SaaS.** You self-host. The whole substrate runs on Cloudflare Workers + Supabase (or Vercel + Supabase, during the migration overlap).
- **Not an agent framework.** It doesn't tell your agents what to do. It just gives them a coordination layer to share with other agents.
- **Not a replacement for Jira / Linear / Confluence / Figma / Slack.** Each of those stays canonical for its domain. Atelier is the spine that connects them around one repo.
- **Not a workflow engine.** No DAGs, no orchestration. Each agent decides for itself; the substrate just prevents collisions and remembers the history.
- **Not a chat app.** Coordination is structured (claims, decisions, contracts), not free-form messages.

## Who is it for

You'll get the most out of Atelier if **at least two of these are true** for your team:

- You run multiple AI coding agents in parallel against one repo (Claude Code sessions, claude.ai Connectors, ChatGPT Connectors, etc.).
- You have humans + agents collaborating, and the humans want visibility into what the agents are doing.
- You've been bitten by agents making conflicting edits, re-litigating decisions, or duplicating exploration.
- You want a canonical record of "why did we do it this way?" that survives session boundaries.

If you're a solo dev with one Claude Code session against a small repo, Atelier is overkill. If you're a 5-person team coordinating 10 agents on a complex codebase, you're the target.

## Three engagement tiers

Per [ADR-031](../architecture/decisions/ADR-031-three-tier-consumer-model-specification-reference-implementa.md), you can engage at three levels:

| Tier | What you do | Where to start |
|---|---|---|
| **Reference Deployment** | Run Atelier as-is for your team via `atelier init` + `atelier deploy` | [`docs/user/getting-started.md`](./getting-started.md) |
| **Reference Implementation** | Fork this repo. Customize. Add lenses, swap embedding model, write adapters. | [`docs/developer/fork-and-customize.md`](../developer/fork-and-customize.md) |
| **Specification** | Implement the 12-tool protocol on a different stack. OR apply the methodology without using this codebase. | [`docs/methodology/adoption-guide.md`](../methodology/adoption-guide.md) or [`docs/architecture/protocol/`](../architecture/protocol/) |

## The honest caveat

The substrate is built and runs cleanly. The **workflow around it is not yet exercised in the wild** — including by the team that built it. You can clone it, run it, hit it with curl, see the dashboard. What you can't yet see is "this is what a normal Tuesday with Atelier looks like." That tutorial is being written from real use, not speculation. See [`first-10-minutes.md`](./tutorials/first-10-minutes.md) for the concrete on-ramp; [`worked-example-two-agents.md`](./guides/worked-example-two-agents.md) for the multi-agent narrative.

## Where to go next

| You want to... | Read |
|---|---|
| Get the substrate running on your laptop in 10 minutes | [`tutorials/first-10-minutes.md`](./tutorials/first-10-minutes.md) |
| See two agents collaborate via Atelier | [`guides/worked-example-two-agents.md`](./guides/worked-example-two-agents.md) |
| Wire your Claude Code to use Atelier | [`guides/wire-claude-code.md`](./guides/wire-claude-code.md) |
| Deploy it for your whole team | [`tutorials/cloudflare-bootstrap.md`](./tutorials/cloudflare-bootstrap.md) |
| Understand the design philosophy | [`docs/strategic/NORTH-STAR.md`](../strategic/NORTH-STAR.md) |
| Understand the architecture | [`docs/architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) |
