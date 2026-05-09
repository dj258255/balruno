'use client';

/**
 * Root marketing landing — Baserow / Linear / Notion / Vercel pattern.
 *
 * Anonymous visitors see the full page (Header / Hero / Features / 10
 * views / Integrations / Community / Pricing / OSS / Footer).
 * Authenticated visitors are routed straight to their last-visited
 * workspace+project (localStorage hint) or /workspaces.
 *
 * Locale toggle in the header writes the NEXT_LOCALE cookie that
 * src/i18n/request.ts reads on every server render and reloads.
 * No router-level locale prefix yet, so a hard reload is the
 * simplest way to pick up the new catalogue.
 */

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';

import { useTheme } from '@/contexts/ThemeContext';
import {
  ArrowRight,
  Github,
  Globe,
  LayoutGrid,
  MessageCircle,
  MessageSquare,
  Plug,
  Sparkles,
  Code2,
} from 'lucide-react';

import { useBackendAuthStore } from '@/stores/backendAuthStore';

const DISCORD_URL = 'https://discord.gg/8cKDsfVYR';
const GITHUB_URL = 'https://github.com/dj258255/balruno';

export default function Home() {
  const router = useRouter();
  const status = useBackendAuthStore((s) => s.status);

  useEffect(() => {
    if (status === 'idle' || status === 'loading') return;
    if (status !== 'authenticated') return;

    if (typeof window !== 'undefined') {
      const lastWs = window.localStorage.getItem('balruno:lastWorkspace');
      const lastProj = lastWs
        ? window.localStorage.getItem(`balruno:lastProject:${lastWs}`)
        : null;
      if (lastWs && lastProj) {
        router.replace(`/${lastWs}/projects/${lastProj}`);
        return;
      }
    }
    router.replace('/workspaces');
  }, [status, router]);

  if (status === 'idle' || status === 'loading' || status === 'authenticated') {
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        style={{ background: 'var(--bg-primary)', color: 'var(--text-tertiary)' }}
      >
        <p className="text-sm">…</p>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <Header />
      <Hero />
      <Features />
      <Views />
      <Integrations />
      <Community />
      <PricingTeaser />
      <OpenSource />
      <Footer />
    </main>
  );
}

function LocaleToggle() {
  const locale = useLocale();
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
      style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
      aria-label="Switch language"
    >
      <Globe className="h-3.5 w-3.5" />
      <span className="font-medium">{locale === 'ko' ? '한국어' : 'EN'}</span>
    </button>
  );
}

function Header() {
  const t = useTranslations('marketing.header');
  const { theme } = useTheme();
  const iconSrc = theme === 'dark' ? '/icon-dark.svg' : '/icon.svg';
  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-md"
      style={{
        borderColor: 'var(--border-primary)',
        background: 'color-mix(in srgb, var(--bg-primary) 80%, transparent)',
      }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          <Image
            src={iconSrc}
            alt=""
            width={28}
            height={28}
            priority
            className="h-7 w-7 rounded-md"
          />
          Balruno
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/pricing"
            className="hidden sm:inline-block rounded-md px-3 py-1.5 transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('pricing')}
          </Link>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <MessageCircle className="h-4 w-4" />
            {t('joinDiscord')}
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Github className="h-4 w-4" />
            {t('githubStar')}
          </a>
          <LocaleToggle />
          <Link
            href="/login"
            className="rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition-transform hover:-translate-y-px"
            style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
          >
            {t('signIn')}
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  const t = useTranslations('marketing.hero');
  return (
    <section className="relative overflow-hidden border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 60% at 20% 0%, rgba(99,102,241,0.18) 0%, transparent 60%),'
            + ' radial-gradient(50% 50% at 90% 10%, rgba(236,72,153,0.14) 0%, transparent 60%),'
            + ' radial-gradient(60% 60% at 50% 100%, rgba(168,85,247,0.10) 0%, transparent 60%)',
        }}
      />
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center">
        <div>
          <p
            className="mb-5 inline-block rounded-full border px-3 py-1 text-xs"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
          >
            {t('badge')}
          </p>
          <h1 className="mb-5 text-4xl font-bold leading-[1.15] tracking-tight md:text-5xl">
            {t('titleLine1')}
            <br />
            <span style={{ color: 'var(--accent)' }}>{t('titleAccent')}</span>
          </h1>
          <p className="mb-8 text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('subtitle')}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-medium shadow-sm transition-transform hover:-translate-y-px"
              style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
            >
              {t('ctaStart')} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border px-5 py-3 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            >
              <MessageCircle className="h-4 w-4" /> Discord
            </a>
          </div>
          <p className="mt-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('freemiumNote')}
          </p>
        </div>
        <HeroIllustration />
      </div>
    </section>
  );
}

function HeroIllustration() {
  return (
    <div
      className="relative aspect-video overflow-hidden rounded-xl border shadow-2xl"
      style={{
        borderColor: 'var(--border-primary)',
        background:
          'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(168,85,247,0.12) 50%, rgba(236,72,153,0.12) 100%)',
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="grid w-full max-w-md grid-cols-4 gap-px overflow-hidden rounded-md p-px"
          style={{ background: 'var(--border-primary)' }}
        >
          {['Class', 'HP', 'STR', 'AGI'].map((h) => (
            <div
              key={h}
              className="px-2 py-2 text-center text-xs font-semibold"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              {h}
            </div>
          ))}
          {[
            ['Knight', '120', '15', '8'],
            ['Mage', '60', '5', '10'],
            ['Archer', '80', '10', '15'],
            ['Cleric', '90', '8', '7'],
          ].flatMap((row, i) =>
            row.map((cell, j) => (
              <div
                key={`${i}-${j}`}
                className="px-2 py-2 text-center text-xs"
                style={{
                  background: 'var(--bg-primary)',
                  color: j === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: j === 0 ? 500 : 400,
                }}
              >
                {cell}
              </div>
            )),
          )}
        </div>
      </div>
    </div>
  );
}

function Features() {
  const t = useTranslations('marketing.features');
  const items = [
    { icon: LayoutGrid, key: 'views' },
    { icon: MessageSquare, key: 'collab' },
    { icon: Plug, key: 'integrations' },
    { icon: Code2, key: 'engineExport' },
    { icon: Sparkles, key: 'formulas' },
  ] as const;
  return (
    <section className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="mb-3 text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="mb-12 text-base" style={{ color: 'var(--text-secondary)' }}>
          {t('lead')}
        </p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div
                key={it.key}
                className="group rounded-xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
              >
                <div
                  className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}
                >
                  <Icon className="h-5 w-5" style={{ color: 'var(--accent)' }} />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{t(`${it.key}.title`)}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {t(`${it.key}.desc`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Views() {
  const t = useTranslations('marketing.viewsSection');
  const views = [
    'Grid', 'Form', 'Kanban', 'Calendar',
    'Gallery', 'Gantt', 'Heatmap', 'Curve',
    'Probability', 'Diff',
  ];
  return (
    <section className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="mb-3 text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="mb-10 text-base" style={{ color: 'var(--text-secondary)' }}>
          {t('lead')}
        </p>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
          {views.map((v) => (
            <div
              key={v}
              className="rounded-lg border px-3 py-5 text-center text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-sm"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
            >
              {v}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Integrations() {
  const t = useTranslations('marketing.integrationsSection');
  const itemKeys = ['github', 'discord', 'outbound', 'notify', 'share', 'export'] as const;
  return (
    <section className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="mb-3 text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="mb-10 text-base" style={{ color: 'var(--text-secondary)' }}>
          {t('lead')}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {itemKeys.map((k) => (
            <div
              key={k}
              className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
              {t(`items.${k}`)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Community() {
  const t = useTranslations('marketing.community');
  return (
    <section className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="mb-3 text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="mb-10 text-base" style={{ color: 'var(--text-secondary)' }}>
          {t('lead')}
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <CommunityCard
            href={DISCORD_URL}
            icon={MessageCircle}
            title={t('discordTitle')}
            desc={t('discordDesc')}
            cta={t('discordCta')}
            tint="#5865F2"
          />
          <CommunityCard
            href={GITHUB_URL}
            icon={Github}
            title={t('githubTitle')}
            desc={t('githubDesc')}
            cta={t('githubCta')}
            tint="var(--text-primary)"
          />
        </div>
      </div>
    </section>
  );
}

function CommunityCard({
  href,
  icon: Icon,
  title,
  desc,
  cta,
  tint,
}: {
  href: string;
  icon: typeof MessageCircle;
  title: string;
  desc: string;
  cta: string;
  tint: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col gap-4 rounded-xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
    >
      <div
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ background: `color-mix(in srgb, ${tint} 18%, transparent)` }}
      >
        <Icon className="h-5 w-5" style={{ color: tint }} />
      </div>
      <div>
        <h3 className="mb-1.5 text-lg font-semibold">{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {desc}
        </p>
      </div>
      <span
        className="mt-auto inline-flex items-center gap-1 text-sm font-medium"
        style={{ color: tint }}
      >
        {cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </a>
  );
}

function PricingTeaser() {
  const t = useTranslations('marketing.pricing');
  const tiers = [
    {
      key: 'free',
      bullets: ['freeB1', 'freeB2', 'freeB3', 'freeB4'],
      featured: false,
    },
    {
      key: 'pro',
      bullets: ['proB1', 'proB2', 'proB3'],
      featured: true,
    },
    {
      key: 'team',
      bullets: ['teamB1', 'teamB2', 'teamB3'],
      featured: false,
    },
  ] as const;

  return (
    <section className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="mb-3 text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="mb-10 text-base" style={{ color: 'var(--text-secondary)' }}>
          {t('lead')}
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.key}
              className="relative rounded-xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{
                borderColor: tier.featured ? 'var(--accent)' : 'var(--border-primary)',
                background: 'var(--bg-primary)',
                boxShadow: tier.featured
                  ? '0 0 0 1px var(--accent) inset'
                  : undefined,
              }}
            >
              {tier.featured && (
                <span
                  className="absolute -top-2.5 left-6 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  {t('proBadge')}
                </span>
              )}
              <h3 className="mb-1 text-lg font-semibold">{t(`${tier.key}Name`)}</h3>
              <p className="mb-2 text-3xl font-bold tracking-tight">{t(`${tier.key}Price`)}</p>
              <p className="mb-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t(`${tier.key}Desc`)}
              </p>
              <ul className="space-y-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {tier.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span style={{ color: 'var(--accent)' }}>·</span>
                    {t(b)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 text-sm">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1 hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            {t('compareAll')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function OpenSource() {
  const t = useTranslations('marketing.oss');
  return (
    <section className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="mb-3 text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p
          className="mx-auto mb-8 max-w-2xl text-base leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('desc')}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border px-5 py-3 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          >
            <Github className="h-4 w-4" /> {t('cta')}
          </a>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-medium text-white shadow-sm transition-transform hover:-translate-y-px"
            style={{ background: '#5865F2' }}
          >
            <MessageCircle className="h-4 w-4" /> Discord
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const t = useTranslations('marketing.footer');
  return (
    <footer className="py-10">
      <div
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-xs"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <div>{t('tagline')}</div>
        <nav className="flex flex-wrap gap-4">
          <Link href="/privacy" className="hover:underline">{t('privacy')}</Link>
          <Link href="/terms" className="hover:underline">{t('terms')}</Link>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:underline">
            {t('github')}
          </a>
          <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="hover:underline">
            {t('discord')}
          </a>
          <Link href="/pricing" className="hover:underline">{t('pricing')}</Link>
        </nav>
      </div>
    </footer>
  );
}
