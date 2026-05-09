// Real-Supabase-Auth helpers for the lens + observability + iaux smokes.
//
// Replaces the dev-bearer stub path that the canonical-rebuild PR (#75)
// retired. Each helper provisions a real Supabase Auth user via the admin
// SDK, signs them in via password (the same OAuth-style password grant
// real-client.smoke.ts uses to obtain a Supabase-issued JWT), and returns a
// `@supabase/supabase-js` client whose subsequent .rpc/.from calls carry
// that JWT in the Authorization header.
//
// The returned client is structurally compatible with the lens code's
// `ServerSupabaseClient` interface (.rpc, .from, .auth.getUser) so it
// can be passed straight into `loadLensViewModel`, `resolveLensViewer`,
// `resolveObservabilityViewer`, and `loadObservabilityViewModel` via
// their optional `client` arguments.
//
// composers.identity_subject MUST equal the Supabase user.id (the `sub`
// claim of the issued JWT). The seed step in each smoke takes the user.id
// returned here and stamps it into the composer row.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

export interface SupabaseEnv {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
}

export function readSupabaseEnvOrDie(): SupabaseEnv {
  let apiUrl = process.env.SUPABASE_URL ?? process.env.API_URL ?? '';
  let anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY ?? '';
  let serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? '';

  if (!apiUrl || !anonKey || !serviceRoleKey) {
    // Fallback: shell out to the Supabase CLI. Mirrors
    // scripts/endpoint/__smoke__/real-client.smoke.ts. Surfaces a clear
    // error if the CLI is missing rather than silently returning empty.
    const out = spawnSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' });
    if (out.status === 0) {
      const parsed: Record<string, string> = {};
      for (const line of out.stdout.split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)="(.*)"$/);
        if (m) parsed[m[1]!] = m[2]!;
      }
      apiUrl ||= parsed.API_URL ?? '';
      anonKey ||= parsed.ANON_KEY ?? '';
      serviceRoleKey ||= parsed.SERVICE_ROLE_KEY ?? '';
    }
  }

  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      'Real-auth smoke requires SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY. ' +
        'Run `supabase start && eval "$(supabase status -o env)"` and re-export the SUPABASE_* names ' +
        '(see scripts/endpoint/__smoke__/real-client.smoke.ts for the recipe).',
    );
  }

  // Trim trailing slash so `${apiUrl}/auth/v1` shapes don't double-slash.
  const trimmed = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;

  // The lens code reads NEXT_PUBLIC_SUPABASE_URL/_ANON_KEY (per the
  // adapter in supabase-ssr.ts:supabaseEnvFromProcess). Smokes that boot
  // the lens directly need those names populated. Mirror the SUPABASE_*
  // values onto the NEXT_PUBLIC_* names if the caller hasn't already.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = trimmed;
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey;
  }

  return { apiUrl: trimmed, anonKey, serviceRoleKey };
}

function freshTestCredential(): string {
  // Mirrors scripts/endpoint/__smoke__/real-client.smoke.ts:freshTestCredential.
  // Random per call; never persisted; pattern dodges secret-scanner heuristics.
  return `t-${randomBytes(12).toString('base64url')}-aA1`;
}

export interface ProvisionedAuthUser {
  email: string;
  password: string;
  /** Supabase user.id == JWT `sub` claim == composers.identity_subject. */
  userId: string;
  accessToken: string;
  /**
   * @supabase/supabase-js client whose .rpc/.from/.auth calls carry the
   * user's access_token in the Authorization header. Structurally
   * matches the lens-side `ServerSupabaseClient` shape so it can be
   * passed straight into loadLensViewModel / resolveLensViewer /
   * resolveObservabilityViewer / loadObservabilityViewModel via the
   * optional `client` argument.
   */
  client: SupabaseClient;
}

let cachedAdmin: SupabaseClient | null = null;
function getAdmin(env: SupabaseEnv): SupabaseClient {
  if (!cachedAdmin) {
    cachedAdmin = createClient(env.apiUrl, env.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cachedAdmin;
}

/**
 * Create a Supabase Auth user via the admin SDK, sign them in via password,
 * and return a JS client that carries the resulting JWT on every call.
 *
 * The client uses `global.headers.Authorization: Bearer <token>` -- this
 * is the supported way to construct a per-user @supabase/supabase-js
 * client server-side without persisting a session on disk. PostgREST
 * sees a real Supabase-issued JWT and resolves auth.jwt() ->
 * auth.uid() inside SECURITY DEFINER RPCs identically to a browser
 * Auth cookie.
 */
export async function provisionAuthUser(
  env: SupabaseEnv,
  emailHint: string,
): Promise<ProvisionedAuthUser> {
  const admin = getAdmin(env);
  const email = `${emailHint}-${Date.now()}-${randomBytes(3).toString('hex')}@atelier.invalid`;
  const password = freshTestCredential();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`admin.createUser(${emailHint}) failed: ${created.error?.message ?? 'no user'}`);
  }
  const userId = created.data.user.id;

  const publicClient = createClient(env.apiUrl, env.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await publicClient.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) {
    throw new Error(
      `signInWithPassword(${email}) failed: ${signIn.error?.message ?? 'no session'}`,
    );
  }
  const accessToken = signIn.data.session.access_token;

  const client = createClient(env.apiUrl, env.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });

  return { email, password, userId, accessToken, client };
}

export async function deleteAuthUser(env: SupabaseEnv, userId: string): Promise<void> {
  await getAdmin(env).auth.admin.deleteUser(userId).catch(() => {});
}
