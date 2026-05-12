// StateFilterChips - Phase 8 filter affordances above the fold.
//
// Three states (open / synthesized / approved) drive the get_proposals
// query via the ?state= URL param. Server-side filter -- the loader
// reads searchParams and forwards to dispatch, so the client never
// receives un-rendered rows (Phase 8 server-side rule).

import Link from 'next/link';

const STATES = [
  { id: 'open' as const, label: 'Open' },
  { id: 'synthesized' as const, label: 'Synthesized' },
  { id: 'approved' as const, label: 'Approved' },
];

export function StateFilterChips({
  activeState,
}: {
  activeState: 'open' | 'synthesized' | 'approved';
}) {
  return (
    <nav
      aria-label="Filter proposals by state"
      className="border-b border-rule bg-paper px-6 lg:px-10 py-2"
    >
      <div className="max-w-7xl mx-auto flex items-center gap-2">
        <span className="label-eyebrow mr-2">Filter</span>
        {STATES.map((s) => {
          const isActive = s.id === activeState;
          return (
            <Link
              key={s.id}
              href={s.id === 'open' ? '/atelier/compose' : `/atelier/compose?state=${s.id}`}
              aria-current={isActive ? 'page' : undefined}
              className={
                isActive
                  ? 'px-3 py-1 text-xs rounded-full bg-primary text-ink-inverse no-underline'
                  : 'px-3 py-1 text-xs rounded-full border border-rule text-ink-muted no-underline hover:text-ink hover:border-rule-strong'
              }
            >
              {s.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
