# Design system — adopter reference

This page is the adopter-facing view of Atelier's design system (per
ADR-060). It mirrors the package-level README at
`prototype/src/lib/atelier/design/README.md` and adds the integration
points an adopter cares about when forking Atelier.

## Where it lives

The design package is `prototype/src/lib/atelier/design/`. It exports:

- `tokens.ts` — colors (light + dark), fonts, radii, elevations,
  motion, icon-stroke, type-ramp tuples. The canonical TypeScript
  source-of-truth.
- `globals.css` — Tailwind v4 `@theme` block + body/html reset + dark-mode
  token swap. Imported once in `prototype/src/app/layout.tsx`.
- Component primitives (`<Surface>`, `<Card>`, `<Panel>`, `<Eyebrow>`,
  `<Heading>`, `<Body>`, `<Mono>`, `<Button>`, `<Field>`, `<Chip>`,
  `<Tabs>`, `<Banner>`, `<EmptyState>`, `<LoadingSkeleton>`,
  `<ErrorPanel>`).
- `motion.ts` — duration + easing tokens and a `useReducedMotion()` hook.
- `icons.tsx` — sized re-exports (`Icon16`, `Icon20`, `Icon24`) of every
  `lucide-react` icon the substrate uses. Direct imports from
  `'lucide-react'` are forbidden outside this file (per ADR-060 D-3).

## Tier 1 — Reference Deployment

If you are running Atelier as-is, you do not interact with the design
package directly. Every Atelier-authored surface (home, sign-in,
`/atelier` lenses, observability, `/prototype/*` harness chrome) reads
from the same tokens; the deploy looks coherent out of the box.

## Tier 2 — Reference Implementation (forking + extending)

Forks customize Atelier in two layers:

1. **Token swap.** Edit `tokens.ts`'s color / font / type-ramp values.
   The Tailwind `@theme` block in `globals.css` mirrors the same shape;
   keep the two in sync (a follow-up TODO is to generate `globals.css`
   from `tokens.ts` at build time, deferred to PR E).
2. **Custom surfaces.** Build new pages against the primitives; they
   inherit the tokens automatically. Use the `lint-no-hex-literals`
   audit gate to enforce token discipline.

A fork that wants a completely different look (different palette,
different typography) can replace `tokens.ts` wholesale. The
primitives stay; the visual result becomes the fork's design language.

## Tier 3 — Specification (implementing on a different stack)

The design system is not load-bearing for the Atelier protocol; you can
implement Atelier (the 18-tool MCP surface + the schema + the
methodology) without adopting this design package. The audit gates are
the methodology contract; the design package is one implementation of
them.

If you are reimplementing in a non-React stack, the deliverables you
need from this package are:

- The token schema (color names, type-ramp tuple shape, motion durations).
- The primitive-API contract (what props each primitive exposes; what
  invariants — accessible empty / loading / error states — every
  consumer surface must render).
- The audit-gate semantics (no hex literals outside the token source;
  every surface accounted for via either migration or waiver).

## Adopter-prototype contract (under `/prototype/<adopter-project>`)

Per ADR-060, an adopter prototype mounted in the harness has a typed
contract via `.atelier/prototype.yaml`:

```yaml
design:
  theme: inherit | override
```

`inherit` (default): the prototype consumes the substrate's CSS
variables and renders coherent with Atelier's chrome.

`override`: the prototype declares its own `@theme` block. The harness
chrome continues to use Atelier tokens; the mounted content looks like
the adopter's design system.

This contract lands in PR D (harness migration). PR A only ships the
substrate-side package + its audit gates.

## Reference

- ADR-060 — `docs/architecture/decisions/ADR-060-unified-design-system-for-atelier-surfaces.md`
- Package README — `prototype/src/lib/atelier/design/README.md`
- Audit gates — `prototype/scripts/audits/`
- Waiver list — `prototype/scripts/audits/design-system-waivers.ts`
