// Thin Next.js wrapper — actual page component lives under
// prototypes/<project>/ per ADR-057. Slice 1: hardcoded to
// dashboard-northstar; v1.x is single-project per the ADR.

import { Home } from '../../../../../prototypes/dashboard-northstar/pages/Home';

export default function Page() {
  return <Home />;
}
