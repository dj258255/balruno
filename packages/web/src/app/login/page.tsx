'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Globe, FileSpreadsheet, Zap, Github as OpenSourceIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { startOAuthLogin } from '@/lib/backend';

/**
 * OAuth-only login. Two-pane layout — left brand panel with product
 * positioning + 3 feature bullets, right form panel with the provider
 * buttons. The brand panel hides on mobile (md breakpoint) so the
 * form gets the full viewport.
 *
 * Locale toggle (top-right, fixed) writes the NEXT_LOCALE cookie that
 * src/i18n/request.ts reads server-side, then reloads to pick up the
 * new message catalog. Same pattern as the marketing landing page's
 * LocaleToggle (app/page.tsx).
 *
 * The buttons full-page navigate to the backend's
 * /oauth2/authorization/{provider} endpoint; the backend handles the
 * provider exchange, sets the balruno_session cookie, and redirects
 * the browser to /auth/callback.
 */
function LoginInner() {
  const params = useSearchParams();
  const error = params.get('error');
  const status = params.get('status');
  const [pending, setPending] = useState<'github' | 'google' | null>(null);
  const t = useTranslations('auth.oauth');

  const handle = (provider: 'github' | 'google') => () => {
    setPending(provider);
    startOAuthLogin(provider);
  };

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row relative"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      {/* Locale toggle — fixed top-right so it sits above both panes
          on desktop and floats above the brand block on mobile. */}
      <div className="absolute top-4 right-4 z-10">
        <LocaleToggle />
      </div>

      {/* Left brand pane — gradient background + tagline + 3 feature
          bullets. Hidden below md breakpoint so the form pane is the
          whole screen on phones. */}
      <aside
        className="hidden md:flex md:w-1/2 lg:w-[55%] flex-col justify-between p-10 lg:p-14 relative overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, var(--primary-purple-light) 0%, var(--accent-light) 60%, var(--bg-secondary) 100%)',
        }}
      >
        {/* Decorative blur orbs — pure CSS, no asset deps. */}
        <div
          aria-hidden
          className="absolute -top-24 -left-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: 'var(--primary-purple)' }}
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -right-16 h-80 w-80 rounded-full opacity-20 blur-3xl"
          style={{ background: 'var(--accent)' }}
        />

        <div className="relative">
          <Link
            href="/"
            className="inline-block text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Balruno
          </Link>
        </div>

        <div className="relative max-w-md">
          <h2
            className="text-3xl lg:text-4xl font-bold leading-tight mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('brandTagline')}
          </h2>
          <p
            className="text-sm lg:text-base leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('brandSubtagline')}
          </p>
        </div>

        <ul className="relative space-y-4 max-w-md">
          <FeatureBullet
            Icon={FileSpreadsheet}
            title={t('feature1Title')}
            body={t('feature1Body')}
          />
          <FeatureBullet
            Icon={Zap}
            title={t('feature2Title')}
            body={t('feature2Body')}
          />
          <FeatureBullet
            Icon={OpenSourceIcon}
            title={t('feature3Title')}
            body={t('feature3Body')}
          />
        </ul>
      </aside>

      {/* Right form pane — provider buttons + ToS. Centered card style
          on desktop, full-bleed top section on mobile (with brand
          link visible since the aside is hidden). */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10 md:py-14">
        {/* Mobile-only brand mark since the aside is hidden. */}
        <Link
          href="/"
          className="md:hidden mb-8 text-2xl font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          Balruno
        </Link>

        <div
          className="w-full max-w-md rounded-2xl border p-8 lg:p-10 shadow-sm"
          style={{
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <h1
            className="text-2xl font-semibold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('title')}
          </h1>
          <p
            className="text-sm leading-relaxed mb-7"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('subtitle')}
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handle('github')}
              disabled={pending !== null}
              className="w-full flex items-center justify-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-wait"
              style={{
                borderColor: 'var(--border-primary)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            >
              <GitHubGlyph />
              {pending === 'github' ? t('redirecting') : t('continueWithGithub')}
            </button>

            <button
              type="button"
              onClick={handle('google')}
              disabled={pending !== null}
              className="w-full flex items-center justify-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-wait"
              style={{
                borderColor: 'var(--border-primary)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            >
              <GoogleGlyph />
              {pending === 'google' ? t('redirecting') : t('continueWithGoogle')}
            </button>
          </div>

          {(status === 'error' || error) && (
            <p
              className="mt-4 rounded-md px-3 py-2 text-sm"
              style={{
                background: 'rgba(239, 68, 68, 0.10)',
                color: 'var(--error)',
              }}
            >
              {error === 'unverified_email_conflict'
                ? t('errUnverified')
                : t('errGeneric')}
            </p>
          )}

          <p
            className="mt-7 text-xs leading-relaxed"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t.rich('tos', {
              terms: (chunks) => (
                <Link href="/terms" className="underline hover:text-[var(--text-secondary)]">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/privacy" className="underline hover:text-[var(--text-secondary)]">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function FeatureBullet({
  Icon,
  title,
  body,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3">
      <div
        className="shrink-0 mt-0.5 flex items-center justify-center w-9 h-9 rounded-lg"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
        }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div
          className="text-sm font-semibold mb-0.5"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </div>
        <p
          className="text-xs leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {body}
        </p>
      </div>
    </li>
  );
}

function LocaleToggle() {
  const locale = useLocale();
  const t = useTranslations('auth.oauth');
  const next = locale === 'ko' ? 'en' : 'ko';
  const switchTo = () => {
    document.cookie = `NEXT_LOCALE=${next}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    window.location.reload();
  };
  return (
    <button
      type="button"
      onClick={switchTo}
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-[var(--bg-hover)]"
      style={{
        borderColor: 'var(--border-primary)',
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
      }}
      aria-label={t('switchLanguage')}
      title={t('switchLanguage')}
    >
      <Globe className="h-3.5 w-3.5" />
      <span className="font-medium">{locale === 'ko' ? '한국어' : 'EN'}</span>
    </button>
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
