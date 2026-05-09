'use client';

/**
 * Landing page after the backend completes an OAuth provider exchange.
 *
 * The backend sets the httpOnly `balruno_session` cookie and redirects
 * the browser here. We can't see the cookie, so we trigger a /me probe
 * via the auth store; if the store flips to `authenticated` we honour
 * any deep-link the user wanted before login (stored in sessionStorage
 * by the page that initiated the redirect — invite pages, e.g.).
 *
 * On any error path we send the user back to /login with an error
 * banner — the login page already knows how to render it.
 */

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { listWorkspaces } from '@/lib/backend';
import { useBackendAuthStore } from '@/stores/backendAuthStore';
import { AuthShell } from '@/components/auth/AuthShell';

// Shared key for cross-route post-login deep-linking. Anything that
// wants the user to come back somewhere specific after OAuth writes
// here before navigating to /login.
export const POST_LOGIN_REDIRECT_KEY = 'balruno.postLoginRedirect';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const queryStatus = params.get('status');
  const queryError = params.get('error');
  const authStatus = useBackendAuthStore((s) => s.status);

  useEffect(() => {
    // Backend explicitly told us the OAuth flow failed (provider error,
    // unverified email, etc.) — bypass the auth probe and propagate.
    if (queryStatus === 'error' || queryError) {
      const qs = new URLSearchParams();
      qs.set('status', 'error');
      if (queryError) qs.set('error', queryError);
      router.replace(`/login?${qs.toString()}`);
      return;
    }

    // Don't call bootstrap() here — the root-layout BackendAuthBootstrap
    // is the single entry point. Wait for its result by watching
    // `authStatus`. 'idle' / 'loading' = still in flight.
    if (authStatus === 'authenticated') {
      const next = readPostLoginRedirect();
      if (next) {
        router.replace(next);
        return;
      }
      // Skip the /workspaces hop. Resolve the destination directly:
      //   1. last-visited workspace+project (localStorage hint set by
      //      the workspace and project pages) → deepest possible URL
      //   2. last-visited workspace alone (no project hint) → /{ws}
      //   3. backend listWorkspaces — single ws goes to /{slug}, multi
      //      goes through the picker, zero gets created inline by the
      //      /workspaces page's empty-state seed.
      void (async () => {
        const w = typeof window !== 'undefined' ? window : null;
        const lastWs = w?.localStorage.getItem('balruno:lastWorkspace');
        const lastProj = lastWs
          ? w?.localStorage.getItem(`balruno:lastProject:${lastWs}`)
          : null;
        if (lastWs && lastProj) {
          router.replace(`/${lastWs}/projects/${lastProj}`);
          return;
        }
        if (lastWs) {
          router.replace(`/${lastWs}`);
          return;
        }
        try {
          const list = await listWorkspaces();
          if (list.length === 1) {
            router.replace(`/${list[0].slug}`);
            return;
          }
          router.replace('/workspaces');
        } catch {
          router.replace('/workspaces');
        }
      })();
    } else if (authStatus === 'anonymous') {
      router.replace('/login?status=error');
    }
  }, [router, queryStatus, queryError, authStatus]);

  const message =
    authStatus === 'anonymous'
      ? '세션 확인에 실패했습니다. 다시 로그인하세요.'
      : '로그인 확인 중...';

  return (
    <AuthShell title="로그인 처리 중">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {message}
      </p>
    </AuthShell>
  );
}

// Only relative paths inside the app are honoured — guards against an
// open-redirect via attacker-controlled sessionStorage value.
function readPostLoginRedirect(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = window.sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  if (stored) window.sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  return stored && stored.startsWith('/') && !stored.startsWith('//') ? stored : null;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}
