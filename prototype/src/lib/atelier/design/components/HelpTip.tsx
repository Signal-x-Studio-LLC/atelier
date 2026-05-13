'use client';

// Inline help affordance. One per section header — reveals a short
// popover describing what a section does and whether it is interactive.
// Click or hover opens; click-outside, Escape, or blur closes.
//
// Relocated into the design package per ADR-060 PR D — the primitive is
// useful beyond the `/prototype/*` harness rail (every Atelier-authored
// surface with a labelled section can adopt it), so it lives alongside
// the other design primitives rather than as a harness-local component.

import {
  FunctionComponent,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

interface HelpTipProps {
  label: string;
  children: ReactNode;
}

export const HelpTip: FunctionComponent<HelpTipProps> = ({ label, children }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        popoverRef.current?.contains(t) ||
        triggerRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDocClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [open, close]);

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-rule bg-raised text-[9px] font-mono text-ink-subtle leading-none hover:border-ink-muted hover:text-ink-default focus:outline-none focus-visible:ring-1 focus-visible:ring-ink-default motion-safe:transition-colors"
      >
        ?
      </button>
      {open && (
        <div
          ref={popoverRef}
          id={popoverId}
          role="dialog"
          aria-label={`About ${label}`}
          className="absolute left-0 top-full z-20 mt-1 w-[240px] max-w-[calc(100vw-2rem)] rounded border border-rule bg-paper p-2 text-[11px] leading-snug text-ink-default shadow-lg break-words motion-safe:transition-opacity"
        >
          {children}
        </div>
      )}
    </span>
  );
};
