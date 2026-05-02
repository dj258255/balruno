'use client';

import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export default function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  const t = useTranslations();

  return (
    <div
      className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 border-b"
      style={{
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
      }}
    >
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg transition-colors"
        style={{ background: 'var(--bg-tertiary)' }}
        aria-label={t('app.openMenu')}
      >
        <Menu className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
      </button>
      <span className="font-semibold" style={{ color: 'var(--accent)' }}>
        {t('app.name')}
      </span>
      <div className="w-9" />
    </div>
  );
}
