'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { workspaceApi } from '@/lib/api/workspaces';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';
import { AuthShell } from '@/components/auth/AuthShell';
import { SubmitButton } from '@/components/auth/SubmitButton';

interface InviteInfo {
  workspaceName: string;
  inviterName: string;
  role: string;
}

type Phase = 'loading' | 'ready' | 'accepting' | 'done' | 'error';

export default function AcceptInvitePage() {
  const t = useTranslations('invite');
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await workspaceApi.inviteInfo(token);
        if (!cancelled) {
          setInfo(r);
          setPhase('ready');
        }
      } catch (e) {
        if (cancelled) return;
        setPhase('error');
        if (e instanceof ApiError) {
          if (e.code === 'NO_BACKEND') setError(t('errNoBackend'));
          else if (e.code === 'NOT_FOUND_INVITE') setError(t('errInvalidToken'));
          else if (e.code === 'INVITE_EXPIRED') setError(t('errExpired'));
          else setError(e.message);
        } else {
          setError(t('errGeneric'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const accept = async () => {
    setPhase('accepting');
    try {
      const { workspaceId } = await workspaceApi.acceptInvite(token);
      setPhase('done');
      router.push(`/?workspace=${workspaceId}`);
    } catch (e) {
      setPhase('error');
      setError(e instanceof ApiError ? e.message : t('errGeneric'));
    }
  };

  if (!isAuthenticated) {
    const next = encodeURIComponent(`/invite/${token}`);
    return (
      <AuthShell title={t('title')} subtitle={t('mustLogin')}>
        <Link
          href={`/login?next=${next}`}
          className="block w-full text-center px-3 py-2.5 rounded-md font-medium"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {t('goLogin')}
        </Link>
        <Link
          href={`/signup?next=${next}`}
          className="mt-2 block w-full text-center px-3 py-2.5 rounded-md font-medium border"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
        >
          {t('goSignup')}
        </Link>
      </AuthShell>
    );
  }

  if (phase === 'loading') {
    return <AuthShell title={t('title')} subtitle={t('loading')}><div /></AuthShell>;
  }

  if (phase === 'error') {
    return (
      <AuthShell title={t('title')}>
        <p className="mb-3 text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
        <Link href="/" className="text-sm" style={{ color: 'var(--accent)' }}>
          {t('backHome')}
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t('title')}
      subtitle={
        info
          ? t('inviteFromBy', { workspace: info.workspaceName, inviter: info.inviterName })
          : ''
      }
    >
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {t('roleLabel')}: <strong>{info?.role}</strong>
      </p>
      <SubmitButton loading={phase === 'accepting'} onClick={accept}>
        {t('accept')}
      </SubmitButton>
      <Link
        href="/"
        className="mt-3 block text-center text-sm"
        style={{ color: 'var(--text-secondary)' }}
      >
        {t('decline')}
      </Link>
    </AuthShell>
  );
}
