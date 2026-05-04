'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { AuthShell } from '@/components/auth/AuthShell';
import { FormField } from '@/components/auth/FormField';
import { SubmitButton } from '@/components/auth/SubmitButton';

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <AuthShell title={t('resetTitle')}>
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          {t('errResetTokenMissing')}
        </p>
        <Link href="/forgot-password" className="mt-4 inline-block text-sm" style={{ color: 'var(--accent)' }}>
          {t('forgotCta')}
        </Link>
      </AuthShell>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError(t('errPasswordTooShort'));
    if (password !== confirm) return setError(t('errPasswordMismatch'));

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      router.push('/login?reset=ok');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NO_BACKEND') setError(t('errNoBackend'));
      else if (e instanceof ApiError && e.code === 'AUTH_RESET_TOKEN_INVALID') setError(t('errResetTokenInvalid'));
      else setError(t('errGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title={t('resetTitle')} subtitle={t('resetSubtitle')}>
      <form onSubmit={submit} noValidate>
        <FormField
          name="password"
          label={t('newPassword')}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormField
          name="confirm"
          label={t('confirmPassword')}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && (
          <p className="mb-3 text-xs" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
        <SubmitButton loading={loading}>{t('resetCta')}</SubmitButton>
      </form>
    </AuthShell>
  );
}
