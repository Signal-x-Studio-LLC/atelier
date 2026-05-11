'use client';

// Routing adapter — replaces `react-router-dom` usage now that the
// dashboard-northstar prototype is mounted under Next.js App Router at
// `/prototype/dashboard-northstar`. Pages keep writing relative paths
// (e.g. "/compose"); this layer prepends the mount base and exposes a
// NavLink with active-state styling driven by `usePathname()`.

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import type { AnchorHTMLAttributes, FunctionComponent, ReactNode } from 'react';

export const BASE = '/prototype/dashboard-northstar';

export function resolveHref(to: string): string {
  // `#` anchors collapse to the project root + anchor (matches
  // CoordinationStrip behaviour: `/connect#presence`).
  if (to.startsWith('#')) return `${BASE}${to}`;
  // External or already-prefixed paths pass through untouched.
  if (to.startsWith('http') || to.startsWith(BASE)) return to;
  // The legacy "/" home of the prototype maps to the mount root.
  if (to === '/') return BASE;
  return `${BASE}${to}`;
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children: ReactNode;
}

export const Link: FunctionComponent<LinkProps> = ({ to, children, ...rest }) => (
  <NextLink href={resolveHref(to)} {...rest}>
    {children}
  </NextLink>
);

interface NavLinkProps {
  to: string;
  children: ReactNode | ((args: { isActive: boolean }) => ReactNode);
  className?: string | ((args: { isActive: boolean }) => string);
}

export const NavLink: FunctionComponent<NavLinkProps> = ({ to, children, className }) => {
  const pathname = usePathname() ?? '';
  const target = resolveHref(to);
  // Strip query/hash before comparing.
  const targetPath = target.split('?')[0]?.split('#')[0] ?? target;
  const isActive =
    targetPath === BASE
      ? pathname === BASE || pathname === `${BASE}/`
      : pathname === targetPath || pathname.startsWith(`${targetPath}/`);
  const resolvedClassName =
    typeof className === 'function' ? className({ isActive }) : className;
  const content = typeof children === 'function' ? children({ isActive }) : children;
  return (
    <NextLink href={target} className={resolvedClassName}>
      {content}
    </NextLink>
  );
};
