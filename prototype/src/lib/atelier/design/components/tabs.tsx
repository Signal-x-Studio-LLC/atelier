'use client';

import type { ReactNode } from 'react';

/**
 * Minimal Tabs primitive — controlled. Consumer holds the active tab id;
 * the primitive renders the tablist + tab buttons with the focus + ARIA
 * shape. Panels are siblings rendered by the consumer.
 */

function joinClasses(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(' ');
}

interface Tab {
  id: string;
  label: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
  className?: string;
}

export function Tabs({ tabs, active, onChange, ariaLabel, className }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={joinClasses(
        'inline-flex items-center gap-1 rounded-md border border-rule bg-paper p-1',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={joinClasses(
              'inline-flex h-7 items-center justify-center rounded-sm px-2.5 text-[13px] font-medium transition-colors',
              isActive
                ? 'bg-raised text-ink'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
