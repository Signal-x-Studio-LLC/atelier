// Tiny shared section primitives.
//
// ADR-060 PR C: migrated from Observability.css class strings to the
// design package. The metric / bar / pill / row shapes inherit token
// utilities; the section files reference the helper components below
// rather than the obs-* class names.

import type { ReactNode } from 'react';
import { Body, Eyebrow, Mono } from '../../../../../lib/atelier/design';
import { severityFor, type Severity } from '../../../../../lib/atelier/observability-config.ts';

export function MetricCard({
  title,
  value,
  envelope,
  suffix,
  sub,
  wide,
}: {
  title: string;
  value: number;
  envelope?: number;
  suffix?: string;
  sub?: string;
  wide?: boolean;
}) {
  const severity: Severity = envelope ? severityFor(value, envelope) : 'ok';
  const ratio = envelope && envelope > 0 ? Math.min(1, value / envelope) : 0;
  return (
    <CardShell wide={wide}>
      <CardHead>
        <CardTitle>{title}</CardTitle>
        {envelope && <SeverityPill severity={severity} />}
      </CardHead>
      <div className="flex items-baseline gap-2">
        <span
          className="font-display text-[28px] leading-none font-semibold text-ink nums-tabular"
        >
          {formatNumber(value)}
        </span>
        {envelope && (
          <Mono className="text-[13px] text-ink-subtle">
            / {formatNumber(envelope)}
            {suffix ? ` ${suffix}` : ''}
          </Mono>
        )}
        {!envelope && suffix && (
          <Mono className="text-[13px] text-ink-subtle">{suffix}</Mono>
        )}
      </div>
      {envelope && (
        <div className="h-1.5 overflow-hidden rounded-sm bg-canvas">
          <div
            className={`h-full ${
              severity === 'alert'
                ? 'bg-error'
                : severity === 'warn'
                ? 'bg-warning'
                : 'bg-primary'
            }`}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      )}
      {sub && <CardSub>{sub}</CardSub>}
    </CardShell>
  );
}

export function SeverityPill({ severity, label }: { severity: Severity; label?: string }) {
  const tone =
    severity === 'alert'
      ? 'border-error bg-canvas text-error'
      : severity === 'warn'
      ? 'border-warning bg-canvas text-warning'
      : 'border-success bg-canvas text-success';
  const text = label ?? severity;
  return (
    <span
      className={`inline-block rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}
    >
      {text}
    </span>
  );
}

export function Card({
  title,
  children,
  wide,
  sub,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
  sub?: string;
}) {
  return (
    <CardShell wide={wide}>
      <CardHead>
        <CardTitle>{title}</CardTitle>
        {sub && <CardSub inline>{sub}</CardSub>}
      </CardHead>
      {children}
    </CardShell>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-[13px] italic text-ink-subtle">{children}</div>;
}

export function Callout({ children, warn }: { children: ReactNode; warn?: boolean }) {
  return (
    <div
      className={`border-l-[3px] ${
        warn ? 'border-warning' : 'border-primary'
      } bg-raised px-3 py-2 text-[12px] leading-[1.5] text-ink-muted`}
    >
      {children}
    </div>
  );
}

export function BarRow({
  label,
  count,
  max,
  severity,
}: {
  label: string;
  count: number;
  max: number;
  severity?: Severity;
}) {
  const ratio = max > 0 ? Math.min(1, count / max) : 0;
  const sev = severity ?? 'ok';
  return (
    <div className="grid grid-cols-[120px_1fr_60px] items-center gap-2 text-[12px]">
      <span className="capitalize text-ink-muted">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-sm bg-canvas">
        <span
          className={`block h-full ${
            sev === 'alert'
              ? 'bg-error'
              : sev === 'warn'
              ? 'bg-warning'
              : 'bg-primary'
          }`}
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
      <Mono className="text-right text-ink-subtle">{count}</Mono>
    </div>
  );
}

// Row primitives -- replace inline obs-row* className strings.

export function RowList({ children }: { children: ReactNode }) {
  return <ul className="m-0 flex list-none flex-col gap-1.5 p-0">{children}</ul>;
}

export function Row({
  children,
  testid,
}: {
  children: ReactNode;
  testid?: string;
}) {
  return (
    <li
      className="flex flex-col gap-0.5 rounded-sm border border-rule bg-raised px-2.5 py-2 text-[12px]"
      data-iaux-row={testid}
    >
      {children}
    </li>
  );
}

export function RowHead({ children }: { children: ReactNode }) {
  return <div className="flex justify-between gap-2">{children}</div>;
}

export function RowMeta({ children, breakAll }: { children: ReactNode; breakAll?: boolean }) {
  return (
    <Mono
      className={`text-[11px] text-ink-subtle ${breakAll ? 'break-all' : ''}`}
    >
      {children}
    </Mono>
  );
}

export function Capitalized({ children }: { children: ReactNode }) {
  return <span className="capitalize">{children}</span>;
}

export function MonoText({ children }: { children: ReactNode }) {
  return <Mono>{children}</Mono>;
}

// Card scaffolding -- replace inline obs-card* className strings.

export function CardShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-3 rounded-md border border-rule bg-paper p-4 ${
        wide ? 'col-[1/-1]' : ''
      }`}
    >
      {children}
    </div>
  );
}

export function CardHead({ children }: { children: ReactNode }) {
  return <div className="flex items-baseline justify-between gap-2">{children}</div>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <Eyebrow as="h2" className="m-0 text-ink-muted">
      {children}
    </Eyebrow>
  );
}

export function CardSub({ children, inline }: { children: ReactNode; inline?: boolean }) {
  return (
    <Mono
      className={`text-[11px] text-ink-subtle ${inline ? '' : 'block'}`}
    >
      {children}
    </Mono>
  );
}

export function relativeTime(d: Date | null | undefined): string {
  if (!d) return 'never';
  const ms = Date.now() - new Date(d).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// Body re-export to keep import surface compact.
export { Body };
