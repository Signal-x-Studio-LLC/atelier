# Atelier Dashboard — Design Principles (locked v1)

**Status:** locked
**Stage:** 2 (Design Principles)
**Source:** `research/STAGE-1-SYNTHESIS.md`
**Feeds:** Stage 3 prototype slices, Stage 4 fact-check

---

## So what?

Atelier's webapp v2 is a **deliberation surface for human + agent teams**, not a fleet-monitor console for agents. Eight principles lock the design space; seven open questions are resolved (or formally deferred with triggers). The proposed Compose / Inbox / Activity / Atlas / Connect IA stands with one structural revision: agents are a filter, not a destination.

---

## Locked principles

### DP-1 — Action-shaped sections beat status-shaped lists

Every attention surface (Inbox, Activity-For-Review, the homepage attention block) decomposes by **what the user is being asked to do**, not by entity state.

- **Right:** `Needs your reaction` / `Needs your approval` / `Blocked on you` / `Awaiting review`
- **Wrong:** `state=open` / `state=review` / `state=blocked`

**Substrate mapping.** Inbox sections route by territory `review_role` (ADR-025) plus brainstorm `reaction_kind` (ADR-054: concern / clarification / endorse / block). Each section is a server-side query, not a client-side filter on a single list.

**Sources.** GitHub PR dashboard (Mar 2026) `Review requests` / `Needs action`; Linear Inbox; Sentry For Review.

### DP-2 — Agents are a filter dimension, never a destination

No `/agents` tab. Authorship (human composer / agent session / web agent client) is metadata on every contribution, decision, proposal. Surfaces stay author-agnostic. A one-click filter chip lets the user slice by agent vs. human authorship.

**Why this matters.** Treating agents as a destination produces a fleet-monitor console — the LangGraph / CrewAI / Conductor shape — and that's a different product. Atelier's wedge is human + agent teams co-authoring one canonical artifact; separating them in the IA destroys that framing on contact.

**Substrate mapping.** `session.surface ∈ {ide, web, terminal, passive}` is already the right schema. Filter chip on every list view; no separate routes.

**Sources.** Linear `Delegate` filter; GitHub "Authored by me includes Copilot."

### DP-3 — Artifact is the canvas; deliberation is the inline modifier

Compose surfaces the **proposal / synthesis / contribution as the primary canvas**, with reactions, votes, approvals embedded inline. The chat-flavored alternative (free-form thread, transcript-as-IA) is the explicit anti-pattern PRD §5 forbids.

**Implementation rule.** Every brainstorm primitive (`propose`, `react`, `synthesize`, `approve_plan`) must enforce structured fields — title + options jsonb + body markdown — never a free-form text body that re-introduces chat shape.

**Sources.** ChatPRD (canvas pattern, validates direction); GitHub PR-review-as-deliberation (closest semantic analog); ADR-054 framing.

### DP-4 — Freshness is non-negotiable; trend-weighting is mandatory at velocity

Every dynamic surface ships:

- **Per-actor freshness signal** — unread dot, last-changed timestamp, "N new since you last looked" banner.
- **Trend-weighted sort option** — default for high-velocity tabs. Pure chronological collapses at N-agent concurrency.
- **Four-modality contract** (per Hive's empirical baseline): foreground toast + background nav badge (capped at "9+") + Web Audio chime when tab hidden + full re-fetch on focus.

**Substrate mapping.** SSE-driven on the foreground tab; per-composer `last_seen_at` in `composers` table to compute "new since"; loop-aware sort presets (default for Activity = trend-weighted; Atlas = recency).

**Sources.** Sentry Trends sort; Vercel recency-default; Hive's empirical four-modality contract.

### DP-5 — Persistent coordination strip is chrome, not a tab

A thin always-visible strip across the top of every dashboard surface shows:

- **Sessions live** (count, click → `/connect#presence`)
- **Tasks in flight** (count, click → Activity filtered to `state ∈ {claimed, in_progress}`)
- **Locks held** (count, click → Activity filtered to active locks)
- **Brainstorms needing attention** (count, click → Inbox `Needs your reaction`)

This frames Atelier as a coordination substrate at first glance — without burying the signal inside a tab a cold visitor might not click.

**Sources.** Hive `renderCoordStrip` (production-proven); ux-ui-auditor Phase 8 default-view-logic.

### DP-6 — Scale budget declared per surface; server-side filter/sort mandatory

Every list view declares its rendering ceiling and runs filter + sort on the server.

| Surface | Paginate at | Virtualize at | Default sort |
|---|---|---|---|
| Inbox sections | 25 | n/a (sections are bounded) | trend-weighted |
| Activity timeline | 50 | 500 | recency desc |
| Atlas search | 25 | 200 | relevance (RRF) |
| Compose drafts | 25 | n/a | recency desc |
| Connect presence | 50 | n/a | last_activity desc |

**Counter to.** Hive's `/api/dashboard` returns the entire project payload, no pagination — Hive's own DESIGN.md flags this as a known gap that breaks at 100×. Atelier on Postgres + RLS + multi-tenant has no excuse.

**Implementation rule.** Per-surface paginated endpoints; cursors not offsets; RLS already filters by project membership; client never receives rows it will not render.

### DP-7 — Compose is the wedge; Atlas is the long tail

The dashboard's primary action — the thing a Tier-1 Deploy adopter does on their first Tuesday — is **Compose**: post a proposal, claim work, log a decision, kick off a checkpoint. Atlas (historical projection / search) is essential but secondary.

**Empty-state rule.** Cold visitors land on Compose's action launcher with a read-only Activity preview, never on an empty Atlas. The current `for-reviewers.md` failure mode ("/atelier dashboard is empty in the live deploy") is what this principle exists to prevent.

**Sources.** ADR-031 three-tier consumer model; Hive's Proposals-as-default landing.

### DP-8 — Three-loop framing surfaces as filter chips, not as nav

The brainstorm / execute / continuity framing (ADR-055) is the right organizing axis for documentation and for tool taxonomy — but not the top-level navigation. Adopters who don't engage all three loops shouldn't see them as equal real estate.

**Implementation.** Loop is a filter chip inside Activity and Atlas; top-level nav stays Compose / Inbox / Activity / Atlas / Connect.

**Counter to.** `/brainstorm` / `/execute` / `/continuity` as top-level nav — this couples the dashboard too tightly to the substrate's tool taxonomy and forces every adopter to model their work in the loop framing.

---

## Locked principles — visual + voice + motion extension

Added 2026-05-10 from `research/visual-voice-motion-research.md` (seven-anchor pass: Linear, Vercel, Figma, Notion, GitHub, Sentry, Makeswift). Same shape as DP-1..8.

### DP-9 — Motion is teaching motion; tight durations; reduced-motion respected

Motion conveys causation, not personality. Use it when state changes (something appeared, moved, was acknowledged); don't use it as flourish. Durations are **120ms standard, 200ms emphasized, 320ms slow** (per the DESIGN.md frontmatter); easings are `cubic-bezier(0.2, 0, 0, 1)` standard. Every animation respects `prefers-reduced-motion`.

- **Sources.** Linear's 2025 design refresh ("a calmer interface for a product in motion"); Vercel Web Interface Guidelines; observed across Notion, GitHub, Sentry — none uses motion as expressive layer.
- **Substrate mapping.** Loading states are skeletons (not spinners) on lists; optimistic UI for reactions + claims; success confirmations are inline state changes, not toasts unless background.
- **Counter to.** Stripe-style expressive motion; spinner-on-everything; toast-confirmation for every action.

### DP-10 — Imperative second-person in chrome; declarative in framing copy

Product chrome (CTAs, section headers, empty states, button labels) is imperative second-person: **"Compose,"** **"Post proposal,"** **"Approve,"** **"Search the substrate"**. Framing copy (page descriptions, marketing-adjacent text, About surfaces) is declarative third-person. The mix is consistent and intentional: instructions act on the reader; framing describes the system.

- **Sources.** Linear ("Add issue," "Inbox"), Makeswift ("Edit side-by-side"), GitHub ("Review requests"), Vercel ("Deploy"). 5 of 7 anchors. Sentry and Notion mix more freely but never the inverse pattern.
- **Substrate mapping.** Section headers: `Needs your reaction` (imperative — "react to these"), `Awaiting your approval` (imperative — "approve these"). Page descriptions: declarative ("What needs your attention, organized by what you're being asked to do.")
- **Counter to.** "Open proposals" (declarative chrome — what DP-1 already rejects); "Your inbox is currently empty :)" (casual chatty empty state — Sentry-grade exception, not the default).

### DP-11 — Editorial serif is display-only; body is grotesque

Fraunces serves display roles only (h1, h2, h3 ≥ 20px). Body copy, labels, microcopy, input text, table data, navigation labels, button labels — all Inter. Mono is JetBrains Mono for code-shaped tokens (trace IDs, file paths, command snippets).

- **Sources.** No anchor uses serif in chrome. Notion makes serif user-selectable for **content only**; Stripe reserves serif for publishing surfaces. Makeswift uses no serif. The pattern is unanimous.
- **Substrate mapping.** `.font-display` class applies only to h1/h2/h3. h4 (1.0625rem / 17px) and below stay Inter. CSS guardrail: no `font-display` class below 20px font-size.
- **Counter to.** Serif body copy ("editorial feel" applied across the surface), serif at h4 or smaller (loses legibility at density).

### DP-12 — Single brand primary; semantic scales carry state; no secondary brand color

The brand owns **one** saturated color (ink blue `#1E3A8A`) used for primary CTA, focused-active state, link affordances. State communication (success / warning / error / info) uses dedicated semantic scales — green / amber / red / blue. There is **no `colors.secondary`**; "secondary CTA" is rendered as outlined with `colors.ink` foreground.

- **Sources.** Unanimous across all seven anchors. Linear (single purple), Vercel (single blue, semantic scales for state), Figma (blue/teal accent), Notion (single blue), GitHub (Primer single primary), Sentry (one purple), Makeswift (one blue/teal). Zero anchors pair two saturated brand colors at equal intensity in product chrome.
- **Substrate mapping.** DESIGN.md frontmatter drops `colors.secondary`. Loop accents (violet/teal/yellow) remain — they're not brand colors, they're categorical filter dimensions per DP-8 and live in `colors.loop`. Per-composer avatar colors are allowed to be saturated (they're identity, not brand).
- **Counter to.** Ink-blue + rose paired as brand (the prototype's initial choice, now revised); using semantic colors as decorative accents.

### DP-14 — Typographic system: tuples, three weights, tabular numerals, optical sizing

Typography is a system, not a font list. Every type token is a **(size, leading, weight, tracking, family)** tuple. The system locks:

- **Modular ratio.** ~1.2 (minor third) between h-levels; tighter steps for body/sm/xs. Anchor match: Linear, Vercel.
- **Three weights only.** 400 body, 500 emphasis + eyebrow + active-nav, 600 headings. No 700 in product chrome. Anchor match: Linear, Vercel, GitHub Primer.
- **Optical sizing.** `font-optical-sizing: auto` globally so Fraunces's `opsz 9..144` axis renders display-cut letterforms at h1/h2 vs text-cut at body sizes.
- **Tabular numerals.** Every digit that changes under update gets `font-variant-numeric: tabular-nums` — counters, timestamps, fencing tokens, badge counts, trace IDs. Without this, numbers jitter on every re-render. Linear / Vercel / GitHub all do this; the visible difference is "this product feels engineered" vs "this product feels approximate."
- **Italic policy.** Italics reserved for in-prose emphasis only. Forbidden in chrome, labels, buttons, nav, eyebrows. Unanimous across all seven anchors.
- **Eyebrow as a token, not a recipe.** Replace ad-hoc `uppercase tracking-wider text-[10px] text-ink-subtle font-mono` with the canonical `.label-eyebrow` token (10px Inter 500, +0.08em, ink-subtle).
- **Measure.** Body prose 60–72ch; UI labels uncapped; codes uncapped.

**Substrate mapping.** `prototype/DESIGN.md` frontmatter `typography.ramp` declares the tuples; `styles.css` exposes `.font-display`, `.font-mono`, `.nums-tabular`, `.label-eyebrow`. All product chrome must use these tokens; raw size/weight/letter-spacing literals fail Stage 4 lint.

**Counter to.** Fonts-list-as-typography (naming Fraunces/Inter without the system); 700-weight in chrome (visually heavy at body sizes); proportional numerals everywhere (acceptable in prose, bad in product chrome); recreating eyebrows ad-hoc across 30+ component sites.

### DP-13 — Canvas-vs-chrome contract: Compose is the canvas; everything else is recessive chrome

Compose's primary artifact (the proposal / synthesis / contribution being authored) is the **canvas** — wide center column, paper background, full focus. Surrounding elements (top nav, coordination strip, sidebar tips, action selector) are **chrome** — visually recessive, smaller type, muted. Compose ships two view modes: **Edit** (chrome visible, inline affordances active) and **Read** (chrome collapsed, artifact reads as the published shape would).

- **Sources.** Makeswift's "Interact mode" (the strongest reference); Figma's canvas-vs-panels treatment; Notion's distraction-free mode.
- **Substrate mapping.** Compose page: artifact occupies 2/3 column; sidebar tips at 1/3 are visibly secondary (smaller type, raised background). Read-mode toggle in the Compose toolbar collapses sidebar and dims the coordination strip.
- **Multiplayer presence pattern** (Makeswift-derived). Co-authoring presence renders as an **overlapping avatar stack in the Compose toolbar**, not live cursors on the canvas. Atelier's co-edit occupancy is occasional (humans + agents pausing/resuming), not constant — cursors-on-canvas over-engineers for this load.
- **Counter to.** Form-shape Compose (everything equal weight, CMS-admin-panel feel); live-cursor multiplayer (mismatch with Atelier's pause/resume session model).

---

## Resolved open questions

### Q1 — Where does the embedded MCP chat fit?

**Resolution:** Dedicated `/connect` route with chat as one of three Connect surfaces (presence, MCP chat, external integrations). A global keyboard shortcut (`⌘K` or `?`) summons the chat from any surface as a slide-over panel. Chat is **not** a free-floating button on every page — that re-frames the dashboard as chat-flavored.

**Trigger to revisit.** If usage telemetry shows >70% of MCP chat invocations originate from a non-Connect surface, promote chat to a global drawer.

### Q2 — Compose form taxonomy

**Resolution:** Unified Compose surface with action-type selector at the top (Propose / Claim / Log Decision / Checkpoint). One form per action, but lives under one route (`/compose`) with the action selected via tabs. Matches Hive's empirical pattern and lowers IA cost.

### Q3 — Cold-visitor 30s view vs. returning-composer view

**Resolution:**

- **Cold visitor** lands on `/` with: brand statement (one paragraph), Compose action launcher, read-only Activity preview (last 10 events), prominent link to `/connect` for chat exploration.
- **Returning composer** lands on `/inbox` with action-shaped sections defaulted to `Needs your reaction` first.

Detection: cold = no `composer_id` cookie or `last_seen_at` >7d; returning = otherwise.

### Q4 — Three-loop framing surface treatment

**Resolution:** DP-8 stands. Loop = filter chip in Activity and Atlas; loop is **not** top-level nav.

### Q5 — Connect surface scope

**Resolution:** Connect contains:

- **Presence** (anchor `#presence`) — who's online, what surface, what session
- **External systems** (anchor `#systems`) — GitHub / Figma / Supabase Auth webhook health, last sync per integration
- **MCP chat** (anchor `#chat`) — natural-language exploration of the substrate; reachable globally via `⌘K`

### Q6 — Empty-state pattern for Tier-1 Deploy

**Resolution:** Stage 3 prototype ships seed-demo-data + a "first Tuesday" narrative scaffold. Cold visitor on a fresh deploy sees a populated dashboard (synthetic but illustrative) with a banner: "This is demo data. Run `atelier seed --remove` to clear it." The current "no contributions yet" state is the failure mode this prevents.

### Q7 — Scale-simulator port from Hive

**Resolution:** Ship `?scale=N` query param day one. Highest-leverage tool in the Hive codebase per `hive-dashboard-analysis.md`; trivial to port; gates ux-ui-auditor Phase 8 scale-budget validation in CI.

---

## Information architecture (locked)

Top-level nav (left to right, persistent across all surfaces):

```
[Atelier]   Compose   Inbox   Activity   Atlas   Connect          [⌘K] [composer]
─────────────────────────────────────────────────────────────────────────────────
[coordination strip: live · in-flight · locked · brainstorms]
─────────────────────────────────────────────────────────────────────────────────
[surface content]
```

| Route | Purpose | Default view | Substrate dependency |
|---|---|---|---|
| `/` | Cold-visitor home | Action launcher + Activity preview | none (read-only sample) |
| `/compose` | The wedge — author primitives | Action-type selector with last-used pre-selected | All 18 tools (most need brainstorm) |
| `/inbox` | Action-shaped attention | `Needs your reaction` first | territory.review_role + reaction_kind |
| `/activity` | Three-loop timeline | Recency desc, all loops | SSE broadcast (currently 30s poll) |
| `/atlas` | Historical projection | Search-led, relevance sort | find_similar (RRF) |
| `/connect` | Presence + integrations + chat | Presence anchor | sessions table + webhook handlers |

---

## Substrate gates (Stage 3 prototype mocks until shipped)

Per `substrate-inventory.md`, three gaps block real wiring:

1. **Brainstorm pipeline** — propose / react / get_proposals / synthesize / approve_plan + 3 tables
2. **SSE broadcast deployment** — `/api/events` endpoint + EventSource client + handler `publish()` calls
3. **Session checkpoints** — table + RPC + tool

Stage 3 prototype designs against the substrate's eventual shape — uses static fixtures matching the planned schema, with API call sites stubbed to return them. When the substrate ships these, the prototype's data layer swaps in without IA changes.

---

## Voice + copy rules (extends prototype CONVENTIONS.md)

- "So what?" in the first line of every panel.
- Banned words: "deflect" / "deflection," "non-preferred," "blocked" (use "not eligible"), "auto-upgraded."
- Banned framing: chat-as-IA. Every brainstorm primitive surfaces as a structured artifact, not a thread.
- Composer-specific language: use **composer**, **session**, **contribution**, **proposal**, **synthesis** consistent with NORTH-STAR §15 vocabulary lock. Don't soften to "user," "user input," "task," "comment."
- One primary CTA per surface (DP-7 carry-over): Compose CTA on `/`, the section's resolution CTA on each Inbox section, no CTA on Activity (read-only).

---

## Validation hooks for Stage 4

- **Token discipline.** Every component CSS value references a token from `prototype/DESIGN.md` frontmatter; no raw hex / rem literals (per CONVENTIONS).
- **Phase 8 dynamic-surface check.** Each of `/inbox`, `/activity`, `/atlas`, `/connect#presence` answers: default-view logic, filter/sort affordances above the fold, freshness contract, declared scale budget, server-side filter/sort.
- **Action-shape audit.** Every section header in `/inbox` is action-shaped (`Needs your X`), not status-shaped (`State: X`).
- **Agent-as-filter audit.** No top-level nav entry, route, or section header containing the word "agents" / "bots" / "AI workers."
- **Loop-as-chip audit.** No top-level route or nav entry containing "brainstorm" / "execute" / "continuity"; loops appear only as filter chips inside Activity and Atlas.

---

## What this doc does not decide

- Specific tool wire formats (implementation detail; lands in Atelier substrate PRs, not here).
- Visual design at component grain (handled by `prototype/DESIGN.md` extraction frontmatter, populated in Stage 3).
- The Atelier substrate's build sequence for the three blocking gaps (that's an Atelier ADR conversation, not a dashboard-blueprint conversation).
