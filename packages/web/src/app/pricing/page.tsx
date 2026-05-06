'use client';

/**
 * Public pricing page — Notion / Baserow / Linear pattern: three tier
 * cards above a side-by-side comparison table. Until the billing
 * surface lands every workspace is FREE; the PRO/TEAM rows are kept
 * accurate to the eventual product (ADR 0016) so curious self-hosters
 * see the same model that drives the in-product limit guards.
 *
 * Public path — listed in proxy.ts so the unauthenticated marketing
 * surface stays accessible without redirecting to /login.
 */

import Link from 'next/link';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { WorkspacePlan } from '@/lib/backend';

export default function PricingPage() {
  const t = useTranslations('pricing');

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-10 text-center">
        <Link
          href="/"
          className="mb-6 inline-block text-2xl font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          Balruno
        </Link>
        <h1 className="text-3xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {t('title')}
        </h1>
        <p className="mx-auto max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('subtitle')}
        </p>
      </header>

      <div
        className="mb-6 rounded-md border px-4 py-3 text-sm"
        style={{
          borderColor: 'var(--border-primary)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-secondary)',
        }}
      >
        {t('billingNote')}
      </div>

      <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <TierCard
          plan="FREE"
          name={t('tierFree')}
          price={t('tierFreePrice')}
          period={t('tierFreePeriod')}
          blurb={t('tierFreeBlurb')}
          cta={t('ctaCurrent')}
          ctaDisabled
        />
        <TierCard
          plan="PRO"
          name={t('tierPro')}
          price={t('tierProPrice')}
          period={t('tierProPeriod')}
          blurb={t('tierProBlurb')}
          cta={t('ctaSoon')}
          ctaDisabled
          highlight
        />
        <TierCard
          plan="TEAM"
          name={t('tierTeam')}
          price={t('tierTeamPrice')}
          period={t('tierTeamPeriod')}
          blurb={t('tierTeamBlurb')}
          cta={t('ctaSoon')}
          ctaDisabled
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        {t('compareTitle')}
      </h2>
      <div
        className="overflow-x-auto rounded-lg border"
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"
                  style={{ color: 'var(--text-tertiary)' }}>
                &nbsp;
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}>
                {t('tierFree')}
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}>
                {t('tierPro')}
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}>
                {t('tierTeam')}
              </th>
            </tr>
          </thead>
          <tbody>
            <Row label={t('rowMembers')} free="3" pro="10" team={t('valUnlimited')} />
            <Row label={t('rowProjects')} free="3" pro="20" team={t('valUnlimited')} />
            <Row label={t('rowSheets')} free="10" pro="50" team={t('valUnlimited')} />
            <Row label={t('rowRows')} free="2,000" pro="20,000" team="100,000" />
            <Row label={t('rowCells')} free="20,000" pro="200,000" team="1,000,000" />
            <Row label={t('rowDocs')} free="20" pro="200" team={t('valUnlimited')} />
            <Row label={t('rowStorage')} free="50 MB" pro="5 GB" team="50 GB" />
            <Row
              label={t('rowHistory')}
              free={t('valHistoryFree')}
              pro={t('valHistoryPro')}
              team={t('valHistoryTeam')}
            />
            <Row label={t('rowAi')} free={t('valByok')} pro="50" team="200" />
            <BoolRow label={t('rowSso')} free={false} pro={false} team />
            <BoolRow label={t('rowAudit')} free={false} pro={false} team />
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {t('selfHostNote')}
      </p>
      <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {t('footnote')}
      </p>
    </main>
  );
}

interface TierCardProps {
  plan: WorkspacePlan;
  name: string;
  price: string;
  period: string;
  blurb: string;
  cta: string;
  ctaDisabled?: boolean;
  highlight?: boolean;
}

function TierCard({
  plan,
  name,
  price,
  period,
  blurb,
  cta,
  ctaDisabled,
  highlight,
}: TierCardProps) {
  return (
    <div
      className="rounded-lg border p-5"
      style={{
        borderColor: highlight ? '#3b82f6' : 'var(--border-primary)',
        background: 'var(--bg-primary)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          {name}
        </h3>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-mono"
          style={{
            background: highlight ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-tertiary)',
            color: highlight ? '#3b82f6' : 'var(--text-secondary)',
          }}
        >
          {plan}
        </span>
      </div>
      <div className="mb-1 flex items-baseline gap-1">
        <span className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {price}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {period}
        </span>
      </div>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {blurb}
      </p>
      <button
        type="button"
        disabled={ctaDisabled}
        className="w-full rounded-md px-3 py-2 text-sm disabled:opacity-60"
        style={{
          background: highlight ? '#3b82f6' : 'var(--bg-secondary)',
          color: highlight ? '#fff' : 'var(--text-primary)',
          border: highlight ? 'none' : '1px solid var(--border-primary)',
          cursor: ctaDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        {cta}
      </button>
    </div>
  );
}

function Row({
  label,
  free,
  pro,
  team,
}: {
  label: string;
  free: string;
  pro: string;
  team: string;
}) {
  return (
    <tr className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{label}</td>
      <Cell value={free} />
      <Cell value={pro} />
      <Cell value={team} />
    </tr>
  );
}

function BoolRow({
  label,
  free,
  pro,
  team,
}: {
  label: string;
  free: boolean;
  pro: boolean;
  team: boolean;
}) {
  return (
    <tr className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{label}</td>
      <BoolCell on={free} />
      <BoolCell on={pro} />
      <BoolCell on={team} />
    </tr>
  );
}

function Cell({ value }: { value: string }) {
  return (
    <td className="px-4 py-3 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
      {value}
    </td>
  );
}

function BoolCell({ on }: { on: boolean }) {
  return (
    <td className="px-4 py-3 text-center" style={{ color: on ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
      {on ? <Check className="mx-auto h-4 w-4" style={{ color: '#22c55e' }} /> : '—'}
    </td>
  );
}
