'use client';

/**
 * Public landing — anonymous multiplayer demo (ADR 0035, 2026-05-08).
 *
 * Excalidraw home pattern. Three branches off the auth probe:
 *
 *   - 'authenticated' → /workspaces (existing onboarding redirect)
 *   - 'anonymous'     → POST /api/v1/demo/anonymous-session, which
 *                       sets the balruno_session cookie bound to the
 *                       seeded demo user, then push /w/demo/p/playground
 *   - 'idle' / 'loading' → minimal loader (do not flash to a logged-in
 *                       user before the cookie probe resolves)
 *
 * The demo session uses the same cookie + JWT path as OAuth login,
 * so the project page renders without any anonymous-specific code on
 * its side. Membership checks on every other workspace/project
 * naturally reject the demo token (it's only a member of the demo
 * workspace) — no extra guards needed downstream.
 *
 * Why no marketing landing here: the user explicitly chose the
 * Excalidraw / Figma-FigJam pattern of dropping a visitor straight
 * onto a working canvas. Marketing copy and pricing live at /pricing
 * and /about; the root URL's job is "show, don't tell".
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useBackendAuthStore } from '@/stores/backendAuthStore';
import { startAnonymousDemoSession } from '@/lib/backend';

export default function Home() {
  const router = useRouter();
  const status = useBackendAuthStore((s) => s.status);
  const setUser = useBackendAuthStore((s) => s.setUser);
  const triggered = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'idle' || status === 'loading') return;

    if (status === 'authenticated') {
      // Direct-jump to the user's last visited workspace+project so
      // the landing flow doesn't bounce through /workspaces and
      // /w/[slug] (each is its own server round-trip + render). The
      // localStorage hint is written by /w/[slug] and the project
      // page; absent (or stale beyond the freshness window) we fall
      // back to the /workspaces hop which auto-redirects from there.
      // Linear / Notion / Figma all do this.
      if (typeof window !== 'undefined') {
        const lastWs = window.localStorage.getItem('balruno:lastWorkspace');
        const lastProj = lastWs
          ? window.localStorage.getItem(`balruno:lastProject:${lastWs}`)
          : null;
        if (lastWs && lastProj) {
          router.replace(`/w/${lastWs}/p/${lastProj}`);
          return;
        }
      }
      router.replace('/workspaces');
      return;
    }

    // status === 'anonymous'
    if (triggered.current) return;
    triggered.current = true;

    (async () => {
      try {
        const session = await startAnonymousDemoSession();
        // Reflect the just-issued cookie in the auth store so any
        // BackendAuthBootstrap-driven UI (presence avatar, write
        // gates) sees an authenticated principal immediately
        // instead of waiting for a page-level /me round-trip.
        setUser({
          id: '00000000-0000-0000-0000-0000000d3000',
          email: 'demo@balruno.local',
          name: session.displayName,
          avatarUrl: null,
          locale: 'ko',
        });
        router.replace(`/w/${session.workspaceSlug}/p/${session.projectSlug}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : '데모 세션을 시작하지 못했어요.');
        triggered.current = false;
      }
    })();
  }, [status, router, setUser]);

  return (
    <main
      className="flex min-h-screen items-center justify-center"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-tertiary)' }}
    >
      {error ? (
        <div className="flex flex-col items-center gap-3 text-sm">
          <p style={{ color: 'var(--text-primary)' }}>{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              triggered.current = false;
              // Re-trigger the effect by nudging a state value through router.
              router.replace('/');
            }}
            className="rounded-md border px-3 py-1.5"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
          >
            다시 시도
          </button>
        </div>
      ) : (
        <p className="text-sm">데모 워크스페이스 불러오는 중…</p>
      )}
    </main>
  );
}
