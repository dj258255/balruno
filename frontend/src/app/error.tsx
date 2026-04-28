'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { reportError } from '@/lib/errorReporting';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errorPage');
  useEffect(() => {
    reportError(error, { source: 'app-error', extra: { digest: error.digest } });
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div
        className="max-w-md w-full rounded-xl p-8"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
        >
          <AlertTriangle size={24} style={{ color: '#ef4444' }} aria-hidden="true" />
        </div>

        <h1
          className="text-xl font-semibold mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('title')}
        </h1>

        <p
          className="text-sm mb-6 leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('body')} {t('retryHint')}
        </p>

        {isDev && (
          <details
            className="mb-6 text-xs rounded-md p-3"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-tertiary)',
            }}
          >
            <summary className="cursor-pointer font-medium mb-2">
              {t('detailsLabel')}
            </summary>
            <code className="block whitespace-pre-wrap break-all font-mono">
              {error.message}
              {error.digest && `\n\ndigest: ${error.digest}`}
              {error.stack && `\n\n${error.stack}`}
            </code>
          </details>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            aria-label={t('retryAria')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--primary-blue)',
              color: 'white',
            }}
          >
            <RotateCw size={16} aria-hidden="true" />
            {t('retry')}
          </button>
          <button
            type="button"
            onClick={() => (window.location.href = '/')}
            aria-label={t('homeAria')}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
            }}
          >
            {t('home')}
          </button>
        </div>
      </div>
    </div>
  );
}
