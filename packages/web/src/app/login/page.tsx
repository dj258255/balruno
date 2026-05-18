import { Suspense } from 'react';

import { LoginClient } from './LoginClient';

// Force static rendering — the route shell never changes per request.
// useSearchParams + state live inside LoginClient (a client component)
// which hydrates on top of the prerendered HTML. Cuts the route out
// of the Vercel Origin Transfer budget while keeping the OAuth flow
// fully interactive.
export const dynamic = 'force-static';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
