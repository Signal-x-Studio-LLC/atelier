# `lib/atelier/design` — Atelier design system

This package is the substrate's canonical design language. It lands per
ADR-060 ("Unified design system covers every Atelier-authored surface")
and supersedes the per-surface inline styles / CSS modules / mixed
Tailwind that previously coexisted across the home, sign-in, `/atelier`
lenses, observability, and harness chrome.

## Contents

| File | Role |
|---|---|
| `tokens.ts` | Canonical TS source-of-truth (colors light + dark, fonts, radii, elevations, motion, icon-stroke, type-ramp tuples) |
| `globals.css` | Imported once in `app/layout.tsx`; declares the Tailwind v4 `@theme` block + body/html reset + dark-mode token swap + `@source` directives |
| `motion.ts` | Duration / easing tokens + `useReducedMotion()` hook + `motionSafe()` helper |
| `components/` | React primitives — see API table below |
| `icons.tsx` | Sized re-exports (`Icon16` / `Icon20` / `Icon24`) of every `lucide-react` icon the substrate uses |
| `icons/custom/` | Atelier-specific icons that `lucide-react` does not cover; SVGR-imported (empty in PR A) |
| `index.ts` | Single entry point |

## Primitive API

| Primitive | Props (load-bearing only) | Notes |
|---|---|---|
| `<Surface>` | `tone` (canvas \| paper \| raised), `as` | Base tone wrapper |
| `<Card>` | `tone`, `elevation` (none \| sm \| md \| lg) | Bordered, rounded-lg |
| `<Panel>` | `tone`, `as` | Raised by default; padded |
| `<Heading>` | `scale` (displayLg \| displayMd \| headingLg \| headingMd \| headingSm), `as` | Default `<h2>`; consumers set `as="h1"` for the single per-route h1 |
| `<Body>` | `scale` (bodyLg \| bodyMd \| bodySm \| caption), `as` | |
| `<Eyebrow>` | `as` | Renders the canonical 10px / uppercase / tracking eyebrow label |
| `<Mono>` | `as` | Tabular numerals; defaults to `<code>` |
| `<Button>` | `variant` (primary \| secondary \| ghost \| danger), `size` (sm \| md \| lg) | |
| `<Field>` | `label`, `hint`, `error` | Labelled input; renders error state inline |
| `<Chip>` | `tone` (neutral \| brainstorm \| execute \| continuity \| info \| success \| warning \| error) | Loop chips render the canonical dot |
| `<Tabs>` | `tabs`, `active`, `onChange`, `ariaLabel` | Controlled, ARIA-correct |
| `<Banner>` | `tone` (info \| success \| warning \| error), `title` | `role="status"` or `role="alert"` (error) |
| `<EmptyState>` | `title`, `description`, `action`, `icon` | The canonical empty-state shape |
| `<LoadingSkeleton>` | `lines` | `aria-busy` + `aria-live="polite"` |
| `<ErrorPanel>` | `title`, `message`, `action` | `role="alert"` |

## Consumer pattern

```tsx
// app/some-route/page.tsx
import { Card, Heading, Body, Button } from '../../lib/atelier/design';

export default function Page() {
  return (
    <Card>
      <Heading as="h1" scale="displayMd">Atelier</Heading>
      <Body scale="bodyMd">Coordination + canonical artifact.</Body>
      <Button variant="primary">Sign in</Button>
    </Card>
  );
}
```

```tsx
// Icons — sized at import, not at the call site
import { Icon20 } from '../../lib/atelier/design/icons';

<Icon20.Search />            // 20×20, stroke 1.5, aria-hidden
<Icon20.Lock aria-label="Locked" />  // override aria-hidden for action icons
```

`globals.css` is imported exactly once (in `app/layout.tsx`); never
re-import it inside primitives or routes. The cascade reaches every
route through the root layout.

## Token discipline

Every CSS value in a primitive references a token. Never raw hex / rem
literals; never Tailwind arbitrary values (`bg-[#...]`). The
`lint-no-hex-literals` audit gate enforces this against every
Atelier-authored route — see `prototype/scripts/audits/`.

## Migration status (ADR-060)

PR A (this) ships the package + closes the 8px-frame regression via
`app/layout.tsx`. Existing surfaces (home, sign-in, `/atelier/*`,
harness chrome) continue rendering through their current paths; the
`design-system-waivers.ts` file lists every Atelier-authored file
that still violates the gates, bound to the migration PR that retires
the entry (B / C / D / E).

See `docs/user/reference/design-system.md` for the adopter-facing version
and `docs/architecture/decisions/ADR-060-unified-design-system-for-atelier-surfaces.md`
for the load-bearing rationale.
