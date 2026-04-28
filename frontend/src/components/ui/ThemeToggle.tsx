'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import './ThemeToggle.css';

export default function ThemeToggle() {
  const t = useTranslations('ui');
  const { theme, toggleTheme } = useTheme();

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleTheme();
    }
  };

  return (
    <div
      className={`theme-toggle-switch ${theme}`}
      onClick={toggleTheme}
      onKeyDown={handleKey}
      role="switch"
      tabIndex={0}
      aria-checked={theme === 'dark'}
      aria-label={theme === 'dark' ? t('themeToLight') : t('themeToDark')}
    >
      <div className="toggle-track">
        {/* 구름 (라이트 모드) */}
        <div className="toggle-clouds">
          <div className="cloud cloud-1"></div>
          <div className="cloud cloud-2"></div>
          <div className="cloud cloud-3"></div>
        </div>
        {/* 별 (다크 모드) */}
        <div className="toggle-stars">
          <div className="star star-1"></div>
          <div className="star star-2"></div>
          <div className="star star-3"></div>
          <div className="star star-4"></div>
          <div className="star star-5"></div>
        </div>
      </div>
      <div className="toggle-thumb">
        {/* 해 */}
        <div className="sun"></div>
        {/* 달 */}
        <div className="moon">
          <div className="moon-crater crater-1"></div>
          <div className="moon-crater crater-2"></div>
          <div className="moon-crater crater-3"></div>
        </div>
      </div>
    </div>
  );
}
