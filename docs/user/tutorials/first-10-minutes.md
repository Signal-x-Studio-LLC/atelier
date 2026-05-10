# First 10 minutes with Atelier

Goal: clone the repo, get the substrate running, wire Claude Code to it, watch your first MCP call land in the dashboard. Concrete, sequential, with expected output at each step.

This is **not** the operator runbook — that's [`local-bootstrap.md`](./local-bootstrap.md), which has full troubleshooting and substrate-fix history. This is the shortest path from zero to "I see it working."

If anything is unclear: read [`what-is-atelier.md`](../what-is-atelier.md) first. It explains the *why*; this explains the *how*.

---

## Prerequisites (verify, don't install)

```bash
node --version            # need v22+
docker info               # need Docker running
supabase --version        # need 1.x+ (npm install -g supabase if missing)
claude --version          # Claude Code CLI 0.5+ (the reference MCP client)
echo $OPENAI_API_KEY      # need a key with embeddings scope
```

If any fail, fix them before continuing. The rest assumes all five succeed.

---

## Step 1 — Clone and install (2 min)

```bash
git clone https://github.com/Signal-x-Studio-LLC/atelier.git
cd atelier
npm install                    # script-level deps
cd prototype && npm install    # Next.js app deps
cd ..
```

Expected: two clean installs, no errors. If you see peer-dep warnings, those are fine.

---

## Step 2 — Boot the substrate (3 min)

```bash
supabase start
```

Expected output ends with a block like:

```
API URL: http://127.0.0.1:54321
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
anon key: eyJhbGc...
service_role key: eyJhbGc...
```

**Save the `anon key`.** You'll need it in Step 4.

Now apply migrations (idempotent — re-runs are safe):

```bash
supabase db push
```

Expected: 18 migrations apply. If you see "already applied" for some, that's fine.

---

## Step 3 — Seed your composer (1 min)

A "composer" is the Atelier identity for a human or agent. You need one to call MCP tools.

```bash
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_ANON_KEY=<paste anon key from Step 2> \
SUPABASE_SERVICE_ROLE_KEY=<paste service_role key from Step 2> \
npx tsx scripts/bootstrap/seed-composer.ts \
  --email you@example.com \
  --password whatever-you-want \
  --discipline architect \
  --access-level admin
```

Expected output:

```
[seed-composer] composer created: <uuid>  email=you@example.com
[seed-composer] discipline=architect access_level=admin
```

(If you get "composer already exists" — that's idempotent; the script just confirms.)

---

## Step 4 — Issue your bearer (30 sec)

```bash
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_ANON_KEY=<paste anon key from Step 2> \
npx tsx scripts/bootstrap/issue-bearer.ts \
  --email you@example.com \
  --password whatever-you-set
```

Expected output:

```
[issue-bearer] access_token: eyJhbGciOiJF...<long string>...
[issue-bearer] expires_in: 3600  (1 hour)
```

**Save the access_token.** You'll paste it in Step 6.

---

## Step 5 — Start the dev server (1 min)

```bash
cd prototype
npm run dev
```

Expected:

```
▲ Next.js 15.x
- Local:   http://localhost:3030
- Ready in 2s
```

Leave this terminal running. Open `http://localhost:3030/atelier` in your browser.

You'll see the sign-in page. Sign in with the email + password from Step 3. After sign-in, you land on the analyst lens — empty state, "no contributions yet."

**This is your dashboard.** Keep this browser tab open; Step 7 will make it light up.

---

## Step 6 — Wire Claude Code (1 min)

In a fresh terminal, at the repo root, edit `.mcp.json` (create it if it doesn't exist):

```json
{
  "mcpServers": {
    "atelier": {
      "type": "http",
      "url": "http://localhost:3030/api/mcp",
      "headers": {
        "Authorization": "Bearer <paste your token from Step 4>"
      }
    }
  }
}
```

Now restart Claude Code (`exit` and start a fresh `claude` session). MCP servers load at startup; the bearer is cached durably so an in-session restart doesn't pick it up.

Verify Claude Code sees the server:

```
/mcp
```

Expected: a list including `atelier` with status `connected`.

---

## Step 7 — Make your first call (30 sec)

In Claude Code, ask:

> Use the atelier MCP tool `get_context` to show me what's currently active.

Claude will call `get_context`. Expected response: an empty-ish JSON document — your session info, no active contributions, no held locks. (You haven't claimed anything yet.)

Now ask:

> Use the atelier MCP tool `claim` to claim a contribution. Use kind=`implementation`, content_ref=`prototype/src/example.ts`, artifact_scope=`["prototype/src/example.ts"]`, trace_ids=`["BRD:Epic-1"]`. Pick a territory you have access to.

Claude will call `claim`. Expected response: a JSON document with a `contribution_id` UUID + a `lock_id`.

Now refresh `http://localhost:3030/atelier` in your browser.

**Your contribution shows up in the dashboard**, with its scope, your composer name, "in progress" state. The lock panel shows the active lock with its fencing token.

This is the loop. An agent claims, the substrate persists it, the dashboard renders it. The same shape works whether the agent is Claude Code, claude.ai Connectors, ChatGPT Connectors, or a script.

---

## Step 8 — Close the loop (30 sec)

Ask Claude:

> Use atelier `release` to release the contribution from the previous call. Use state=`merged`.

Expected: success response. Refresh dashboard — contribution flips to `merged`, lock disappears.

You've completed one full coordination cycle.

---

## What you just demonstrated

- The substrate runs locally with one command (`supabase start` + `npm run dev`).
- An MCP client (Claude Code) connects via a bearer.
- The 12-tool surface is callable from natural language ("use the atelier tool X").
- Every call lands in the database; the dashboard renders the same state.
- The full lifecycle (claim → work → release) takes seconds.

The substrate doesn't care who called it. Two Claude Code sessions, three claude.ai Connectors, a curl script, and a human clicking around the dashboard would all see the same state. That's the point.

---

## Common stumbles (in order of how often they bite)

| Symptom | Cause | Fix |
|---|---|---|
| `claude` says `atelier` is `disconnected` | Stale cached bearer | Quit Claude Code completely (`exit`), start fresh `claude`. Don't trust `/mcp` Disable→Enable. |
| `401 invalid_bearer` | Bearer expired (1-hour TTL) | Re-run Step 4. Update `.mcp.json`. Restart Claude Code. |
| `claim` returns `territory_not_found` | No territories seeded | The default seed creates one; if you customized, check `territories.yaml` |
| Dashboard shows sign-in page after Step 5 | Cookie not set | Sign in via the browser; the session cookie persists. Don't try to reuse the bearer for the dashboard. |
| `supabase start` hangs | Docker out of resources | Increase Docker Desktop memory (4GB+). Run `supabase stop` then retry. |

For deeper troubleshooting see [`local-bootstrap.md`](./local-bootstrap.md).

---

## Where to go next

| You want to... | Read |
|---|---|
| See two agents coordinating via Atelier | [`../guides/worked-example-two-agents.md`](../guides/worked-example-two-agents.md) |
| Understand the 12-tool surface in detail | [`docs/architecture/protocol/`](../../architecture/protocol/) |
| Deploy this for your whole team | [`cloudflare-bootstrap.md`](./cloudflare-bootstrap.md) |
| Wire other MCP clients (claude.ai, ChatGPT) | [`../guides/wire-claude-code.md`](../guides/wire-claude-code.md) (similar pattern) |
| Customize for your own project | [`../../developer/fork-and-customize.md`](../../developer/fork-and-customize.md) |
