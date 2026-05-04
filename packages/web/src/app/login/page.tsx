'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authApi, applyLoginResponse } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { AuthShell } from '@/components/auth/AuthShell';
import { FormField } from '@/components/auth/FormField';
import { SubmitButton } from '@/components/auth/SubmitButton';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      applyLoginResponse(res);
      router.push(next);
    } catch (e) {
      setError(messageFromError(e, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t('loginTitle')}
      subtitle={t('loginSubtitle')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link href="/signup" style={{ color: 'var(--accent)' }}>
            {t('signupLink')}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <FormField
          name="email"
          label={t('email')}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          name="password"
          label={t('password')}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p className="mb-3 text-xs" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
        <SubmitButton loading={loading}>{t('loginCta')}</SubmitButton>
        <div className="mt-3 text-right">
          <Link href="/forgot-password" className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {t('forgotPasswordLink')}
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}

function messageFromError(e: unknown, t: ReturnType<typeof useTranslations<'auth'>>): string {
  if (e instanceof ApiError) {
    if (e.code === 'AUTH_INVALID_CREDENTIALS') return t('errInvalidCredentials');
    if (e.code === 'NO_BACKEND') return t('errNoBackend');
    if (e.code === 'RATE_LIMIT_LOGIN') return t('errRateLimited');
    if (e.code === 'NETWORK') return t('errNetwork');
    return e.message;
  }
  return t('errGeneric');
}
