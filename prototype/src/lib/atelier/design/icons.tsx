/**
 * Iconography — single import point per ADR-060.
 *
 * `lucide-react` is canonical (decision codified in ADR-060 D-3 closure).
 * Call sites import from this file, never from `'lucide-react'` directly;
 * the indirection is the tree-shaking gate, because new icons require an
 * addition here and additions surface in PR review.
 *
 * The eslint enforcement that fails any direct `'lucide-react'` import
 * outside this file is wired into `lint-design-system.mjs` (PR D / PR E
 * migrations); for PR A the discipline is convention + review.
 *
 * Custom icons (when lucide lacks a domain-specific shape) live in
 * `./icons/custom/` — see that directory's README for the SVGR contract.
 * No custom icons land in PR A.
 */

import type { ComponentType, SVGProps } from 'react';
import {
  Users,
  GitBranch,
  Lock,
  MessagesSquare,
  Radio,
  Zap,
  CheckCheck,
  Eye,
  OctagonAlert,
  Search,
  SearchX,
  Command,
  MessageSquarePlus,
  Hand,
  FileText,
  Bookmark,
  Code2,
  PenTool,
  KeyRound,
  Cloud,
  Sparkles,
  Inbox,
  Pencil,
} from 'lucide-react';

import { iconStroke } from './tokens';

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }>;

/**
 * Size tiers. Stroke width defaults to the `tight` token (1.5) matching
 * the existing northstar `Icon.tsx`. Consumers can override via
 * `strokeWidth` prop when an icon needs the heavier `default` (2) stroke.
 */
function wrapAtSize(Icon: LucideIcon, size: 16 | 20 | 24): LucideIcon {
  const Wrapped: LucideIcon = (props) => (
    <Icon size={size} strokeWidth={iconStroke.tight} aria-hidden {...props} />
  );
  (Wrapped as unknown as { displayName: string }).displayName = `Icon${size}(${(Icon as unknown as { displayName?: string; name?: string }).displayName ?? (Icon as unknown as { name?: string }).name ?? 'lucide'})`;
  return Wrapped;
}

const NAMED = {
  Users,
  GitBranch,
  Lock,
  MessagesSquare,
  Radio,
  Zap,
  CheckCheck,
  Eye,
  OctagonAlert,
  Search,
  SearchX,
  Command,
  MessageSquarePlus,
  Hand,
  FileText,
  Bookmark,
  Code2,
  PenTool,
  KeyRound,
  Cloud,
  Sparkles,
  Inbox,
  Pencil,
} as const;

export type IconName = keyof typeof NAMED;

function buildTier(size: 16 | 20 | 24): Record<IconName, LucideIcon> {
  const out = {} as Record<IconName, LucideIcon>;
  for (const name of Object.keys(NAMED) as IconName[]) {
    out[name] = wrapAtSize(NAMED[name] as LucideIcon, size);
  }
  return out;
}

export const Icon16 = buildTier(16);
export const Icon20 = buildTier(20);
export const Icon24 = buildTier(24);
