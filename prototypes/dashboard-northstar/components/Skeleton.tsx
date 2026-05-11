import { FunctionComponent } from 'react';

/**
 * Skeleton — D-6 primitive, DP-9 motion rule.
 *
 * Loading-state pattern. Subtle pulse using the raised surface color so
 * the screen doesn't flash blank, and the silhouette of the eventual
 * content shows through. Respects prefers-reduced-motion (CSS animation
 * is overridden in styles.css when reduced-motion is set).
 *
 * Use for: list rows that take > 200ms to fetch, async-mounted regions,
 * SSE-reconnect transitions.
 */
export const Skeleton: FunctionComponent<{
  className?: string;
  count?: number;
}> = ({ className = '', count = 1 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className={['bg-raised rounded animate-pulse', className].join(' ')}
        aria-hidden="true"
      />
    ))}
  </>
);

/** SkeletonRow — list-row-shaped skeleton; matches Activity's row metric. */
export const SkeletonRow: FunctionComponent = () => (
  <div className="px-4 py-3 flex items-center gap-3" aria-hidden="true">
    <div className="w-2 h-2 bg-raised rounded-full animate-pulse" />
    <div className="h-3 bg-raised rounded w-28 animate-pulse" />
    <div className="h-3 bg-raised rounded flex-1 animate-pulse" />
    <div className="h-5 w-5 bg-raised rounded-full animate-pulse" />
    <div className="h-3 bg-raised rounded w-12 animate-pulse" />
  </div>
);
