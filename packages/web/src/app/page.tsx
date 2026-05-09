'use client';

/**
 * Root entry — auth probe + redirect.
 *
 * Authenticated users jump to their last visited workspace+project
 * (localStorage hint written by the workspace/project pages); when
 * the hint is absent we fall back to /workspaces which auto-routes
 * from there. Unauthenticated users are sent to /login.
 *
 * The previous Excalidraw-style anonymous demo (ADR 0035) was
 * reverted on 2026-05-08; nothing here should touch a demo session
 * anymore.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useBackendAuthStore } from '@/stores/backendAuthStore';

export default function Home() {
  const router = useRouter();
  const status = useBackendAuthStore((s) => s.status);

  useEffect(() => {
    if (status === 'idle' || status === 'loading') return;

    if (status === 'authenticated') {
      if (typeof window !== 'undefined') {
        const lastWs = window.localStorage.getItem('balruno:lastWorkspace');
        const lastProj = lastWs
          ? window.localStorage.getItem(`balruno:lastProject:${lastWs}`)
          : null;
        if (lastWs && lastProj) {
          router.replace(`/${lastWs}/projects/${lastProj}`);
          return;
        }
      }
      router.replace('/workspaces');
      return;
    }

    router.replace('/login');
  }, [status, router]);

  return (
    <main
      className="flex min-h-screen items-center justify-center"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-tertiary)' }}
    >
      <p className="text-sm">불러오는 중…</p>
    </main>
  );
}
