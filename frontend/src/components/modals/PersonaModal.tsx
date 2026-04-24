'use client';

/**
 * 페르소나 선택 모달 — 첫 진입 1 회. hasChosen=false 일 때만 노출.
 *
 * 네 갈래:
 *  - balancer (밸런서)   : 스탯·수식·시뮬 중심
 *  - pm (PM)             : 스프린트·버그·로드맵 중심
 *  - analyst (분석가)    : 경제 · 곡선 · 분포 중심
 *  - explorer (둘러보기) : 전체 탐색
 *
 * 선택값은 personaStore 에 persist. "나중에" 로 닫으면 hasChosen=true 만 세팅.
 */

import { Swords, Kanban, LineChart, Compass, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePersona, type Persona } from '@/stores/personaStore';

interface PersonaOption {
  value: Persona;
  icon: typeof Swords;
  gradient: string;
  titleKey: string;
  descKey: string;
}

const OPTIONS: PersonaOption[] = [
  {
    value: 'balancer',
    icon: Swords,
    gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    titleKey: 'persona.balancer.title',
    descKey: 'persona.balancer.desc',
  },
  {
    value: 'pm',
    icon: Kanban,
    gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    titleKey: 'persona.pm.title',
    descKey: 'persona.pm.desc',
  },
  {
    value: 'analyst',
    icon: LineChart,
    gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
    titleKey: 'persona.analyst.title',
    descKey: 'persona.analyst.desc',
  },
  {
    value: 'explorer',
    icon: Compass,
    gradient: 'linear-gradient(135deg, #10b981, #14b8a6)',
    titleKey: 'persona.explorer.title',
    descKey: 'persona.explorer.desc',
  },
];

export default function PersonaModal() {
  const t = useTranslations();
  const hasChosen = usePersona((s) => s.hasChosen);
  const setPersona = usePersona((s) => s.setPersona);
  const dismissModal = usePersona((s) => s.dismissModal);

  if (hasChosen) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      <div
        className="relative w-full max-w-lg rounded-xl shadow-2xl overflow-hidden"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
        }}
      >
        <button
          type="button"
          onClick={dismissModal}
          className="absolute top-3 right-3 p-1 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: 'var(--text-tertiary)' }}
          aria-label={t('common.close')}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('persona.heading')}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('persona.subheading')}
          </p>
        </div>

        <div className="px-6 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPersona(opt.value)}
              className="group flex items-start gap-3 p-3 rounded-lg border text-left transition-all hover:shadow-md"
              style={{
                background: 'var(--bg-primary)',
                borderColor: 'var(--border-primary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-primary)';
              }}
            >
              <span
                className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                style={{ background: opt.gradient }}
              >
                <opt.icon className="w-5 h-5" style={{ color: 'white' }} />
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t(opt.titleKey)}
                </div>
                <div
                  className="text-caption mt-0.5"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {t(opt.descKey)}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div
          className="px-6 py-3 border-t flex items-center justify-between"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
            {t('persona.changeLaterHint')}
          </span>
          <button
            type="button"
            onClick={dismissModal}
            className="text-xs px-3 py-1.5 rounded-md transition-colors"
            style={{
              color: 'var(--text-secondary)',
              background: 'var(--bg-tertiary)',
            }}
          >
            {t('persona.skip')}
          </button>
        </div>
      </div>
    </div>
  );
}
