'use client';

/**
 * Root entry point — redirects to the server-canonical flow.
 *
 * This page used to render a heavyweight local-only Notion clone
 * (Y.Doc + IndexedDB persistence + 700-line layout with sidebar +
 * panels + tour + ydoc-backed presence). v0.6 cleanup retired that
 * surface — server-canonical mode is now the only supported runtime
 * and lives at /workspaces, /w/[slug], /w/[slug]/p/[projectSlug].
 *
 *   - Authenticated callers go to /workspaces.
 *   - Unauthenticated callers go to /login. Self-host operators who
 *     haven't wired the backend yet land on the same login page; the
 *     login page itself surfaces the OAuth providers, not a local-
 *     only fallback.
 *
 * The redirect runs in an effect so SSR can serve a tiny
 * placeholder instead of streaming the full local-mode bundle. The
 * placeholder is intentionally minimal — most users are redirected
 * within ~50ms of mount.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useBackendAuthStore } from '@/stores/backendAuthStore';

export default function Home() {
  const router = useRouter();
  const status = useBackendAuthStore((s) => s.status);

  useEffect(() => {
    // Wait for the auth check to settle. 'idle' = initial, before
    // the cookie probe completes; routing during 'idle' would race
    // the probe and could push an authenticated user to /login by
    // mistake.
    if (status === 'idle') return;
    router.replace(status === 'authenticated' ? '/workspaces' : '/login');
  }, [status, router]);

  return (
    <main
      className="flex min-h-screen items-center justify-center"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-tertiary)' }}
    >
      <p className="text-sm">로딩 중…</p>
    </main>
  );
}
