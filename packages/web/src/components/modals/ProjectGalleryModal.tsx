/**
 * 프로젝트 갤러리 모달 — 새 프로젝트 시작 시 템플릿 선택.
 *
 * WelcomeScreen 의 샘플 갤러리를 "첫 진입" 이후에도 재접근 가능하게.
 * Sidebar / CommandPalette 어디서든 열 수 있음.
 */

import { useState } from 'react';
import { X, Swords, Shield, TrendingUp, Sparkles, Plus, Check, FileSpreadsheet, Wand2, Kanban, Bug, GanttChart, Users, Crosshair, Zap, Castle, Coins, Dices, Gamepad2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SAMPLE_PROJECTS, type SampleProject } from '@/data/sampleProjects';
import { useProjectStore } from '@/stores/projectStore';
import { useEscapeKey } from '@/hooks';

interface Props {
  onClose: () => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Swords, Shield, TrendingUp, Sparkles, Kanban, Bug, GanttChart, Crosshair, Zap, Castle, Coins, Dices, Gamepad2,
};

const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  combat: { bg: 'var(--error-light)', border: 'var(--error)', text: 'var(--error)' },
  economy: { bg: 'var(--warning-light)', border: 'var(--warning)', text: 'var(--warning)' },
  progression: { bg: 'var(--success-light)', border: 'var(--success)', text: 'var(--success)' },
  gacha: { bg: 'var(--primary-purple-light)', border: 'var(--primary-purple)', text: 'var(--primary-purple)' },
  'team-pm': { bg: 'rgba(59, 130, 246, 0.12)', border: '#3b82f6', text: '#3b82f6' },
};

export default function ProjectGalleryModal({ onClose }: Props) {
  useEscapeKey(onClose);
  const t = useTranslations();
  const createFromSample = useProjectStore((s) => s.createFromSample);
  const createProject = useProjectStore((s) => s.createProject);
  const createSheet = useProjectStore((s) => s.createSheet);

  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const balancingSamples = SAMPLE_PROJECTS.filter((s) => s.category !== 'team-pm');
  const teamSamples = SAMPLE_PROJECTS.filter((s) => s.category === 'team-pm');

  const handleCreateFromSample = (sampleId: string) => {
    if (isCreating) return;
    setIsCreating(true);
    setSelectedSample(sampleId);
    setTimeout(() => {
      const sample = SAMPLE_PROJECTS.find((s) => s.id === sampleId);
      if (sample) {
        const name = t(sample.nameKey as 'samples.rpgCharacter.name');
        createFromSample(sampleId, name, t);
      }
      setIsCreating(false);
      onClose();
    }, 300);
  };

  const handleCreateEmpty = () => {
    if (isCreating) return;
    setIsCreating(true);
    setTimeout(() => {
      const projectId = createProject(t('sidebar.newProject'));
      createSheet(projectId, 'Sheet1');
      setIsCreating(false);
      onClose();
    }, 200);
  };

  const handleImport = () => {
    window.dispatchEvent(new Event('balruno:open-import-modal'));
    onClose();
  };

  const handleAI = () => {
    window.dispatchEvent(new Event('balruno:open-ai-setup'));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-title"
        className="w-full max-w-3xl max-h-[85vh] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div>
            <h2 id="gallery-title" className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('projectGallery.newProjectStart')}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t('projectGallery.newProjectDesc')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <SampleGroup
            icon={<Swords className="w-4 h-4" style={{ color: 'var(--error)' }} />}
            title={t('welcome.balancingTitle')}
            subtitle={t('welcome.balancingSubtitle')}
            samples={balancingSamples}
            selectedSample={selectedSample}
            isCreating={isCreating}
            t={t}
            onSelect={handleCreateFromSample}
          />

          <SampleGroup
            icon={<Users className="w-4 h-4" style={{ color: '#3b82f6' }} />}
            title={t('welcome.teamPmTitle')}
            subtitle={t('welcome.teamPmSubtitle')}
            samples={teamSamples}
            selectedSample={selectedSample}
            isCreating={isCreating}
            t={t}
            onSelect={handleCreateFromSample}
          />

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
                onClick={handleImport}
                disabled={isCreating}
                className="p-3 rounded-lg border border-dashed flex items-center justify-center gap-2 transition-all hover:border-solid disabled:opacity-50"
                style={{ borderColor: 'var(--border-secondary)', color: 'var(--text-secondary)' }}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-sm">{t('import.importFromExcel')}</span>
              </button>
              <button
                onClick={handleAI}
                disabled={isCreating}
                className="p-3 rounded-lg border border-dashed flex items-center justify-center gap-2 transition-all hover:border-solid disabled:opacity-50"
                style={{ borderColor: '#8b5cf6', color: '#8b5cf6' }}
              >
                <Wand2 className="w-4 h-4" />
                <span className="text-sm font-medium">{t('projectGallery.startWithAi')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
    <div className="card p-4 sm:p-5">
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
          const displayName = t(sample.nameKey as 'samples.rpgCharacter.name');
          const displayDesc = t(sample.descriptionKey as 'samples.rpgCharacter.description');

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
