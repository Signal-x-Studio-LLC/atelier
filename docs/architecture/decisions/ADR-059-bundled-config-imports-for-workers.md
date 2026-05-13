---
id: ADR-059
trace_id: BRD-OPEN-QUESTIONS-37
category: architecture
session: 2026-05-13-cf-data-layer-port
composer: nino-chavez
timestamp: 2026-05-13T00:00:00Z
amends: ADR-052
---

# Workers-bundled imports replace Node-fs reads for the substrate data layer

**Summary.** The prototype's request-time substrate data layer (`.atelier/prototype.yaml`, the observability block of `.atelier/config.yaml`, and the project's design-principles markdown) shifts from `node:fs` reads against `process.cwd()` to TypeScript modules generated at build time and imported as part of the Cloudflare Workers bundle. A new codegen step (`scripts/build/generate-bundled-config.ts`) reads each source, validates it via the same shape checks the runtime previously ran, and emits typed `as const` modules under `prototype/src/lib/atelier/__bundled__/`. CI fails a PR if the emitted output drifts vs. the committed tree. The three runtime loaders (`prototype-manifest.ts`, `observability-config.ts`, `traceability-data.ts`) keep their public signatures but read from the bundle. A runtime-env tripwire (`runtime-env.ts`) catches future regressions where new code reaches for `node:fs` at request time.

**Rationale.**

ADR-052 pivoted the prototype's hosting to Cloudflare Workers via `@opennextjs/cloudflare`. The Workers runtime does not implement `node:fs`; the `nodejs_compat` flag exposes `node:async_hooks`, `node:buffer`, `node:crypto`, `node:net`, `node:tls`, `node:stream`, `node:url`, `node:util`, and a handful more, but not `node:fs` (per the Cloudflare runtime-APIs/nodejs reference). Three prototype modules — `prototype-manifest.ts`, `observability-config.ts`, `traceability-data.ts` — read static config files via `readFileSync` / `existsSync` at request time. After the M6→M7 Cloudflare deploy landed at `https://atelier-prototype.biq.workers.dev`, every product surface that touched those loaders 500'd with `PrototypeManifestError: Prototype manifest not found at /.atelier/prototype.yaml` because `process.cwd()` is `/` inside a Worker and the filesystem isn't there.

Three credible shapes were considered:

1. **Bundled imports** (chosen). Read configs at build time, emit TS modules, import them at runtime. The Workers bundle carries the validated config inline.
2. **Workers KV binding.** Provision a KV namespace, upload configs at deploy time, read at runtime. Adds a binding to provision, an upload step to the deploy pipeline, and a latency penalty (KV read p50 ~10-15ms cold). Justified only when the config changes faster than the deploy cadence.
3. **Durable Object storage.** Even heavier than KV for static config.

Bundled imports match the canonical pattern for build-time-known static config on Workers (per the OpenNext Cloudflare adapter's documented patterns and Next.js's first-class support for ESM imports of JSON / TS modules). The config files change at PR cadence; deploys happen on merge; therefore the deploy IS the config update mechanism. KV's flexibility buys nothing here and costs a binding + latency.

The one substrate config that genuinely changes post-deploy is `find_similar`'s embedding adapter URL and API-key env-var name (per ADR-041, adopters override these to swap providers). That config already flows through environment variables, not the bundled file — adopters set `ATELIER_FIND_SIMILAR_BASE_URL` and friends per the env-var override convention. The bundled-import refactor leaves that path untouched.

**Decision.**

1. **New codegen step.** `scripts/build/generate-bundled-config.ts` reads:
   - `.atelier/prototype.yaml` -> `prototype/src/lib/atelier/__bundled__/prototype-manifest.bundled.ts`
   - `.atelier/config.yaml` (observability block only) -> `prototype/src/lib/atelier/__bundled__/observability-config.bundled.ts`
   - `prototypes/<project>/docs/design-principles.md` (path declared by the manifest's `traceability_source.design_principles`) -> `prototype/src/lib/atelier/__bundled__/design-principles.bundled.ts`

   Each emitted module exports a single `as const` constant plus a type alias. The codegen validates each source via the same checks the runtime loaders used to run; a malformed manifest fails the build, not the request. Output is byte-deterministic (stable key sort + fixed indent).

2. **Build pipeline wiring.** `npm run codegen` exists at the repo root and in `prototype/`. The prototype's `predev`, `prebuild`, and `precf:build` scripts invoke it. `npm ci && npm run cf:build` from a clean checkout regenerates the bundle before OpenNext bundles the Worker. `tsx` is added to `prototype/`'s devDependencies (was previously only at the repo root) so `cd prototype && npm ci` is sufficient on the CI deploy job.

3. **Runtime loader refactor.** Each of the three loaders drops its `node:fs` + `process.cwd()` usage and imports its bundled module. Public signatures are preserved (`loadPrototypeManifest()`, `loadObservabilityConfig(repoRoot?: string)`, `loadDpExcerpts(manifest: PrototypeManifest)`) so no caller changes are required. `loadObservabilityConfig`'s `repoRoot` parameter becomes inert.

4. **Runtime-env tripwire.** `prototype/src/lib/atelier/runtime-env.ts` exports `detectRuntime()` and `assertNodeRuntime(callsite)`. It is not currently called from the bundled-import path (no need to assert Node when the only file access happens at codegen). It exists as scaffolding so any future code path that does need to discriminate runtime can do so loudly rather than silently breaking on deploy.

5. **CI codegen-drift check.** The audit workflow's fast-checks job runs `npm run codegen` and fails the PR if `git diff --quiet -- prototype/src/lib/atelier/__bundled__/` returns non-zero. Forces committers to regenerate after editing any source config.

6. **Smoke.** `prototype/__smoke__/bundled-config.smoke.ts` exercises all three runtime loaders without a DB. Wired into the audit workflow fast-checks job. Catches regressions where the emitted shape and the public interface drift.

7. **Scripts under `scripts/{endpoint,coordination,sync}` are NOT migrated.** Those modules run as Node-only CLI utilities (smokes, cron-worker jobs, codegen, observability publishers). They never load into a Workers bundle. The audit confirmed this — none of those scripts are imported transitively by `prototype/src/app/**`.

**Consequences.**

- Editing `.atelier/prototype.yaml`, the observability block of `.atelier/config.yaml`, or `prototypes/<project>/docs/design-principles.md` now requires running `npm run codegen` before commit, OR the CI drift check fails the PR. The error message names the command. Cost: one extra `npm run codegen` step in the contributor workflow. Benefit: validation happens at build time, not 500-at-request time.
- The `find_similar` config path is unchanged — env-var overrides still work. Adopter customization for that config is not affected.
- `loadObservabilityConfig`'s `repoRoot` parameter becomes inert. Callers don't need to be updated, but the parameter is now noise. Removing it is a follow-up cleanup with one line of caller-site change in `observability-data.ts` — deferred to keep this PR scoped.
- The runtime-env tripwire is dead code at v1.x but cheap insurance against future regressions. Cost is zero (one file, ~50 LOC); benefit is loud failure rather than silent.

**Canonical-pattern citation.**

- OpenNext Cloudflare adapter (`@opennextjs/cloudflare`): documented limitations include "no filesystem access at request time" and the standard remediation pattern of moving static config into build-time imports. See `https://opennext.js.org/cloudflare/howtos/static-assets` (the assets pattern documents the same approach for non-route static content).
- Cloudflare Workers nodejs_compat reference: `https://developers.cloudflare.com/workers/runtime-apis/nodejs/` — `node:fs` is not listed.
- Next.js ESM imports: TS / JSON modules are first-class compile-time imports; this matches the Server Components convention of resolving config at build, not request, time.

No divergence from canonical. The custom piece is the codegen script itself, which is a single-file utility (one source, ~280 LOC) wired via npm scripts; not a build framework, not a plugin, no new dependency beyond `tsx` (already used repo-wide).

**Reversal triggers.**

If any of the bundled config files needs to mutate faster than the deploy cadence (e.g., adopters want to flip observability thresholds without redeploying), the bundled-import shape stops fitting. Revisit by promoting that specific config to Workers KV with the bundled module as the default fallback. Until that demand surfaces, the bundled shape is correct.
