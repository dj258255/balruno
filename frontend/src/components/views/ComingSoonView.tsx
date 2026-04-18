'use client';

import { Construction } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ViewType } from '@/types';

export default function ComingSoonView({ view }: { view: ViewType }) {
  const t = useTranslations();
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-3 max-w-sm px-6">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: 'var(--bg-tertiary)' }}
        >
          <Construction className="w-7 h-7" style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
          {t(`views.${view}` as 'views.kanban')}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {t('views.comingSoon')}
        </p>
      </div>
    </div>
  );
}
