// Playwright config for the Phase 3 a11y SR-sweep automation.
//
// Sibling to playwright.config.ts (IA/UX DOM smoke). Reuses the same
// globalSetup that provisions a real Supabase Auth user + seats the
// @supabase/ssr cookie envelope, but points at a separate test
// directory (e2e/a11y) and a separate matcher so the two suites can be
// invoked independently.
//
// Honest scoping: this config runs axe-core, keyboard nav, live-region,
// and reduced-motion checks against /atelier/compose, /atelier/inbox,
// /atelier/activity. It does NOT drive NVDA or VoiceOver; that human
// SR pass is tracked as carry-forward in
// docs/audits/phase-3-a11y-sr-sweep.md.

import { defineConfig } from '@playwright/test';

const PORT = 3030;

export default defineConfig({
  testDir: './e2e/a11y',
  testMatch: ['sr-sweep.spec.ts'],
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './__smoke__/iaux.global-setup.ts',
  globalTeardown: './__smoke__/iaux.global-teardown.ts',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    storageState: process.env.IAUX_STORAGE_STATE,
  },
  webServer: {
    command: 'npm run dev',
    url: `http://127.0.0.1:${PORT}/`,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
    env: {
      POSTGRES_URL:
        process.env.POSTGRES_URL ??
        'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    },
  },
});
