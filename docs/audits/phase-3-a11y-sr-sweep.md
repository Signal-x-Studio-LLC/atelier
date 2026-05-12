---
title: Phase 3 item 5 - a11y SR-sweep (automatable portion)
status: partial - automatable portion landed; human SR pass open
date: 2026-05-12
related:
  - integration.md §3 line 84 (atelier-dashboard-blueprint)
  - integration.md §5 Block 5 voice + a11y gates
  - research/a11y-baseline-audit.md (21/21 WCAG AA baseline)
  - docs/methodology/METHODOLOGY.md (canonical state)
  - ~/.claude/CLAUDE.md "IA / UX audit scope" Phase 8 rules
  - wip/big-blueprint/docs/design-system-audit.md (D-7 a11y baseline)
---

# Phase 3 item 5 — accessibility SR-sweep

## Scope split (honesty discipline)

Item 5 as written in integration.md §3 line 84 reads:

> "NVDA + VoiceOver on Compose, Inbox, Activity."

NVDA and VoiceOver are interactive screen readers. An AI session cannot
drive them. This audit splits item 5 into two parts:

- **Automatable portion (this PR, landed):** axe-core static audit,
  keyboard-only navigation traces, skip-nav + landmark contract,
  live-region inventory, reduced-motion clamp, h1 count - all running
  in CI via Playwright at every PR that touches `prototype/**` or the
  workflow file.
- **Human portion (open carry-forward):** actual NVDA pass on Windows
  and VoiceOver pass on macOS, with a real composer driving real flows
  (propose -> react -> synthesize -> approve_plan; filter-chip swap on
  Inbox; SSE prepend on Activity). Tracked in the "Open carry-forward"
  section below.

The merged PR closes the automatable portion of item 5. It does NOT
close the human-SR portion. Commit message and PR title reflect this
split.

## Methodology

The automatable portion runs as a separate Playwright config
(`prototype/playwright.a11y.config.ts`) that reuses the IA/UX DOM
suite's globalSetup (real Supabase Auth user, OTP sign-in, storage
state). Test file:
`prototype/e2e/a11y/sr-sweep.spec.ts`.

Surfaces in scope (DP-7 / DP-1 / DP-4 wedges):

- `/atelier/compose` — propose form, action tabs, presence stack
- `/atelier/inbox` — action-shaped sections, anchor chips
- `/atelier/activity` — SSE-driven freshness timeline

For each surface the suite asserts:

| Check | Tool | Gate |
|-------|------|------|
| axe-core full audit (WCAG 2.0 / 2.1 A + AA) | `@axe-core/playwright` | fail on `critical` impact; report `serious`/`moderate`/`minor` as annotations |
| Skip-nav present + targets `<main>` landmark | DOM query | fail on missing |
| Skip-nav is the first keyboard-focusable element | `keyboard.press('Tab')` | fail on mismatch |
| No focus trap across 30 tab stops | `keyboard.press('Tab')` loop | fail if same focused element repeats >=5 times consecutively |
| Exactly one `<h1>` per initial render | DOM count | fail on count != 1 |
| At least one live-region affordance (`role="status"`, `role="alert"`, `aria-live`) | DOM count | fail on count == 0 |
| Reduced-motion clamp on global transitions | dedicated browser context with `reducedMotion: 'reduce'` | fail if computed transition-duration matches the un-clamped 0.12s value |

axe-core rules invoked (transitively, via the WCAG tag set):

- `color-contrast` (the 21/21 baseline floor)
- `landmark-one-main`
- `page-has-heading-one`
- `label`, `label-title-only`
- `link-name`, `button-name`
- `image-alt`
- `aria-allowed-attr`, `aria-required-attr`, `aria-roles`, `aria-valid-attr-value`
- `duplicate-id`, `duplicate-id-aria`
- `tabindex` (warns on positive tabindex)
- `focus-order-semantics`
- `region` (any non-landmark content)
- `bypass` (a "skip" mechanism must exist - this is what skip-nav satisfies)
- `meta-viewport` (no `user-scalable=no`)

`color-only-information` is enforced transitively by the contrast rule +
the existing 21/21 baseline; the suite does not re-implement that
check.

## Results

Pass/fail per surface is reported as the Playwright suite's exit code.
CI logs (uploaded as `playwright-report-${run_id}` artifact on failure)
contain the per-test `axe-summary` annotation listing the count of
critical / serious / moderate / minor findings, plus per-violation
annotations for the serious tier (these are reviewed at each PR but do
not block merge).

The 21/21 WCAG AA contrast baseline from
`atelier-dashboard-blueprint/research/a11y-baseline-audit.md` is the
static contrast floor; this suite re-asserts contrast at every CI run
so a token tweak that breaks the floor surfaces as an axe violation,
not a silent regression.

## Affordances added by this PR

To make the suite green, the following structural a11y affordances
land alongside the test suite:

- `prototype/src/app/atelier/_components/SurfaceShell.tsx` - shared
  scaffolding: `<a data-testid="skip-nav" href="#atelier-main-content">`
  followed by `<main id="atelier-main-content" tabIndex={-1}>`. Skip
  link is visually hidden off-screen until focused (token-styled chip
  in the top-left when focused, honoring the prototype's global focus-
  visible ring). Reduced-motion media query disables the reveal
  transition.
- `prototype/src/app/atelier/compose/layout.tsx`,
  `prototype/src/app/atelier/inbox/layout.tsx`,
  `prototype/src/app/atelier/activity/layout.tsx` - each wraps
  children in `<SurfaceShell>`.

The role-aware `/atelier` lens shell (`Lens.tsx`) already renders its
own `<main>`. It is not in scope for this sweep (item 5 names compose
/ inbox / activity specifically) but the same `SurfaceShell` can wrap
it as a v1.x polish item.

## Open carry-forward - human SR pass needed

The following dynamic-UI moments are where SR behavior matters and the
automated suite cannot validate. A human session with NVDA (Windows
11, Firefox + Chrome) and VoiceOver (macOS, Safari + Chrome) should:

### Compose (DP-7 wedge)

- [ ] Submit a propose form -> verify `role="alert"` error and
  `role="status"` success messages are announced when they appear,
  not just on focus.
- [ ] Action-tab switch (Propose -> Decide -> Checkpoint) -> verify the
  newly-visible content is announced (no silent re-render).
- [ ] Mode toggle (Edit <-> Read) -> verify focus restoration after
  toggle; the Read canvas should announce its document role.
- [ ] Presence-stack avatars -> verify accessible name conveys
  composer identity (display name, not initial-only).
- [ ] Option editor (add/remove option rows) -> verify each row's
  label-text is announced when the row is focused.

### Inbox (DP-1 action-shaped sections)

- [ ] Section headers ("Needs your reaction", "Awaiting approval",
  "Awaiting review", "Blocked on you") -> verify section landmark
  navigation surfaces them in announcement order matching DOM order.
- [ ] Filter chip swap -> verify count change announces via the
  InboxFreshness live region, not silently.
- [ ] Anchor chip click -> verify focus lands inside the target
  section and the section heading is announced.

### Activity (DP-4 freshness wedge)

- [ ] Initial timeline render -> verify the `role="status" aria-busy`
  loading skeleton is announced.
- [ ] SSE prepend (new event arrives while page is open) -> verify the
  freshness banner ("N new in last 24h") increments via live region;
  the prepended row itself should NOT auto-announce (would be noisy).
- [ ] Filter chip swap (loop / author / sort) -> verify the empty-state
  message is announced when filters narrow to zero results.

### Cross-surface

- [ ] Modal / drawer / dialog open -> verify focus traps INTO the
  dialog (the existing 30-stop keyboard test allows brief trap windows
  precisely so modal focus trapping does not register as a violation;
  the human SR pass should confirm the trap is correct and that ESC
  releases it).
- [ ] Modal close -> verify focus restoration to the triggering
  element.
- [ ] Toast / transient banner -> verify announcement quality (polite
  vs assertive matches the message urgency).

## How to run locally

```bash
cd prototype
supabase start --workdir ..
npm run test:a11y
```

Requires Mailpit running on `127.0.0.1:54324` (started automatically
by `supabase start`) so globalSetup can pull the OTP code.

## Known issue caught + resolved: keyboard-test signature collision

PR #132's first CI run failed the keyboard-traversal test on
`/atelier/activity` with "focus trap suspected: BUTTON.fixed.top-3
repeated 5 times". Initial diagnosis suspected SSE-driven re-renders
resetting focus; the actual cause was much simpler.

**Root cause (test bug):** the signature function used the active
element's first two className tokens, producing `BUTTON.px-2.5.py-1`
for every SegBtn (Activity has 5 of them — All/Composers/Agents
filter chips + Recency/Trend sort buttons, all sharing the same
class prefix). Sequential Tab through 5 SegBtns produced 5 identical
signatures and tripped the "same element 5 times consecutively" gate.
Compose and Inbox didn't have 5 SegBtns in a row, so they passed.

**Secondary bug (misleading error):** the assertion message reported
`longestStreak.cur` (the last-visited signature in the array) instead
of the signature that actually produced the streak. The end-of-array
element happened to be `BUTTON.fixed.top-3` (DarkModeToggle), so the
error pointed at the wrong button and sent debugging in the wrong
direction.

**Fix in PR #132:**

1. **Discriminating signature:** prefer `data-testid`, then
   `aria-label`, then visible text content (truncated), then fall
   back to class prefix. 5 distinct SegBtns now produce 5 distinct
   signatures by their text content.
2. **Accurate error message:** track `maxSig` separately from `cur`
   so the assertion names the actual streak element and dumps the
   full `visited[]` array for debugging.

No application-side change was needed — the SSE-bailout hypothesis
was wrong. Activity's `onerror` handler is unchanged from G2.

## References

1. integration.md §3 line 84 + §5 Block 5 voice gates
2. research/a11y-baseline-audit.md - 21/21 WCAG AA baseline
3. ~/.claude/CLAUDE.md "IA / UX audit scope" Phase 8 rules
4. wip/big-blueprint/docs/design-system-audit.md D-7 a11y baseline
   (focus-visible, WCAG AA, one h1, skip-nav)
