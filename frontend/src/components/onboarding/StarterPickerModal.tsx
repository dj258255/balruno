'use client';

/**
 * StarterPickerModal — 첫 진입 시 자동 표시.
 * 사용자가 자기 게임 장르를 골라 starter pack 시드.
 *
 * 트리거: page.tsx 의 init 흐름 — savedProjects.length === 0 + 'balruno:starter-seeded' 없음
 * 선택 후: createProject(name, desc, { seedStarterId: 'rpg' }) 호출 → 시트 자동 생성
 *
 * 닫기:
 *  - ESC / 외부 클릭 / X 버튼 → 'blank' (빈 워크스페이스) 자동 선택 (사용자 강제 X)
 *  - 또는 카드 클릭 → 해당 starter 시드
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { STARTER_CATALOG } from '@/lib/starterPack';

interface Props {
  onPick: (starterId: string) => void;
  onClose?: () => void;
}

export default function StarterPickerModal({ onPick, onClose }: Props) {
  const t = useTranslations('onboarding');
  const tStarter = useTranslations('starterPack');
  // ESC 키로 닫기 — onClose 가 있으면 그걸로 (빈 워크스페이스 자동 선택), 없으면 무시
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
        style={{ background: 'var(--bg-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 — 우상단 */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
            aria-label={t('close')}
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        )}

        <div className="px-6 pt-6 pb-3 text-center border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('starterPickerTitle')}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('starterPickerDesc')}
          </p>
        </div>

        {/* Catalog grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
          {STARTER_CATALOG.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onPick(entry.id)}
                className="group flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all text-left hover:border-[var(--accent)] hover:scale-[1.02]"
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-primary)',
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: `${entry.color}20`, color: entry.color }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {tStarter(`${entry.i18nKey}.label`)}
                </div>
                <div className="text-caption line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>
                  {tStarter(`${entry.i18nKey}.description`)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3 border-t flex items-center justify-between text-caption"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}
        >
          <span>{t('starterPickerCount', { count: STARTER_CATALOG.length })}</span>
          <span>{t('starterPickerFooter')}</span>
        </div>
      </div>
    </div>
  );
}
