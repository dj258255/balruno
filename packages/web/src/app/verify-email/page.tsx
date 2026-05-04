'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { AuthShell } from '@/components/auth/AuthShell';

type VerifyState = 'pending' | 'ok' | 'invalid' | 'no-backend' | 'expired';

export default function VerifyEmailPage() {
  const t = useTranslations('auth');
  const params = useSearchParams();
  const token = params.get('token');

  const [state, setState] = useState<VerifyState>('pending');

  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await authApi.verifyEmail(token);
        if (!cancelled) setState('ok');
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError) {
          if (e.code === 'NO_BACKEND') return setState('no-backend');
          if (e.code === 'AUTH_VERIFY_TOKEN_EXPIRED') return setState('expired');
        }
        setState('invalid');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const subtitle = (() => {
    switch (state) {
      case 'pending':
        return t('verifyPending');
      case 'ok':
        return t('verifyOk');
      case 'no-backend':
        return t('errNoBackend');
      case 'expired':
        return t('verifyExpired');
      case 'invalid':
      default:
        return t('verifyInvalid');
    }
  })();

  return (
    <AuthShell title={t('verifyTitle')} subtitle={subtitle}>
      {state === 'ok' && (
        <Link href="/login" className="text-sm" style={{ color: 'var(--accent)' }}>
          {t('verifyGoLogin')}
        </Link>
      )}
      {(state === 'invalid' || state === 'expired') && (
        <Link href="/login" className="text-sm" style={{ color: 'var(--accent)' }}>
          {t('backToLogin')}
        </Link>
      )}
    </AuthShell>
  );
}
