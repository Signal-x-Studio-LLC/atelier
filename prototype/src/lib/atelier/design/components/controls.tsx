import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

/**
 * Form + action primitives. Thin Tailwind-utility wrappers; behavior
 * exposed via props, never via styling holes.
 */

function joinClasses(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-ink-inverse hover:bg-primary-hover border border-transparent',
  secondary:
    'bg-paper text-ink border border-rule hover:border-rule-strong',
  ghost:
    'bg-transparent text-ink hover:bg-raised border border-transparent',
  danger:
    'bg-error text-ink-inverse hover:opacity-90 border border-transparent',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'h-7 px-2 text-[13px] rounded-sm',
  md: 'h-9 px-3 text-[14px] rounded-md',
  lg: 'h-11 px-4 text-[15px] rounded-md',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={joinClasses(
        'inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
    />
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export function Field({ label, hint, error, id, className, ...rest }: FieldProps) {
  const inputId = id ?? rest.name;
  return (
    <label htmlFor={inputId} className="flex flex-col gap-1">
      {label ? (
        <span className="text-[13px] font-medium text-ink">{label}</span>
      ) : null}
      <input
        {...rest}
        id={inputId}
        className={joinClasses(
          'h-9 rounded-sm border border-rule bg-paper px-2 text-[14px] text-ink',
          'placeholder:text-ink-subtle focus:outline-none focus:border-primary',
          error ? 'border-error' : '',
          className,
        )}
      />
      {error ? (
        <span className="text-[12px] text-error">{error}</span>
      ) : hint ? (
        <span className="text-[12px] text-ink-subtle">{hint}</span>
      ) : null}
    </label>
  );
}

type ChipTone = 'neutral' | 'brainstorm' | 'execute' | 'continuity' | 'info' | 'success' | 'warning' | 'error';

const CHIP_CLASS: Record<ChipTone, string> = {
  neutral: 'bg-raised text-ink border-rule',
  brainstorm: 'bg-paper text-ink border-rule',
  execute: 'bg-paper text-ink border-rule',
  continuity: 'bg-paper text-ink border-rule',
  info: 'bg-paper text-info border-rule',
  success: 'bg-paper text-success border-rule',
  warning: 'bg-paper text-warning border-rule',
  error: 'bg-paper text-error border-rule',
};

const CHIP_DOT: Partial<Record<ChipTone, string>> = {
  brainstorm: 'bg-loop-brainstorm',
  execute: 'bg-loop-execute',
  continuity: 'bg-loop-continuity',
};

interface ChipProps {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
}

export function Chip({ tone = 'neutral', children, className }: ChipProps) {
  const dot = CHIP_DOT[tone];
  return (
    <span
      className={joinClasses(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] font-medium',
        CHIP_CLASS[tone],
        className,
      )}
    >
      {dot ? <span className={joinClasses('inline-block size-1.5 rounded-full', dot)} /> : null}
      {children}
    </span>
  );
}
