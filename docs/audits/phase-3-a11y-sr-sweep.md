---
title: Phase 3 item 5 - a11y SR-sweep (automation tier closed)
status: automation tier closed; human-SR announcement-quality pass open
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

## Mechanized in this iteration (automation tier closed)

The following carry-forward items moved from "human-only" to mechanized.
Each is a Playwright test in `prototype/e2e/a11y/sr-sweep.spec.ts`; the
tests assert the structural / focus-management / live-region wiring
contract that a human SR pass would otherwise re-verify on every
release. Announcement quality remains human-gated (see "Irreducible
human-only residue" below).

### Compose

- Mode toggle (Edit <-> Read) preserves keyboard focus on a sensible
  target (toggle button OR the `role="document"` read canvas root);
  Read canvas declares `role="document"` so an SR has the announcement
  hook. Test: `compose dynamic UI > mode toggle (Edit <-> Read)
  preserves keyboard focus on a sensible target`.
- Action-tab switch (Propose / Claim / Log Decision / Checkpoint)
  updates `aria-selected` on the clicked tab AND clears it on all
  other tabs (rules out the silent re-render where panel content
  changes but tab state lies). Test: `compose dynamic UI > action-tab
  switch updates aria-selected on tab buttons`.
- Presence-stack avatars carry `aria-label` >2 chars (rules out the
  initial-only label that an SR reads as a single letter). Test:
  `compose dynamic UI > presence-stack avatars carry accessible name
  longer than 2 chars`. Soft-passes when 0 avatars render.

### Inbox

- Section landmarks appear in fixed DOM order matching the announced
  order: needs-reaction -> awaiting-approval -> awaiting-review ->
  blocked-on-you. Guards against silent reordering. Test: `inbox
  dynamic UI > section landmarks appear in DOM order matching
  announcement order`.
- Anchor-chip click lands focus inside the target section (chip is
  wired through `handleAnchorClick` which focuses the section after
  `scrollIntoView`). Test: `inbox dynamic UI > anchor-chip click
  lands focus inside target section`.
- InboxFreshness carries `role="status"` + `aria-live="polite"` so
  count changes have an announcement hook. Test: `inbox dynamic UI >
  InboxFreshness exposes a live-region affordance`.

### Activity

- Empty-state element (rendered when filters narrow to zero) carries
  `role="status"` + `aria-live="polite"`. Provoked via `?empty=1`
  query param (matches Inbox's `?empty=1` pattern; the harness
  reviewer drawer can rewrite the URL to surface this scenario).
  Test: `activity dynamic UI > empty-state element carries
  live-region affordance`.

### Cross-surface

- Dialog contract placeholder: each surface asserts zero `role="dialog"`
  / `<dialog>` elements on initial render (the precondition under
  which the existing 30-stop keyboard test is honest about non-trap
  behavior). When a dialog lands on any surface, the placeholder
  expectation flips to ESC-closes + focus-restoration assertions.
  Test: `cross-surface modal contract > <surface>: no dialog mounted
  on initial render (contract placeholder)`.

## Irreducible human-only residue

The following carry-forward items remain genuinely human-only. They
are not structural or wiring properties; they are perceptual /
announcement-quality / voice judgments that an automated suite cannot
substitute for. A human session with NVDA (Windows 11, Firefox +
Chrome) and VoiceOver (macOS, Safari + Chrome) should:

- Announcement quality on form-submit feedback: does the propose
  form's `role="alert"` error message read with the right urgency
  in NVDA / VoiceOver? Does `role="status"` success match the calmer
  tone? (Wiring is asserted by the live-region inventory; the
  perceptual match is not.)
- Action-tab announcement: when the active tab changes, does the
  newly-visible panel content actually get announced in the user's
  cadence, or does the SR fall silent? (Structural correctness is
  asserted; the read-out fidelity is not.)
- Mode-toggle voice: does the SR announce "document, Compose proposal"
  on entering Read mode, or does it land mid-sentence? (Role is
  asserted; the announced text is not.)
- Presence-stack announcement quality: an SR may read "S, S, S" for
  three single-initial-letter avatars; does the >2-char label resolve
  to a readable composer identity?
- Inbox count-change announcement: when filter state shifts the
  freshness summary, does the polite live region wait for a pause,
  or step on the user mid-task? (Wiring is asserted; politeness
  cadence is not.)
- SSE prepend: when a new envelope arrives while the Activity page
  is open, the freshness banner should announce the increment;
  individual prepended rows should NOT auto-announce (noisy). The
  human pass verifies the row stays silent and only the banner
  speaks.
- Reading order vs user intent: does the order in which the SR
  surfaces sections / rows / chips match the order the user actually
  needs them in? (DOM order is asserted to match the documented
  order; whether the documented order matches user intent is a
  perceptual judgment.)
- Modal / drawer / dialog flows (when they land): focus-traps-into
  correctness, ESC-releases correctness, focus-restoration-to-trigger,
  toast urgency polite-vs-assertive. The cross-surface placeholder
  test pre-flights the precondition; the perceptual flow does not.

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
