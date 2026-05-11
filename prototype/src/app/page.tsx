// Public landing for the substrate. Atelier is self-hosted dev infrastructure;
// composers sign in to reach lenses, and agents call /api/mcp directly. The
// lens-first /atelier surface is the legacy dashboard pending v2; the canonical
// prototype for v2 lives at the link below (standalone CF Pages deploy until
// ADR-057 mounts it at /prototype/dashboard-northstar).

import Link from 'next/link';

const NORTHSTAR_URL = 'https://atelier-dashboard-northstar.pages.dev/';

const styles = {
  shell: {
    background: '#0e1014',
    color: '#e6e9ef',
    font: '14px/1.5 ui-sans-serif, system-ui, -apple-system, "SF Pro Text", sans-serif',
    minHeight: '100vh',
    display: 'grid' as const,
    placeItems: 'center' as const,
    padding: 24,
  },
  card: {
    maxWidth: 640,
    width: '100%',
    background: '#161a22',
    border: '1px solid #2a303c',
    borderRadius: 6,
    padding: '28px 32px',
  },
  eyebrow: {
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: 12,
    color: '#8a93a6',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },
  title: {
    font: '600 24px/1.2 ui-sans-serif, system-ui, sans-serif',
    margin: '0 0 12px',
  },
  lede: {
    color: '#c9d1e0',
    margin: '0 0 20px',
  },
  section: {
    borderTop: '1px solid #2a303c',
    marginTop: 20,
    paddingTop: 16,
  },
  sectionLabel: {
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: 11,
    color: '#8a93a6',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    margin: '0 0 8px',
  },
  link: {
    color: '#7aa6ff',
    textDecoration: 'none',
  },
  linkMuted: {
    color: '#c9d1e0',
    textDecoration: 'underline',
    textDecorationColor: '#2a303c',
  },
  row: {
    margin: '0 0 6px',
    fontSize: 13,
    color: '#c9d1e0',
  },
  note: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#8a93a6',
  },
  code: {
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    background: '#0e1014',
    border: '1px solid #2a303c',
    padding: '1px 5px',
    borderRadius: 3,
    color: '#c9d1e0',
  },
  signin: {
    display: 'inline-block',
    marginTop: 4,
    fontSize: 13,
    color: '#8a93a6',
    textDecoration: 'underline',
    textDecorationColor: '#2a303c',
  },
} as const;

export default function Home() {
  return (
    <main style={styles.shell}>
      <div style={styles.card}>
        <div style={styles.eyebrow}>atelier // coordination substrate</div>
        <h1 style={styles.title}>Atelier — coordination substrate for human + AI teams</h1>
        <p style={styles.lede}>
          Webapp v2 is in design. The canonical prototype defines what v2 will be;
          the lens-first dashboard is legacy and frozen until v2 ships. Substrate
          state, observability, and the agent endpoint are unchanged.
        </p>

        <div style={styles.section}>
          <p style={styles.sectionLabel}>Canonical prototype (v2 north star)</p>
          <p style={styles.row}>
            <a href={NORTHSTAR_URL} style={styles.link} rel="noreferrer">
              atelier-dashboard-northstar.pages.dev
            </a>{' '}
            — Compose / Inbox / Activity / Atlas / Connect
          </p>
          <p style={styles.note}>
            Standalone Cloudflare Pages deploy. Will move to{' '}
            <code style={styles.code}>/prototype/dashboard-northstar</code> once
            ADR-057 lands.
          </p>
        </div>

        <div style={styles.section}>
          <p style={styles.sectionLabel}>Legacy lens-first dashboard</p>
          <p style={styles.row}>
            <Link href="/atelier" style={styles.linkMuted}>
              /atelier
            </Link>{' '}
            — five role-aware lenses (analyst / dev / pm / designer / stakeholder).
            Frozen pending v2.
          </p>
        </div>

        <div style={styles.section}>
          <p style={styles.sectionLabel}>Substrate surfaces</p>
          <p style={styles.row}>
            Observability:{' '}
            <Link href="/atelier/observability" style={styles.linkMuted}>
              /atelier/observability
            </Link>
          </p>
          <p style={styles.row}>
            Agent endpoint: <code style={styles.code}>/api/mcp</code> · OAuth
            discovery:{' '}
            <code style={styles.code}>
              /.well-known/oauth-authorization-server
            </code>
          </p>
        </div>

        <div style={styles.section}>
          <Link href="/sign-in" style={styles.signin} data-testid="signin-cta">
            Sign in →
          </Link>
        </div>
      </div>
    </main>
  );
}
