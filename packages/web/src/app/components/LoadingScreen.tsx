'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function LoadingScreen() {
  const t = useTranslations();

  return (
    <div
      className="h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-secondary)' }}
    >
      <div className="text-center">
        <Loader2
          className="w-8 h-8 animate-spin mx-auto mb-3"
          style={{ color: 'var(--accent)' }}
        />
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {t('common.loading')}
        </p>
      </div>
    </div>
  );
}
