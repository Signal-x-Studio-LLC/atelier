import type { State, CapabilityResult, Status } from './types.ts';

/**
 * Diff two State snapshots, returning which capabilities changed status
 * between them. Useful for "what shipped this week" reports.
 */
export interface CapabilityTransition {
  id: string;
  description: string;
  from: Status | 'NEW';
  to: Status | 'REMOVED';
}

export function diffStates(prev: State, next: State): CapabilityTransition[] {
  const prevById = new Map<string, CapabilityResult>(
    prev.capabilities.map((c) => [c.capability.id, c]),
  );
  const nextById = new Map<string, CapabilityResult>(
    next.capabilities.map((c) => [c.capability.id, c]),
  );

  const transitions: CapabilityTransition[] = [];

  for (const [id, n] of nextById) {
    const p = prevById.get(id);
    if (!p) {
      transitions.push({
        id,
        description: n.capability.description,
        from: 'NEW',
        to: n.status,
      });
    } else if (p.status !== n.status) {
      transitions.push({
        id,
        description: n.capability.description,
        from: p.status,
        to: n.status,
      });
    }
  }

  for (const [id, p] of prevById) {
    if (!nextById.has(id)) {
      transitions.push({
        id,
        description: p.capability.description,
        from: p.status,
        to: 'REMOVED',
      });
    }
  }

  return transitions;
}

export function renderDiffTable(transitions: CapabilityTransition[]): string {
  if (!transitions.length) return '_No status transitions._';
  const lines = ['| ID | From | To | Description |', '|----|------|----|-------------|'];
  for (const t of transitions) {
    lines.push(`| \`${t.id}\` | ${t.from} | ${t.to} | ${t.description} |`);
  }
  return lines.join('\n');
}
