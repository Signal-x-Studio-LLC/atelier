import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Feedback + state primitives — Banner, EmptyState, LoadingSkeleton, ErrorPanel.
 *
 * Every consumer of the design system should render explicit empty,
 * loading, and error states (D-7 a11y baseline + ADR-060 generator
 * contract). These primitives are the canonical shapes.
 */

function joinClasses(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(' ');
}

type BannerTone = 'info' | 'success' | 'warning' | 'error';

const BANNER_CLASS: Record<BannerTone, string> = {
  info: 'border-info text-info',
  success: 'border-success text-success',
  warning: 'border-warning text-warning',
  error: 'border-error text-error',
};

interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: BannerTone;
  title?: ReactNode;
  children?: ReactNode;
}

export function Banner({ tone = 'info', title, children, className, ...rest }: BannerProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      {...rest}
      className={joinClasses(
        'rounded-md border bg-paper px-3 py-2 text-[14px]',
        BANNER_CLASS[tone],
        className,
      )}
    >
      {title ? <div className="font-medium text-ink">{title}</div> : null}
      {children ? <div className="text-ink-muted">{children}</div> : null}
    </div>
  );
}

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={joinClasses(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-rule bg-paper p-8 text-center',
        className,
      )}
    >
      {icon ? <div className="text-ink-subtle">{icon}</div> : null}
      <div className="font-medium text-ink">{title}</div>
      {description ? <div className="text-[13px] text-ink-muted">{description}</div> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

interface LoadingSkeletonProps {
  lines?: number;
  className?: string;
}

export function LoadingSkeleton({ lines = 3, className }: LoadingSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={joinClasses('flex flex-col gap-2', className)}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 w-full animate-pulse rounded-sm bg-raised"
          style={{ width: `${100 - i * 8}%` }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}

interface ErrorPanelProps {
  title?: ReactNode;
  message?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function ErrorPanel({ title = 'Something went wrong', message, action, className }: ErrorPanelProps) {
  return (
    <div
      role="alert"
      className={joinClasses(
        'rounded-lg border border-error bg-paper p-4 text-[14px]',
        className,
      )}
    >
      <div className="font-medium text-error">{title}</div>
      {message ? <div className="pt-1 text-ink-muted">{message}</div> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
