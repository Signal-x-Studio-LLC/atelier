// Playwright config for the IA/UX DOM smoke (M7-exit gate, DOM layer).
//
// Spins up the prototype dev server, then drives the suite against
// http://localhost:3030/atelier with a real Supabase Auth-bound storage
// state seeded by globalSetup (post canonical-rebuild per PR #75).
// Single worker because the suite shares one fixture set (parallel
// would race on cleanup).

import { defineConfig } from '@playwright/test';

const PORT = 3030;

export default defineConfig({
  testDir: './__smoke__',
  testMatch: ['iaux.dom.spec.ts'],
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  // globalSetup provisions a real Supabase Auth user for the analyst,
  // re-seeds the iaux composer row with composers.identity_subject =
  // user.id, drives the OTP flow through /sign-in to seat the
  // @supabase/ssr cookie envelope, and writes Playwright storageState.
  // globalTeardown deletes the throwaway auth user.
  globalSetup: './__smoke__/iaux.global-setup.ts',
  globalTeardown: './__smoke__/iaux.global-teardown.ts',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    // Tests inherit the storageState path set by globalSetup. Path is
    // routed through the env var so this config doesn't need to know
    // the temp-dir name; defineConfig's `use` field resolves at
    // test-launch time, after globalSetup has populated the env.
    storageState: process.env.IAUX_STORAGE_STATE,
  },
  webServer: {
    command: 'npm run dev',
    // Use the root route as the readiness probe; /atelier requires auth and
    // would race against globalSetup's sign-in flow if used as the gate.
    url: `http://127.0.0.1:${PORT}/`,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
    env: {
      // Real-auth path (post canonical-rebuild): no dev-bearer fallback.
      // The lens runtime reads the @supabase/ssr cookie envelope that
      // globalSetup seeds via the OTP sign-in flow.
      POSTGRES_URL:
        process.env.POSTGRES_URL ??
        'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
      // Local-Supabase URL + anon key, required by the SSR cookie
      // adapter, the JWKS verifier (issuer derivation), and the
      // broadcast client island. The local-dev anon key is a public
      // well-known JWT shipped with every `supabase start`; safe to
      // commit because it only authenticates against an ephemeral CI
      // Supabase instance.
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    },
  },
});
