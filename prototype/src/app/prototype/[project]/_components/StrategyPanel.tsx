'use client';

// Strategy panel — substrate harness surface per ADR-057 Slice 4.
//
// Client component. Picks the current surface from usePathname() and
// renders three things for that surface:
//   1. The manifest's strategy_notes prose (always rendered; no auth).
//   2. Recent log_decision rows scoped to the surface's trace id
//      (loaded by the server layout via loadStrategyPanelData; passed
//      down as a bucketed map).
//   3. A collapsed "Log a decision here" form that POSTs via a server
//      action and refreshes the list on success.
//
// Auth degradation: when the load result is `ok:false`, the form
// collapses to a "Sign in to log a decision" link. The strategy_notes
// still render — they're from the manifest, not the substrate.

import { FunctionComponent, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import type { PrototypeManifest } from '../../../../lib/atelier/prototype-manifest';
import type {
  StrategyPanelDecision,
  StrategyPanelLoadResult,
} from '../../../../lib/atelier/strategy-panel-data';
import {
  logDecisionFromPanel,
  type LogDecisionActionResult,
  type LogDecisionCategory,
} from '../_actions/log-decision';

interface StrategyPanelProps {
  manifest: PrototypeManifest;
  data: StrategyPanelLoadResult;
}

const CATEGORIES: { value: LogDecisionCategory; label: string }[] = [
  { value: 'architecture', label: 'Architecture' },
  { value: 'product', label: 'Product' },
  { value: 'design', label: 'Design' },
  { value: 'research', label: 'Research' },
];

function resolveSurfaceRoute(pathname: string, projectName: string): string {
  const prefix = `/prototype/${projectName}`;
  if (!pathname.startsWith(prefix)) return '/';
  const rest = pathname.slice(prefix.length);
  return rest === '' ? '/' : rest;
}

export const StrategyPanel: FunctionComponent<StrategyPanelProps> = ({
  manifest,
  data,
}) => {
  const pathname = usePathname();
  const surfaceRoute = resolveSurfaceRoute(pathname, manifest.name);
  const surface = manifest.surfaces.find((s) => s.route === surfaceRoute);

  if (!surface) {
    return (
      <div className="space-y-1.5">
        <div className="label-eyebrow text-ink-muted">Strategy notes</div>
        <p className="text-[11px] text-ink-subtle leading-snug">
          Surface{' '}
          <code className="font-mono text-ink-muted">{surfaceRoute}</code> not
          declared in <code className="font-mono">.atelier/prototype.yaml</code>.
        </p>
      </div>
    );
  }

  const decisions: StrategyPanelDecision[] =
    data.ok && data.decisionsByRoute[surfaceRoute]
      ? data.decisionsByRoute[surfaceRoute]
      : [];

  const pathToRevalidate = `/prototype/${manifest.name}${surfaceRoute === '/' ? '' : surfaceRoute}`;

  return (
    <div className="space-y-3">
      <div>
        <div className="label-eyebrow text-ink-muted mb-1">Strategy notes</div>
        <p
          className="text-[11px] leading-snug text-ink-subtle whitespace-pre-line"
          data-testid="strategy-notes"
        >
          {surface.strategy_notes.trim()}
        </p>
      </div>

      <div>
        <div className="label-eyebrow text-ink-muted mb-1.5">Decisions here</div>
        {data.ok ? (
          decisions.length === 0 ? (
            <p className="text-[11px] text-ink-subtle opacity-70 italic">
              No decisions logged against this surface yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {decisions.map((d) => (
                <li
                  key={d.id}
                  className="text-[11px] leading-snug border-l-2 border-rule pl-2"
                >
                  <div className="text-ink-default">{d.summary}</div>
                  <div className="text-ink-subtle opacity-70 nums-tabular">
                    {new Date(d.timestamp).toLocaleString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="text-[11px] text-ink-subtle opacity-70 italic">
            {data.reason === 'no_bearer' || data.reason === 'no_composer'
              ? 'Sign in to view decisions.'
              : `Couldn't load decisions: ${data.message}`}
          </p>
        )}
      </div>

      <div className="pt-2 border-t border-rule">
        {data.ok ? (
          <DecisionForm
            projectName={manifest.name}
            surfaceRoute={surfaceRoute}
            pathToRevalidate={pathToRevalidate}
          />
        ) : (
          <Link
            href={`/sign-in?redirect=${encodeURIComponent(pathToRevalidate)}`}
            className="text-[11px] text-ink-muted underline hover:text-ink-default"
          >
            Sign in to log a decision →
          </Link>
        )}
      </div>
    </div>
  );
};

interface DecisionFormProps {
  projectName: string;
  surfaceRoute: string;
  pathToRevalidate: string;
}

const DecisionForm: FunctionComponent<DecisionFormProps> = ({
  projectName,
  surfaceRoute,
  pathToRevalidate,
}) => {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState<LogDecisionActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const input = {
      projectName,
      surfaceRoute,
      pathToRevalidate,
      category: String(fd.get('category') ?? 'architecture') as LogDecisionCategory,
      summary: String(fd.get('summary') ?? ''),
      rationale: String(fd.get('rationale') ?? ''),
    };
    startTransition(async () => {
      const r = await logDecisionFromPanel(input);
      setResult(r);
      if (r.ok) {
        form.reset();
        router.refresh();
      }
    });
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-[11px] text-ink-muted underline hover:text-ink-default"
        data-testid="strategy-panel-expand-form"
      >
        + Log a decision here
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="label-eyebrow text-ink-muted">Log a decision</div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-[11px] text-ink-subtle hover:text-ink-muted"
        >
          cancel
        </button>
      </div>
      <label className="block space-y-1">
        <span className="text-[10px] text-ink-subtle uppercase tracking-wide">
          Category
        </span>
        <select
          name="category"
          required
          className="w-full text-[11px] bg-raised border border-rule rounded px-1.5 py-1 text-ink-default"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-[10px] text-ink-subtle uppercase tracking-wide">
          Summary
        </span>
        <input
          type="text"
          name="summary"
          required
          maxLength={140}
          placeholder="One-sentence summary"
          className="w-full text-[11px] bg-raised border border-rule rounded px-1.5 py-1 text-ink-default placeholder:text-ink-subtle"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[10px] text-ink-subtle uppercase tracking-wide">
          Rationale
        </span>
        <textarea
          name="rationale"
          required
          rows={3}
          placeholder="Why this decision was made"
          className="w-full text-[11px] bg-raised border border-rule rounded px-1.5 py-1 text-ink-default placeholder:text-ink-subtle resize-none"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="w-full text-[11px] bg-ink-default text-bg-base rounded px-2 py-1 disabled:opacity-50"
        data-testid="strategy-panel-submit"
      >
        {isPending ? 'Logging…' : 'Log decision'}
      </button>
      {result && (
        <div
          role="status"
          className={`text-[10px] leading-snug ${
            result.ok ? 'text-ink-default' : 'text-red-700'
          }`}
        >
          {result.ok ? (
            <span>Logged. ADR: {result.adrId}</span>
          ) : (
            <span>
              {result.code}: {result.message}
            </span>
          )}
        </div>
      )}
    </form>
  );
};
