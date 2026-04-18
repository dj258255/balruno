'use client';

import { useState } from 'react';
import { ArrowRight, Swords, Shield, TrendingUp, Sparkles, Plus, Check, FileSpreadsheet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SAMPLE_PROJECTS } from '@/data/sampleProjects';
import { useProjectStore } from '@/stores/projectStore';

// 아이콘 매핑
const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Swords,
  Shield,
  TrendingUp,
  Sparkles,
};

// 카테고리별 색상
const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  combat: { bg: 'var(--error-light)', border: 'var(--error)', text: 'var(--error)' },
  economy: { bg: 'var(--warning-light)', border: 'var(--warning)', text: 'var(--warning)' },
  progression: { bg: 'var(--success-light)', border: 'var(--success)', text: 'var(--success)' },
  gacha: { bg: 'var(--primary-purple-light)', border: 'var(--primary-purple)', text: 'var(--primary-purple)' },
};

export default function WelcomeScreen() {
  const t = useTranslations();
  const createFromSample = useProjectStore((state) => state.createFromSample);
  const createProject = useProjectStore((state) => state.createProject);
  const createSheet = useProjectStore((state) => state.createSheet);
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateFromSample = (sampleId: string) => {
    if (isCreating) return;
    setIsCreating(true);
    setSelectedSample(sampleId);

    // 약간의 딜레이로 애니메이션 효과
    setTimeout(() => {
      const sample = SAMPLE_PROJECTS.find(s => s.id === sampleId);
      if (sample) {
        const name = t(sample.nameKey as 'samples.rpgCharacter.name');
        createFromSample(sampleId, name, t);
      }
      setIsCreating(false);
    }, 300);
  };

  const handleCreateEmpty = () => {
    if (isCreating) return;
    setIsCreating(true);

    setTimeout(() => {
      const projectId = createProject(t('sidebar.newProject'));
      createSheet(projectId, 'Sheet1');
      setIsCreating(false);
    }, 200);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-2xl w-full">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('welcome.title')}
          </h1>
          <p className="text-base sm:text-lg" style={{ color: 'var(--text-tertiary)' }}>
            {t('welcome.subtitle')}
          </p>
        </div>

        {/* 샘플 프로젝트 섹션 */}
        <div className="card p-4 sm:p-6 mb-6">
          <h2 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('samples.title')}
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>
            {t('samples.subtitle')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SAMPLE_PROJECTS.map((sample) => {
              const IconComponent = iconMap[sample.icon] || Swords;
              const colors = categoryColors[sample.category];
              const isSelected = selectedSample === sample.id;

              return (
                <button
                  key={sample.id}
                  onClick={() => handleCreateFromSample(sample.id)}
                  disabled={isCreating}
                  className="p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  style={{
                    background: isSelected ? colors.bg : 'var(--bg-tertiary)',
                    borderColor: isSelected ? colors.border : 'transparent',
                  }}
                  aria-label={`${t(sample.nameKey as 'samples.rpgCharacter.name')} 샘플로 시작`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: colors.bg }}
                    >
                      {isSelected && isCreating ? (
                        <Check className="w-5 h-5" style={{ color: colors.text }} />
                      ) : (
                        <IconComponent className="w-5 h-5" style={{ color: colors.text }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>
                        {t(sample.nameKey as 'samples.rpgCharacter.name')}
                      </div>
                      <div className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                        {t(sample.descriptionKey as 'samples.rpgCharacter.description')}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 빈 프로젝트 + Excel 가져오기 옵션 */}
          <div
            className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-2"
            style={{ borderColor: 'var(--border-secondary)' }}
          >
            <button
              onClick={handleCreateEmpty}
              disabled={isCreating}
              className="p-3 rounded-lg border border-dashed flex items-center justify-center gap-2 transition-all hover:border-solid disabled:opacity-50"
              style={{
                borderColor: 'var(--border-secondary)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              aria-label={t('samples.orEmpty')}
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span className="text-sm">{t('samples.orEmpty')}</span>
            </button>
            <button
              onClick={() => window.dispatchEvent(new Event('balruno:open-import-modal'))}
              disabled={isCreating}
              className="p-3 rounded-lg border border-dashed flex items-center justify-center gap-2 transition-all hover:border-solid disabled:opacity-50"
              style={{
                borderColor: 'var(--border-secondary)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              aria-label={t('import.importFromExcel')}
            >
              <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
              <span className="text-sm">{t('import.importFromExcel')}</span>
            </button>
          </div>
        </div>

        {/* 기능 소개 (축소) */}
        <div className="card p-4 sm:p-6">
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('features.title')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <FeatureItem
              title={t('features.gameFormula')}
              desc={t('features.gameFormulaDesc')}
            />
            <FeatureItem
              title={t('features.balanceValidator')}
              desc={t('features.balanceValidatorDesc')}
            />
            <FeatureItem
              title={t('features.difficultyCurve')}
              desc={t('features.difficultyCurveDesc')}
            />
            <FeatureItem
              title={t('features.sheetLink')}
              desc={t('features.sheetLinkDesc')}
            />
            <FeatureItem
              title={t('features.growthCurve')}
              desc={t('features.growthCurveDesc')}
            />
            <FeatureItem
              title={t('features.autoSave')}
              desc={t('features.autoSaveDesc')}
            />
          </div>
        </div>

        {/* 사이드바 안내 (데스크톱에서만) */}
        <div
          className="hidden sm:flex items-center justify-center gap-2 text-sm mt-6"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <span>{t('welcome.startGuide')}</span>
          <span
            className="font-semibold px-2 py-1 rounded"
            style={{
              background: 'var(--accent-light)',
              color: 'var(--accent)',
            }}
          >
            {t('welcome.startButton')}
          </span>
          <span>{t('welcome.startEnd')}</span>
          <ArrowRight className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-2 sm:p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
      <div className="text-xs sm:text-sm font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>
        {title}
      </div>
      <div className="text-[10px] sm:text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {desc}
      </div>
    </div>
  );
}
