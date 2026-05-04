'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { AuthShell } from '@/components/auth/AuthShell';
import { FormField } from '@/components/auth/FormField';
import { SubmitButton } from '@/components/auth/SubmitButton';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'NO_BACKEND' ? t('errNoBackend') : t('errGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t('forgotTitle')}
      subtitle={sent ? t('forgotSentSubtitle') : t('forgotSubtitle')}
      footer={
        <Link href="/login" style={{ color: 'var(--accent)' }}>
          {t('backToLogin')}
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('forgotCheckInbox', { email })}
        </p>
      ) : (
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
          {error && (
            <p className="mb-3 text-xs" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}
          <SubmitButton loading={loading}>{t('forgotCta')}</SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
