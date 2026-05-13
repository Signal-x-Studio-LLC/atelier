// /sign-in -- magic-link + 6-digit code sign-in for /atelier (D7).
//
// Two paths from a single email submission per the auth-shape decision:
//   1. Magic link in the email body (clickable URL hits /auth/confirm,
//      which calls auth.verifyOtp({ token_hash, type }) per the rally-hq
//      reference pattern -- BRD-OPEN-QUESTIONS §31)
//   2. 6-digit code in the same email (entered into the second form view)
//
// Both paths use Supabase Auth's email-OTP. The link path is convenient
// when email and browser are on the same device; the code path bypasses
// corporate email-gateway URL pre-fetching (which consumes the link
// before the user clicks) and the mobile-email -> desktop-browser case.
//
// Server component owns the page chrome; the form is a client component
// (the email/code state machine + Supabase calls run in the browser).
//
// Per ADR-029 the form imports the Supabase browser client only via the
// supabase-browser.ts adapter -- never directly from @supabase/*.
//
// ADR-060 PR B: chrome rebuilt on the design package primitives.

import SignInForm from './SignInForm.tsx';
import {
  Surface,
  Card,
  Heading,
  Body,
  Eyebrow,
  Mono,
} from '../../lib/atelier/design';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in -- Atelier' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = sanitizeRedirect(params.redirect);
  return (
    <Surface
      as="main"
      tone="canvas"
      className="min-h-screen grid place-items-center p-6"
    >
      <Card className="w-full max-w-[30rem] p-7 md:p-8">
        <Eyebrow as="div" className="text-ink-subtle mb-2">
          atelier // sign in
        </Eyebrow>
        <Heading as="h1" scale="headingLg" className="mb-2">
          Sign in
        </Heading>
        <Body scale="bodyMd" className="text-ink-muted mb-5">
          Enter your email. We will send you a sign-in link AND a 6-digit
          code -- use whichever arrives first.
        </Body>
        <SignInForm redirectTo={redirectTo} initialError={params.error ?? null} />
        <footer className="mt-6 pt-4 border-t border-rule text-ink-subtle">
          <Body as="p" scale="caption" className="mb-2">
            Need access? Ask your admin to invite you via{' '}
            <Mono>atelier invite</Mono>. Atelier does not auto-create
            accounts; signing in here will only succeed for emails an
            admin has already invited.
          </Body>
          <Body as="p" scale="caption" className="mt-1">
            Using a different identity provider? See{' '}
            <Mono>.atelier/config.yaml: identity.provider</Mono>{' '}
            (ADR-028).
          </Body>
        </footer>
      </Card>
    </Surface>
  );
}

/**
 * Restrict redirects to same-origin paths. Reject absolute URLs, scheme-
 * relative ('//evil.test/path'), and protocol-bearing strings. The form
 * URL-encodes the value before navigation so this is purely shape
 * validation, not URL parsing.
 */
function sanitizeRedirect(raw: string | undefined): string {
  if (!raw) return '/atelier';
  if (!raw.startsWith('/')) return '/atelier';
  if (raw.startsWith('//')) return '/atelier';
  if (/^\/?[a-z][a-z0-9+.-]*:/i.test(raw)) return '/atelier';
  return raw;
}
