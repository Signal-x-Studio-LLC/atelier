// Runtime-env tripwire (ADR-059).
//
// Detects whether the current process is Node.js or a Workers-style edge
// runtime, and exposes a helper that throws a loud error if request-time
// code path tries to reach for node:fs in the Workers bundle.
//
// This is a defense-in-depth measure on top of the codegen + bundled-import
// refactor. The codegen prevents node:fs from being needed at request time;
// this tripwire catches future regressions before they ship.
//
// Canonical pattern: opennextjs-cloudflare runs the Next.js server as a
// Cloudflare Worker. Workers expose a subset of Node APIs via nodejs_compat
// (https://developers.cloudflare.com/workers/runtime-apis/nodejs/); node:fs
// is NOT among them. The detection here uses process.versions.node, which
// is present on real Node and absent in Workers.

export type RuntimeKind = 'node' | 'workers' | 'unknown';

export function detectRuntime(): RuntimeKind {
  if (typeof process !== 'undefined' && typeof process.versions?.node === 'string') {
    // navigator.userAgent === 'Cloudflare-Workers' even when the workerd
    // shim exposes a partial `process`. Prefer the userAgent signal when
    // we're inside a Worker masquerading as Node-compat.
    const ua =
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ===
        'string'
        ? (globalThis as { navigator?: { userAgent?: string } }).navigator!.userAgent!
        : '';
    if (ua.toLowerCase().includes('cloudflare-workers')) return 'workers';
    return 'node';
  }
  if (typeof globalThis !== 'undefined' && 'caches' in globalThis && 'fetch' in globalThis) {
    return 'workers';
  }
  return 'unknown';
}

export function assertNodeRuntime(callsite: string): void {
  const kind = detectRuntime();
  if (kind !== 'node') {
    throw new Error(
      `[atelier] ${callsite}: node:fs access attempted in ${kind} runtime. ` +
        `Use a bundled import from prototype/src/lib/atelier/__bundled__/ instead. ` +
        `See ADR-059.`,
    );
  }
}
