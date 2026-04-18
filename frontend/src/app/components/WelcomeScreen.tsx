'use client';

import { useState } from 'react';
import { ArrowRight, Swords, Shield, TrendingUp, Sparkles, Plus, Check, FileSpreadsheet, Wand2, Kanban, Bug, GanttChart, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SAMPLE_PROJECTS, type SampleProject } from '@/data/sampleProjects';
import { useProjectStore } from '@/stores/projectStore';

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Swords,
  Shield,
  TrendingUp,
  Sparkles,
  Kanban,
  Bug,
  GanttChart,
};

const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  combat: { bg: 'var(--error-light)', border: 'var(--error)', text: 'var(--error)' },
  economy: { bg: 'var(--warning-light)', border: 'var(--warning)', text: 'var(--warning)' },
  progression: { bg: 'var(--success-light)', border: 'var(--success)', text: 'var(--success)' },
  gacha: { bg: 'var(--primary-purple-light)', border: 'var(--primary-purple)', text: 'var(--primary-purple)' },
  'team-pm': { bg: 'rgba(59, 130, 246, 0.12)', border: '#3b82f6', text: '#3b82f6' },
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
    setTimeout(() => {
      const sample = SAMPLE_PROJECTS.find((s) => s.id === sampleId);
      if (sample) {
        const name = sample.nameKey.startsWith('samples.') && !sample.nameKey.startsWith('samples.sprintBoard')
          ? t(sample.nameKey as 'samples.rpgCharacter.name')
          : sampleFallbackName(sample);
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

  const balancingSamples = SAMPLE_PROJECTS.filter((s) => s.category !== 'team-pm');
  const teamSamples = SAMPLE_PROJECTS.filter((s) => s.category === 'team-pm');

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-3xl w-full">
        {/* 헤더 — B2B 포지셔닝 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Game Studio Workspace
          </h1>
          <p className="text-base sm:text-lg" style={{ color: 'var(--text-tertiary)' }}>
            밸런싱 데이터 + 애자일 티켓 + 에픽 로드맵 — 한 곳에서
          </p>
        </div>

        {/* 밸런싱 섹션 */}
        <SampleGroup
          icon={<Swords className="w-4 h-4" style={{ color: 'var(--error)' }} />}
          title="밸런싱 (Designer)"
          subtitle="수식 + 시뮬 + 엔진 export"
          samples={balancingSamples}
          selectedSample={selectedSample}
          isCreating={isCreating}
          t={t}
          onSelect={handleCreateFromSample}
        />

        {/* 팀 PM 섹션 — B2B 신규 */}
        <SampleGroup
          icon={<Users className="w-4 h-4" style={{ color: '#3b82f6' }} />}
          title="팀 PM (Studio)"
          subtitle="스프린트 / 버그 / 에픽 로드맵"
          samples={teamSamples}
          selectedSample={selectedSample}
          isCreating={isCreating}
          t={t}
          onSelect={handleCreateFromSample}
        />

        {/* 하단: 빈 / Excel / AI 3 버튼 */}
        <div className="card p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={handleCreateEmpty}
              disabled={isCreating}
              className="p-3 rounded-lg border border-dashed flex items-center justify-center gap-2 transition-all hover:border-solid disabled:opacity-50"
              style={{ borderColor: 'var(--border-secondary)', color: 'var(--text-secondary)' }}
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">{t('samples.orEmpty')}</span>
            </button>
            <button
              onClick={() => window.dispatchEvent(new Event('balruno:open-import-modal'))}
              disabled={isCreating}
              className="p-3 rounded-lg border border-dashed flex items-center justify-center gap-2 transition-all hover:border-solid disabled:opacity-50"
              style={{ borderColor: 'var(--border-secondary)', color: 'var(--text-secondary)' }}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="text-sm">{t('import.importFromExcel')}</span>
            </button>
            <button
              onClick={() => window.dispatchEvent(new Event('balruno:open-ai-setup'))}
              disabled={isCreating}
              className="p-3 rounded-lg border border-dashed flex items-center justify-center gap-2 transition-all hover:border-solid disabled:opacity-50"
              style={{ borderColor: '#8b5cf6', color: '#8b5cf6' }}
            >
              <Wand2 className="w-4 h-4" />
              <span className="text-sm font-medium">AI 로 시작</span>
            </button>
          </div>
        </div>

        <div
          className="hidden sm:flex items-center justify-center gap-2 text-sm mt-6"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <span>{t('welcome.startGuide')}</span>
          <span
            className="font-semibold px-2 py-1 rounded"
            style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
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

function sampleFallbackName(sample: SampleProject): string {
  // 팀 PM 샘플 임시 이름 (i18n 추가 전까지)
  const fallbacks: Record<string, string> = {
    'sprint-board': '스프린트 보드',
    'bug-tracker': '버그 트래커',
    'epic-roadmap': '에픽 로드맵',
  };
  return fallbacks[sample.id] ?? sample.id;
}

interface SampleGroupProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  samples: SampleProject[];
  selectedSample: string | null;
  isCreating: boolean;
  t: ReturnType<typeof useTranslations>;
  onSelect: (sampleId: string) => void;
}

function SampleGroup({ icon, title, subtitle, samples, selectedSample, isCreating, t, onSelect }: SampleGroupProps) {
  return (
    <div className="card p-4 sm:p-5 mb-4">
      <h2 className="font-semibold mb-1 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        {icon} {title}
      </h2>
      <p className="text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>
        {subtitle}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {samples.map((sample) => {
          const IconComponent = iconMap[sample.icon] || Swords;
          const colors = categoryColors[sample.category];
          const isSelected = selectedSample === sample.id;
          const displayName =
            sample.nameKey.startsWith('samples.') && !sample.id.startsWith('sprint') && !sample.id.startsWith('bug') && !sample.id.startsWith('epic')
              ? t(sample.nameKey as 'samples.rpgCharacter.name')
              : sampleFallbackName(sample);
          const displayDesc =
            sample.id === 'sprint-board'
              ? 'Backlog/Todo/Doing/Review/Done 5단 칸반'
              : sample.id === 'bug-tracker'
              ? '우선순위 S1-S4 + 플랫폼 태그'
              : sample.id === 'epic-roadmap'
              ? 'Pre-production → Launch 페이즈 Gantt'
              : t(sample.descriptionKey as 'samples.rpgCharacter.description');

          return (
            <button
              key={sample.id}
              onClick={() => onSelect(sample.id)}
              disabled={isCreating}
              className="p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              style={{
                background: isSelected ? colors.bg : 'var(--bg-tertiary)',
                borderColor: isSelected ? colors.border : 'transparent',
              }}
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
                    {displayName}
                  </div>
                  <div className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                    {displayDesc}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
