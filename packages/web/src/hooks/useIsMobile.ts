/**
 * Tab-stable mobile viewport detection (ADR 0022 v1.2 stage B').
 *
 * Returns true when the viewport is below the Tailwind `md` breakpoint
 * (768px). Hook subscribes to a MediaQueryList so orientation changes
 * + browser resize update components in real-time.
 *
 * SSR-safe: returns false on the server (window undefined) so the
 * initial render always matches a desktop layout. The first client-
 * side useEffect tick then updates if the viewport is actually
 * mobile — same hydration pattern Tailwind's responsive classes use.
 */

import { useEffect, useState } from 'react';

const BREAKPOINT = '(max-width: 767px)';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(BREAKPOINT);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return isMobile;
}
