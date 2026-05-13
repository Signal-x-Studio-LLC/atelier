# Custom icons

This directory holds Atelier-specific icons that the `lucide-react` set does not
cover (per ADR-060 D-3 closure).

## Contract

- Each custom icon is a single `.svg` file imported as a React component via
  SVGR. The component carries the same prop shape as a lucide icon:
  `size` (number), `strokeWidth` (number), and the rest of
  `SVGProps<SVGSVGElement>`.
- New custom icons land via the same size-tier wrapper used in
  `../icons.tsx` (`Icon16` / `Icon20` / `Icon24`), so call sites do not
  branch between lucide vs custom imports.
- The bar for adding one: the lucide-react set has been searched for the
  domain-specific shape and lacks a near-match. Document the search in
  the PR description.

## Why empty in PR A

PR A migrates no substrate surfaces; only the package foundation lands.
No surface currently consumes a custom icon. PR B / C / D may add one
if a migrating surface needs a shape lucide does not provide.
