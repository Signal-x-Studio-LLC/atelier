# `tools/state-derive`

Derives current implementation state from the codebase. Single source of truth for shipped-vs-spec audits.

## Why this exists

Spec docs, roadmaps, and audit findings decay the moment they ship. A capability written up as "in flight" in week N becomes "done" in week N+1, but the doc still says "in flight." Downstream audits quote the stale doc verbatim and produce recommendations on top of state that's already wrong.

This tool replaces prose-claim audit findings with **mechanically derived evidence**. Run it before any audit, before any "what shipped" review, before any roadmap status update — trust its output, not the docs.

## Usage

From the repo root:

```sh
npx tsx tools/state-derive/index.ts
```

Or from this directory:

```sh
cd tools/state-derive
npm run derive   # writes docs/state/_state.json + _state.md
```

Outputs:
- `docs/state/_state.json` — machine-readable state with `as_of_commit` + per-capability evidence
- `docs/state/_state.md` — human-readable summary grouped by category, with collapsible evidence detail blocks

## Catalog convention

Capability definitions live in `catalog/*.ts`. Each file exports one or more `Capability[]` arrays. The loader auto-imports every `.ts` file under `catalog/` (recursively), excluding files prefixed with `_` (examples / scratch).

Recommended grouping: one file per domain, spec section, or epic. Keep each file under ~30 capabilities for review-ability.

```typescript
// catalog/auth.ts
import type { Capability } from '../types.ts'

export const authCapabilities: Capability[] = [
  {
    id: 'auth-magic-link',
    category: 'capability',
    description: 'Magic-link login flow exists with token verification',
    reference: 'BRD §2.1 / ADR-003',
    derivation: [
      { type: 'file_exists', path: 'src/routes/auth/magic-link/+page.svelte' },
      { type: 'grep_present', path: 'src/routes/auth/verify/+server.ts', pattern: 'verifyOtp' },
    ],
  },
]
```

See `catalog/_example.ts` for a full example covering all check types.

## Check primitives

| Check | What it verifies |
|-------|------------------|
| `file_exists` / `file_absent` | A file or directory exists / does not exist at a path |
| `grep_present` / `grep_absent` | A pattern is / is not present in a file or directory |
| `grep_count` | A pattern's match count is within `expect_min`..`expect_max` |
| `schema_has_table` | A SQL migration creates a named table |
| `schema_has_column` | A SQL migration creates or alters a column on a named table |
| `commit_message_grep` | At least one commit message matches a pattern (optionally since a date) |

## Statuses

| Status | Meaning |
|--------|---------|
| `COMPLIANT` | All checks matched expectations |
| `PARTIAL` | Some checks matched, some did not |
| `NON-COMPLIANT` | No checks matched (the capability is missing or broken) |
| `ABSENT` | Capability intentionally absent — absence confirmed |
| `ERROR` | At least one check failed to run (directory missing, etc.) |
| `MANUAL_REVIEW` | Capability requires human review — mechanical checks are advisory |

## Inverted capabilities (anti-patterns)

Set `invert: true` on a capability when the derivation looks for a violation rather than a positive proof. Aggregation flips: matched=true now means NON-COMPLIANT, matched=false means COMPLIANT. Use this for conventions where the check is "find sites that break the rule."

```typescript
{
  id: 'convention-no-raw-color-tokens',
  category: 'convention',
  description: 'Components use semantic tokens, not raw color tokens',
  invert: true,
  derivation: [
    { type: 'grep_present', path: 'src/lib/components', pattern: 'var\\(--color-arena-' },
  ],
}
```

## Environment overrides

| Variable | Default | Purpose |
|----------|---------|---------|
| `STATE_DERIVE_SCHEMA_DIR` | `supabase/migrations:apps/api/migrations/schema:migrations` | Colon-separated dirs containing `*.sql` migration files |
| `STATE_DERIVE_OUT` | `docs/state` | Output directory (relative to repo root) |
| `STATE_DERIVE_PROJECT` | `project` | Project name used in markdown title |

## Embedding the output

The rendered `_state.md` is designed to be consumed by docs viewers, dashboards, or prototype studios:

- **JSON output** drives programmatic consumers (Front Door tiles, capability cards in a prototype gallery, CI gates that fail when COMPLIANT capability count regresses).
- **Markdown output** is human-skimmable and embeds inside any docs site that renders markdown.

Standard pattern: render the JSON capability list as cards in your prototype studio with status indicators (✅ shipped, 🟡 partial, ❌ missing). Spec docs reference capability IDs; the studio links each card to its capability.

## Architecture

```
state-derive/
├── types.ts          — Capability / Check / Status type definitions
├── derive.ts         — runs a single Check, aggregates results into Status
├── render.ts         — writes JSON + Markdown output
├── diff.ts           — compares two State snapshots (for "what shipped" reports)
├── index.ts          — CLI entry; discovers catalog/*.ts and runs all
├── checks/
│   ├── file.ts       — file_exists / file_absent
│   ├── grep.ts       — grep_present / grep_absent / grep_count
│   ├── schema.ts     — schema_has_table / schema_has_column
│   └── commit.ts     — commit_message_grep
└── catalog/          — project-specific Capability[] declarations
    └── _example.ts   — starter template (skipped by loader)
```

The tool is intentionally **zero-runtime-deps**. It walks the filesystem, runs RegExp, shells out to `git`. No package install needed beyond `tsx` + `@types/node` on PATH.

## When to add a capability

Add a capability when:
- A spec doc, BRD, or ADR makes a claim about what's shipped — encode the claim mechanically
- A convention is established that you want enforced over time — add an inverted capability that scans for violations
- A feature flag retires — add a `feature_flag_inactive` capability so the catalog flags re-introduction
- An integration test exists for a BRD acceptance criterion — add a `scenario-coverage` capability pointing at the test

Don't add a capability for things the type system or test suite already covers. State-derive is for cross-cutting claims that can't be verified by a single test.

## When to re-run

- Before drafting any audit, roadmap status, or "what's shipped" doc
- In CI on every PR (optional gate: fail when a previously-COMPLIANT capability regresses)
- After landing a slice that closes a known PARTIAL or NON-COMPLIANT capability
- Anytime you suspect spec docs have drifted from the codebase
