'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';

type Lang = 'ko' | 'en';

interface LegalShellProps {
  ko: ReactNode;
  en: ReactNode;
  /** Title shown in header, e.g. "Terms" or "Privacy". Will be appended with " — Balruno". */
  brand?: string;
  /** Last updated date, both languages share. */
  updatedAt: string;
}

/**
 * Bilingual (KO / EN) legal page shell.
 * Toggle in header switches between language renders.
 * Default = Korean (운영자 모국어 + Korean PIPA 1차 대상).
 */
export function LegalShell({ ko, en, updatedAt }: LegalShellProps) {
  const [lang, setLang] = useState<Lang>('ko');
  const isKo = lang === 'ko';

  return (
    <main
      className="mx-auto max-w-2xl px-6 py-10"
      style={{ color: 'var(--text-primary)' }}
    >
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-sm" style={{ color: 'var(--accent)' }}>
          {isKo ? '← 홈으로' : '← Home'}
        </Link>
        <div
          className="inline-flex rounded-md border overflow-hidden text-xs"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          {(['ko', 'en'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className="px-3 py-1.5 font-medium transition-colors"
              style={{
                background: lang === l ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                color: lang === l ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
              aria-pressed={lang === l}
            >
              {l === 'ko' ? '한국어' : 'English'}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs mb-8" style={{ color: 'var(--text-tertiary)' }}>
        {isKo ? '최종 수정일' : 'Last updated'}: {updatedAt}
      </p>

      <article className="legal-prose">{isKo ? ko : en}</article>

      <style jsx>{`
        .legal-prose :global(h1) {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 1rem;
        }
        .legal-prose :global(h2) {
          font-size: 1rem;
          font-weight: 600;
          margin-top: 1.75rem;
          margin-bottom: 0.5rem;
        }
        .legal-prose :global(p),
        .legal-prose :global(li) {
          font-size: 0.875rem;
          line-height: 1.65;
          color: var(--text-secondary);
        }
        .legal-prose :global(ul) {
          list-style: disc;
          padding-left: 1.25rem;
          margin: 0.5rem 0;
        }
        .legal-prose :global(li) {
          margin-bottom: 0.25rem;
        }
        .legal-prose :global(p) {
          margin: 0.5rem 0;
        }
        .legal-prose :global(strong) {
          color: var(--text-primary);
          font-weight: 600;
        }
        .legal-prose :global(a) {
          color: var(--accent);
        }
        .legal-prose :global(table) {
          width: 100%;
          font-size: 0.8rem;
          border-collapse: collapse;
          margin: 0.75rem 0;
        }
        .legal-prose :global(th),
        .legal-prose :global(td) {
          border: 1px solid var(--border-primary);
          padding: 0.4rem 0.6rem;
          text-align: left;
        }
        .legal-prose :global(th) {
          background: var(--bg-secondary);
          font-weight: 600;
        }
        .legal-prose :global(.note) {
          border-left: 3px solid var(--accent);
          padding: 0.5rem 0.75rem;
          background: var(--bg-secondary);
          border-radius: 0 4px 4px 0;
          margin: 0.75rem 0;
          font-size: 0.8rem;
        }
      `}</style>
    </main>
  );
}
