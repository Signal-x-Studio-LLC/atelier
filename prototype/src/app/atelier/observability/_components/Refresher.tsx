// Observability refresh island.
//
// Mounts a 30s interval calling router.refresh() so the SSR pass re-runs
// and the panels reflect the latest snapshot. Different surface from the
// LiveUpdater used by the coordination lenses (which subscribes to the
// broadcast substrate): observability is operator-driven monitoring
// where freshness is the value, not write contention.
//
// Manual refresh button calls router.refresh() immediately. Timer resets
// on manual refresh so a manual click does not race with an imminent
// auto-tick.
//
// ADR-060 PR C: migrated to design-package primitives.

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Mono } from '../../../../lib/atelier/design';

const POLL_INTERVAL_MS = 30_000;

export default function Refresher({ staleAsOf }: { staleAsOf: string }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastTick, setLastTick] = useState<number>(Date.now());

  useEffect(() => {
    const start = (): void => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setLastTick(Date.now());
        router.refresh();
      }, POLL_INTERVAL_MS);
    };
    start();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [router]);

  const onManual = (): void => {
    setRefreshing(true);
    setLastTick(Date.now());
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const secondsSinceTick = Math.floor((Date.now() - lastTick) / 1000);
  const secondsToNext = Math.max(0, Math.ceil((POLL_INTERVAL_MS - (Date.now() - lastTick)) / 1000));

  return (
    <div
      className="mt-1 flex flex-col items-end gap-1"
      suppressHydrationWarning
      data-iaux-snapshot-ts={staleAsOf}
    >
      <Mono className="text-[11px] text-ink-subtle">
        Snapshot {staleAsOf} (auto-refresh in ~{secondsToNext}s; last tick {secondsSinceTick}s ago)
      </Mono>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onManual}
        disabled={refreshing}
        className="uppercase tracking-wider"
      >
        {refreshing ? 'Refreshing...' : 'Refresh now'}
      </Button>
    </div>
  );
}
