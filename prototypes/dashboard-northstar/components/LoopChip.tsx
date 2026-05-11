import { FunctionComponent } from 'react';
import type { Loop } from '../lib/types';

/**
 * DP-8 — three-loop framing surfaces as filter chips, not as nav.
 * Loop dot + label, no border by default. Chips compose into a toolbar
 * above Activity and Atlas timelines.
 */
export const LoopChip: FunctionComponent<{
  loop: Loop;
  active?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
}> = ({ loop, active = false, onClick, size = 'md' }) => {
  const labels: Record<Loop, string> = {
    brainstorm: 'Brainstorm',
    execute: 'Execute',
    continuity: 'Continuity',
  };
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center rounded-full border transition-colors',
        sizeClasses,
        active
          ? 'bg-ink text-ink-inverse border-ink'
          : 'bg-paper text-ink-muted border-rule hover:border-rule-strong hover:text-ink',
      ].join(' ')}
    >
      <span className={`loop-dot loop-dot--${loop}`} />
      {labels[loop]}
    </button>
  );
};
