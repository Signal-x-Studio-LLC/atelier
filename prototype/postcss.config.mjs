// PostCSS configuration scoped to enabling Tailwind v4 for the
// /prototype/<project_id> route family (ADR-057). The rest of the atelier
// surfaces use inline styles + CSS modules and are unaffected — the
// tailwind directive only activates inside the harness layout's
// imported stylesheet.

export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
