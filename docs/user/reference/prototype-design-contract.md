# Prototype design contract

Reference for adopters mounting a prototype at `/prototype/<project>`
via `.atelier/prototype.yaml`. Source: ADR-060 PR E (closes ADR-057's
"TBD by implementation" on the harness-content styling relationship).

Atelier is self-hostable OSS. An adopter standing up Atelier against
an organization with its own brand guidelines may want their prototype
content to look like their design system, not Atelier's. The contract
below makes that explicit, named, and selectable per prototype.

## Two modes

`.atelier/prototype.yaml` declares the prototype's theme mode:

```yaml
design:
  theme: inherit | override
```

### `inherit` (default)

The prototype consumes the substrate's CSS custom properties via the
global cascade. The harness wraps the prototype in a `<section>` that
the substrate's tokens (declared in
`prototype/src/lib/atelier/design/globals.css`) reach via normal CSS
inheritance. The prototype's Tailwind classes, raw `var(--color-*)`
references, and the design package's primitives all resolve against
substrate tokens automatically.

This is the right choice when the adopter wants their prototype to look
coherent with Atelier's chrome — most adopters most of the time.

### `override`

The prototype declares its own `@theme` block in its own `styles.css`
and ships a parallel token set. The harness chrome (rail, drawer,
strategy panel, presence panel, mount info) continues to render with
Atelier's tokens; the mounted content renders with the adopter's. The
visual seam between frame and content is intentional under this mode.

The harness layout enforces this by applying `style={{ all:
'revert-layer' }}` on the wrapping `<section>` so cascading variables
reset at the section boundary. The adopter's `@theme` block then wins
inside.

## Token surface under `inherit`

The adopter can rely on these CSS custom properties:

**Colors (light + dark, swapped via `html.dark` / `.dark`):**

- `--color-canvas`, `--color-paper`, `--color-raised`
- `--color-rule`, `--color-rule-strong`
- `--color-ink`, `--color-ink-muted`, `--color-ink-subtle`,
  `--color-ink-inverse`
- `--color-primary`, `--color-primary-hover`
- `--color-success`, `--color-warning`, `--color-error`, `--color-info`
- `--color-loop-brainstorm`, `--color-loop-execute`,
  `--color-loop-continuity`

**Type families:**

- `--font-display` (Fraunces)
- `--font-body` (Inter)
- `--font-mono` (JetBrains Mono)

**Radius:** `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`

**Elevation:** `--shadow-sm`, `--shadow-md`, `--shadow-lg`

**Iconography:** `--icon-stroke-tight`, `--icon-stroke-default`

**Motion:** `--motion-fast`, `--motion-base`, `--motion-slow`,
`--motion-ease-standard`, `--motion-ease-emphasized`

The canonical source is
`prototype/src/lib/atelier/design/globals.css`; the values mirror
`prototype/src/lib/atelier/design/tokens.ts` (the TS source-of-truth
consumed by the design package primitives).

## Minimum `@theme` block under `override`

An `override`-mode prototype must declare at minimum:

```css
@import "tailwindcss";

@theme {
  /* Typography — the harness measures vertical rhythm against this. */
  --font-display: "YourDisplay", serif;
  --font-body: "YourBody", system-ui, sans-serif;
  --font-mono: "YourMono", ui-monospace, monospace;

  /* Colors — the harness will not visually correct mismatches. */
  --color-canvas: #...;
  --color-paper: #...;
  --color-ink: #...;
  --color-ink-muted: #...;
  --color-primary: #...;
}
```

Radius, elevation, and motion tokens are optional under `override` —
the harness has no contract on them — but most adopters will want to
declare a matching scale for visual consistency inside the prototype.

## Worked examples

### `inherit` consumer (the dashboard-northstar shape)

```tsx
// prototypes/your-project/components/SummaryCard.tsx
export function SummaryCard({ title, value }: Props) {
  return (
    <div className="bg-paper border border-rule rounded-lg p-4">
      <p className="label-eyebrow text-ink-subtle">{title}</p>
      <p className="font-display text-2xl text-ink">{value}</p>
    </div>
  );
}
```

Every utility (`bg-paper`, `border-rule`, `text-ink-subtle`, etc.)
resolves against the substrate's tokens. Dark mode swaps free.

```yaml
# .atelier/prototype.yaml
design:
  theme: inherit
```

### `override` consumer

```css
/* prototypes/your-project/styles.css */
@import "tailwindcss";
@source "./**/*.{ts,tsx}";

@theme {
  --font-body: "Söhne", system-ui, sans-serif;
  --color-canvas: #0a0a0a;
  --color-paper: #141414;
  --color-ink: #f5f5f5;
  --color-ink-muted: #a0a0a0;
  --color-primary: #ff5a1f;
}
```

```yaml
# .atelier/prototype.yaml
design:
  theme: override
```

The harness rail (left) renders with Atelier's warm-stone palette; the
content area (right) renders with the adopter's dark-canvas palette.
The seam is visible — by design.

## Why this contract exists

Atelier is self-hostable OSS. The default (`inherit`) lets adopters who
do not care about brand parity ship coherent UI for free. The escape
hatch (`override`) preserves an adopter's right to look like
themselves; the typed contract makes the choice explicit at config
time, not implicit at runtime via missing CSS.

Trace IDs: ADR-060 (this contract), ADR-057 (harness chrome owner),
ADR-059 (bundled config import that ships `design.theme` into the
runtime).
