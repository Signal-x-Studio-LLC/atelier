---
id: ADR-060
trace_id: ADR-060
category: architecture
session: 2026-05-13-design-system-consolidation
composer: nino-chavez
timestamp: 2026-05-13T00:00:00Z
---

# Unified design system covers every Atelier-authored surface

**Summary.** Atelier ships a custom design language. The dashboard-northstar prototype (PRs #123-132, 2026-05-12) established it: design tokens in `prototype/DESIGN.md` frontmatter mirrored into Tailwind v4 `@theme` blocks in `prototypes/dashboard-northstar/styles.css`, 14 design principles (DP-1..DP-14) in `atelier-dashboard-blueprint/docs/content/design-principles.md`, 10 design-system dimensions (D-1..D-10) per the blueprint's `research/design-system-audit.md`, and two audit gates (`audit-contrast.mjs` + `lint-design-system.mjs`) wired into CI for the v2 surfaces. **None of that propagates to Atelier's other user-facing surfaces.** The substrate home page renders with inline `style={}` objects carrying hardcoded hex; the `/atelier/*` legacy lenses + `/atelier/observability` use ad-hoc `.module.css` files with locally-scoped colors; the `/prototype/*` harness chrome consumes Tailwind utilities partially but routes its decisions, presence, and traceability panels through a different vocabulary again. The result is structurally visible: every Atelier-authored route renders with an 8px white frame because no `globals.css` resets the body margin, and the home page, lenses, harness chrome, and v2 surfaces feel like four products. This ADR promotes the dashboard-northstar's design discipline to a substrate-owned package that **every** Atelier-authored surface consumes, and expands the audit gates accordingly.

**Rationale.**

Atelier's premise (per NORTH-STAR §1) is a self-hostable OSS template for mixed teams of humans and agents to concurrently author one canonical artifact. The methodology rule from `~/.claude/CLAUDE.md` "Design-system audit scope (custom design language)" names the operating discipline: any initiative shipping a custom design language must cover 15 design-system dimensions (5 research + 10 prototype). The dashboard-northstar applied this rule to its own v2 webapp surfaces; the substrate's own surfaces have never been held to it.

Three structural costs follow:

1. **Dogfooding fails.** Atelier teaches adopters to ship coherent UI for their own projects but cannot demonstrate coherence on its own deployed surfaces. The 8px white-frame regression (browser default `body { margin: 8px }` showing through because no `globals.css` exists) is one of many symptoms.
2. **Adopter onboarding leaks.** When an adopter clones Atelier and adds their own surfaces, they have four examples to copy from (home inline-style, lens CSS-modules, harness mixed, v2 Tailwind+tokens) without a canonical "this is how Atelier surfaces are built" answer.
3. **The harness contract weakens.** ADR-057 frames the `/prototype/*` route as harness chrome wrapping content the project provides. If the harness chrome and the mounted prototype disagree on type ramp, color tokens, spacing, or focus rings, the harness reads as a foreign frame around the content rather than continuous chrome.

The dashboard-northstar's discipline is the closest thing to canonical that Atelier has shipped. It includes:
- Color tokens (semantic + accent + loop-specific) declared in Tailwind v4 `@theme` blocks; light + dark variants
- Typography fonts (`Fraunces` / `Inter` / `JetBrains Mono`) but **no typography ramp tuples** (size+leading+weight+tracking+family per token) — gap from D-2
- Radius scale (sm/md/lg/xl)
- Elevation scale (shadow-sm/md/lg)
- Tailwind `@source` directives covering `prototypes/dashboard-northstar/**` and `prototype/src/app/prototype/**` (harness chrome) — but NOT `prototype/src/app/atelier/**` or `prototype/src/app/page.tsx`
- DP-1..DP-14 (design principles) and D-1..D-10 (design dimensions) documented in the blueprint repo
- Two audit gates (`audit-contrast.mjs` + `lint-design-system.mjs`) running in CI against `/atelier/{compose,inbox,activity,atlas,connect}` only

Promoting this discipline to substrate-wide requires four moves. Each is small individually; the bundle is the load-bearing decision this ADR records.

**Decision.**

1. **A substrate-owned design package lives at `prototype/src/lib/atelier/design/`.** The package exports:
   - `tokens.ts` — color, spacing, radius, elevation, motion, type-ramp-tuple tokens as `as const` TS objects. Source of truth; the Tailwind `@theme` block in `globals.css` references the same values. Type ramp tuples close the D-2 gap (5-7 named scales each with size+leading+weight+tracking+family).
   - `globals.css` — `@import "tailwindcss"` + `@theme` block referencing `tokens.ts` values + body/html reset (`* { box-sizing: border-box }`, `html, body { margin: 0; min-height: 100% }`) + `.dark` / `.light` root class theme swap + Tailwind `@source` directives covering **every** Atelier-authored route (`prototype/src/app/**`, `prototypes/**`).
   - Component primitives — `<Surface>`, `<Card>`, `<Panel>`, `<Eyebrow>`, `<Heading>`, `<Body>`, `<Mono>`, `<Button>`, `<Field>`, `<Chip>`, `<Tabs>`, `<Banner>`, `<EmptyState>`, `<LoadingSkeleton>`, `<ErrorPanel>`, `<HelpTip>`. Each is a thin React wrapper using token-referencing Tailwind utilities. Implementer hint: if a primitive needs a CSS-module escape hatch, that's a smell — the primitive should expose props, not styling holes.
   - `motion.ts` — durations + easing curves; one helper for "respect prefers-reduced-motion" wrapper.
   - Index re-exports everything.

2. **Every Atelier-authored surface consumes from `lib/atelier/design/`.** Concretely:
   - `prototype/src/app/layout.tsx` imports `globals.css` (closes the 8px-frame regression).
   - `prototype/src/app/page.tsx` (home), `prototype/src/app/sign-in/**`, `prototype/src/app/atelier/**` (lenses + observability + role-aware shells), `prototype/src/app/prototype/[project]/_components/**` (harness chrome) all rewrite against the primitives. Inline `style={}` objects and ad-hoc `.module.css` retire.
   - The `prototypes/dashboard-northstar/styles.css` `@theme` block is dropped in favor of importing the substrate's `globals.css`. The dashboard-northstar prototype becomes a consumer of the substrate's design system, not the source-of-truth holder.

3. **Audit gates expand to cover every Atelier-authored route.** `audit-contrast.mjs` and `lint-design-system.mjs` run against:
   - `prototype/src/app/page.tsx`
   - `prototype/src/app/sign-in/**`
   - `prototype/src/app/atelier/**`
   - `prototype/src/app/prototype/[project]/_components/**`
   - `prototypes/dashboard-northstar/**` (already covered)
   New CI check `lint-no-hex-literals.mjs` fails any TSX / CSS file outside `__bundled__/`, `node_modules/`, and the `tokens.ts` source-of-truth that contains a hex literal. Tailwind class lint (no arbitrary values like `bg-[#abc]` except in declared token slots) wired into the same script.

4. **DP-1..DP-14 + D-1..D-10 apply to every Atelier-authored surface.** The blueprint's design-principles + design-system-dimensions docs are no longer scoped to v2-only. The substrate's own surfaces are subject to the same gates: token discipline, no banned vocabulary (`design-principles.md §Voice + copy`), focus-visible, exactly one `<h1>`, skip-nav (per Phase 3 item 5 / ADR-057 a11y), responsive sanity at 375px, empty/loading/error states explicit.

5. **Generator contract: new surfaces start design-system-correct.** When Atelier scaffolds a new surface (current shape: `atelier init` + `atelier surface add`), the generated template imports `globals.css`, uses the design primitives, and ships an empty/loading/error trio out of the box. Adopters never reach the "three vocabularies" state.

**Alternatives considered.**

- **Ship a shared package but leave existing surfaces as-is.** Rejected. Code-archaeology cost compounds; new adopters see four examples to copy and pick wrong; the audit gates can't cover surfaces that don't use the package. The cost of migration is upfront and bounded; the cost of not migrating is permanent and unbounded.
- **Use a third-party library (Radix, shadcn-as-installed, BigDesign).** Rejected per the existing canonical-pattern-first rule + the dashboard-northstar's already-shipped custom language. The custom language exists; the gap is that it isn't substrate-wide. A third-party library would discard the v2 design work + force every adopter to consume a vendor.
- **Generator-first, migrate later.** Considered. Rejected as the primary plan because the broken state (4 vocabularies + 8px frame) is visible NOW and undermines the adopter pitch. The migration is the proof. Generator support follows in the same package.
- **One mega-PR vs. per-surface-family migration.** A pure mega-PR is unreviewable (10+ surfaces + audit-gate config + every styled file); a pure per-family migration leaves the audit gate inconsistent during cutover (the gate cannot enforce against home until home is migrated, so regressions during the migration go undetected). Both rejected in favor of the package-first-then-waiver-retirement sequencing committed below.

**Trace IDs.** ADR-060 (this), ADR-057 (harness chrome owner), ADR-052 (Cloudflare deploy host that surfaces the regression), ADR-059 (data-layer port that unblocked the deploy). Methodology rules invoked: `~/.claude/CLAUDE.md` "Design-system audit scope (custom design language)" + canonical-pattern-first + Phase 8 IA/UX dynamic-surface gates (apply equally to substrate surfaces).

**Migration sequencing — package-first, waiver-pattern, five PRs.**

The mega-PR-vs-per-family question has an honest answer that uses both, because a pure mega-PR is unreviewable (10+ surfaces touching audit-gate config + tokens + every styled file) and a pure per-family migration leaves the audit gates inconsistent during the cutover (the substrate-wide gate cannot enforce against home until home is migrated; without the gate landing globally on day one, regressions during the migration go undetected). The waiver pattern resolves the contradiction: the gate lands once, accepts current state via a typed waiver list (`prototype/scripts/audits/design-system-waivers.ts` exporting `{ path: string; reason: string; until_pr: string }[]`), and each migration PR retires its own entries. CI fails any PR that adds a waiver without an `until_pr` reference and fails any migration PR that does not retire the corresponding entries.

Five PRs:

1. **PR A — Package foundation.** `prototype/src/lib/atelier/design/` ships with: `tokens.ts` (the canonical TS source-of-truth — type ramp tuples close D-2; colors mirror the current `@theme` block in `prototypes/dashboard-northstar/styles.css`); `globals.css` (Tailwind `@import`, `@theme` referencing `tokens.ts`, `@source` covering every Atelier-authored route, body/html reset, `.dark`/`.light` root-class swap); a minimal primitive set (`<Surface>`, `<Card>`, `<Panel>`, `<Eyebrow>`, `<Heading>`, `<Body>`, `<Mono>`, `<Button>`, `<Field>`, `<Chip>`, `<Tabs>`, `<Banner>`, `<EmptyState>`, `<LoadingSkeleton>`, `<ErrorPanel>`); icons re-export per the iconography decision below; `motion.ts` with `prefers-reduced-motion` helpers. `prototype/src/app/layout.tsx` imports `globals.css` (closes the 8px-frame regression immediately, because the body reset fires for every route — even unmigrated ones). Audit gates expand `--paths` to cover every Atelier-authored route. Waiver file lands with current-state entries for every unmigrated surface, each citing the PR letter that retires it.

2. **PR B — Home + sign-in migration.** `app/page.tsx`'s inline `styles` const replaced by primitives. `app/sign-in/**` migrated. Waiver entries for these files removed; audit gates fully enforced on them.

3. **PR C — `/atelier/*` lenses + observability migration.** The five role-aware lenses (`Lens.module.css`, `LensSelector.module.css`, `LensUnauthorized.module.css`, `Panel.module.css`) and `/atelier/observability` (`Observability.css`) rewrite against primitives. Token discipline replaces hardcoded dark-mode values duplicated across `.module.css` files. Waiver entries retired.

4. **PR D — `/prototype/*` harness chrome migration.** The eight rail-section components (`ReviewerDrawer`, `StrategyPanel`, `TraceabilityPanel`, `PresencePanel`, `AnnotationsRailSection`, `ProjectChrome`, `AnnotationOverlay`, `MountBlock`) consume primitives. The HelpTip already in flight (PR #138) moves from `prototype/src/app/prototype/[project]/_components/HelpTip.tsx` to `prototype/src/lib/atelier/design/components/HelpTip.tsx` and is re-exported via the package index; existing harness imports update. Waiver entries retired.

5. **PR E — Cleanup + generator.** The dashboard-northstar prototype's local `@theme` block in `prototypes/dashboard-northstar/styles.css` is removed; the file becomes a thin import of the substrate's `globals.css` (per the adopter contract below). The waiver file is deleted (it should be empty by this PR; the deletion is the assertion). The generator template (`atelier surface add` scaffold) is updated to consume the package by default.

PR A and PR B can land in either order against A's foundation; PR C and PR D can land in parallel against A; PR E gates on all four. The total reviewable surface is ~5 commits of ~300-600 LOC each rather than one 3000-LOC commit; the audit gates are global from PR A; the waiver list provides visible accountability that no surface is forgotten.

**Iconography library decision — `lucide-react` canonical, sized re-exports, custom-icon escape hatch.**

`lucide-react` is already a dependency consumed by the v2 dashboard-northstar surfaces, so the decision committed here is the consumption pattern, not the library choice. "Use lucide" alone leaves three real questions open: tree-shaking discipline, sizing contract, and custom-icon overflow. The consumption pattern in the design package:

- `prototype/src/lib/atelier/design/icons.ts` re-exports the named lucide icons the substrate uses, each wrapped at a canonical size variant. Three size tiers (`Icon16`, `Icon20`, `Icon24`) with stroke-width tokens (`--icon-stroke-tight: 1.5`, `--icon-stroke-default: 2`) sourced from `tokens.ts`. Every consumer imports from `lib/atelier/design/icons`, never from `lucide-react` at call sites — the indirection is the tree-shaking gate, because new icons require an addition to the file and addition surfaces in PR review.
- Custom icons (when lucide lacks a domain-specific shape, e.g., a "loop" indicator carrying brainstorm/execute/continuity semantics) live in `prototype/src/lib/atelier/design/icons/custom/` as `.svg` files imported as React components via SVGR. Each custom icon implements the same size-tier API. The bar for adding one: the lucide library's set has been searched and lacks a near-match documented in the PR description.
- An eslint rule (or audit-gate addition in `lint-design-system.mjs`) fails any import from `'lucide-react'` outside `design/icons.ts`. The rule is the enforcement layer; PR review is the discretion layer for additions to `icons.ts`.

This closes the D-3 gap (iconography library decision) from `atelier-dashboard-blueprint/research/design-system-audit.md`. The decision lives inside ADR-060 because it is structurally part of the design package, not a separable choice with its own load-bearing rationale.

**Adopter-side requirements for prototypes mounted in the harness — recommendation, not requirement, with a typed contract.**

Adopter prototypes mounted at `/prototype/<adopter-project>` per ADR-057 are content the adopter authors; the harness wraps it. The question this ADR resolves is what ADR-060's design-system commitment obligates adopters to. The answer is "recommend, do not require," because Atelier is self-hostable OSS that an adopter may stand up against an organization with its own brand guidelines that supersede Atelier's tokens. A hard requirement that adopter prototypes consume Atelier tokens breaks the self-hostable contract; a strong recommendation with a typed contract lets adopters opt in to coherence while preserving their right to look like themselves.

The typed contract lives in `.atelier/prototype.yaml`:

```yaml
design:
  theme: inherit | override
  # inherit (default): the prototype consumes the substrate's CSS variables
  # (--color-*, --font-*, --radius-*, --shadow-*) and renders coherent with
  # Atelier's chrome. The harness wraps the prototype in a <section> that
  # applies the substrate's tokens via :root or :scope; the prototype's
  # Tailwind classes resolve against them automatically.
  #
  # override: the prototype declares its own @theme block in its own
  # styles.css. The harness chrome continues to use Atelier tokens; the
  # mounted content looks like the adopter's design system. The frame and
  # the content are visually distinct, by adopter intent.
```

The substrate's responsibilities under this contract:

- `globals.css` exposes the full token set as CSS custom properties on `:root`.
- The harness layout (`/prototype/[project]/layout.tsx`) reads `design.theme` from the bundled prototype manifest (per ADR-059) and conditionally scopes the token cascade. `inherit` lets the cascade reach the prototype content; `override` resets cascading variables on the prototype's content container so the prototype's own theme block takes precedence.
- A doc at `docs/user/reference/prototype-design-contract.md` explains both modes with examples, lists every CSS custom property the prototype can rely on under `inherit`, and shows the minimum `@theme` block an `override` prototype needs (typography + colors at a minimum, because the harness measures vertical rhythm against the token type ramp).

The adopter's responsibilities under the contract:

- If `theme: inherit` (default): nothing extra. Use Tailwind utilities or raw `var(--color-*)` references; the cascade handles the rest.
- If `theme: override`: ship your own `@theme` block with at minimum the typography + color tokens. The harness will not visually correct mismatches; that is the price of override.

`prototypes/dashboard-northstar/` is the first `inherit`-mode consumer: PR E above drops its local `@theme` block precisely because it inherits from the substrate's `globals.css`. An adopter who wants their dashboard to look like their brand sets `theme: override` and ships their own theme block.

This closes ADR-057's open question about the harness's relationship to the mounted prototype's styling. ADR-057 deferred the relationship to "TBD by implementation"; ADR-060 makes it the recommend-with-typed-contract above.

**Out of scope for this ADR.**

- The HelpTip primitive currently in flight in PR #138 lands as scoped (inside `prototype/src/app/prototype/[project]/_components/`); PR D moves it into the package. Not wasted work — the component is correct as-is; the placement migrates with the rest of the harness in PR D.

**Failure mode if not adopted.**

The 8px white frame on every Atelier surface stays. The home page, sign-in, lenses, observability, and harness chrome continue to drift from the v2 design as PRs land. The dogfooding case for "Atelier teaches adopters to ship coherent UI" gets weaker every week. Within two M-cycles, the audit-contrast.mjs / lint-design-system.mjs gates cover surfaces that themselves don't represent Atelier to a visitor. Adopters who land on the home page first form a "this looks unfinished" impression before reaching anything the gates protect.
