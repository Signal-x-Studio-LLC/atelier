'use client';

// DarkModeToggle - Phase 3 polish item 3 per integration.md §3.
//
// Pairs with the no-FOUC bootstrap script in app/layout.tsx that sets
// html.dark / html.light before hydration. This component renders the
// user-facing switch and persists the choice to localStorage so the
// bootstrap script picks it up on the next paint.
//
// Mounted by each /atelier/<surface>/layout.tsx so the toggle is
// available across the in-substrate IA. Fixed-position top-right
// keeps it out of the surface's primary content flow.

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'atelier-theme';

function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function DarkModeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  // Read the class set by the no-FOUC bootstrap script after hydration.
  // useEffect avoids a hydration-mismatch warning -- the server can't
  // know which theme the bootstrap will choose.
  useEffect(() => {
    setTheme(readInitialTheme());
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.remove(theme);
    document.documentElement.classList.add(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage can be unavailable (private mode, security
      // settings). The choice still applies for this page session via
      // the class swap; persistence is best-effort.
    }
  };

  if (!mounted) {
    // Avoid rendering during SSR / hydration; the bootstrap script
    // already established the correct theme.
    return null;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={theme === 'dark'}
      className="fixed top-3 right-3 z-50 w-9 h-9 inline-flex items-center justify-center rounded-full border border-rule bg-paper text-ink-muted hover:text-ink hover:border-rule-strong shadow-sm"
      title={`Theme: ${theme}`}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

// Inline SVGs keep the toggle independent of the lucide Icon component
// (which is used inside surface content). Stroke colors inherit from
// the button's text-ink-* utility classes via currentColor.
function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
