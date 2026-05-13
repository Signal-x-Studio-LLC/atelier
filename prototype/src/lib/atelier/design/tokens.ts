/**
 * Atelier design tokens — canonical TS source-of-truth (ADR-060 PR A).
 *
 * Every value here mirrors `prototypes/dashboard-northstar/styles.css`'s
 * `@theme` block, which itself sourced from `prototype/DESIGN.md`
 * frontmatter in the blueprint repo. The Tailwind v4 `@theme` block in
 * `./globals.css` references these values as CSS custom properties so the
 * cascade is consistent across both consumers (TS components +
 * Tailwind-class consumers).
 *
 * Type ramp tuples close the D-2 gap from
 * `atelier-dashboard-blueprint/research/design-system-audit.md`: each
 * named scale carries the full (size, leading, weight, tracking, family)
 * tuple rather than only a font-family pointer.
 */

export const colors = {
  light: {
    canvas: '#fafaf7',
    paper: '#ffffff',
    raised: '#f5f5f1',
    rule: '#e7e5df',
    ruleStrong: '#cbc9c0',

    ink: '#0f172a',
    inkMuted: '#475569',
    inkSubtle: '#64748b',
    inkInverse: '#f8fafc',

    primary: '#1e3a8a',
    primaryHover: '#1e40af',

    success: '#15803d',
    warning: '#b45309',
    error: '#b91c1c',
    info: '#1e40af',

    loopBrainstorm: '#7c3aed',
    loopExecute: '#0f766e',
    loopContinuity: '#a16207',
  },
  dark: {
    canvas: '#0e1014',
    paper: '#161a22',
    raised: '#1d222c',
    rule: '#2a303c',
    ruleStrong: '#3a4151',

    ink: '#e6e9ef',
    inkMuted: '#a3aab8',
    inkSubtle: '#8a93a6',
    inkInverse: '#0f172a',

    primary: '#7aa6ff',
    primaryHover: '#93b6ff',

    success: '#71d49a',
    warning: '#ffae73',
    error: '#ff7a8a',
    info: '#7aa6ff',

    loopBrainstorm: '#a78bfa',
    loopExecute: '#5eead4',
    loopContinuity: '#fbbf24',
  },
} as const;

export const fonts = {
  display: '"Fraunces", Georgia, serif',
  body: '"Inter", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const;

export const radii = {
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  full: '9999px',
} as const;

export const elevations = {
  light: {
    sm: '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
    md: '0 2px 8px -2px rgba(15, 23, 42, 0.08), 0 1px 2px 0 rgba(15, 23, 42, 0.04)',
    lg: '0 8px 24px -8px rgba(15, 23, 42, 0.12), 0 2px 4px -1px rgba(15, 23, 42, 0.06)',
  },
  dark: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 2px 8px -2px rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.25)',
    lg: '0 8px 24px -8px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
  },
} as const;

export const motion = {
  durations: {
    fast: '120ms',
    base: '200ms',
    slow: '320ms',
  },
  easings: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.3, 0, 0, 1)',
  },
} as const;

export const iconStroke = {
  tight: 1.5,
  default: 2,
} as const;

/**
 * Type ramp tuples — D-2 closure.
 *
 * Each named scale carries:
 *   size      — CSS length (rem | px | clamp())
 *   leading   — line-height as unitless number
 *   weight    — font-weight numeric (one of 400 / 500 / 600 per DESIGN.md weights_in_use)
 *   tracking  — letter-spacing
 *   family    — pointer into `fonts` map
 *
 * Primitive components consume these via the `scale` prop on
 * `<Heading>` / `<Body>` / `<Eyebrow>` / `<Mono>`.
 */
export type TypeFamily = keyof typeof fonts;
export type TypeRamp = {
  size: string;
  leading: number;
  weight: 400 | 500 | 600;
  tracking: string;
  family: TypeFamily;
  transform?: 'uppercase';
};

export const typeRamp = {
  displayLg: {
    size: 'clamp(2rem, 1.5rem + 2vw, 3rem)',
    leading: 1.05,
    weight: 600,
    tracking: '-0.02em',
    family: 'display',
  },
  displayMd: {
    size: '1.875rem',
    leading: 1.15,
    weight: 600,
    tracking: '-0.015em',
    family: 'display',
  },
  headingLg: {
    size: '1.5rem',
    leading: 1.2,
    weight: 600,
    tracking: '-0.012em',
    family: 'display',
  },
  headingMd: {
    size: '1.25rem',
    leading: 1.25,
    weight: 600,
    tracking: '-0.01em',
    family: 'display',
  },
  headingSm: {
    size: '1.0625rem',
    leading: 1.35,
    weight: 600,
    tracking: '-0.005em',
    family: 'body',
  },
  bodyLg: {
    size: '0.9375rem',
    leading: 1.5,
    weight: 500,
    tracking: '0',
    family: 'body',
  },
  bodyMd: {
    size: '0.9375rem',
    leading: 1.5,
    weight: 400,
    tracking: '0',
    family: 'body',
  },
  bodySm: {
    size: '0.8125rem',
    leading: 1.45,
    weight: 400,
    tracking: '0',
    family: 'body',
  },
  caption: {
    size: '0.75rem',
    leading: 1.4,
    weight: 400,
    tracking: '0',
    family: 'body',
  },
  eyebrow: {
    size: '0.625rem',
    leading: 1,
    weight: 500,
    tracking: '0.08em',
    family: 'body',
    transform: 'uppercase',
  },
  mono: {
    size: '0.8125rem',
    leading: 1.45,
    weight: 400,
    tracking: '0',
    family: 'mono',
  },
} as const satisfies Record<string, TypeRamp>;

export type TypeRampScale = keyof typeof typeRamp;

export const tokens = {
  colors,
  fonts,
  radii,
  elevations,
  motion,
  iconStroke,
  typeRamp,
} as const;
