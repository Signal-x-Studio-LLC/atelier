import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Atelier',
  description:
    'Atelier prototype: canonical artifact + coordination dashboard. Per prototype/README.md.',
};

// No-FOUC dark-mode bootstrap (Phase 3 polish item 3 per integration.md
// §3). Inlined as a blocking script before React hydration so the first
// paint already has the correct theme class. Source of truth, in order:
//   1. localStorage.atelier-theme  ('dark' | 'light')
//   2. window.matchMedia('(prefers-color-scheme: dark)')  -> system pref
//   3. default light
// The DarkModeToggle client component (mounted by each /atelier/*
// layout) writes localStorage on user toggle; this script reads it
// without React.
const NO_FOUC_BOOTSTRAP = `(function(){try{var s=localStorage.getItem('atelier-theme');var d=s==='dark'||(s===null&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.add(d?'dark':'light');}catch(_){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FOUC_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
