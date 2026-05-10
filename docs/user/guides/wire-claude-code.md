# Wire Claude Code to Atelier

The literal `.mcp.json` snippet + how to use it. Two cases: local Atelier, deployed Atelier.

If you're starting from zero, do [`first-10-minutes.md`](../tutorials/first-10-minutes.md) instead — it includes wiring as Step 6 and walks the full setup.

---

## Local Atelier (substrate running on your laptop)

Create or edit `.mcp.json` at your project root:

```json
{
  "mcpServers": {
    "atelier": {
      "type": "http",
      "url": "http://localhost:3030/api/mcp",
      "headers": {
        "Authorization": "Bearer <paste your bearer here>"
      }
    }
  }
}
```

Get the bearer from `scripts/bootstrap/issue-bearer.ts` (TTL is 1 hour; rotate via `scripts/bootstrap/rotate-bearer.ts`).

---

## Deployed Atelier (Cloudflare Workers)

Same shape, different URL:

```json
{
  "mcpServers": {
    "atelier": {
      "type": "http",
      "url": "https://atelier-prototype.<your-cf-subdomain>.workers.dev/api/mcp",
      "headers": {
        "Authorization": "Bearer <paste your bearer here>"
      }
    }
  }
}
```

The bearer issuance flow is the same — `scripts/bootstrap/issue-bearer.ts` against the cloud Supabase URL instead of `127.0.0.1:54321`.

---

## Verify the wire

Restart Claude Code completely (`exit` and start a fresh `claude` — see "bearer caching" warning below). Then:

```
/mcp
```

Expected: `atelier` listed with status `connected`.

Smoke a tool call:

> Use the atelier `get_context` tool with no arguments.

Expected: a JSON document containing your session info, plus arrays for active contributions, held locks, recent decisions. Empty arrays are fine — they confirm the call succeeded; you just haven't done anything yet.

---

## Bearer caching warning (load-bearing)

**Claude Code's MCP HTTP client caches bearer tokens durably across `/mcp` Disable→Enable AND across `exit` + relaunch.** Editing `.mcp.json` and restarting is NOT enough to pick up a new bearer. You must:

1. Quit Claude Code (`exit`)
2. Wait for the process to fully terminate
3. Start a fresh `claude` session

If you doubt the cache cleared, escape hatch is `curl`:

```bash
curl -H "Authorization: Bearer <new bearer>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-11-25" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  http://localhost:3030/api/mcp
```

If `curl` works but Claude Code shows `disconnected` or 401, the cache is the issue. Quit Claude Code more aggressively (kill the process if needed) and restart.

This is documented in the project memory at `feedback_cc-mcp-bearer-cache-durable.md` because it bites repeatedly.

---

## OAuth-flow clients (claude.ai Connectors, ChatGPT Connectors)

Cloud-hosted MCP clients can't use static bearers — they need OAuth. The substrate publishes a separate URL for OAuth-flow clients:

- **Static-bearer URL** (Claude Code, scripts, curl): `https://<your-deploy>/api/mcp` — discovery NOT published here
- **OAuth-flow URL** (claude.ai, ChatGPT): `https://<your-deploy>/oauth/api/mcp` — discovery IS published

Discovery endpoint: `https://<your-deploy>/.well-known/oauth-authorization-server/oauth/api/mcp`

When you add the substrate to claude.ai Connectors or ChatGPT Connectors, paste the OAuth-flow URL (`/oauth/api/mcp`), not the static-bearer one. The client follows the discovery + dynamic-registration + auth-code flow automatically.

---

## What you can do once wired

The 12-tool surface (per ADR-013/040) covers:

| Tool | Purpose |
|---|---|
| `register` | Open a session (returns session_id + composer info) |
| `heartbeat` | Keep session alive (auto-handled by clients usually) |
| `deregister` | Close session cleanly |
| `get_context` | See active sessions, held locks, recent decisions, optionally check overlap with file scopes |
| `find_similar` | Vector search past contributions/decisions for relevance |
| `claim` | Take a unit of work + acquire any needed locks |
| `update` | Post progress (state transitions: open → claimed → in_progress → review → merged/rejected) |
| `release` | Mark contribution done; release locks |
| `log_decision` | Record an ADR-style decision (writes markdown to repo + database row) |
| `acquire_lock` | Standalone lock acquisition (when you need a lock without a contribution) |
| `release_lock` | Standalone lock release |
| `propose_contract_change` | Propose a contract amendment with classifier guidance |

Full protocol shape: [`docs/architecture/protocol/`](../../architecture/protocol/).

---

## Common stumbles

| Symptom | Cause | Fix |
|---|---|---|
| `disconnected` in `/mcp` | Bearer cache; bearer expired; URL typo | Restart Claude Code; re-issue bearer; check URL has `http://` or `https://` |
| `401 invalid_bearer` | Bearer expired (1-hour TTL) | Re-run `issue-bearer.ts` or `rotate-bearer.ts` + restart |
| `503 cron_secret_not_configured` | You called `/api/cron/*` paths from Claude Code | Don't — those are for cron triggers only, not MCP |
| Tools call but dashboard doesn't update | Wrong project; multiple projects in datastore | Check `get_context` response for `project_id`; dashboard scopes per-project |

---

## Cross-references

- [`first-10-minutes.md`](../tutorials/first-10-minutes.md) — full setup walkthrough
- [`worked-example-two-agents.md`](./worked-example-two-agents.md) — what coordination looks like in practice
- [`rotate-bearer.md`](./rotate-bearer.md) — bearer rotation procedure
- [`docs/architecture/protocol/`](../../architecture/protocol/) — full 12-tool spec
