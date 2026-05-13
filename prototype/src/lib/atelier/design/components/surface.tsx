import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

/**
 * Surface primitives — token-referencing wrappers around `<section>`,
 * `<article>`, `<div>`. Carry no opinion beyond the Tailwind utility
 * shape: `bg-*`, `text-*`, `border-*`, `rounded-*`, `shadow-*`. All
 * utilities resolve against the substrate's CSS custom properties
 * declared in `globals.css`.
 */

type SurfaceTone = 'canvas' | 'paper' | 'raised';

const TONE_CLASS: Record<SurfaceTone, string> = {
  canvas: 'bg-canvas text-ink',
  paper: 'bg-paper text-ink',
  raised: 'bg-raised text-ink',
};

function joinClasses(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  tone?: SurfaceTone;
  as?: 'section' | 'div' | 'article' | 'main' | 'aside' | 'header' | 'footer';
  children?: ReactNode;
  style?: CSSProperties;
}

export function Surface({
  tone = 'canvas',
  as: Tag = 'section',
  className,
  children,
  style,
  ...rest
}: SurfaceProps) {
  return (
    <Tag {...rest} className={joinClasses(TONE_CLASS[tone], className)} style={style}>
      {children}
    </Tag>
  );
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: SurfaceTone;
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  children?: ReactNode;
}

const ELEVATION_CLASS: Record<'none' | 'sm' | 'md' | 'lg', string> = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
};

export function Card({
  tone = 'paper',
  elevation = 'sm',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      className={joinClasses(
        TONE_CLASS[tone],
        ELEVATION_CLASS[elevation],
        'rounded-lg border border-rule',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface PanelProps extends HTMLAttributes<HTMLElement> {
  tone?: SurfaceTone;
  as?: 'section' | 'aside' | 'div';
  children?: ReactNode;
}

export function Panel({
  tone = 'raised',
  as: Tag = 'section',
  className,
  children,
  ...rest
}: PanelProps) {
  return (
    <Tag
      {...rest}
      className={joinClasses(
        TONE_CLASS[tone],
        'rounded-md border border-rule p-4',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
