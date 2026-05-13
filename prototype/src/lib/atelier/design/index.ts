/**
 * Atelier design package — ADR-060 PR A.
 *
 * Single entry point for the substrate's design system. Consumers
 * import primitives, tokens, motion helpers, and sized icons from here
 * via a relative path (the prototype tsconfig does not declare an
 * `@/` alias; the relative import is the canonical shape).
 *
 *   import { Card, Heading, Button, tokens } from '../../lib/atelier/design';
 *
 * Note: `globals.css` is imported once in `prototype/src/app/layout.tsx`
 * (not re-exported from this module — CSS side-effect imports belong at
 * the application root, not inside a token-shape ESM barrel).
 */

export * from './components';
export { tokens, colors, fonts, radii, elevations, motion, iconStroke, typeRamp } from './tokens';
export type { TypeRampScale, TypeRamp, TypeFamily } from './tokens';
export { durations, easings, useReducedMotion, motionSafe } from './motion';
export { Icon16, Icon20, Icon24 } from './icons';
export type { IconName } from './icons';
