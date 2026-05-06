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

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useBackendAuthStore } from '@/stores/backendAuthStore';
import { AuthShell } from '@/components/auth/AuthShell';

// Shared key for cross-route post-login deep-linking. Anything that
// wants the user to come back somewhere specific after OAuth writes
// here before navigating to /login.
export const POST_LOGIN_REDIRECT_KEY = 'balruno.postLoginRedirect';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get('status');
  const error = params.get('error');
  const [message, setMessage] = useState('로그인 확인 중...');

  useEffect(() => {
    if (status === 'error' || error) {
      const qs = new URLSearchParams();
      qs.set('status', 'error');
      if (error) qs.set('error', error);
      router.replace(`/login?${qs.toString()}`);
      return;
    }

    let cancelled = false;
    void (async () => {
      await useBackendAuthStore.getState().bootstrap();
      if (cancelled) return;

      const auth = useBackendAuthStore.getState();
      if (auth.status === 'authenticated') {
        const next = readPostLoginRedirect();
        router.replace(next ?? '/workspaces');
      } else {
        setMessage('세션 확인에 실패했습니다. 다시 로그인하세요.');
        router.replace('/login?status=error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, status, error]);

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
