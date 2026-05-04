'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authApi, applyLoginResponse } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { AuthShell } from '@/components/auth/AuthShell';
import { FormField } from '@/components/auth/FormField';
import { SubmitButton } from '@/components/auth/SubmitButton';

export default function SignupPage() {
  const t = useTranslations('auth');
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t('errPasswordTooShort'));
      return;
    }
    if (!agreeTerms || !agreePrivacy) {
      setError(t('errTermsRequired'));
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.signup({
        email,
        password,
        displayName,
        agreeTerms,
        agreePrivacy,
        agreeMarketing,
      });
      applyLoginResponse(res);
      router.push('/welcome');
    } catch (e) {
      setError(messageFromError(e, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t('signupTitle')}
      subtitle={t('signupSubtitle')}
      footer={
        <>
          {t('hasAccount')}{' '}
          <Link href="/login" style={{ color: 'var(--accent)' }}>
            {t('loginLink')}
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
          name="displayName"
          label={t('displayName')}
          autoComplete="name"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <FormField
          name="password"
          label={t('password')}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="mb-4 mt-3 space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <CheckRow
            label={
              <>
                <Link href="/terms" target="_blank" style={{ color: 'var(--accent)' }}>
                  {t('termsLabel')}
                </Link>{' '}
                {t('agreeRequired')}
              </>
            }
            checked={agreeTerms}
            onChange={setAgreeTerms}
          />
          <CheckRow
            label={
              <>
                <Link href="/privacy" target="_blank" style={{ color: 'var(--accent)' }}>
                  {t('privacyLabel')}
                </Link>{' '}
                {t('agreeRequired')}
              </>
            }
            checked={agreePrivacy}
            onChange={setAgreePrivacy}
          />
          <CheckRow
            label={t('marketingOptIn')}
            checked={agreeMarketing}
            onChange={setAgreeMarketing}
          />
        </div>

        {error && (
          <p className="mb-3 text-xs" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
        <SubmitButton loading={loading}>{t('signupCta')}</SubmitButton>
      </form>
    </AuthShell>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span>{label}</span>
    </label>
  );
}

function messageFromError(e: unknown, t: ReturnType<typeof useTranslations<'auth'>>): string {
  if (e instanceof ApiError) {
    if (e.code === 'CONFLICT_EMAIL_EXISTS') return t('errEmailExists');
    if (e.code === 'NO_BACKEND') return t('errNoBackend');
    if (e.code === 'NETWORK') return t('errNetwork');
    return e.message;
  }
  return t('errGeneric');
}
