'use client';

/**
 * Invite-link landing page.
 *
 * The route is public (see `middleware.ts` PUBLIC_PATHS) so anonymous
 * visitors can hit it. Flow:
 *   1. Probe /me via the auth store.
 *   2. If anonymous → stash the current path in sessionStorage and
 *      offer a "sign in to accept" button. The auth/callback page reads
 *      that key after OAuth completes and routes back here.
 *   3. If authenticated → POST to /api/v1/invites/{token}/accept and
 *      send the user to the workspace list (or the joined workspace,
 *      once a detail route exists).
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { BackendError, acceptInvite } from '@/lib/backend';
import { useBackendAuthStore } from '@/stores/backendAuthStore';
import { AuthShell } from '@/components/auth/AuthShell';
import { POST_LOGIN_REDIRECT_KEY } from '@/app/auth/callback/page';

type State = 'pending' | 'unauth' | 'error' | 'done';

export default function InviteAcceptPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [state, setState] = useState<State>('pending');
  const [message, setMessage] = useState('초대 링크 처리 중...');

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    void (async () => {
      await useBackendAuthStore.getState().bootstrap();
      if (cancelled) return;

      const auth = useBackendAuthStore.getState();
      if (auth.status !== 'authenticated') {
        setState('unauth');
        setMessage('초대를 수락하려면 먼저 로그인하세요.');
        return;
      }

      try {
        const member = await acceptInvite(token);
        if (cancelled) return;
        setState('done');
        router.replace(`/workspaces?joined=${member.workspaceId}`);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof BackendError && e.isUnauthenticated) {
          setState('unauth');
          setMessage('초대를 수락하려면 먼저 로그인하세요.');
          return;
        }
        setState('error');
        setMessage(
          e instanceof Error ? e.message : '초대를 수락하지 못했습니다.',
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const goLogin = () => {
    if (typeof window !== 'undefined' && token) {
      window.sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, `/i/${token}`);
    }
    router.push('/login');
  };

  return (
    <AuthShell title="워크스페이스 초대">
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {message}
      </p>

      {state === 'unauth' && (
        <button
          type="button"
          onClick={goLogin}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          로그인 후 수락
        </button>
      )}

      {state === 'error' && (
        <button
          type="button"
          onClick={() => router.push('/workspaces')}
          className="w-full rounded-md border px-4 py-2 text-sm"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          워크스페이스로 이동
        </button>
      )}
    </AuthShell>
  );
}
