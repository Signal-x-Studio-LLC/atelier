'use client';

import { FunctionComponent, ReactNode } from 'react';
import { NavLink, Link } from '../lib/nav';
import { CoordinationStrip } from './CoordinationStrip';
import { DemoBanner } from './DemoBanner';
import { Icon } from './Icon';
import { ME } from '../fixtures/seed';
import { badgeCount } from '../lib/format';

interface AppShellProps {
  children: ReactNode;
  inboxCount?: number;
}

/**
 * AppShell — top nav (Compose / Inbox / Activity / Atlas / Connect),
 * persistent coordination strip (DP-5), demo-data banner (Q6 resolution).
 *
 * The shell is canonical chrome — every dashboard route renders inside it.
 * The cold-visitor home (`/`) renders WITHOUT the inbox-default routing
 * but inside this same shell so the brand surface and the working surface
 * share one design language.
 */
export const AppShell: FunctionComponent<AppShellProps> = ({ children, inboxCount = 0 }) => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* D-7 a11y — skip-nav for keyboard users */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-ink focus:text-ink-inverse focus:px-3 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <DemoBanner />
      <header className="border-b border-rule bg-paper sticky top-0 z-20">
        <div className="max-w-[1280px] mx-auto px-6 h-14 flex items-center gap-8">
          <Link to="/" className="font-display text-lg font-semibold tracking-tight text-ink no-underline">
            Atelier
            <span className="ml-2 text-xs font-normal text-ink-subtle align-middle">north-star prototype</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavItem to="/compose">Compose</NavItem>
            <NavItem to="/inbox" badge={badgeCount(inboxCount)}>Inbox</NavItem>
            <NavItem to="/activity">Activity</NavItem>
            <NavItem to="/atlas">Atlas</NavItem>
            <NavItem to="/connect">Connect</NavItem>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              className="text-xs text-ink-muted hover:text-ink px-2 py-1 rounded border border-rule font-mono inline-flex items-center gap-1.5"
              aria-label="Open MCP chat command palette (Cmd+K)"
              title="Summon MCP chat"
            >
              <Icon name="Command" size="xs" />
              K
            </button>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-ink-inverse"
              style={{ backgroundColor: ME.avatar_color }}
              title={`${ME.display_name} · ${ME.discipline}`}
            >
              {ME.display_name.charAt(0)}
            </div>
          </div>
        </div>
        <CoordinationStrip />
      </header>
      <main id="main" className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-8">{children}</main>
      <footer className="border-t border-rule bg-paper">
        <div className="max-w-[1280px] mx-auto px-6 h-12 flex items-center text-xs text-ink-subtle">
          <span>Atelier dashboard north-star — Stage 3 prototype</span>
          <span className="ml-auto font-mono">project · atelier · main</span>
        </div>
      </footer>
    </div>
  );
};

interface NavItemProps {
  to: string;
  children: ReactNode;
  badge?: string;
}

const NavItem: FunctionComponent<NavItemProps> = ({ to, children, badge }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      [
        'px-3 py-1.5 rounded-md no-underline transition-colors',
        isActive ? 'bg-raised text-ink font-semibold' : 'text-ink-muted hover:text-ink hover:bg-raised',
      ].join(' ')
    }
  >
    <span className="inline-flex items-center gap-2">
      {children}
      {badge && (
        <span className="text-[10px] leading-none font-mono bg-primary text-ink-inverse px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </span>
  </NavLink>
);
