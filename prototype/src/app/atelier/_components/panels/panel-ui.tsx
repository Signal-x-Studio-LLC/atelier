// Shared row/tag UI primitives for /atelier lens panels.
//
// ADR-060 PR C: these replace the Panel.module.css boilerplate. The
// design-package's <Panel>/<Eyebrow>/<Body>/<Mono>/<Chip> primitives
// cover the section-level shape; this file adds the row/list/tag
// micro-shapes the lens panels share (rows are denser than <Card>
// inside the panel grid).

import type { ReactNode } from 'react';
import { Eyebrow, Mono } from '../../../../lib/atelier/design';

export function PanelHeader({
  title,
  count,
}: {
  title: ReactNode;
  count?: ReactNode;
}) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-2">
      <Eyebrow as="h2" className="m-0 text-ink-muted">{title}</Eyebrow>
      {count !== undefined && count !== null ? (
        <Mono className="text-[12px] text-ink-subtle">{count}</Mono>
      ) : null}
    </div>
  );
}

export function PanelEmpty({ children }: { children: ReactNode }) {
  return <div className="text-[13px] italic text-ink-subtle">{children}</div>;
}

export function PanelList({ children }: { children: ReactNode }) {
  return <ul className="m-0 flex list-none flex-col gap-2 p-0">{children}</ul>;
}

export function PanelRow({ children }: { children: ReactNode }) {
  return (
    <li className="flex flex-col gap-1 rounded-sm border border-rule bg-raised px-3 py-2.5 text-[13px]">
      {children}
    </li>
  );
}

export function RowHead({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">{children}</div>
  );
}

export function RowTitle({ children }: { children: ReactNode }) {
  return <span className="break-words font-medium text-ink">{children}</span>;
}

export function RowMeta({ children }: { children: ReactNode }) {
  return (
    <Mono className="shrink-0 text-[11px] text-ink-subtle">{children}</Mono>
  );
}

export function RowSub({ children }: { children: ReactNode }) {
  return (
    <div className="break-words text-[12px] text-ink-subtle">{children}</div>
  );
}

export function Tags({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1">{children}</div>;
}

type TagTone = 'neutral' | 'accent' | 'warm' | 'danger' | 'ok' | 'mine';

const TAG_TONE: Record<TagTone, string> = {
  neutral: 'border-rule bg-canvas text-ink-muted',
  accent: 'border-info bg-canvas text-info',
  warm: 'border-warning bg-canvas text-warning',
  danger: 'border-error bg-canvas text-error',
  ok: 'border-success bg-canvas text-success',
  mine: 'border-rule-strong bg-rule text-ink',
};

export function Tag({
  tone = 'neutral',
  children,
}: {
  tone?: TagTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded-sm border px-1.5 py-px font-mono text-[11px] ${TAG_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

type StateTone = 'default' | 'review' | 'inProgress';

const STATE_TONE: Record<StateTone, string> = {
  default: 'bg-rule text-ink',
  review: 'bg-warning text-ink-inverse',
  inProgress: 'bg-primary text-ink-inverse',
};

export function StatePill({
  tone = 'default',
  children,
}: {
  tone?: StateTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded-sm px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider ${STATE_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function Affordance({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 border-t border-rule pt-2 text-[12px] text-ink-subtle">
      {children}
    </div>
  );
}

export function DegradedCallout({ children }: { children: ReactNode }) {
  return (
    <div className="border-l-[3px] border-warning bg-raised px-3 py-2 text-[13px] text-ink-muted">
      {children}
    </div>
  );
}
