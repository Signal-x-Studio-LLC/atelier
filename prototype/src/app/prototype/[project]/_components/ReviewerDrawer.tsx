'use client';

// Reviewer drawer — substrate harness control surface per ADR-057 Slice 2.
//
// Toggles project-mounted content into named scenarios (default / empty /
// loading) by writing scenario keys to the URL search params. Pages that
// care about the scenario read it back via `useSearchParams`. The contract
// is intentionally URL-shaped so a stakeholder can paste a link and the
// recipient lands on the same view — no client-side state to lose.
//
// Reviewer-drawer toggle keys (locked for this slice):
//
//   scenario  — 'default' | 'empty' | 'loading'         (writes ?empty=1 OR ?loading=1; default clears both)
//   scale     — integer 1..N, default 1                  (writes ?scale=N; pages use fixtures.cloneAt)
//
// Future slices may extend this contract; growth points out in ADR-057
// re-evaluation triggers ("toggle contract proves insufficient").

import { FunctionComponent } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { HelpTip } from './HelpTip';

type Scenario = 'default' | 'empty' | 'loading';

const SCENARIOS: { value: Scenario; label: string; hint: string }[] = [
  { value: 'default', label: 'Default', hint: 'Seeded fixtures' },
  { value: 'empty', label: 'Empty', hint: 'Cold-Tuesday view' },
  { value: 'loading', label: 'Loading', hint: 'Skeleton flash' },
];

function readScenario(params: URLSearchParams): Scenario {
  if (params.has('empty')) return 'empty';
  if (params.has('loading')) return 'loading';
  return 'default';
}

function readScale(params: URLSearchParams): number {
  const raw = params.get('scale');
  if (!raw) return 1;
  const n = parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 99) return n;
  return 1;
}

function buildHref(
  pathname: string,
  current: URLSearchParams,
  patch: { scenario?: Scenario; scale?: number },
): string {
  const next = new URLSearchParams(current);
  if (patch.scenario !== undefined) {
    next.delete('empty');
    next.delete('loading');
    if (patch.scenario === 'empty') next.set('empty', '1');
    if (patch.scenario === 'loading') next.set('loading', '1');
  }
  if (patch.scale !== undefined) {
    if (patch.scale <= 1) next.delete('scale');
    else next.set('scale', String(patch.scale));
  }
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export const ReviewerDrawer: FunctionComponent = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // useSearchParams() returns a ReadonlyURLSearchParams; clone into a plain
  // URLSearchParams for the helpers above (which need .set/.delete).
  const current = new URLSearchParams(searchParams.toString());
  const scenario = readScenario(current);
  const scale = readScale(current);

  const onScenarioChange = (next: Scenario) => {
    router.replace(buildHref(pathname, current, { scenario: next }), { scroll: false });
  };

  const onScaleChange = (raw: string) => {
    const n = parseInt(raw, 10);
    const next = Number.isFinite(n) && n >= 1 && n <= 99 ? n : 1;
    router.replace(buildHref(pathname, current, { scale: next }), { scroll: false });
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="label-eyebrow">Scenario</span>
          <HelpTip label="SCENARIO">
            Click a scenario card to reload the prototype with that fixture
            state. Default shows the seeded data; Empty drops fixtures to
            test empty-state UI; Loading shows skeleton flash. Sets{' '}
            <code className="font-mono">?empty=1</code> or{' '}
            <code className="font-mono">?loading=1</code> in the URL.
          </HelpTip>
        </div>
        <div role="radiogroup" aria-label="Surface scenario" className="space-y-1">
          {SCENARIOS.map(s => {
            const active = scenario === s.value;
            return (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onScenarioChange(s.value)}
                className={
                  'w-full text-left px-2 py-1.5 rounded text-xs leading-snug border transition-colors ' +
                  (active
                    ? 'border-primary bg-primary/5 text-ink'
                    : 'border-rule bg-paper text-ink-muted hover:border-rule-strong hover:text-ink')
                }
              >
                <div className="font-medium">{s.label}</div>
                <div className="text-ink-subtle opacity-80">{s.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-1.5">
          <label htmlFor="harness-scale" className="label-eyebrow">
            Scale
          </label>
          <HelpTip label="SCALE">
            Number of times to clone fixture rows. Useful for reviewing
            density at scale. Sets{' '}
            <code className="font-mono">?scale=N</code> in the URL; the
            prototype reads it and multiplies fixture rows accordingly.
          </HelpTip>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="harness-scale"
            type="number"
            min={1}
            max={99}
            step={1}
            value={scale}
            onChange={e => onScaleChange(e.target.value)}
            className="w-16 px-2 py-1 rounded border border-rule bg-paper text-xs text-ink font-mono"
          />
          <span className="text-xs text-ink-subtle">× fixtures</span>
        </div>
        <p className="mt-1 text-[11px] text-ink-subtle opacity-80 leading-snug">
          Clones rows {scale}× via <code className="font-mono">fixtures.cloneAt</code>.
        </p>
      </div>
    </div>
  );
};
