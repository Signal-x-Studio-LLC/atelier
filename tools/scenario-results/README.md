# scenario-results — gate-G4 evidence normalizer

Turns the scenario suites' JSON reporter output into the `_scenario-results.json`
artifact that the state-derive `scenario_passes` check (gate G4) consumes. It
**parses recorded evidence; it never executes tests.**

See `docs/methodology/dod-verification-ladder-pattern.md` for the gate model.

## Contract

Emits `{ schemaVersion, generatedAt, as_of_commit, runs[] }` where each run is
`{ ac, scenario, suite, status, ranAt, source }`, keyed by acceptance-criterion
id. Types live in `../state-derive/types.ts` (`ScenarioRun` / `ScenarioResults`).

- **AC mapping** — extracted from the scenario name by the `§story.ac` prose
  convention (e.g. `BRD §US-1.1`). The machine-readable upgrade is explicit
  `acs:` / `@ac:` tags; the reporter prefers them when present. A scenario with
  no AC ref is recorded keyed by its slug.
- **Status** — `passed` / `failed` / `skipped`. For a multi-attempt spec,
  `failed` wins, then `passed`, else `skipped`.

## Usage

```sh
tsx index.ts \
  --vitest <jest-or-vitest-results.json> \
  --playwright <playwright-results.json> \
  --out docs/audits/derived/_scenario-results.json \
  [--commit <sha>]
```

Any `--vitest` / `--playwright` input may be omitted; absent inputs contribute
no runs. `--commit` defaults to `git rev-parse HEAD`.

## Pipeline placement

Run in CI **after** the scenario suites and **before** `state-derive`, in the
derive-on-main job. The artifact is automation-owned and **never committed**
(the no-state-files gate enforces this) — producing it ephemerally at derive
time avoids any committed-derived-file rebase race while keeping
`as_of_commit == HEAD` so the `scenario_passes` staleness guard passes.

## Self-test

`npm test` (vitest) — covers AC extraction, slugging, the Jest/Vitest +
Playwright reporter parsers, and deterministic ordering.
