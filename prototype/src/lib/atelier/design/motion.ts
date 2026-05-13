'use client';

/**
 * Motion helpers — duration + easing tokens + reduced-motion gates.
 *
 * The hook + helper here are the JS-side counterpart to the
 * @media (prefers-reduced-motion: reduce) block in globals.css. CSS
 * transitions are auto-shortened by the cascade; JS-driven motion
 * (animated layouts, autoplay, scroll-snap programmatic scroll) must
 * gate on `useReducedMotion()` explicitly.
 */

import { useEffect, useState } from 'react';
import { motion as motionTokens } from './tokens';

export const durations = motionTokens.durations;
export const easings = motionTokens.easings;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    setReduced(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return reduced;
}

/**
 * Returns a CSS transition string when motion is allowed; returns 'none'
 * when the user has requested reduced motion. Intended for inline styles
 * on primitives that compose transition properties at runtime.
 *
 *   const transition = motionSafe(reduced, 'opacity 200ms cubic-bezier(...)');
 */
export function motionSafe(reduced: boolean, transition: string): string {
  return reduced ? 'none' : transition;
}
