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
- **One mega-PR vs. per-surface-family migration.** Migration shape is implementation-level, not load-bearing here. The ADR commits to "every surface migrates"; the sequencing PR can decide chunk shape after the package lands.

**Trace IDs.** ADR-060 (this), ADR-057 (harness chrome owner), ADR-052 (Cloudflare deploy host that surfaces the regression), ADR-059 (data-layer port that unblocked the deploy). Methodology rules invoked: `~/.claude/CLAUDE.md` "Design-system audit scope (custom design language)" + canonical-pattern-first + Phase 8 IA/UX dynamic-surface gates (apply equally to substrate surfaces).

**Out of scope for this ADR.**

- The migration sequencing (mega-PR vs. per-surface-family). Decision deferred to the PR that lands the package.
- The HelpTip primitive currently in flight in a background agent. It lands as scoped; on merge it MOVES into `lib/atelier/design/` in the consolidation PR. Not wasted work; just temporary placement.
- Iconography library decision (D-3 gap from `design-system-audit.md`). `lucide-react` is already in use in v2 surfaces; canonicalize via a separate small ADR or fold into the consolidation PR. Not blocking this ADR.
- Adopter content/prototype surfaces (e.g., a customer's own dashboard mounted at `/prototype/<their-project>`). They consume the substrate's design tokens by virtue of importing the same Tailwind layer; whether they additionally adopt the primitive components is their call. This ADR sets the substrate-side contract, not the adopter-side requirement.

**Failure mode if not adopted.**

The 8px white frame on every Atelier surface stays. The home page, sign-in, lenses, observability, and harness chrome continue to drift from the v2 design as PRs land. The dogfooding case for "Atelier teaches adopters to ship coherent UI" gets weaker every week. Within two M-cycles, the audit-contrast.mjs / lint-design-system.mjs gates cover surfaces that themselves don't represent Atelier to a visitor. Adopters who land on the home page first form a "this looks unfinished" impression before reaching anything the gates protect.
