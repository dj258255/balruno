'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useEscapeKey } from '@/hooks';
import { SAMPLE_PROJECTS } from '@/data/sampleProjects';
import { useProjectStore } from '@/stores/projectStore';
import {
  ChevronRight,
  ChevronLeft,
  Play,
  CheckCircle2,
  Lightbulb,
  MousePointer,
  Keyboard,
  Target,
  TrendingUp,
  Coins,
  Sparkles,
  Layers,
  Swords,
  Calculator,
  BarChart3,
  PieChart,
  AlertTriangle,
  FunctionSquare,
  Shield,
  Rocket,
} from 'lucide-react';

interface OnboardingGuideProps {
  onClose: () => void;
}

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  action?: string;
  example?: {
    before?: string;
    input: string;
    result: string;
  };
  tip?: string;
  isGuidelinesStep?: boolean;
  isSurveyStep?: boolean;
  isToolsStep?: boolean;
  isSampleStep?: boolean;
}

// 아이콘 매핑
const sampleIconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Swords,
  Shield,
  TrendingUp,
  Sparkles,
};

// 카테고리별 색상
const sampleCategoryColors: Record<string, { bg: string; border: string; text: string }> = {
  combat: { bg: 'var(--error-light)', border: 'var(--error)', text: 'var(--error)' },
  economy: { bg: 'var(--warning-light)', border: 'var(--warning)', text: 'var(--warning)' },
  progression: { bg: 'var(--success-light)', border: 'var(--success)', text: 'var(--success)' },
  gacha: { bg: 'var(--primary-purple-light)', border: 'var(--primary-purple)', text: 'var(--primary-purple)' },
  'team-pm': { bg: 'var(--primary-blue-light)', border: 'var(--primary-blue)', text: 'var(--primary-blue)' },
};

// 매핑 누락 카테고리 fallback
const DEFAULT_CATEGORY_COLOR = {
  bg: 'var(--bg-tertiary)',
  border: 'var(--border-primary)',
  text: 'var(--text-secondary)',
};

// Helper function to get guidelines data with translations
const getGuidelinesData = (t: (key: string) => string) => [
  {
    id: 'ttk',
    icon: Swords,
    title: t('onboarding.guidelines.ttk.title'),
    color: 'red',
    items: [
      { label: t('onboarding.guidelines.ttk.items.fps.label'), value: t('onboarding.guidelines.ttk.items.fps.value'), desc: t('onboarding.guidelines.ttk.items.fps.desc') },
      { label: t('onboarding.guidelines.ttk.items.moba.label'), value: t('onboarding.guidelines.ttk.items.moba.value'), desc: t('onboarding.guidelines.ttk.items.moba.desc') },
      { label: t('onboarding.guidelines.ttk.items.mmorpg.label'), value: t('onboarding.guidelines.ttk.items.mmorpg.value'), desc: t('onboarding.guidelines.ttk.items.mmorpg.desc') },
    ],
  },
  {
    id: 'damage',
    icon: Target,
    title: t('onboarding.guidelines.damage.title'),
    color: 'orange',
    items: [
      { label: t('onboarding.guidelines.damage.items.minDamage.label'), value: t('onboarding.guidelines.damage.items.minDamage.value'), desc: t('onboarding.guidelines.damage.items.minDamage.desc') },
      { label: t('onboarding.guidelines.damage.items.defReduction.label'), value: t('onboarding.guidelines.damage.items.defReduction.value'), desc: t('onboarding.guidelines.damage.items.defReduction.desc') },
      { label: t('onboarding.guidelines.damage.items.ehpRatio.label'), value: t('onboarding.guidelines.damage.items.ehpRatio.value'), desc: t('onboarding.guidelines.damage.items.ehpRatio.desc') },
    ],
  },
  {
    id: 'growth',
    icon: TrendingUp,
    title: t('onboarding.guidelines.growth.title'),
    color: 'green',
    items: [
      { label: t('onboarding.guidelines.growth.items.linear.label'), value: t('onboarding.guidelines.growth.items.linear.value'), desc: t('onboarding.guidelines.growth.items.linear.desc') },
      { label: t('onboarding.guidelines.growth.items.exponential.label'), value: t('onboarding.guidelines.growth.items.exponential.value'), desc: t('onboarding.guidelines.growth.items.exponential.desc') },
      { label: t('onboarding.guidelines.growth.items.logarithmic.label'), value: t('onboarding.guidelines.growth.items.logarithmic.value'), desc: t('onboarding.guidelines.growth.items.logarithmic.desc') },
    ],
  },
  {
    id: 'economy',
    icon: Coins,
    title: t('onboarding.guidelines.economy.title'),
    color: 'yellow',
    items: [
      { label: t('onboarding.guidelines.economy.items.faucetSink.label'), value: t('onboarding.guidelines.economy.items.faucetSink.value'), desc: t('onboarding.guidelines.economy.items.faucetSink.desc') },
      { label: t('onboarding.guidelines.economy.items.currencyRate.label'), value: t('onboarding.guidelines.economy.items.currencyRate.value'), desc: t('onboarding.guidelines.economy.items.currencyRate.desc') },
      { label: t('onboarding.guidelines.economy.items.inflation.label'), value: t('onboarding.guidelines.economy.items.inflation.value'), desc: t('onboarding.guidelines.economy.items.inflation.desc') },
    ],
  },
  {
    id: 'gacha',
    icon: Sparkles,
    title: t('onboarding.guidelines.gacha.title'),
    color: 'purple',
    items: [
      { label: t('onboarding.guidelines.gacha.items.topRate.label'), value: t('onboarding.guidelines.gacha.items.topRate.value'), desc: t('onboarding.guidelines.gacha.items.topRate.desc') },
      { label: t('onboarding.guidelines.gacha.items.pity.label'), value: t('onboarding.guidelines.gacha.items.pity.value'), desc: t('onboarding.guidelines.gacha.items.pity.desc') },
      { label: t('onboarding.guidelines.gacha.items.expectedCost.label'), value: t('onboarding.guidelines.gacha.items.expectedCost.value'), desc: t('onboarding.guidelines.gacha.items.expectedCost.desc') },
    ],
  },
  {
    id: 'flow',
    icon: Layers,
    title: t('onboarding.guidelines.flow.title'),
    color: 'blue',
    items: [
      { label: t('onboarding.guidelines.flow.items.difficultyRate.label'), value: t('onboarding.guidelines.flow.items.difficultyRate.value'), desc: t('onboarding.guidelines.flow.items.difficultyRate.desc') },
      { label: t('onboarding.guidelines.flow.items.failCount.label'), value: t('onboarding.guidelines.flow.items.failCount.value'), desc: t('onboarding.guidelines.flow.items.failCount.desc') },
      { label: t('onboarding.guidelines.flow.items.rewardInterval.label'), value: t('onboarding.guidelines.flow.items.rewardInterval.value'), desc: t('onboarding.guidelines.flow.items.rewardInterval.desc') },
    ],
  },
];

// Helper function to get tools categories data with translations
const getToolsCategoriesData = (t: (key: string) => string) => [
  {
    id: 'calculation',
    icon: Calculator,
    title: t('onboarding.steps.tools.categories.calculation.title'),
    color: 'violet',
    tools: [
      t('onboarding.steps.tools.categories.calculation.tools.calculator'),
      t('onboarding.steps.tools.categories.calculation.tools.goalSolver'),
      t('onboarding.steps.tools.categories.calculation.tools.formulaHelper'),
    ],
  },
  {
    id: 'visualization',
    icon: BarChart3,
    title: t('onboarding.steps.tools.categories.visualization.title'),
    color: 'green',
    tools: [
      t('onboarding.steps.tools.categories.visualization.tools.comparison'),
      t('onboarding.steps.tools.categories.visualization.tools.chart'),
      t('onboarding.steps.tools.categories.visualization.tools.presetComparison'),
    ],
  },
  {
    id: 'analysis',
    icon: AlertTriangle,
    title: t('onboarding.steps.tools.categories.analysis.title'),
    color: 'yellow',
    tools: [
      t('onboarding.steps.tools.categories.analysis.tools.imbalanceDetector'),
      t('onboarding.steps.tools.categories.analysis.tools.balanceAnalysis'),
      t('onboarding.steps.tools.categories.analysis.tools.balanceValidator'),
      t('onboarding.steps.tools.categories.analysis.tools.dpsVariance'),
      t('onboarding.steps.tools.categories.analysis.tools.curveFitting'),
      t('onboarding.steps.tools.categories.analysis.tools.difficultyCurve'),
    ],
  },
  {
    id: 'simulation',
    icon: Swords,
    title: t('onboarding.steps.tools.categories.simulation.title'),
    color: 'rose',
    tools: [
      t('onboarding.steps.tools.categories.simulation.tools.simulation'),
      t('onboarding.steps.tools.categories.simulation.tools.economy'),
    ],
  },
];

// Helper function to get tutorial steps with translations
const getTutorialSteps = (t: (key: string) => string): TutorialStep[] => [
  {
    id: 'sample-select',
    title: t('onboarding.steps.sampleSelect.title'),
    description: t('onboarding.steps.sampleSelect.description'),
    tip: t('onboarding.steps.sampleSelect.tip'),
    isSampleStep: true,
  },
  {
    id: 'tools',
    title: t('onboarding.steps.tools.title'),
    description: t('onboarding.steps.tools.description'),
    tip: t('onboarding.steps.tools.tip'),
    isToolsStep: true,
  },
  {
    id: 'survey',
    title: t('onboarding.steps.survey.title'),
    description: t('onboarding.steps.survey.description'),
    tip: t('onboarding.steps.survey.tip'),
    isSurveyStep: true,
  },
  {
    id: 'guidelines',
    title: t('onboarding.steps.guidelines.title'),
    description: t('onboarding.steps.guidelines.description'),
    tip: t('onboarding.steps.guidelines.tip'),
    isGuidelinesStep: true,
  },
  {
    id: 'create-project',
    title: t('onboarding.steps.createProject.title'),
    description: t('onboarding.steps.createProject.description'),
    action: t('onboarding.steps.createProject.action'),
    tip: t('onboarding.steps.createProject.tip'),
  },
  {
    id: 'create-sheet',
    title: t('onboarding.steps.createSheet.title'),
    description: t('onboarding.steps.createSheet.description'),
    action: t('onboarding.steps.createSheet.action'),
    tip: t('onboarding.steps.createSheet.tip'),
  },
  {
    id: 'input-data',
    title: t('onboarding.steps.inputData.title'),
    description: t('onboarding.steps.inputData.description'),
    action: t('onboarding.steps.inputData.action'),
    example: {
      input: t('onboarding.steps.inputData.example.input'),
      result: t('onboarding.steps.inputData.example.result'),
    },
    tip: t('onboarding.steps.inputData.tip'),
  },
  {
    id: 'formula-basic',
    title: t('onboarding.steps.formulaBasic.title'),
    description: t('onboarding.steps.formulaBasic.description'),
    action: t('onboarding.steps.formulaBasic.action'),
    example: {
      before: t('onboarding.steps.formulaBasic.example.before'),
      input: t('onboarding.steps.formulaBasic.example.input'),
      result: t('onboarding.steps.formulaBasic.example.result'),
    },
    tip: t('onboarding.steps.formulaBasic.tip'),
  },
  {
    id: 'formula-damage',
    title: t('onboarding.steps.formulaDamage.title'),
    description: t('onboarding.steps.formulaDamage.description'),
    example: {
      before: t('onboarding.steps.formulaDamage.example.before'),
      input: t('onboarding.steps.formulaDamage.example.input'),
      result: t('onboarding.steps.formulaDamage.example.result'),
    },
    tip: t('onboarding.steps.formulaDamage.tip'),
  },
  {
    id: 'formula-dps',
    title: t('onboarding.steps.formulaDps.title'),
    description: t('onboarding.steps.formulaDps.description'),
    example: {
      before: t('onboarding.steps.formulaDps.example.before'),
      input: t('onboarding.steps.formulaDps.example.input'),
      result: t('onboarding.steps.formulaDps.example.result'),
    },
    tip: t('onboarding.steps.formulaDps.tip'),
  },
  {
    id: 'formula-scale',
    title: t('onboarding.steps.formulaScale.title'),
    description: t('onboarding.steps.formulaScale.description'),
    example: {
      before: t('onboarding.steps.formulaScale.example.before'),
      input: t('onboarding.steps.formulaScale.example.input'),
      result: t('onboarding.steps.formulaScale.example.result'),
    },
    tip: t('onboarding.steps.formulaScale.tip'),
  },
  {
    id: 'done',
    title: t('onboarding.steps.done.title'),
    description: t('onboarding.steps.done.description'),
    tip: t('onboarding.steps.done.tip'),
  },
];

export default function OnboardingGuide({ onClose }: OnboardingGuideProps) {
  const t = useTranslations();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const createFromSample = useProjectStore((state) => state.createFromSample);

  // ESC 키로 닫기
  useEscapeKey(onClose);

  // Get translated data
  const GUIDELINES_DATA = getGuidelinesData(t);
  const TOOLS_CATEGORIES_DATA = getToolsCategoriesData(t);
  const TUTORIAL_STEPS = getTutorialSteps(t);

  const handleNext = () => {
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('balruno_onboarding_completed', 'true');
    onClose();
  };

  const handleSkip = () => {
    localStorage.setItem('balruno_onboarding_completed', 'true');
    onClose();
  };

  const handleSampleSelect = (sampleId: string) => {
    setSelectedSample(sampleId);
  };

  const handleStartWithSample = () => {
    if (selectedSample) {
      const sample = SAMPLE_PROJECTS.find(s => s.id === selectedSample);
      if (sample) {
        const name = t(sample.nameKey as 'samples.rpgCharacter.name');
        createFromSample(selectedSample, name, t);
        handleComplete();
      }
    }
  };

  const step = TUTORIAL_STEPS[currentStep];

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[1100] p-2 sm:p-4" style={{ background: 'rgba(0, 0, 0, 0.6)' }}>
      <div className="rounded-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] shadow-2xl overflow-hidden flex flex-col" style={{ background: 'var(--bg-primary)' }}>
        {/* 진행 표시 바 */}
        <div className="h-1" style={{ background: 'var(--bg-tertiary)' }}>
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%`,
              background: 'var(--primary-blue)'
            }}
          />
        </div>

        {/* 헤더 - 반응형 */}
        <div
          className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b shrink-0"
          style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto">
            <div className="flex items-center gap-0.5 sm:gap-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {TUTORIAL_STEPS.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentStep(index);
                    // 클릭한 스텝을 읽음으로 표시
                    setCompletedSteps((prev) => new Set([...prev, index]));
                  }}
                  className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors shrink-0"
                  style={{
                    background: index === currentStep
                      ? 'var(--primary-blue)'
                      : completedSteps.has(index)
                      ? 'var(--success-light)'
                      : 'var(--bg-hover)',
                    color: index === currentStep
                      ? 'white'
                      : completedSteps.has(index)
                      ? 'var(--success)'
                      : 'var(--text-tertiary)'
                  }}
                >
                  {completedSteps.has(index) ? (
                    <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  ) : (
                    <span className="text-[10px] sm:text-xs font-medium">{index + 1}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="text-sm transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
          >
            {t('onboarding.skip')}
          </button>
        </div>

        {/* 컨텐츠 - 고정 높이로 일관된 크기 유지 */}
        <div className="px-4 sm:px-8 py-4 sm:py-6 h-[400px] sm:h-[420px] overflow-y-auto flex flex-col">
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{step.title}</h2>
          <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>{step.description}</p>

          {/* 권장 수치 가이드라인 UI */}
          {step.isGuidelinesStep && (
            <div className="grid grid-cols-2 gap-3 mb-4 flex-1 overflow-y-auto pr-2">
              {GUIDELINES_DATA.map((category) => {
                const IconComponent = category.icon;
                const colorStyles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
                  red: { bg: 'var(--error-light)', border: 'var(--error)', text: 'var(--error)', icon: 'var(--error)' },
                  orange: { bg: 'var(--warning-light)', border: 'var(--warning)', text: 'var(--warning)', icon: 'var(--warning)' },
                  green: { bg: 'var(--success-light)', border: 'var(--success)', text: 'var(--success)', icon: 'var(--success)' },
                  yellow: { bg: 'var(--warning-light)', border: 'var(--warning)', text: 'var(--warning)', icon: 'var(--warning)' },
                  purple: { bg: 'var(--primary-purple-light)', border: 'var(--primary-purple)', text: 'var(--primary-purple)', icon: 'var(--primary-purple)' },
                  blue: { bg: 'var(--primary-blue-light)', border: 'var(--primary-blue)', text: 'var(--primary-blue)', icon: 'var(--primary-blue)' },
                };
                const style = colorStyles[category.color] ?? {
                  bg: 'var(--bg-tertiary)', border: 'var(--border-primary)',
                  text: 'var(--text-secondary)', icon: 'var(--text-secondary)',
                };
                return (
                  <div
                    key={category.id}
                    className="p-3 rounded-lg border"
                    style={{ background: style.bg, borderColor: style.border }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <IconComponent className="w-4 h-4" style={{ color: style.icon }} />
                      <span className="font-semibold text-sm" style={{ color: style.text }}>{category.title}</span>
                    </div>
                    <div className="space-y-1">
                      {category.items.map((item, idx) => (
                        <div key={idx} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span className="font-medium">{item.label}:</span>{' '}
                          <span className="opacity-90">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 도구 소개 UI */}
          {step.isToolsStep && (
            <div className="grid grid-cols-2 gap-3 mb-4 flex-1 overflow-y-auto pr-2">
              {TOOLS_CATEGORIES_DATA.map((category) => {
                const IconComponent = category.icon;
                const colorStyles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
                  violet: { bg: 'var(--primary-purple-light)', border: 'var(--primary-purple)', text: 'var(--primary-purple)', icon: 'var(--primary-purple)' },
                  green: { bg: 'var(--success-light)', border: 'var(--success)', text: 'var(--success)', icon: 'var(--success)' },
                  yellow: { bg: 'var(--warning-light)', border: 'var(--warning)', text: 'var(--warning)', icon: 'var(--warning)' },
                  rose: { bg: 'var(--error-light)', border: 'var(--error)', text: 'var(--error)', icon: 'var(--error)' },
                };
                const style = colorStyles[category.color] ?? {
                  bg: 'var(--bg-tertiary)', border: 'var(--border-primary)',
                  text: 'var(--text-secondary)', icon: 'var(--text-secondary)',
                };
                return (
                  <div
                    key={category.id}
                    className="p-3 rounded-lg border"
                    style={{ background: style.bg, borderColor: style.border }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <IconComponent className="w-4 h-4" style={{ color: style.icon }} />
                      <span className="font-semibold text-sm" style={{ color: style.text }}>{category.title}</span>
                    </div>
                    <div className="space-y-1">
                      {category.tools.map((tool, idx) => (
                        <div key={idx} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {tool}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 샘플 프로젝트 선택 UI */}
          {step.isSampleStep && (
            <div className="space-y-3 mb-4 flex-1 overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-3">
                {SAMPLE_PROJECTS.map((sample) => {
                  const IconComponent = sampleIconMap[sample.icon] || Swords;
                  const colors = sampleCategoryColors[sample.category] ?? DEFAULT_CATEGORY_COLOR;
                  const isSelected = selectedSample === sample.id;

                  return (
                    <button
                      key={sample.id}
                      onClick={() => handleSampleSelect(sample.id)}
                      className="p-3 rounded-xl border-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: isSelected ? colors.bg : 'var(--bg-tertiary)',
                        borderColor: isSelected ? colors.border : 'transparent',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: colors.bg }}
                        >
                          <IconComponent className="w-4 h-4" style={{ color: colors.text }} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm mb-0.5" style={{ color: 'var(--text-primary)' }}>
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

              {/* 샘플로 바로 시작 버튼 */}
              {selectedSample && (
                <button
                  onClick={handleStartWithSample}
                  className="w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{ background: 'var(--primary-blue)', color: 'white' }}
                >
                  <Rocket className="w-4 h-4" />
                  {t('samples.createButton')}
                </button>
              )}
            </div>
          )}

          {/* 액션 가이드 */}
          {step.action && (
            <div
              className="flex items-center gap-2 mb-4 p-3 rounded-lg"
              style={{ background: 'var(--primary-blue-light)' }}
            >
              <MousePointer className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--primary-blue)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--primary-blue)' }}>{step.action}</span>
            </div>
          )}

          {/* 예제 */}
          {step.example && (
            <div
              className="rounded-lg p-4 mb-4 font-mono text-sm"
              style={{ background: 'var(--bg-sidebar)' }}
            >
              {step.example.before && (
                <div className="mb-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{`// ${step.example.before}`}</div>
              )}
              <div className="flex items-center gap-2 mb-2">
                <Keyboard className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ color: 'var(--success)' }}>{step.example.input}</span>
              </div>
              <div className="flex items-center gap-2" style={{ color: 'var(--warning)' }}>
                <Play className="w-4 h-4" />
                <span>→ {step.example.result}</span>
              </div>
            </div>
          )}

          {/* 피드백 & 오픈소스 안내 */}
          {step.isSurveyStep && (
            <div className="space-y-4 mb-4 flex-1">
              <div
                className="p-4 rounded-lg"
                style={{ background: 'var(--bg-tertiary)' }}
              >
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('onboarding.steps.survey.feedbackRequest')}
                </div>
                <ul className="mt-2 space-y-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  <li>• {t('onboarding.steps.survey.feedbackItem1')}</li>
                  <li>• {t('onboarding.steps.survey.feedbackItem2')}</li>
                  <li>• {t('onboarding.steps.survey.feedbackItem3')}</li>
                </ul>
              </div>

              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                <span>{t('onboarding.steps.survey.openSource')}</span>
                <a
                  href="https://github.com/dj258255/balruno"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--primary-blue)' }}
                >
                  GitHub
                </a>
              </div>
            </div>
          )}

          {/* 팁 */}
          {step.tip && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg"
              style={{ background: 'var(--warning-light)' }}
            >
              <Lightbulb className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
              <span className="text-sm" style={{ color: 'var(--warning)' }}>{step.tip}</span>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div
          className="px-6 py-4 border-t flex items-center justify-between"
          style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}
        >
          <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {currentStep + 1} / {TUTORIAL_STEPS.length}
          </div>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 px-4 py-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <ChevronLeft className="w-4 h-4" />
                {t('onboarding.previous')}
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-5 py-2 rounded-lg transition-colors"
              style={{ background: 'var(--primary-blue)', color: 'white' }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              {currentStep === TUTORIAL_STEPS.length - 1 ? (
                t('onboarding.getStarted')
              ) : (
                <>
                  {t('onboarding.next')}
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 온보딩 완료 여부 확인 훅
export function useOnboardingStatus() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem('balruno_onboarding_completed');
    if (!completed) {
      setShowOnboarding(true);
    }
  }, []);

  const resetOnboarding = () => {
    localStorage.removeItem('balruno_onboarding_completed');
    setShowOnboarding(true);
  };

  return { showOnboarding, setShowOnboarding, resetOnboarding };
}
