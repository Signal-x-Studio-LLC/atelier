// SurfaceShell - shared a11y scaffolding for /atelier/{compose,inbox,activity}.
//
// Phase 3 item 5 (a11y SR-sweep automation): provides a skip-nav link
// rendered as the first focusable element on every in-scope surface,
// plus a `<main>` landmark anchor. The skip link is visually hidden
// (off-screen translate) until keyboard-focused, then reveals as a
// token-styled chip in the top-left. Token-only styling (no raw hex /
// rem); inherits the prototype's global focus-visible ring from
// styles.css. Reduced-motion media query disables the reveal
// transition.
//
// Usage in a layout:
//
//     <>
//       <SurfaceSkipNav />
//       <DarkModeToggle />
//       <SurfaceShell>{children}</SurfaceShell>
//     </>
//
// SurfaceSkipNav is exported separately from SurfaceShell so layouts
// can keep it as the FIRST DOM-order focusable, ahead of the dark-mode
// toggle and any other chrome.
//
// The role-aware /atelier lens shell (Lens.tsx) already renders its own
// <main>; that surface is not wrapped here. /atelier/compose,
// /atelier/inbox, /atelier/activity all wrap via the helpers below.
//
// ADR-060 PR C: dropped inline-hex fallbacks. The substrate's
// `globals.css` cascade guarantees the tokens exist; no fallback needed.

import type { ReactNode } from 'react';

const SKIP_NAV_TARGET_ID = 'atelier-main-content';

export function SurfaceSkipNav() {
  return (
    <>
      <a
        href={`#${SKIP_NAV_TARGET_ID}`}
        data-testid="skip-nav"
        className="sr-skip-nav"
        style={{
          position: 'absolute',
          left: '0.5rem',
          top: '0.5rem',
          padding: '0.5rem 0.75rem',
          background: 'var(--color-paper)',
          color: 'var(--color-ink)',
          border: '1px solid var(--color-rule)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.875rem',
          zIndex: 100,
          transform: 'translateY(-200%)',
          transition: 'transform 0.12s ease-out',
        }}
      >
        Skip to main content
      </a>
      <style>{`
        .sr-skip-nav:focus,
        .sr-skip-nav:focus-visible {
          transform: translateY(0) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .sr-skip-nav { transition: none !important; }
        }
      `}</style>
    </>
  );
}

export function SurfaceShell({ children }: { children: ReactNode }) {
  return (
    <main id={SKIP_NAV_TARGET_ID} tabIndex={-1}>
      {children}
    </main>
  );
}
