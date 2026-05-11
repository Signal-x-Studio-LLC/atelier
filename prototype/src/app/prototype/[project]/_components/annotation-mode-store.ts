'use client';

// Module-level annotate-mode store for the harness annotation overlay
// (ADR-057 Slice 7).
//
// WHY A MODULE STORE: the harness layout renders the rail section
// (annotate-mode toggle) and the AnnotationOverlay as siblings under
// the server-component layout tree, so they cannot share React state
// via props. A tiny `useSyncExternalStore`-compatible singleton is
// dependency-free and reliable across the route subtree's client
// component graph.

import { useSyncExternalStore } from 'react';

let value = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return value;
}

function getServerSnapshot(): boolean {
  return false;
}

function set(next: boolean): void {
  if (next === value) return;
  value = next;
  for (const listener of listeners) listener();
}

export function useAnnotateMode(): [boolean, (next: boolean) => void] {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [current, set];
}

export function getAnnotateMode(): boolean {
  return value;
}

export function setAnnotateMode(next: boolean): void {
  set(next);
}
