// Public landing for the substrate. Atelier is self-hosted dev infrastructure;
// composers sign in to reach lenses, and agents call /api/mcp directly. The
// lens-first /atelier surface is the legacy dashboard pending v2; the canonical
// prototype for v2 is mounted in-substrate at /prototype/dashboard-northstar
// (ADR-057).
//
// ADR-060 PR B: this surface consumes the design package
// (`lib/atelier/design`) primitives. No inline styles; no raw hex.

import Link from 'next/link';
import {
  Surface,
  Card,
  Heading,
  Body,
  Eyebrow,
  Mono,
} from '../lib/atelier/design';

const NORTHSTAR_PATH = '/prototype/dashboard-northstar';

export default function Home() {
  return (
    <Surface
      as="main"
      tone="canvas"
      className="min-h-screen grid place-items-center p-6"
    >
      <Card className="w-full max-w-[40rem] p-7 md:p-8">
        <Eyebrow as="div" className="text-ink-subtle mb-2">
          atelier // coordination substrate
        </Eyebrow>
        <Heading as="h1" scale="displayMd" className="mb-3">
          Atelier — coordination substrate for human + AI teams
        </Heading>
        <Body scale="bodyLg" className="text-ink-muted mb-5">
          Webapp v2 is in design. The canonical prototype defines what v2 will
          be; the lens-first dashboard is legacy and frozen until v2 ships.
          Substrate state, observability, and the agent endpoint are unchanged.
        </Body>

        <section className="mt-5 pt-4 border-t border-rule">
          <Eyebrow as="p" className="text-ink-subtle mb-2">
            Canonical prototype (v2 north star)
          </Eyebrow>
          <Body as="p" scale="bodySm" className="text-ink-muted mb-1">
            <Link href={NORTHSTAR_PATH} className="text-primary no-underline">
              <Mono>/prototype/dashboard-northstar</Mono>
            </Link>{' '}
            — Compose / Inbox / Activity / Atlas / Connect
          </Body>
          <Body as="p" scale="caption" className="text-ink-subtle mt-1">
            Mounted in-substrate under ADR-057. Harness chrome (reviewer drawer,
            strategy notes, traceability, presence, annotations) wraps the
            rendered surface.
          </Body>
        </section>

        <section className="mt-5 pt-4 border-t border-rule">
          <Eyebrow as="p" className="text-ink-subtle mb-2">
            Legacy lens-first dashboard
          </Eyebrow>
          <Body as="p" scale="bodySm" className="text-ink-muted">
            <Link href="/atelier" className="text-ink underline decoration-rule">
              /atelier
            </Link>{' '}
            — five role-aware lenses (analyst / dev / pm / designer /
            stakeholder). Frozen pending v2.
          </Body>
        </section>

        <section className="mt-5 pt-4 border-t border-rule">
          <Eyebrow as="p" className="text-ink-subtle mb-2">
            Substrate surfaces
          </Eyebrow>
          <Body as="p" scale="bodySm" className="text-ink-muted mb-1">
            Observability:{' '}
            <Link
              href="/atelier/observability"
              className="text-ink underline decoration-rule"
            >
              /atelier/observability
            </Link>
          </Body>
          <Body as="p" scale="bodySm" className="text-ink-muted">
            Agent endpoint: <Mono>/api/mcp</Mono> · OAuth discovery:{' '}
            <Mono>/.well-known/oauth-authorization-server</Mono>
          </Body>
        </section>

        <section className="mt-5 pt-4 border-t border-rule">
          <Link
            href="/sign-in"
            data-testid="signin-cta"
            className="inline-block text-ink-subtle underline decoration-rule text-[13px]"
          >
            Sign in →
          </Link>
        </section>
      </Card>
    </Surface>
  );
}
