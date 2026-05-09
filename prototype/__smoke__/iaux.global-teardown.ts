// Playwright globalTeardown for the IA/UX DOM smoke.
//
// Deletes the throwaway Supabase Auth user provisioned by globalSetup so
// repeated local runs don't accumulate orphan auth.users rows.
// Fixture cleanup (the iaux-smoke project + its dependent rows) stays in
// the spec's test.afterAll so it runs even if globalTeardown is skipped.

import { deleteAuthUser, readSupabaseEnvOrDie } from './real-auth-helpers.ts';

export default async function globalTeardown(): Promise<void> {
  const userId = process.env.IAUX_AUTH_USER_ID;
  if (!userId) return;
  try {
    const sb = readSupabaseEnvOrDie();
    await deleteAuthUser(sb, userId);
  } catch (err) {
    // Don't fail the run on cleanup failure -- the user is throwaway and
    // the next `supabase db reset` will wipe it regardless.
    console.warn('[iaux teardown] deleteAuthUser failed:', (err as Error).message);
  }
}
