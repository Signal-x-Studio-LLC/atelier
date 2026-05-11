'use client';

// Annotation overlay — substrate harness surface per ADR-057 Slice 7.
//
// An absolutely-positioned layer rendered inside `data-harness="content"`
// that:
//   - Captures click coordinates when "annotate mode" is on, opens a
//     compose form, and POSTs a `claim` (kind='design') via server action.
//   - Renders existing pins (loaded server-side) as numbered dots at the
//     anchor position. Click a pin to open a popover with label/body.
//   - Esc / click-outside closes the active popover or compose form.
//
// ANCHORING (v1, pragmatic):
//   - Primary: nearest ancestor with `[data-surface-anchor]` as a CSS
//     selector, plus the click's offset normalized to that element's bbox.
//   - Fallback (and stored alongside primary as a backup): scroll-normalized
//     percent of the data-harness="content" container.
//   - On render, try document.querySelector(selector); if it resolves,
//     pin at (selector.bbox.x + xPctSelector * width, …). Else fall back to
//     content.bbox.x + xPct * contentWidth.
//
// FUTURE WORK (called out in PR):
//   - ResizeObserver / MutationObserver to keep pins glued when the surface
//     reflows.
//   - Threading (replies as kind='design' contributions linked via trace_id
//     to the parent pin id).
//   - Edit + delete (substrate `update` tool already supports state +
//     content_ref transitions).

import {
  FunctionComponent,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';

import type { AnnotationLoadResult, AnnotationPin } from '../../../../lib/atelier/annotations-data';
import {
  createAnnotationFromOverlay,
  type CreateAnnotationActionResult,
} from '../_actions/create-annotation';
import { useAnnotateMode } from './annotation-mode-store';

interface AnnotationOverlayProps {
  projectName: string;
  surfaceRoutes: readonly string[];
  data: AnnotationLoadResult;
}

interface ResolvedPosition {
  /** Pixel coords relative to the data-harness="content" container. */
  x: number;
  y: number;
}

function resolveSurfaceRoute(pathname: string, projectName: string): string {
  const prefix = `/prototype/${projectName}`;
  if (!pathname.startsWith(prefix)) return '/';
  const rest = pathname.slice(prefix.length);
  return rest === '' ? '/' : rest;
}

/**
 * Resolve a pin's pixel position within the content container, given the
 * stored anchor. Tries the selector path first; falls back to the
 * scroll-normalized percent on miss.
 */
function resolvePinPosition(
  container: HTMLElement,
  anchor: AnnotationPin['anchor'],
): ResolvedPosition {
  const containerRect = container.getBoundingClientRect();
  if (anchor.selector) {
    try {
      const el = container.querySelector<HTMLElement>(anchor.selector);
      if (el) {
        const r = el.getBoundingClientRect();
        // anchor.xPct is interpreted as percent within the anchor element
        // when selector resolves (matches what we captured on click).
        return {
          x: r.left - containerRect.left + anchor.xPct * r.width,
          y: r.top - containerRect.top + anchor.yPct * r.height,
        };
      }
    } catch {
      // Invalid selector — fall through to percent fallback.
    }
  }
  // Fallback: percent within the content container (scroll-normalized).
  return {
    x: anchor.xPct * containerRect.width,
    y: anchor.yPct * containerRect.height,
  };
}

/**
 * Walk up the DOM from `target` (inclusive) looking for the closest
 * ancestor that has a [data-surface-anchor] attribute. Returns null if
 * none found before crossing the content container boundary.
 */
function findSurfaceAnchor(
  target: Element,
  container: HTMLElement,
): { element: HTMLElement; selector: string } | null {
  let node: Element | null = target;
  while (node && node !== container) {
    if (node instanceof HTMLElement && node.hasAttribute('data-surface-anchor')) {
      const raw = node.getAttribute('data-surface-anchor')!;
      // The attribute value is itself a CSS-attribute-selector-safe id.
      // Use [data-surface-anchor="..."] as the selector for re-resolution.
      const escaped = raw.replace(/"/g, '\\"');
      return {
        element: node,
        selector: `[data-surface-anchor="${escaped}"]`,
      };
    }
    node = node.parentElement;
  }
  return null;
}

export const AnnotationOverlay: FunctionComponent<AnnotationOverlayProps> = ({
  projectName,
  surfaceRoutes,
  data,
}) => {
  const [annotateMode, setAnnotateModeFromStore] = useAnnotateMode();
  const onSetAnnotateMode = setAnnotateModeFromStore;
  const pathname = usePathname();
  const surfaceRoute = resolveSurfaceRoute(pathname, projectName);
  const router = useRouter();

  // The overlay layer needs to size itself against the content container
  // (its parent). useLayoutEffect grabs the parent on mount.
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [containerEl, setContainerEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setContainerEl(overlayRef.current?.parentElement ?? null);
  }, []);

  const pins: AnnotationPin[] = data.pinsByRoute[surfaceRoute] ?? [];

  // openPinId — which existing pin's popover is open.
  // composeAt — pixel coords + captured anchor for an in-flight new pin.
  const [openPinId, setOpenPinId] = useState<string | null>(null);
  const [composeAt, setComposeAt] = useState<{
    x: number;
    y: number;
    anchor: AnnotationPin['anchor'];
  } | null>(null);
  const [result, setResult] = useState<CreateAnnotationActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // Re-resolve pin positions on resize. Pure render-from-state — when
  // window resizes we just bump a counter to force re-measure of the
  // pin DOM positions via the resolver below.
  const [, setResizeTick] = useState(0);
  useEffect(() => {
    const onResize = () => setResizeTick((n) => n + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Esc closes whichever popover/form is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (composeAt) setComposeAt(null);
      else if (openPinId) setOpenPinId(null);
      else if (annotateMode) onSetAnnotateMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [composeAt, openPinId, annotateMode, onSetAnnotateMode]);

  // Click-outside (on overlay background) closes pop-overs.
  const handleOverlayClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      if (composeAt) {
        setComposeAt(null);
        setResult(null);
        return;
      }
      if (openPinId) {
        setOpenPinId(null);
        return;
      }
      if (!annotateMode || !containerEl) return;
      // Capture click position relative to the content container.
      const rect = containerEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Selector path: find the closest [data-surface-anchor] ancestor of
      // the actual element under the cursor (not the overlay itself).
      const elementUnder = document.elementFromPoint(e.clientX, e.clientY);
      let selector: string | null = null;
      let xPct = x / Math.max(rect.width, 1);
      let yPct = y / Math.max(rect.height, 1);
      if (elementUnder && containerEl.contains(elementUnder)) {
        const found = findSurfaceAnchor(elementUnder, containerEl);
        if (found) {
          selector = found.selector;
          const r = found.element.getBoundingClientRect();
          // Re-normalize the offset within the anchor element so the pin
          // sticks to that element on re-render.
          xPct = (e.clientX - r.left) / Math.max(r.width, 1);
          yPct = (e.clientY - r.top) / Math.max(r.height, 1);
        }
      }
      setComposeAt({
        x,
        y,
        anchor: { selector, xPct, yPct, v: 1 },
      });
      setResult(null);
    },
    [annotateMode, openPinId, composeAt, containerEl],
  );

  const handleSubmit = (e: ReactMouseEvent<HTMLFormElement> | React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!composeAt) return;
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const label = String(fd.get('label') ?? '');
    const body = String(fd.get('body') ?? '');
    const pathToRevalidate = `/prototype/${projectName}${
      surfaceRoute === '/' ? '' : surfaceRoute
    }`;
    startTransition(async () => {
      const r = await createAnnotationFromOverlay({
        projectName,
        surfaceRoute,
        pathToRevalidate,
        label,
        body,
        anchor: composeAt.anchor,
      });
      setResult(r);
      if (r.ok) {
        setComposeAt(null);
        onSetAnnotateMode(false);
        router.refresh();
      }
    });
  };

  // The overlay is `pointer-events: none` by default so the underlying
  // surface stays interactive. We flip to `auto` only when annotateMode
  // is on, or when a popover/compose form is open (so click-outside
  // can dismiss). Pins themselves always accept clicks (auto on the dot).
  const interactive = annotateMode || openPinId !== null || composeAt !== null;

  // Resolve pin positions only when container is mounted. The dependency
  // on `pins` and the resize tick keep this fresh.
  const resolvedPins = containerEl
    ? pins.map((pin) => ({
        pin,
        pos: resolvePinPosition(containerEl, pin.anchor),
      }))
    : [];

  // Suppress warning: surfaceRoutes is currently unused in render but
  // documented as the canonical set; keep on the props for future filtering.
  void surfaceRoutes;

  return (
    <div
      ref={overlayRef}
      data-harness="annotation-overlay"
      onClick={handleOverlayClick}
      className={`absolute inset-0 ${
        interactive ? 'pointer-events-auto' : 'pointer-events-none'
      } ${annotateMode ? 'cursor-crosshair bg-blue-500/[0.04]' : ''}`}
      style={{ zIndex: 30 }}
      aria-hidden={!interactive}
    >
      {resolvedPins.map(({ pin, pos }, index) => {
        const isOpen = openPinId === pin.id;
        return (
          <div
            key={pin.id}
            className="absolute pointer-events-auto"
            style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)' }}
            data-testid="annotation-pin"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenPinId(isOpen ? null : pin.id);
                setComposeAt(null);
              }}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-mono shadow-md transition-transform hover:scale-110 ${
                isOpen
                  ? 'bg-ink-default text-bg-base ring-2 ring-blue-400'
                  : 'bg-blue-600 text-white ring-2 ring-white'
              }`}
              aria-label={`Annotation ${index + 1}: ${pin.label}`}
            >
              {index + 1}
            </button>
            {isOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-7 top-0 w-64 rounded border border-rule bg-raised p-2 shadow-lg text-[11px] leading-snug"
                role="dialog"
              >
                <div className="flex items-baseline justify-between mb-1 gap-2">
                  <div className="font-semibold text-ink-default truncate">
                    {pin.label}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenPinId(null)}
                    className="text-[10px] text-ink-subtle hover:text-ink-muted"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                {pin.body && (
                  <p className="text-ink-subtle whitespace-pre-wrap mb-1.5">
                    {pin.body}
                  </p>
                )}
                <div className="text-[10px] text-ink-subtle opacity-70 nums-tabular">
                  {new Date(pin.createdAt).toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {composeAt && (
        <div
          className="absolute pointer-events-auto"
          style={{
            left: composeAt.x,
            top: composeAt.y,
            transform: 'translate(-50%, -50%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-[10px] font-mono shadow-md ring-2 ring-white flex items-center justify-center">
            +
          </div>
          <form
            onSubmit={handleSubmit}
            className="absolute left-7 top-0 w-72 rounded border border-rule bg-raised p-2 shadow-lg space-y-2"
          >
            <div className="flex items-baseline justify-between">
              <div className="label-eyebrow text-ink-muted">New annotation</div>
              <button
                type="button"
                onClick={() => {
                  setComposeAt(null);
                  setResult(null);
                }}
                className="text-[11px] text-ink-subtle hover:text-ink-muted"
              >
                cancel
              </button>
            </div>
            <label className="block space-y-1">
              <span className="text-[10px] text-ink-subtle uppercase tracking-wide">
                Label
              </span>
              <input
                type="text"
                name="label"
                required
                maxLength={120}
                autoFocus
                placeholder="One-line label"
                className="w-full text-[11px] bg-base border border-rule rounded px-1.5 py-1 text-ink-default placeholder:text-ink-subtle"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] text-ink-subtle uppercase tracking-wide">
                Note (optional)
              </span>
              <textarea
                name="body"
                rows={3}
                placeholder="What about this?"
                className="w-full text-[11px] bg-base border border-rule rounded px-1.5 py-1 text-ink-default placeholder:text-ink-subtle resize-none"
              />
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="w-full text-[11px] bg-ink-default text-bg-base rounded px-2 py-1 disabled:opacity-50"
              data-testid="annotation-submit"
            >
              {isPending ? 'Dropping…' : 'Drop pin'}
            </button>
            {result && !result.ok && (
              <div
                role="status"
                className="text-[10px] leading-snug text-red-700"
              >
                {result.code}: {result.message}
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
