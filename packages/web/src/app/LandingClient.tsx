'use client';

/**
 * Root entry — redirect-only client.
 *
 * Mounted from app/page.tsx (server shell, force-static). The CDN
 * serves the prerendered HTML; this client hydrates on top and
 * decides where the visitor should land:
 *
 *  - anonymous                  → /login   (auth wall)
 *  - authenticated, deep link   → last-visited workspace+project
 *  - authenticated, last ws     → that workspace's entry
 *  - authenticated, no hint     → first owned workspace's entry
 *  - authenticated, no ws       → /workspaces (create flow)
 *
 * The legacy marketing landing (Hero / Features / Views / Integrations
 * / Community / PricingTeaser / Footer) has been removed in favour of
 * this auth-walled SPA pattern (2026-05-21). README + GitHub remain
 * the discovery surface for unauthenticated visitors.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { listWorkspaces } from '@/lib/backend';
import { useBackendAuthStore } from '@/stores/backendAuthStore';

export function LandingClient() {
  const router = useRouter();
  const status = useBackendAuthStore((s) => s.status);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (status === 'idle' || status === 'loading') return;

    if (status === 'anonymous') {
      router.replace('/login');
      return;
    }

    if (status !== 'authenticated' || resolving) return;
    setResolving(true);

    // Authenticated path. Try the localStorage deep-link first
    // (last-visited workspace + project), then fall back to the
    // user's first owned workspace via the backend.
    void (async () => {
      try {
        if (typeof window !== 'undefined') {
          const lastWs = window.localStorage.getItem('balruno:lastWorkspace');
          const lastProj = lastWs
            ? window.localStorage.getItem(`balruno:lastProject:${lastWs}`)
            : null;
          if (lastWs && lastProj) {
            router.replace(`/${lastWs}/projects/${lastProj}`);
            return;
          }
          if (lastWs) {
            router.replace(`/${lastWs}`);
            return;
          }
        }

        const list = await listWorkspaces();
        if (list.length > 0) {
          router.replace(`/${list[0].slug}`);
          return;
        }
        router.replace('/workspaces');
      } catch {
        // Backend unreachable or session stale — let the user retry
        // from the workspace list, which surfaces the real error.
        router.replace('/workspaces');
      }
    })();
  }, [status, resolving, router]);

  return (
    <main
      className="flex min-h-screen items-center justify-center"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-tertiary)' }}
    >
      <p className="text-sm">…</p>
    </main>
  );
}
