import { FunctionComponent } from 'react';
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
  SearchX,
} from 'lucide-react';

/**
 * D-3 — iconography contract.
 *
 * Single source for icons. All icons run at one of four sizes (12/16/20/24px)
 * with stroke-width 1.5. Decoration icons inherit text color; action icons
 * REQUIRE `label` (renders as aria-label) so screen readers can name them.
 *
 * Library: lucide-react. Named imports for tree-shaking — adding a new
 * icon means adding to this registry, which keeps the inventory visible.
 */

const REGISTRY = {
  Users, GitBranch, Lock, MessagesSquare, Radio,
  Zap, CheckCheck, Eye, OctagonAlert, Search, SearchX, Command,
  MessageSquarePlus, Hand, FileText, Bookmark,
  Code2, PenTool, KeyRound, Cloud, Sparkles,
  Inbox, Pencil,
} as const;

export type IconName = keyof typeof REGISTRY;
export type IconSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<IconSize, number> = { xs: 12, sm: 16, md: 20, lg: 24 };

interface IconProps {
  name: IconName;
  size?: IconSize;
  /** Required for action icons (icon-only buttons); omit for decoration. */
  label?: string;
  className?: string;
}

export const Icon: FunctionComponent<IconProps> = ({ name, size = 'sm', label, className = '' }) => {
  const Component = REGISTRY[name];
  if (!Component) {
    if (typeof console !== 'undefined') console.warn(`Icon "${name}" not in registry`);
    return null;
  }
  const a11y = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true };
  return (
    <Component
      size={SIZES[size]}
      strokeWidth={1.5}
      className={className}
      {...a11y}
    />
  );
};
