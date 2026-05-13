// Charter — the canonical files agents read on every register/get_context.
// Per ARCH 6.7 charter is paths-only by default; excerpts opt-in via the
// lens depth (PM and stakeholder lenses default to excerpts on).
//
// ADR-060 PR C: migrated to design-package primitives.

import { Mono, Panel } from '../../../../lib/atelier/design';
import {
  Affordance,
  PanelHeader,
  PanelList,
  PanelRow,
  RowHead,
} from './panel-ui.tsx';

export default function CharterPanel({
  paths,
  excerpts,
  excerptsEnabled,
}: {
  paths: string[];
  excerpts: Record<string, string> | null;
  excerptsEnabled: boolean;
}) {
  return (
    <Panel tone="paper" className="flex min-w-0 flex-col gap-3 p-4">
      <PanelHeader title="Charter" count={paths.length} />
      <PanelList>
        {paths.map((path) => (
          <PanelRow key={path}>
            <RowHead>
              <Mono className="break-words font-medium text-ink">{path}</Mono>
            </RowHead>
            {excerpts?.[path] && (
              <Mono as="pre" className="m-0 whitespace-pre-wrap break-words text-[12px] text-ink-muted">
                {excerpts[path]}
              </Mono>
            )}
          </PanelRow>
        ))}
      </PanelList>
      <Affordance>
        {excerptsEnabled
          ? 'Lens default: excerpts on. get_context returns first-N-line excerpts inline.'
          : 'Lens default: paths only. Set with_charter_excerpts=true on get_context to include bodies.'}
      </Affordance>
    </Panel>
  );
}
