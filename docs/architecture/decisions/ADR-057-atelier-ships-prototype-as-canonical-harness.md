---
id: ADR-057
trace_id: BRD:Epic-1
category: architecture
session: 2026-05-11-bb-meta-codify-refinement
composer: nino-chavez
timestamp: 2026-05-11T12:00:00Z
---

# Atelier ships `/prototype` as canonical harness chrome; projects provide content

**Summary.** Atelier owns a new top-level `/prototype/<project_id>` route that mounts harness chrome — reviewer drawer, strategy panels, annotation overlay, traceability resolver, presence indicator — over content the project provides. Annotations, strategy notes, traceability, and presence all use existing substrate primitives (`contributions` with `kind: 'design'`, `log_decision`, `get_context(scope_files)`, `sessions`); the only net-new substrate work is the route + harness components + a project-declared mount manifest (`.atelier/prototype.yaml`). Scope is intentionally bounded to harness chrome — Atelier does NOT host arbitrary builds, run sandboxed code, define methodology phases, or replace BC-pattern SliceShell. The dashboard north-star initiative is the first consumer (Phase 2 migration from standalone CF Pages to `/prototype/dashboard-northstar`).

**Rationale.**

The BB initiative dashboard north-star meta-codify evaluation (`atelier-dashboard-blueprint/META-CODIFY-EVALUATION.md` § "Refinement (2026-05-11)") surfaced a layered fork in the prior verdict. The original framing collapsed two concerns into one:

- **Prototype methodology** — slice-per-directory, BRD-trace, four-deliverable doc package, SliceShell paradigm. BB-specific opinion. Stays a usage pattern.
- **Prototype harness chrome** — reviewer drawer, strategy panels, annotation overlay, traceability resolver, presence. Generic UI primitives over substrate data the project already produces. Belongs in the substrate.

Five of six harness needs map directly to substrate primitives already shipped or scoped:

| Harness need | Substrate primitive |
|---|---|
| Annotations on a surface | `contributions` with `kind: 'design'` + `artifact_scope` pointing at the surface |
| Strategy notes per surface | `log_decision` writes; query by territory or trace_id |
| Traceability resolver (DP-N → research/§) | `get_context(scope_files)` + existing trace_id wiring |
| Presence on a surface (who's reviewing right now) | `sessions` table |
| Reviewer drawer (scenario / scale / loading toggles) | Generic UI; no substrate dep |
| Content rendering | **Project-owned** (Vite/Next/etc. build artifact, mounted via manifest) |

Only the reviewer drawer is net-new UI; the other four needs are thin chrome over data the substrate already holds. Building them outside Atelier means re-implementing what Atelier already exposes, then maintaining a separate write path to keep state in sync. The harness clears every test in the Atelier-feature decision rule (no stage opinions; no new tools beyond ADR-040 + ADR-054; no stage state in the schema; benefits from a scaffold + docs page).

The dashboard north-star initiative shipped Phase 1 as a standalone Cloudflare Pages deploy (`atelier-dashboard-northstar.pages.dev`) precisely because this substrate feature did not yet exist. Phase 2 — mounting that surface at `/prototype/dashboard-northstar` and getting the harness chrome for free — is the dogfooding case for this ADR. Without the route, every future prototype that wants annotations + traceability + presence re-implements the same chrome.

**Decision.**

Atelier ships a new top-level route, `/prototype/<project_id>`, that:

1. **Reads** a project-declared manifest at `.atelier/prototype.yaml` (schema TBD in a follow-up; minimum fields enumerated below) to discover the project's content path, traceability source, and per-surface strategy notes.
2. **Mounts** the project's built content (static assets from the declared `content_path`) under the route. Atelier does NOT execute the project's source — the project's own build pipeline produces the artifact.
3. **Renders harness chrome around the content** — reviewer drawer (scenario / scale / loading / empty toggles, generic), annotation overlay (drags `kind: 'design'` `contributions` rows tied to surface + coordinates), strategy panel (per-surface `log_decision` reads filtered by trace_id), traceability resolver (DP-N → research excerpt via `get_context(scope_files)`), presence chip (reads `sessions` filtered by surface).
4. **Writes** all reviewer actions through existing tools: annotations via `claim` (atomic create with `kind: 'design'`); strategy notes via `log_decision`; reads via `get_context`. No new tools; ADR-040 + ADR-054 surface lock preserved.
5. **Authenticates** via existing `/sign-in` flow; the route requires an authenticated composer to write annotations or strategy notes (reads can be gated more loosely per project, but default is auth-required).

Minimum `.atelier/prototype.yaml` fields (full schema specified in a follow-up ADR or inline addendum):

```yaml
name: dashboard-northstar
content_path: prototypes/dashboard-northstar/dist  # built artifact location
traceability_source:
  design_principles: docs/content/design-principles.md
  research_dir: research/
surfaces:
  - route: /compose
    strategy_notes: |
      Compose is the wedge (DP-7). Action selector → propose / claim / log_decision / checkpoint.
    dps: [DP-1, DP-3, DP-7, DP-13]
  # ... one entry per surface
```

The `<project_id>` URL segment is reserved by Atelier (one project per Atelier instance is the v1.x assumption; multi-project mounting is a re-evaluation trigger below).

**Consequences.**

- **Phase 2 unblocked.** The dashboard north-star initiative migrates from CF Pages to `/prototype/dashboard-northstar` per `atelier-dashboard-blueprint/HANDOFF.md` action #6. Three migration layers per the handoff: surface content → `atelier/prototypes/dashboard-northstar/`; design tokens → canonical into Atelier's webapp design-system layer; prototype-only chrome (DemoBanner / EmptyState / Skeleton / `?empty=1` / `?loading=1` / `?scale=N`) → retired in favor of the harness drawer.
- **ADR-001 amendment required.** ADR-001 names "the prototype web app" as a single artifact; the substrate now hosts multiple projects' prototypes alongside its own. Small clarifying amendment per handoff action #4 — separate PR.
- **No new tools.** Annotation and strategy-note writes pass through `claim` and `log_decision`; reads through `get_context`. `TOOL_NAMES` tuple length unchanged. ADR-040 surface lock preserved. ADR-056 expansion protocol does NOT apply (no surface expansion).
- **`.atelier/prototype.yaml` becomes a recognized config surface.** Lives alongside any future `.atelier/*` configs. Schema lives in a follow-up; minimum fields above lock the shape sufficient to ship Phase 2.
- **Project build pipelines stay project-owned.** Atelier mounts a built artifact; it does not run Vite, Next, or any project's source. No CSP / sandboxing / supply-chain concerns from the substrate side. Projects bring their own build.
- **BB skill branches on target.** Per the META-CODIFY refinement, `/blueprint-prototype` gains a three-paradigm selector: Atelier-hosted (`prototype.host: atelier` — this ADR's case), standalone deploy (today's CF Pages pattern), BC-pattern SliceShell (host-product slice demonstrations). BB harness work already landed in `wip/big-blueprint`.
- **`traceability.json` increments.** adrs:56→57; decisions:58→59; new D59 entry referencing this ADR.

**What this does NOT decide.**

- **The full `.atelier/prototype.yaml` schema.** The minimum-field set above is enough to ship Phase 2; the long-tail schema (e.g., custom auth requirements, scenario presets per surface, content-versioning policy) is a follow-up. Could land as an inline addendum to this ADR or as its own ADR depending on how scope grows during implementation.
- **Whether multiple projects can mount under one Atelier instance.** v1.x assumes one project per Atelier (the `<project_id>` URL segment is structural, not currently variable). Multi-tenant mounting is a re-evaluation trigger below.
- **Sandboxing / CSP / build-pipeline hosting.** Out of scope — Atelier mounts a built artifact path. Projects whose builds need isolated environments deploy standalone instead.
- **Whether the legacy `/atelier` lens-first dashboard moves.** Action #2's placeholder landing (separate PR) labels `/atelier` as legacy; relocation to `/atelier-legacy` is a separate move that can land with webapp v2.
- **Annotation overlay coordinate system.** The harness needs a way to anchor an annotation to a region of the surface (DOM selector, bounding-box, etc.). Decision deferred to implementation; the data shape (`contributions.artifact_scope`) does not change.
- **Reviewer drawer scenario / scale / loading toggle contract.** The harness exposes toggles; the project's content listens via URL params or a postMessage channel. Detail deferred to implementation. The standalone north-star prototype already supports `?empty=1` / `?loading=1` / `?scale=N` as the precedent.

**Re-evaluation triggers.**

- A second project wants to mount its prototype in the same Atelier instance → revisit whether `<project_id>` is variable + adjust route shape; resolve any auth/data-isolation concerns the v1.x single-project assumption hides.
- The harness chrome needs project-specific extension (e.g., a custom panel for a project's domain) → revisit whether the harness exposes a plugin / slot interface or whether project-specific UI lives in the project's content + the harness wraps generic primitives only.
- Annotation volume on a single surface exceeds what overlay rendering can handle (>500 annotations / surface) → revisit overlay strategy (clustering, filtering, server-side pagination).
- Projects start abusing the manifest to declare execute-side concerns (e.g., custom routing, dynamic content fetched at render time) → revisit the scope boundary; harden the "Atelier mounts static artifacts only" invariant or grow it deliberately.
- The reviewer-drawer toggle contract (`?empty=1` / `?loading=1` / `?scale=N`) proves insufficient (e.g., projects need richer state injection) → formalize a postMessage protocol; document in the schema.
- BB-pattern initiatives consistently produce surfaces that the harness can't render coherently (e.g., the trace_id / DP linkage isn't present) → revisit whether BB methodology should mandate the manifest fields the harness assumes, or whether the harness should degrade gracefully.
