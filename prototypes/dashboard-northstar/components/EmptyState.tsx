import { FunctionComponent, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/**
 * EmptyState — D-6 primitive, DP-7 empty-state rule.
 *
 * Cold visitors and empty filters get a deliberate, named-action empty state,
 * not "no items" silence. Pairs icon + heading + descriptive sentence +
 * optional CTA. Use when a list-shaped surface has zero results.
 */
export const EmptyState: FunctionComponent<{
  icon: IconName;
  heading: string;
  body: string;
  cta?: ReactNode;
}> = ({ icon, heading, body, cta }) => (
  <div className="text-center py-12 px-6 border border-dashed rule-strong rounded-lg bg-paper">
    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-raised mb-4">
      <Icon name={icon} size="md" className="text-ink-subtle" />
    </div>
    <h3 className="font-display text-h3 font-semibold text-ink mb-2">{heading}</h3>
    <p className="text-sm text-ink-muted max-w-sm mx-auto leading-relaxed">{body}</p>
    {cta && <div className="mt-5">{cta}</div>}
  </div>
);
