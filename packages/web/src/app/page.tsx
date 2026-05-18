import { LandingClient } from './LandingClient';

// Force static rendering — the landing route shell has no per-request
// data, so we let the CDN serve the prerendered HTML and skip the
// SSR call entirely. The auth-redirect + locale toggle live inside
// LandingClient (a client component) and hydrate on top of the
// static shell. Cuts Vercel Fast Origin Transfer for the root route.
export const dynamic = 'force-static';

export default function Home() {
  return <LandingClient />;
}
