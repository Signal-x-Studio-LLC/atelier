import { FunctionComponent, ReactNode } from 'react';
import { LoopChip } from '../components/LoopChip';
import { AuthorBadge } from '../components/AuthorBadge';
import { Icon, type IconName } from '../components/Icon';

/**
 * Design System showcase (`/design-system`).
 *
 * Renders every token from `prototype/DESIGN.md` frontmatter so reviewers
 * can see the system in one place. Not in the top nav — internal/dev
 * surface, reachable by direct URL or footer link.
 *
 * Sections track the 15-dimension audit (R-1..R-5 + D-1..D-10) from
 * ~/Workspace/dev/wip/big-blueprint/docs/design-system-audit.md.
 */
export const DesignSystem: FunctionComponent = () => {
  return (
    <div className="py-6 space-y-16 max-w-[1200px]">
      <header>
        <p className="label-eyebrow mb-2">D-1 through D-10 · auto-rendered from tokens</p>
        <h1 className="font-display text-display font-semibold leading-tight tracking-tight text-ink mb-3">
          The Atelier design system
        </h1>
        <p className="text-base text-ink-muted max-w-prose leading-relaxed">
          Every token from <code className="font-mono text-sm bg-raised px-1.5 py-0.5 rounded">prototype/DESIGN.md</code> rendered visually.
          What you see here is what every product surface inherits. Tokens are <em>extracted from</em> this page —
          if it isn't here, it isn't a token.
        </p>
      </header>

      {/* ─────────────────────── COLOR ─────────────────────── */}
      <Section eyebrow="D-1" title="Color" subtitle="Single brand primary. Semantic scales carry state. Warm-stone neutrals counter generic-gray.">
        <SubSection label="Brand">
          <SwatchRow>
            <Swatch name="primary"       hex="#1E3A8A" cssVar="--color-primary" />
            <Swatch name="primary-hover" hex="#1E40AF" cssVar="--color-primary-hover" />
          </SwatchRow>
        </SubSection>

        <SubSection label="Surfaces (warm stone)">
          <SwatchRow>
            <Swatch name="canvas"        hex="#FAFAF7" cssVar="--color-canvas" />
            <Swatch name="paper"         hex="#FFFFFF" cssVar="--color-paper" />
            <Swatch name="raised"        hex="#F5F5F1" cssVar="--color-raised" />
            <Swatch name="rule"          hex="#E7E5DF" cssVar="--color-rule" />
            <Swatch name="rule-strong"   hex="#CBC9C0" cssVar="--color-rule-strong" />
          </SwatchRow>
        </SubSection>

        <SubSection label="Ink (text)">
          <SwatchRow>
            <Swatch name="ink"           hex="#0F172A" cssVar="--color-ink"         dark />
            <Swatch name="ink-muted"     hex="#475569" cssVar="--color-ink-muted"   dark />
            <Swatch name="ink-subtle"    hex="#64748B" cssVar="--color-ink-subtle" dark />
            <Swatch name="ink-inverse"   hex="#F8FAFC" cssVar="--color-ink-inverse" />
          </SwatchRow>
        </SubSection>

        <SubSection label="Semantic (state)">
          <SwatchRow>
            <Swatch name="success" hex="#15803D" cssVar="--color-success" dark />
            <Swatch name="warning" hex="#B45309" cssVar="--color-warning" dark />
            <Swatch name="error"   hex="#B91C1C" cssVar="--color-error"   dark />
            <Swatch name="info"    hex="#1E40AF" cssVar="--color-info"    dark />
          </SwatchRow>
        </SubSection>

        <SubSection label="Loop accents (DP-8 categorical, not brand)">
          <SwatchRow>
            <Swatch name="brainstorm" hex="#7C3AED" cssVar="--color-loop-brainstorm" dark />
            <Swatch name="execute"    hex="#0F766E" cssVar="--color-loop-execute"    dark />
            <Swatch name="continuity" hex="#A16207" cssVar="--color-loop-continuity" dark />
          </SwatchRow>
        </SubSection>
      </Section>

      {/* ─────────────────────── TYPOGRAPHY ─────────────────────── */}
      <Section eyebrow="D-2" title="Typography" subtitle="Ramp tuples — every token is (size, leading, weight, tracking, family). Three weights total. Optical sizing on. Tabular numerals on counters/timestamps/codes.">
        <SubSection label="Ramp">
          <div className="border border-rule rounded-lg bg-paper overflow-hidden">
            <TypeRow token="display"  className="font-display text-display font-semibold" example="The studio where humans and agents author."   spec="clamp(2-3rem) / 1.05 / 600 / -0.02em / display" />
            <TypeRow token="h1"       className="font-display text-h1 font-semibold"       example="What the dashboard should be"                     spec="30px / 1.15 / 600 / -0.015em / display" />
            <TypeRow token="h2"       className="font-display text-h2 font-semibold"       example="Needs your reaction"                              spec="24px / 1.2 / 600 / -0.012em / display" />
            <TypeRow token="h3"       className="font-display text-h3 font-semibold"       example="Awaiting your approval"                            spec="20px / 1.25 / 600 / -0.01em / display" />
            <TypeRow token="h4"       className="text-h4 font-semibold"                    example="External systems"                                 spec="17px / 1.35 / 600 / -0.005em / body" />
            <TypeRow token="body"     className="text-base"                                example="Atelier is a self-hostable coordination substrate." spec="15px / 1.5 / 400 / 0 / body" />
            <TypeRow token="body_em"  className="text-base font-medium"                    example="Atelier is a self-hostable coordination substrate." spec="15px / 1.5 / 500 / 0 / body (emphasis)" />
            <TypeRow token="sm"       className="text-sm"                                  example="Last sync · 18s ago. Three loops, one timeline."  spec="13px / 1.45 / 400 / 0 / body" />
            <TypeRow token="xs"       className="text-xs"                                  example="paginate at 50 · virtualize at 500"               spec="12px / 1.4 / 400 / 0 / body" />
            <TypeRow token="eyebrow"  className="label-eyebrow"                            example="needs your reaction"                              spec="10px / 1 / 500 / +0.08em / body uppercase" />
            <TypeRow token="code"     className="font-mono text-sm"                        example="atelier seed --remove · US-9.1 · 18s"             spec="13px / 1.45 / 400 / 0 / mono · tabular-nums" />
          </div>
        </SubSection>

        <SubSection label="Numerals — tabular vs lining">
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-rule rounded-lg bg-paper p-4">
              <p className="label-eyebrow mb-2">tabular (counters, timestamps, codes)</p>
              <p className="nums-tabular font-mono text-base">2026-05-10 19:42:18</p>
              <p className="nums-tabular font-mono text-base">142,808 · 9,001 · 117</p>
              <p className="nums-tabular text-base">4 sessions · 2 contributions · 2 locks</p>
            </div>
            <div className="border border-rule rounded-lg bg-paper p-4">
              <p className="label-eyebrow mb-2">lining proportional (prose)</p>
              <p className="text-base">Built between April 24 and May 10, 2026. 18 migrations, 52 ADRs, 106 stories.</p>
            </div>
          </div>
        </SubSection>

        <SubSection label="Three weights only">
          <div className="border border-rule rounded-lg bg-paper p-4 space-y-2">
            <p className="font-normal text-base">Regular 400 — body, sm, xs prose</p>
            <p className="font-medium text-base">Medium 500 — eyebrow, body emphasis, active nav</p>
            <p className="font-semibold text-base">Semibold 600 — h1–h4, primary CTA</p>
            <p className="text-xs text-ink-subtle mt-3 italic">700 is forbidden in product chrome (DP-11).</p>
          </div>
        </SubSection>
      </Section>

      {/* ─────────────────────── SPACING ─────────────────────── */}
      <Section eyebrow="D-4" title="Spacing" subtitle="4px base. Tailwind-aligned. No invented values.">
        <div className="space-y-2">
          {[
            { token: '1', rem: '0.25rem', px: 4 },
            { token: '2', rem: '0.5rem',  px: 8 },
            { token: '3', rem: '0.75rem', px: 12 },
            { token: '4', rem: '1rem',    px: 16 },
            { token: '5', rem: '1.25rem', px: 20 },
            { token: '6', rem: '1.5rem',  px: 24 },
            { token: '8', rem: '2rem',    px: 32 },
            { token: '10', rem: '2.5rem', px: 40 },
            { token: '12', rem: '3rem',   px: 48 },
            { token: '16', rem: '4rem',   px: 64 },
          ].map(s => (
            <div key={s.token} className="flex items-center gap-4 text-sm">
              <span className="font-mono nums-tabular text-ink-subtle w-12 text-right">{s.token}</span>
              <div className="bg-primary h-2" style={{ width: `${s.px}px` }} />
              <span className="font-mono nums-tabular text-xs text-ink-subtle">{s.rem} · {s.px}px</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ─────────────────────── RADIUS + ELEVATION ─────────────────────── */}
      <Section eyebrow="D-4" title="Shape + elevation" subtitle="Four-step radius. Three-step elevation. Strategy = mostly flat.">
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { name: 'sm', radius: '0.25rem' },
            { name: 'md', radius: '0.375rem' },
            { name: 'lg', radius: '0.5rem' },
            { name: 'xl', radius: '0.75rem' },
          ].map(r => (
            <div key={r.name} className="text-center">
              <div className="bg-raised h-20 mx-auto border border-rule" style={{ borderRadius: r.radius }} />
              <p className="label-eyebrow mt-2">rounded-{r.name}</p>
              <p className="font-mono nums-tabular text-xs text-ink-subtle mt-1">{r.radius}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { name: 'sm', shadow: '0 1px 2px 0 rgba(15, 23, 42, 0.04)' },
            { name: 'md', shadow: '0 2px 8px -2px rgba(15, 23, 42, 0.08), 0 1px 2px 0 rgba(15, 23, 42, 0.04)' },
            { name: 'lg', shadow: '0 8px 24px -8px rgba(15, 23, 42, 0.12), 0 2px 4px -1px rgba(15, 23, 42, 0.06)' },
          ].map(e => (
            <div key={e.name} className="text-center">
              <div className="bg-paper h-20 mx-auto rounded-lg" style={{ boxShadow: e.shadow }} />
              <p className="label-eyebrow mt-3">shadow-{e.name}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ─────────────────────── ICONOGRAPHY ─────────────────────── */}
      <Section eyebrow="D-3" title="Iconography" subtitle="Lucide React, stroke-width 1.5, four sizes. Decoration icons inherit color + are aria-hidden; action icons require a label that surfaces as aria-label.">
        <SubSection label="Sizes">
          <div className="flex items-end gap-8">
            {(['xs', 'sm', 'md', 'lg'] as const).map(s => (
              <div key={s} className="text-center">
                <div className="h-12 flex items-end justify-center">
                  <Icon name="Sparkles" size={s} className="text-ink-muted" />
                </div>
                <p className="label-eyebrow mt-2">{s}</p>
                <p className="font-mono nums-tabular text-xs text-ink-subtle">{ { xs: 12, sm: 16, md: 20, lg: 24 }[s] }px</p>
              </div>
            ))}
          </div>
        </SubSection>

        <SubSection label="Inventory in use">
          <div className="grid grid-cols-6 gap-4">
            {[
              { name: 'Users',           use: 'sessions live' },
              { name: 'GitBranch',       use: 'contributions in flight' },
              { name: 'Lock',            use: 'locks held' },
              { name: 'MessagesSquare',  use: 'brainstorms awaiting' },
              { name: 'Radio',           use: 'last broadcast' },
              { name: 'Zap',             use: 'needs reaction' },
              { name: 'CheckCheck',      use: 'awaiting approval' },
              { name: 'Eye',             use: 'awaiting review' },
              { name: 'OctagonAlert',    use: 'blocked on you' },
              { name: 'Search',          use: 'atlas search' },
              { name: 'Command',         use: '⌘K chat' },
              { name: 'MessageSquarePlus', use: 'propose' },
              { name: 'Hand',            use: 'claim' },
              { name: 'FileText',        use: 'log decision' },
              { name: 'Bookmark',        use: 'checkpoint' },
              { name: 'Code2',           use: 'GitHub integration' },
              { name: 'PenTool',         use: 'Figma integration' },
              { name: 'KeyRound',        use: 'Supabase Auth' },
            ].map(i => (
              <div key={i.name} className="border border-rule rounded-lg bg-paper p-3 flex flex-col items-center gap-1.5">
                <Icon name={i.name as IconName} size="md" className="text-ink-muted" />
                <code className="font-mono nums-tabular text-[10px] text-ink-subtle text-center leading-tight">{i.name}</code>
                <p className="text-[10px] text-ink-subtle text-center">{i.use}</p>
              </div>
            ))}
          </div>
        </SubSection>

        <SubSection label="Decoration vs action">
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-rule rounded-lg bg-paper p-4">
              <p className="label-eyebrow mb-2">decoration · aria-hidden</p>
              <p className="text-sm text-ink inline-flex items-center gap-1.5"><Icon name="Users" size="sm" className="text-ink-muted" /> 4 sessions live</p>
              <p className="text-xs text-ink-subtle mt-2">Inherits color from parent. Adjacent text names it.</p>
            </div>
            <div className="border border-rule rounded-lg bg-paper p-4">
              <p className="label-eyebrow mb-2">action · aria-label required</p>
              <button type="button" aria-label="Search Atlas" className="text-ink-muted hover:text-ink p-2 rounded border border-rule">
                <Icon name="Search" size="sm" label="Search Atlas" />
              </button>
              <p className="text-xs text-ink-subtle mt-2">Icon-only buttons name themselves to screen readers.</p>
            </div>
          </div>
        </SubSection>
      </Section>

      {/* ─────────────────────── MOTION ─────────────────────── */}
      <Section eyebrow="D-5" title="Motion" subtitle="Teaching motion, not flourish. Three durations. Reduced-motion respected.">
        <div className="grid grid-cols-3 gap-4">
          {[
            { name: 'fast',  ms: 120, use: 'hover, focus, micro' },
            { name: 'base',  ms: 200, use: 'expand, fade, panel' },
            { name: 'slow',  ms: 320, use: 'page transition, reorder' },
          ].map(m => (
            <div key={m.name} className="border border-rule rounded-lg bg-paper p-4">
              <p className="font-mono nums-tabular text-2xl text-ink mb-1">{m.ms}ms</p>
              <p className="label-eyebrow mb-2">{m.name}</p>
              <p className="text-xs text-ink-subtle">{m.use}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-subtle italic mt-3">
          Easing: <code className="font-mono">cubic-bezier(0.2, 0, 0, 1)</code> standard ·
          <code className="font-mono ml-1">cubic-bezier(0.3, 0, 0, 1)</code> emphasized
        </p>
      </Section>

      {/* ─────────────────────── COMPONENTS ─────────────────────── */}
      <Section eyebrow="D-6" title="Component primitives" subtitle="What's built. Each example is the canonical shape — no second variant exists.">
        <SubSection label="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="bg-primary text-ink-inverse px-4 py-2 rounded-md font-medium text-sm hover:bg-[var(--color-primary-hover)]">Primary</button>
            <button type="button" className="border border-rule-strong text-ink px-4 py-2 rounded-md font-medium text-sm hover:bg-raised">Secondary (outlined)</button>
            <button type="button" className="text-primary text-sm font-medium hover:underline">Tertiary (link)</button>
            <button type="button" disabled className="bg-primary text-ink-inverse px-4 py-2 rounded-md font-medium text-sm opacity-40 cursor-not-allowed">Disabled</button>
          </div>
        </SubSection>

        <SubSection label="Filter chips (DP-8)">
          <div className="flex flex-wrap items-center gap-2">
            <LoopChip loop="brainstorm" active />
            <LoopChip loop="execute" />
            <LoopChip loop="continuity" />
            <LoopChip loop="brainstorm" size="sm" />
            <LoopChip loop="execute" size="sm" />
          </div>
        </SubSection>

        <SubSection label="Author badge (DP-2 — agents as filter, not destination)">
          <div className="flex flex-wrap items-center gap-4">
            <AuthorBadge sessionId="s-1" showName />
            <AuthorBadge sessionId="s-2" showName />
            <AuthorBadge sessionId="s-4" showName />
            <AuthorBadge sessionId="s-5" showName />
          </div>
        </SubSection>

        <SubSection label="Input field">
          <div className="max-w-md space-y-1">
            <label className="text-sm font-medium text-ink block">Title</label>
            <input type="text" placeholder="SSE fan-out: in-memory map vs. Durable Object" className="w-full px-3 py-2 border border-rule rounded-md bg-paper text-ink placeholder:text-ink-subtle" />
            <p className="text-xs text-ink-subtle">One sentence. The question, not a vibe.</p>
          </div>
        </SubSection>

        <SubSection label="Coordination strip (DP-5)">
          <div className="border border-rule rounded-lg bg-raised overflow-hidden">
            <div className="h-9 flex items-center gap-6 px-4 text-xs text-ink-muted">
              <span className="inline-flex items-baseline gap-1.5"><span className="font-mono nums-tabular font-semibold text-ink">4</span> sessions live</span>
              <span className="inline-flex items-baseline gap-1.5"><span className="font-mono nums-tabular font-semibold text-ink">2</span> contributions in flight</span>
              <span className="inline-flex items-baseline gap-1.5"><span className="font-mono nums-tabular font-semibold text-ink">2</span> locks held</span>
              <span className="inline-flex items-baseline gap-1.5"><span className="font-mono nums-tabular font-semibold text-primary">2</span> brainstorms awaiting reaction</span>
            </div>
          </div>
        </SubSection>

        <SubSection label="Eyebrow + heading + meta — the canonical section header pattern">
          <div className="border border-rule rounded-lg bg-paper p-5 max-w-2xl">
            <p className="label-eyebrow mb-1.5">D-10 content token</p>
            <h3 className="font-display text-h3 font-semibold text-ink mb-1">A canonical section header</h3>
            <p className="text-sm text-ink-muted">Eyebrow uses <code className="font-mono text-xs">.label-eyebrow</code>; heading uses display family at ≥ 20px; meta below uses body sm.</p>
          </div>
        </SubSection>
      </Section>

      {/* ─────────────────────── STATES ─────────────────────── */}
      <Section eyebrow="D-6" title="States" subtitle="Empty, loading, error. One canonical example each — primitives, not motifs.">
        <div className="grid grid-cols-3 gap-4">
          <StateExample title="Empty">
            <p className="text-sm text-ink-subtle italic py-4">No open proposals waiting on you. Quiet stretch.</p>
          </StateExample>
          <StateExample title="Loading (skeleton)">
            <div className="space-y-2 py-2">
              <div className="h-3 bg-raised rounded animate-pulse" />
              <div className="h-3 bg-raised rounded w-4/5 animate-pulse" />
              <div className="h-3 bg-raised rounded w-3/5 animate-pulse" />
            </div>
          </StateExample>
          <StateExample title="Error">
            <p className="text-sm text-error py-2">
              Couldn't load Activity. The substrate's SSE endpoint isn't deployed yet.
              <button className="block mt-1 text-primary text-xs font-medium hover:underline">Retry</button>
            </p>
          </StateExample>
        </div>
      </Section>

      {/* ─────────────────────── VOICE ─────────────────────── */}
      <Section eyebrow="DP-10" title="Voice" subtitle="Imperative second-person in chrome. Declarative in framing copy.">
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-rule rounded-lg bg-paper p-5">
            <p className="label-eyebrow mb-2">chrome — imperative</p>
            <ul className="text-sm text-ink space-y-1.5">
              <li>· Compose</li>
              <li>· Post proposal</li>
              <li>· Needs your reaction</li>
              <li>· Search the substrate</li>
              <li>· Ask the substrate…</li>
            </ul>
          </div>
          <div className="border border-rule rounded-lg bg-paper p-5">
            <p className="label-eyebrow mb-2">framing — declarative</p>
            <p className="text-sm text-ink-muted leading-relaxed">
              Atelier is a self-hostable coordination substrate for mixed teams.
              Brainstorm primitives produce structured deliberation, not chat threads.
              Locks prevent collisions, contracts prevent decision drift.
            </p>
          </div>
        </div>
      </Section>

      <footer className="border-t border-rule pt-6 text-xs text-ink-subtle">
        <p>
          Token source: <code className="font-mono">prototype/DESIGN.md</code> frontmatter ·
          Audit checklist: <code className="font-mono">big-blueprint/docs/design-system-audit.md</code> ·
          Principles: <code className="font-mono">docs/content/design-principles.md</code> (DP-1..14)
        </p>
        <p className="mt-1">
          Known gaps (D-3 iconography library, D-7 a11y formal audit, D-8 responsive pass) tracked in
          <code className="font-mono ml-1">research/design-system-gap-audit.md</code>.
        </p>
      </footer>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────

const Section: FunctionComponent<{ eyebrow: string; title: string; subtitle: string; children: ReactNode }> = ({ eyebrow, title, subtitle, children }) => (
  <section>
    <header className="mb-6 pb-3 border-b border-rule">
      <p className="label-eyebrow mb-1.5">{eyebrow}</p>
      <h2 className="font-display text-h1 font-semibold text-ink mb-1">{title}</h2>
      <p className="text-sm text-ink-muted max-w-prose">{subtitle}</p>
    </header>
    <div className="space-y-8">{children}</div>
  </section>
);

const SubSection: FunctionComponent<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div>
    <p className="label-eyebrow mb-3">{label}</p>
    {children}
  </div>
);

const SwatchRow: FunctionComponent<{ children: ReactNode }> = ({ children }) => (
  <div className="flex flex-wrap gap-3">{children}</div>
);

const Swatch: FunctionComponent<{ name: string; hex: string; cssVar: string; dark?: boolean }> = ({ name, hex, cssVar, dark }) => (
  <div className="flex-shrink-0 w-40">
    <div
      className="h-20 rounded-lg border border-rule mb-2 flex items-end p-2"
      style={{ backgroundColor: hex }}
    >
      <span className={`font-mono nums-tabular text-[10px] ${dark ? 'text-ink-inverse opacity-70' : 'text-ink-muted'}`}>
        {hex}
      </span>
    </div>
    <p className="text-sm font-medium text-ink">{name}</p>
    <p className="font-mono text-[10px] text-ink-subtle truncate">{cssVar}</p>
  </div>
);

const TypeRow: FunctionComponent<{ token: string; className: string; example: string; spec: string }> = ({ token, className, example, spec }) => (
  <div className="px-5 py-4 border-b border-rule last:border-b-0 grid grid-cols-[80px_1fr_280px] items-baseline gap-4">
    <span className="label-eyebrow">{token}</span>
    <p className={`${className} text-ink truncate`}>{example}</p>
    <p className="font-mono nums-tabular text-xs text-ink-subtle text-right">{spec}</p>
  </div>
);

const StateExample: FunctionComponent<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <div className="border border-rule rounded-lg bg-paper">
    <div className="px-4 py-2 border-b border-rule bg-raised">
      <p className="label-eyebrow">{title}</p>
    </div>
    <div className="px-4 py-3">{children}</div>
  </div>
);
