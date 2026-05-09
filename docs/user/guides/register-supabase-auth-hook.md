# Register the Supabase Auth Hook

**Audience:** an operator wiring Supabase Auth events (user-created, password-reset, sign-in, send-email, etc.) into the Atelier substrate via the `/api/webhooks/supabase-auth` receiver.

**Scope:** the substrate ships the verifying receiver (S12 close, Track 3d). At v1.x it records every delivery in `webhook_deliveries` and returns 200 — no per-event business logic dispatches yet. That's the same receive-only initial scope as GitHub and Figma; per-event handlers (composer auto-provision on user-created, custom email templates on send-email, telemetry on sign-in, etc.) are adopter-signal-driven follow-on slices.

This runbook covers the registration path. After it, every Supabase auth event lands in `webhook_deliveries` with `source='supabase-auth'`, idempotency-keyed on the `webhook-id` header.

---

## 1. Generate the hook secret

```bash
openssl rand -base64 32
```

Copy the output. Supabase's hook form will accept this as the secret directly, OR you can pass a `whsec_<base64>`-prefixed value — the verifier handles both.

## 2. Set the secret on Atelier

```bash
# Local (in prototype/.env.local):
SUPABASE_AUTH_HOOK_SECRET=<the-base64-from-step-1>

# Cloud (Vercel):
vercel env add SUPABASE_AUTH_HOOK_SECRET production
# paste the same value
```

The verifier fails closed when the secret is missing — every request returns 500 until the env var is set. There is no fail-open path.

## 3. Register the hook in Supabase

1. Open the Supabase Dashboard → your project → **Authentication** → **Hooks**.
2. Click **Add a new hook** → choose **Send a webhook**.
3. Pick the event you want to wire (start with `Send Email Hook` or `Custom Access Token Hook` — `User Created` is also a common entry point).
4. **URL:** `https://<your-atelier-domain>/api/webhooks/supabase-auth`
5. **HTTP Method:** POST.
6. **Secret:** paste the same value from step 1.
7. Save.

## 4. Test the hook

Supabase doesn't ship a "send test event" button on the Hooks form, so trigger a real event matching the hook type:

- For `Send Email Hook`: trigger a magic-link from the `/sign-in` page.
- For `User Created`: sign up a fresh test address.
- For `Custom Access Token`: sign in with any user.

Then verify the delivery landed:

```bash
psql "$POSTGRES_URL" -c "
  SELECT delivery_id, event_type, received_at, processed_at, outcome
    FROM webhook_deliveries
   WHERE source = 'supabase-auth'
   ORDER BY received_at DESC
   LIMIT 5
"
```

Expect a row with `outcome='received'` and `processed_at` set. If you see no row, check Vercel function logs for the `/api/webhooks/supabase-auth` route — the four common failure modes are `webhook_secret_missing` (500), `missing_signature` (401), `invalid_signature` (401), and `stale_timestamp` (401, clock-skew >5min between Supabase and the receiver).

## 5. Troubleshooting

**401 invalid_signature on every request:** the secret on the Supabase form does not match `SUPABASE_AUTH_HOOK_SECRET`. Re-paste both sides and confirm.

**401 with stale_timestamp:** the request timestamp is outside the ±5min replay window. If your Vercel region clock and Supabase event clock diverge by more than 5 minutes, raise an issue — the tolerance is conservative by Standard Webhooks convention but configurable in `svix-verify.ts`.

**500 webhook_secret_missing:** the env var did not propagate to the deployment. For Vercel, this usually means you set it on Preview but not Production (or vice versa); confirm via `vercel env ls`.

**No row in `webhook_deliveries` despite event firing:** Supabase's webhook delivery may be failing before reaching the receiver (e.g., DNS, CORS misconfig). Check the Supabase Dashboard → **Authentication** → **Hooks** → the failing hook → **Logs** for delivery attempts and their HTTP responses.

---

## Reference

- `prototype/src/app/api/webhooks/supabase-auth/route.ts` — receiver
- `prototype/src/lib/atelier/webhooks/svix-verify.ts` — Standard Webhooks verifier
- `prototype/__smoke__/webhooks-supabase-auth.smoke.ts` — smoke (15 checks)
- [Supabase Auth Hooks docs](https://supabase.com/docs/guides/auth/auth-hooks)
- [Standard Webhooks spec](https://www.standardwebhooks.com)
