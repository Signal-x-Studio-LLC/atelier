/**
 * DP-4 freshness contract — relative time formatting for "N new since you
 * last looked." Keep small and dependency-free.
 */

export function timeAgo(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const seconds = Math.max(1, Math.round((now.getTime() - then.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatTraceId(t: string): string {
  return t;
}

export function badgeCount(n: number): string {
  if (n === 0) return '';
  if (n > 9) return '9+';
  return String(n);
}
