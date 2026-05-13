// Auth-error states for the lens page.
//
// The lens path can fail at three points: no bearer at all, bearer
// validation rejected, or bearer-resolves-to-no-composer. Each renders a
// distinct affordance:
//
//   no_bearer       -> sign-in CTA with the originating route threaded
//                      through ?redirect=, so post-sign-in lands the user
//                      back where they started.
//   no_composer     -> "ask your admin to invite you" -- magic-link auth
//                      succeeded (Supabase Auth user exists) but no
//                      Atelier composer row maps to that identity_subject;
//                      composer rows are created by `atelier invite`.
//   invalid_bearer  -> diagnostic "what to check" block for operators;
//                      this is a configuration error path, not a
//                      sign-in path.
//
// ADR-060 PR C: migrated to design-package primitives. Gate behavior
// (TITLES + reason routing) preserved exactly.

import Link from 'next/link';
import { Body, Card, Eyebrow, Heading, Mono, Surface } from '../../../lib/atelier/design';

export type LensUnauthorizedReason = 'no_bearer' | 'invalid_bearer' | 'no_composer';

// `lensId` is a display label here (rendered into the eyebrow); the
// /atelier/observability surface reuses this component with id="observability"
// so the type is widened from `LensId` to plain string.
export default function LensUnauthorized({
  lensId,
  reason,
  message,
}: {
  lensId: string;
  reason: LensUnauthorizedReason;
  message: string;
}) {
  const title = TITLES[reason];
  return (
    <Surface tone="canvas" as="main" className="grid min-h-screen place-items-center p-6">
      <Card tone="paper" elevation="sm" className="w-full max-w-[560px] p-6">
        <Eyebrow as="div" className="mb-2 text-ink-subtle font-mono">
          /atelier/{lensId} -- unauthorized
        </Eyebrow>
        <Heading as="h1" scale="headingMd" className="m-0 mb-3 text-ink">
          {title}
        </Heading>
        <Body scale="bodyMd" className="m-0 mb-4 text-ink-muted">
          {message}
        </Body>
        {reason === 'no_bearer' && <SignInCTA lensId={lensId} />}
        {reason === 'no_composer' && <NoComposerHelp />}
        {reason === 'invalid_bearer' && <InvalidBearerHelp />}
      </Card>
    </Surface>
  );
}

const TITLES: Record<LensUnauthorizedReason, string> = {
  no_bearer: 'Sign in to view the dashboard',
  invalid_bearer: 'Bearer rejected',
  no_composer: 'Your account is not invited yet',
};

function SignInCTA({ lensId }: { lensId: string }) {
  // The originating route is a same-origin path; Next's Link encodes
  // the query string for us.
  const returnTo = `/atelier/${lensId}`;
  return (
    <div className="mt-1 grid gap-2.5">
      <Link
        href={{ pathname: '/sign-in', query: { redirect: returnTo } }}
        className="inline-flex h-9 w-fit items-center justify-center rounded-sm bg-primary px-4 text-[13px] font-semibold text-ink-inverse no-underline transition-colors hover:bg-primary-hover"
        data-testid="signin-cta"
      >
        Sign in
      </Link>
      <Body scale="caption" className="m-0 text-ink-subtle">
        Atelier sends a sign-in link AND a 6-digit code; use whichever
        path your environment allows.
      </Body>
    </div>
  );
}

function NoComposerHelp() {
  return (
    <div className="border-t border-rule pt-3 text-[13px] text-ink-subtle">
      <Body scale="bodySm" className="text-ink-muted">
        Sign-in succeeded, but no Atelier composer is mapped to this
        identity. Composer rows are created by an admin via{' '}
        <Mono>atelier invite &lt;email&gt;</Mono>; contact whoever runs
        this Atelier instance and ask to be invited.
      </Body>
      <div className="mt-3">
        <Link
          href="/sign-out"
          className="text-[12px] text-ink-subtle underline hover:text-ink-muted"
        >
          Sign out
        </Link>
      </div>
    </div>
  );
}

function InvalidBearerHelp() {
  return (
    <div className="border-t border-rule pt-3 text-[13px] text-ink-subtle">
      <strong className="text-ink">What to check:</strong>
      <Mono
        as="pre"
        className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-sm border border-rule bg-canvas p-3 text-[12px] text-ink-muted"
      >
        {[
          'Verify NEXT_PUBLIC_SUPABASE_URL points at your Supabase project (the JWKS issuer derives from it).',
          'Dev path: confirm ATELIER_DEV_BEARER format is "stub:<sub>".',
        ].join('\n')}
      </Mono>
      <div className="mt-3">
        <Link
          href="/sign-out"
          className="text-[12px] text-ink-subtle underline hover:text-ink-muted"
        >
          Sign out and start over
        </Link>
      </div>
    </div>
  );
}
