'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { startOAuthLogin } from '@/lib/backend';
import { AuthShell } from '@/components/auth/AuthShell';

/**
 * OAuth-only login. The buttons full-page navigate to the backend's
 * /oauth2/authorization/{provider} endpoint; the backend handles the
 * provider exchange, sets the balruno_session cookie, and redirects
 * the browser to /auth/callback.
 */
function LoginInner() {
  const params = useSearchParams();
  const error = params.get('error');
  const status = params.get('status');
  const [pending, setPending] = useState<'github' | 'google' | null>(null);

  const handle = (provider: 'github' | 'google') => () => {
    setPending(provider);
    startOAuthLogin(provider);
  };

  return (
    <AuthShell title="Sign in to Balruno">
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
        Continue with one of your existing accounts. We never store passwords —
        verification happens at your provider.
      </p>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handle('github')}
          disabled={pending !== null}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-3 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
        >
          <GitHubGlyph />
          {pending === 'github' ? 'Redirecting…' : 'Continue with GitHub'}
        </button>

        <button
          type="button"
          onClick={handle('google')}
          disabled={pending !== null}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-3 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
        >
          <GoogleGlyph />
          {pending === 'google' ? 'Redirecting…' : 'Continue with Google'}
        </button>
      </div>

      {(status === 'error' || error) && (
        <p className="mt-4 rounded-md bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error === 'unverified_email_conflict'
            ? 'This email is already linked to another account but the new provider could not verify it. Sign in with the original method instead.'
            : 'Login failed. Please try again.'}
        </p>
      )}

      <p className="mt-6 text-xs text-neutral-500 dark:text-neutral-500">
        By continuing you agree to the{' '}
        <Link href="/terms" className="underline">Terms</Link> and{' '}
        <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function GitHubGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.16c-3.2.7-3.88-1.37-3.88-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.94 10.94 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.14v3.18c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.22-4.74 3.22-8.3z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.28-1.93-6.15-4.52H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC04" d="M5.85 14.13a6.6 6.6 0 0 1 0-4.26V7.03H2.18a11 11 0 0 0 0 9.94l3.67-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.61 0 3.06.55 4.21 1.64l3.15-3.15C17.45 2.13 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.03l3.67 2.84c.87-2.59 3.29-4.49 6.15-4.49z" />
    </svg>
  );
}
