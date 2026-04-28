'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  ComposedChart,
  Area,
} from 'recharts';
import {
  Maximize2, X, Plus, Trash2, Layers, TrendingUp, Settings, Eye,
  Target, Clock, Calculator, AlertTriangle, BarChart3, Percent,
  Copy, ChevronDown, ChevronUp, Zap, Timer, Check
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SCALE } from '@/lib/formulaEngine';
import type { CurveType } from '@/types';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
import { cn } from '@/lib/utils';
import {
  PANEL_COLOR,
  CURVE_COLORS,
  SCENARIO_COLORS,
  CURVE_KEYS,
  hermiteInterpolate,
  calculateDiminishing,
  calculateXPRequired,
  calculateSegmentedValue,
  type GrowthSegment,
  type InterpolationType,
  type ViewMode,
} from './growth-curve-chart.helpers';

interface GrowthCurveChartProps {
  initialBase?: number;
  initialRate?: number;
  initialMaxLevel?: number;
  showHelp?: boolean;
  setShowHelp?: (value: boolean) => void;
  onClose?: () => void;
}

interface Scenario {
  id: string;
  name: string;
  color: string;
  base: number;
  rate: number;
  curveType: CurveType;
  enabled: boolean;
}

// 보조 컴포넌트 + 훅 분리 → growth-curve-chart/
import { CustomSelect, ToggleSwitch, PreviewCard, NumberInput } from './growth-curve-chart/components';
import { useScenarios, useSegments } from './growth-curve-chart/hooks';

export default function GrowthCurveChart({
  initialBase = 100,
  initialRate = 1.1,
  initialMaxLevel = 50,
  showHelp: externalShowHelp,
  setShowHelp: externalSetShowHelp,
  onClose,
}: GrowthCurveChartProps) {
  const [internalShowHelp, setInternalShowHelp] = useState(false);
  const showHelp = externalShowHelp ?? internalShowHelp;
  const setShowHelp = externalSetShowHelp ?? setInternalShowHelp;

  const t = useTranslations('growthCurve');

  // 기본 상태
  const [base, setBase] = useState(initialBase);
  const [rate, setRate] = useState(initialRate);
  const [maxLevel, setMaxLevel] = useState(initialMaxLevel);
  const [showCurves, setShowCurves] = useState({
    linear: true,
    exponential: true,
    logarithmic: true,
    quadratic: false,
  });
  const [showChartModal, setShowChartModal] = useState(false);

  // 뷰 모드 (기본 곡선 / 성장률 / XP 요구량 / 시간 진행)
  const [viewMode, setViewMode] = useState<ViewMode>('curve');

  // 커스텀 곡선
  // S-곡선 예시: 상한선 있는 스탯 (치명타율, 회피율 등)
  const [customCurve, setCustomCurve] = useState<CurveType>('scurve');
  const [customBase, setCustomBase] = useState(5);     // 시작 5%
  const [customRate, setCustomRate] = useState(0.8);   // 성장 속도
  const [showCustom, setShowCustom] = useState(false);

  // 구간별 성장
  // 실제 RPG 성장 패턴: 초반 급성장 → 중반 안정 → 후반 완만
  const [showSegmented, setShowSegmented] = useState(false);
  const { segments, setSegments, addSegment, removeSegment, updateSegment } = useSegments([
    { id: '1', startLevel: 1, endLevel: 15, curveType: 'exponential', rate: 1.12 },  // 초반: 급성장
    { id: '2', startLevel: 16, endLevel: 35, curveType: 'linear', rate: 50 },        // 중반: 안정적
    { id: '3', startLevel: 36, endLevel: 50, curveType: 'logarithmic', rate: 100 },  // 후반: 완만
  ], initialMaxLevel);
  const [interpolation, setInterpolation] = useState<InterpolationType>('none');
  const [transitionWidth, setTransitionWidth] = useState(3);

  // === 새로운 기능들 ===

  // 1. 다중 시나리오 비교 — useScenarios 훅 (Track D-2 2차 분해)
  const { scenarios, setScenarios, addScenario, removeScenario, updateScenario } = useScenarios([
    { id: '1', name: t('scenarioWarriorHp'), color: SCENARIO_COLORS[0], base: 500, rate: 1.08, curveType: 'linear', enabled: false },
    { id: '2', name: t('scenarioMageHp'), color: SCENARIO_COLORS[1], base: 300, rate: 1.05, curveType: 'linear', enabled: false },
  ]);
  const [showScenarios, setShowScenarios] = useState(false);

  // 2. Diminishing Returns (수확 체감)
  // 방어력 스탯 예시: 소프트캡 50%, 하드캡 75% 감소율
  const [showDiminishing, setShowDiminishing] = useState(false);
  const [diminishingConfig, setDiminishingConfig] = useState({
    base: 0,        // 시작 방어력
    rate: 10,       // 레벨당 +10
    softCap: 300,   // 300 이후 효율 감소
    hardCap: 500,   // 500에서 완전히 정지
  });

  // 3. XP 요구량 모드
  // 일반적인 RPG 기준: 100 × level^2 (레벨 50 = 250,000 XP)
  const [xpConfig, setXpConfig] = useState({
    baseXP: 100,        // 기본 XP (레벨 1 → 2에 필요한 XP의 기준)
    exponent: 2.2,      // 지수 (2~2.5가 일반적, 높을수록 후반 어려움)
    curveType: 'polynomial' as 'polynomial' | 'exponential' | 'runescape',
  });

  // 4. 시간 기반 진행 예측
  // 모바일 RPG 기준: 시간당 5000 XP, 일 1시간 플레이
  const [timeConfig, setTimeConfig] = useState({
    xpPerHour: 5000,      // 시간당 획득 XP (전투 + 퀘스트 평균)
    playHoursPerDay: 1,   // 일일 플레이 시간 (캐주얼: 0.5~1h, 코어: 2~4h)
    targetLevel: 50,      // 목표 레벨
  });

  // 5. 목표 역계산 (Goal Solver)
  // 예: 레벨 50에서 HP 5000이 되려면?
  const [showGoalSolver, setShowGoalSolver] = useState(false);
  const [goalSolverConfig, setGoalSolverConfig] = useState({
    targetLevel: 50,
    targetValue: 5000,
    solveFor: 'rate' as 'rate' | 'base' | 'level',
  });

  // 6. 성장률 경고 임계값
  // 일반적인 RPG 기준: 성장률 10~20%가 적정
  const [growthWarnings, setGrowthWarnings] = useState({
    tooFast: 30, // 30% 이상이면 급성장 경고
    tooSlow: 3,  // 3% 이하면 둔화 경고
  });

  // 7. 확장 섹션 상태
  const [expandedSections, setExpandedSections] = useState({
    advanced: false,
    analysis: true,
  });


  // (시나리오/세그먼트 관리는 useScenarios/useSegments 훅으로 분리됨 — 위 114, 103 라인)

  // 목표 역계산 로직
  const solveGoal = useCallback(() => {
    const { targetLevel, targetValue, solveFor } = goalSolverConfig;

    if (solveFor === 'rate') {
      // base + level * rate = targetValue → rate = (targetValue - base) / level
      // exponential: base * rate^level = targetValue → rate = (targetValue/base)^(1/level)
      const linearRate = (targetValue - base) / targetLevel;
      const expRate = Math.pow(targetValue / base, 1 / targetLevel);
      return {
        linear: linearRate.toFixed(2),
        exponential: expRate.toFixed(4),
      };
    } else if (solveFor === 'base') {
      const linearBase = targetValue - targetLevel * rate * 10;
      const expBase = targetValue / Math.pow(rate, targetLevel);
      return {
        linear: Math.round(linearBase),
        exponential: Math.round(expBase),
      };
    } else {
      // level 역산 (이진 탐색)
      let low = 1, high = 1000;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const val = SCALE(base, mid, rate, 'exponential');
        if (val < targetValue) low = mid + 1;
        else high = mid;
      }
      return { level: low };
    }
  }, [goalSolverConfig, base, rate]);

  // 차트 데이터 생성
  const chartData = useMemo(() => {
    const data = [];
    for (let level = 1; level <= maxLevel; level++) {
      const point: Record<string, number> = { level };

      if (viewMode === 'curve') {
        // 기본 곡선들 (항상 계산 - hide prop으로 표시 제어)
        point.linear = SCALE(base, level, rate * 10, 'linear');
        point.exponential = SCALE(base, level, rate, 'exponential');
        point.logarithmic = SCALE(base, level, rate * 50, 'logarithmic');
        point.quadratic = SCALE(base, level, rate, 'quadratic');

        if (showCustom) {
          point.custom = SCALE(customBase, level, customRate, customCurve);
        }
        if (showSegmented && segments.length > 0) {
          point.segmented = calculateSegmentedValue(base, level, segments, interpolation, transitionWidth);
        }
        if (showDiminishing) {
          point.diminishing = calculateDiminishing(
            diminishingConfig.base,
            level,
            diminishingConfig.rate,
            diminishingConfig.softCap,
            diminishingConfig.hardCap
          );
        }

        // 시나리오들
        if (showScenarios) {
          for (const scenario of scenarios) {
            if (scenario.enabled) {
              point[`scenario_${scenario.id}`] = SCALE(scenario.base, level, scenario.rate, scenario.curveType);
            }
          }
        }
      } else if (viewMode === 'growthRate') {
        // 성장률 (%) 계산
        if (level > 1) {
          const prevLinear = SCALE(base, level - 1, rate * 10, 'linear');
          const currLinear = SCALE(base, level, rate * 10, 'linear');
          point.linear = ((currLinear - prevLinear) / prevLinear) * 100;

          const prevExp = SCALE(base, level - 1, rate, 'exponential');
          const currExp = SCALE(base, level, rate, 'exponential');
          point.exponential = ((currExp - prevExp) / prevExp) * 100;

          const prevLog = SCALE(base, level - 1, rate * 50, 'logarithmic');
          const currLog = SCALE(base, level, rate * 50, 'logarithmic');
          point.logarithmic = prevLog > 0 ? ((currLog - prevLog) / prevLog) * 100 : 0;

          const prevQuad = SCALE(base, level - 1, rate, 'quadratic');
          const currQuad = SCALE(base, level, rate, 'quadratic');
          point.quadratic = ((currQuad - prevQuad) / prevQuad) * 100;
        } else {
          point.linear = 0;
          point.exponential = 0;
          point.logarithmic = 0;
          point.quadratic = 0;
        }
      } else if (viewMode === 'xpRequired') {
        // XP 요구량 모드
        point.xpRequired = calculateXPRequired(xpConfig.baseXP, level, xpConfig.exponent, xpConfig.curveType);
        point.cumulativeXP = Array.from({ length: level }, (_, i) =>
          calculateXPRequired(xpConfig.baseXP, i + 1, xpConfig.exponent, xpConfig.curveType)
        ).reduce((a, b) => a + b, 0);
      } else if (viewMode === 'timeProgress') {
        // 시간 기반 진행
        const xpForLevel = calculateXPRequired(xpConfig.baseXP, level, xpConfig.exponent, xpConfig.curveType);
        const cumulativeXP = Array.from({ length: level }, (_, i) =>
          calculateXPRequired(xpConfig.baseXP, i + 1, xpConfig.exponent, xpConfig.curveType)
        ).reduce((a, b) => a + b, 0);

        point.hoursToReach = cumulativeXP / timeConfig.xpPerHour;
        point.daysToReach = point.hoursToReach / timeConfig.playHoursPerDay;
      }

      data.push(point);
    }
    return data;
  }, [
    base, rate, maxLevel, showCustom, customBase, customRate, customCurve,
    showSegmented, segments, interpolation, transitionWidth, showDiminishing, diminishingConfig,
    showScenarios, scenarios, viewMode, xpConfig, timeConfig
  ]);

  // 성장률 분석 통계
  const growthStats = useMemo(() => {
    if (viewMode !== 'growthRate' || chartData.length < 2) return null;

    const rates = chartData.slice(1).map(d => d.exponential).filter(v => !isNaN(v) && isFinite(v));
    if (rates.length === 0) return null;

    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const max = Math.max(...rates);
    const min = Math.min(...rates);
    const tooFastLevels = chartData.filter((d, i) => i > 0 && d.exponential > growthWarnings.tooFast).map(d => d.level);
    const tooSlowLevels = chartData.filter((d, i) => i > 0 && d.exponential < growthWarnings.tooSlow && d.exponential > 0).map(d => d.level);

    return { avg, max, min, tooFastLevels, tooSlowLevels };
  }, [chartData, viewMode, growthWarnings]);

  // 시간 예측 통계
  const timeStats = useMemo(() => {
    if (viewMode !== 'timeProgress') return null;

    const targetData = chartData.find(d => d.level === timeConfig.targetLevel);
    if (!targetData) return null;

    return {
      hoursToTarget: targetData.hoursToReach,
      daysToTarget: targetData.daysToReach,
      weeksToTarget: targetData.daysToReach / 7,
    };
  }, [chartData, viewMode, timeConfig.targetLevel]);

  const [previewLevel, setPreviewLevel] = useState(10);
  const previewValues = useMemo(() => {
    return {
      linear: SCALE(base, previewLevel, rate * 10, 'linear'),
      exponential: SCALE(base, previewLevel, rate, 'exponential'),
      logarithmic: SCALE(base, previewLevel, rate * 50, 'logarithmic'),
      quadratic: SCALE(base, previewLevel, rate, 'quadratic'),
      custom: showCustom ? SCALE(customBase, previewLevel, customRate, customCurve) : null,
      segmented: showSegmented && segments.length > 0 ? calculateSegmentedValue(base, previewLevel, segments, interpolation, transitionWidth) : null,
      diminishing: showDiminishing ? calculateDiminishing(diminishingConfig.base, previewLevel, diminishingConfig.rate, diminishingConfig.softCap, diminishingConfig.hardCap) : null,
    };
  }, [base, rate, previewLevel, customBase, customRate, customCurve, showCustom, showSegmented, segments, interpolation, transitionWidth, showDiminishing, diminishingConfig]);

  return (
    <PanelShell
      title={t('titleHeader')}
      subtitle={t('subtitleHeader')}
      icon={TrendingUp}
      iconColor={PANEL_COLOR}
      onClose={onClose ?? (() => {})}
      bodyClassName="p-0 flex flex-col overflow-hidden"
      actions={<HelpToggle active={showHelp} onToggle={() => setShowHelp(!showHelp)} color={PANEL_COLOR} />}
    >
      <div className="p-4 space-y-5 overflow-y-auto overflow-x-hidden flex-1 scrollbar-slim">
        {/* 도움말 섹션 */}
        {showHelp && (
          <div className="glass-card p-4 animate-slideDown space-y-4">
            {/* 헤더 */}
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `linear-gradient(135deg, ${PANEL_COLOR}, ${PANEL_COLOR}cc)` }}
              >
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('title')}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('helpDesc')}</p>
              </div>
            </div>

            {/* 뷰 모드별 도움말 */}
            {viewMode === 'curve' && (
              <>
                {/* 곡선 타입 설명 */}
                <div className="space-y-2">
                  <h5 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('help.curveTypes')}</h5>
                  {[
                    { key: 'linear', color: CURVE_COLORS.linear },
                    { key: 'exponential', color: CURVE_COLORS.exponential },
                    { key: 'logarithmic', color: CURVE_COLORS.logarithmic },
                    { key: 'quadratic', color: CURVE_COLORS.quadratic },
                    { key: 'sCurve', color: CURVE_COLORS.custom },
                  ].map(({ key, color }) => (
                    <div key={key} className="glass-section p-2.5" style={{ borderLeft: `3px solid ${color}` }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-medium text-sm" style={{ color }}>{t(`${key}Help.name`)}</span>
                        <code className="text-sm px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>
                          {t(`${key}Help.formula`)}
                        </code>
                      </div>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t(`${key}Help.desc`)}</p>
                    </div>
                  ))}
                </div>

                {/* 추가 기능 설명 */}
                <div className="space-y-2">
                  <h5 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('help.advancedFeatures')}</h5>

                  {/* 수확 체감 */}
                  <div className="glass-section p-2.5" style={{ borderLeft: `3px solid ${CURVE_COLORS.diminishing}` }}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm" style={{ color: CURVE_COLORS.diminishing }}>{t('help.diminishing.name')}</span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('help.diminishing.desc')}</p>
                    <div className="mt-1.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {t('help.diminishing.example')}
                    </div>
                  </div>

                  {/* 다중 시나리오 */}
                  <div className="glass-section p-2.5" style={{ borderLeft: `3px solid ${PANEL_COLOR}` }}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm" style={{ color: PANEL_COLOR }}>{t('help.scenarios.name')}</span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('help.scenarios.desc')}</p>
                  </div>

                  {/* 구간별 성장 */}
                  <div className="glass-section p-2.5" style={{ borderLeft: `3px solid ${CURVE_COLORS.segmented}` }}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm" style={{ color: CURVE_COLORS.segmented }}>{t('help.segmented.name')}</span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('help.segmented.desc')}</p>
                  </div>
                </div>

                <div className="glass-section p-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('helpTip')}
                </div>
              </>
            )}

            {viewMode === 'growthRate' && (
              <div className="space-y-3">
                <h5 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('help.growthRate.title')}</h5>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('help.growthRate.desc')}</p>

                <div className="grid grid-cols-2 gap-2">
                  <div className="glass-section p-2.5" style={{ borderLeft: '3px solid #e86161' }}>
                    <span className="font-medium text-sm" style={{ color: '#e86161' }}>{t('help.growthRate.tooFast')}</span>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('help.growthRate.tooFastDesc')}</p>
                  </div>
                  <div className="glass-section p-2.5" style={{ borderLeft: '3px solid #5a9cf5' }}>
                    <span className="font-medium text-sm" style={{ color: '#5a9cf5' }}>{t('help.growthRate.tooSlow')}</span>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('help.growthRate.tooSlowDesc')}</p>
                  </div>
                </div>

                <div className="glass-section p-2.5">
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('help.growthRate.formula')}</span>
                  <code className="block mt-1 text-sm p-2 rounded" style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>
                    {t('help.growthRate.formulaCode')}
                  </code>
                </div>

                <div className="glass-section p-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('help.growthRate.tip')}
                </div>
              </div>
            )}

            {viewMode === 'xpRequired' && (
              <div className="space-y-3">
                <h5 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('help.xp.title')}</h5>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('help.xp.desc')}</p>

                <div className="space-y-2">
                  <div className="glass-section p-2.5" style={{ borderLeft: '3px solid #e5a440' }}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-medium text-sm" style={{ color: '#e5a440' }}>{t('help.xp.polynomial.name')}</span>
                      <code className="text-sm px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.05)' }}>baseXP × level^n</code>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('help.xp.polynomial.desc')}</p>
                  </div>

                  <div className="glass-section p-2.5" style={{ borderLeft: '3px solid #9179f2' }}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-medium text-sm" style={{ color: '#9179f2' }}>{t('help.xp.exponential.name')}</span>
                      <code className="text-sm px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.05)' }}>baseXP × n^level</code>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('help.xp.exponential.desc')}</p>
                  </div>

                  <div className="glass-section p-2.5" style={{ borderLeft: '3px solid #3db88a' }}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-medium text-sm" style={{ color: '#3db88a' }}>{t('help.xp.runescape.name')}</span>
                      <code className="text-sm px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.05)' }}>Σ(l + 300×2^(l/7))/4</code>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('help.xp.runescape.desc')}</p>
                  </div>
                </div>

                <div className="glass-section p-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('help.xp.tip')}
                </div>
              </div>
            )}

            {viewMode === 'timeProgress' && (
              <div className="space-y-3">
                <h5 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('help.time.title')}</h5>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('help.time.desc')}</p>

                <div className="glass-section p-2.5">
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('help.time.params')}</span>
                  <ul className="mt-1.5 space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <li>• <strong>{t('help.time.xpPerHour')}</strong>: {t('help.time.xpPerHourDesc')}</li>
                    <li>• <strong>{t('help.time.playHours')}</strong>: {t('help.time.playHoursDesc')}</li>
                    <li>• <strong>{t('help.time.targetLevel')}</strong>: {t('help.time.targetLevelDesc')}</li>
                  </ul>
                </div>

                <div className="glass-section p-2.5">
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('help.time.formula')}</span>
                  <code className="block mt-1 text-sm p-2 rounded" style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>
                    {t('help.time.formulaCode')}
                  </code>
                </div>

                <div className="glass-section p-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('help.time.tip')}
                </div>
              </div>
            )}

            {/* 목표 역계산 도움말 (모든 모드에서 표시) */}
            <div className="glass-section p-2.5" style={{ borderLeft: '3px solid #e5a440' }}>
              <div className="flex items-center gap-2 mb-0.5">
                <Target className="w-4 h-4" style={{ color: '#e5a440' }} />
                <span className="font-medium text-sm" style={{ color: '#e5a440' }}>{t('help.goalSolver.name')}</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('help.goalSolver.desc')}</p>
              <div className="mt-1.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('help.goalSolver.example')}
              </div>
            </div>
          </div>
        )}

        {/* 뷰 모드 선택 탭 */}
        <div className="glass-card p-2">
          <div className="flex gap-1">
            {[
              { mode: 'curve' as ViewMode, icon: TrendingUp, label: t('modeCurve') },
              { mode: 'growthRate' as ViewMode, icon: Percent, label: t('modeGrowthRate') },
              { mode: 'xpRequired' as ViewMode, icon: BarChart3, label: t('modeXpRequired') },
              { mode: 'timeProgress' as ViewMode, icon: Timer, label: t('modeTimeProgress') },
            ].map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  viewMode === mode && 'shadow-sm'
                )}
                style={{
                  background: viewMode === mode ? `${PANEL_COLOR}15` : 'transparent',
                  color: viewMode === mode ? PANEL_COLOR : 'var(--text-secondary)',
                  border: `1px solid ${viewMode === mode ? PANEL_COLOR : 'transparent'}`,
                }}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 설정 패널 */}
        <div className="space-y-5">
          {/* 기본 설정 */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Settings className="w-4 h-4" style={{ color: PANEL_COLOR }} />
              <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('basicSettings')}</h4>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('baseValue')}</label>
                <NumberInput
                  value={base}
                  onChange={setBase}
                  className="glass-input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('rate')}</label>
                <NumberInput
                  value={rate}
                  onChange={setRate}
                  className="glass-input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('maxLevel')}</label>
                <NumberInput
                  value={maxLevel}
                  onChange={setMaxLevel}
                  max={200}
                  className="glass-input w-full text-sm"
                />
              </div>
            </div>
          </div>

          {/* 뷰 모드별 추가 설정 */}
          {viewMode === 'xpRequired' && (
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4" style={{ color: '#e5a440' }} />
                <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('xpConfigTitle')}</h4>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('baseXp')}</label>
                  <NumberInput
                    value={xpConfig.baseXP}
                    onChange={(v) => setXpConfig({ ...xpConfig, baseXP: v })}
                    className="glass-input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('exponent')}</label>
                  <NumberInput
                    value={xpConfig.exponent}
                    onChange={(v) => setXpConfig({ ...xpConfig, exponent: v })}
                    className="glass-input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('formulaType')}</label>
                  <CustomSelect
                    value={xpConfig.curveType}
                    onChange={(v) => setXpConfig({ ...xpConfig, curveType: v as typeof xpConfig.curveType })}
                    options={[
                      { value: 'polynomial', label: t('typePolynomial') },
                      { value: 'exponential', label: t('typeExponential') },
                      { value: 'runescape', label: t('typeRunescape') },
                    ]}
                  />
                </div>
              </div>
              <div className="text-sm p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.03)', color: 'var(--text-secondary)' }}>
                {xpConfig.curveType === 'polynomial' && t('formulaPolyDesc', { base: xpConfig.baseXP, exp: xpConfig.exponent })}
                {xpConfig.curveType === 'exponential' && t('formulaExpDesc', { base: xpConfig.baseXP, exp: xpConfig.exponent })}
                {xpConfig.curveType === 'runescape' && t('formulaRunescapeDesc')}
              </div>
            </div>
          )}

          {viewMode === 'timeProgress' && (
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Timer className="w-4 h-4" style={{ color: '#9179f2' }} />
                <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('timeConfigTitle')}</h4>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('xpPerHour')}</label>
                  <NumberInput
                    value={timeConfig.xpPerHour}
                    onChange={(v) => setTimeConfig({ ...timeConfig, xpPerHour: v })}
                    className="glass-input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('dailyPlayHours')}</label>
                  <NumberInput
                    value={timeConfig.playHoursPerDay}
                    onChange={(v) => setTimeConfig({ ...timeConfig, playHoursPerDay: v })}
                    className="glass-input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('targetLevel')}</label>
                  <NumberInput
                    value={timeConfig.targetLevel}
                    onChange={(v) => setTimeConfig({ ...timeConfig, targetLevel: Math.min(v, maxLevel) })}
                    max={maxLevel}
                    className="glass-input w-full text-sm"
                  />
                </div>
              </div>
              {timeStats && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="glass-section p-2 text-center">
                    <div className="text-lg font-bold" style={{ color: '#9179f2' }}>{timeStats.hoursToTarget.toFixed(1)}h</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('totalPlayTime')}</div>
                  </div>
                  <div className="glass-section p-2 text-center">
                    <div className="text-lg font-bold" style={{ color: '#e5a440' }}>{t('daysExpected', { days: timeStats.daysToTarget.toFixed(1) })}</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('expectedDays')}</div>
                  </div>
                  <div className="glass-section p-2 text-center">
                    <div className="text-lg font-bold" style={{ color: '#3db88a' }}>{t('weeksExpected', { weeks: timeStats.weeksToTarget.toFixed(1) })}</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('expectedWeeks')}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {viewMode === 'growthRate' && growthStats && (
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Percent className="w-4 h-4" style={{ color: '#e86161' }} />
                <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('growthAnalysisTitle')}</h4>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="glass-section p-2 text-center">
                  <div className="text-lg font-bold" style={{ color: '#3db88a' }}>{growthStats.avg.toFixed(1)}%</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('avgGrowthRate')}</div>
                </div>
                <div className="glass-section p-2 text-center">
                  <div className="text-lg font-bold" style={{ color: '#e86161' }}>{growthStats.max.toFixed(1)}%</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('maxGrowthRate')}</div>
                </div>
                <div className="glass-section p-2 text-center">
                  <div className="text-lg font-bold" style={{ color: '#5a9cf5' }}>{growthStats.min.toFixed(1)}%</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('minGrowthRate')}</div>
                </div>
              </div>
              {(growthStats.tooFastLevels.length > 0 || growthStats.tooSlowLevels.length > 0) && (
                <div className="space-y-2">
                  {growthStats.tooFastLevels.length > 0 && (
                    <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(232,97,97,0.1)' }}>
                      <AlertTriangle className="w-4 h-4" style={{ color: '#e86161' }} />
                      <span className="text-sm" style={{ color: '#e86161' }}>
                        {t('growthSurge', { threshold: growthWarnings.tooFast, levels: growthStats.tooFastLevels.slice(0, 5).join(', ') })}
                        {growthStats.tooFastLevels.length > 5 && t('growthMore', { n: growthStats.tooFastLevels.length - 5 })}
                      </span>
                    </div>
                  )}
                  {growthStats.tooSlowLevels.length > 0 && (
                    <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(90,156,245,0.1)' }}>
                      <AlertTriangle className="w-4 h-4" style={{ color: '#5a9cf5' }} />
                      <span className="text-sm" style={{ color: '#5a9cf5' }}>
                        {t('growthSlow', { threshold: growthWarnings.tooSlow, levels: growthStats.tooSlowLevels.slice(0, 5).join(', ') })}
                        {growthStats.tooSlowLevels.length > 5 && t('growthMore', { n: growthStats.tooSlowLevels.length - 5 })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 곡선 선택 (기본 뷰에서만) */}
          {viewMode === 'curve' && (
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="w-4 h-4" style={{ color: PANEL_COLOR }} />
                <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('curvesToShow')}</h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CURVE_KEYS.map((key) => {
                  const color = CURVE_COLORS[key as keyof typeof CURVE_COLORS];
                  const isChecked = showCurves[key as keyof typeof showCurves];
                  return (
                    <button
                      key={key}
                      onClick={() => setShowCurves((prev) => ({ ...prev, [key]: !prev[key as keyof typeof showCurves] }))}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all',
                        isChecked && 'shadow-sm'
                      )}
                      style={{
                        background: isChecked ? `${color}15` : 'var(--bg-tertiary)',
                        border: `1px solid ${isChecked ? color : 'transparent'}`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        <span className="font-medium" style={{ color: isChecked ? color : 'var(--text-secondary)' }}>{t(key)}</span>
                      </div>
                      <ToggleSwitch checked={isChecked} color={color} />
                    </button>
                  );
                })}
              </div>

              {/* 커스텀 곡선 */}
              <button
                onClick={() => setShowCustom(!showCustom)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all',
                  showCustom && 'shadow-sm'
                )}
                style={{
                  background: showCustom ? `${CURVE_COLORS.custom}15` : 'var(--bg-tertiary)',
                  border: `1px solid ${showCustom ? CURVE_COLORS.custom : 'transparent'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CURVE_COLORS.custom }} />
                  <span className="font-medium" style={{ color: showCustom ? CURVE_COLORS.custom : 'var(--text-secondary)' }}>{t('customCurve')}</span>
                </div>
                <ToggleSwitch checked={showCustom} color={CURVE_COLORS.custom} />
              </button>

              {/* 커스텀 곡선 설정 */}
              {showCustom && (
                <div className="glass-section p-3 space-y-3 mt-2" style={{ borderLeft: `3px solid ${CURVE_COLORS.custom}` }}>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('curveTypeLabel')}</label>
                    <CustomSelect
                      value={customCurve}
                      onChange={(v) => setCustomCurve(v as CurveType)}
                      options={[
                        { value: 'linear', label: t('linear') },
                        { value: 'exponential', label: t('exponential') },
                        { value: 'logarithmic', label: t('logarithmic') },
                        { value: 'quadratic', label: t('quadratic') },
                        { value: 'scurve', label: t('sCurve') },
                      ]}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('baseValue')}</label>
                      <NumberInput value={customBase} onChange={setCustomBase} className="glass-input w-full text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('rate')}</label>
                      <NumberInput value={customRate} onChange={setCustomRate} className="glass-input w-full text-sm" />
                    </div>
                  </div>
                </div>
              )}

              {/* Diminishing Returns */}
              <button
                onClick={() => setShowDiminishing(!showDiminishing)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all',
                  showDiminishing && 'shadow-sm'
                )}
                style={{
                  background: showDiminishing ? `${CURVE_COLORS.diminishing}15` : 'var(--bg-tertiary)',
                  border: `1px solid ${showDiminishing ? CURVE_COLORS.diminishing : 'transparent'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CURVE_COLORS.diminishing }} />
                  <span className="font-medium" style={{ color: showDiminishing ? CURVE_COLORS.diminishing : 'var(--text-secondary)' }}>{t('harvestDiminishing')}</span>
                </div>
                <ToggleSwitch checked={showDiminishing} color={CURVE_COLORS.diminishing} />
              </button>

              {showDiminishing && (
                <div className="glass-section p-3 space-y-3" style={{ borderLeft: `3px solid ${CURVE_COLORS.diminishing}` }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('baseValue')}</label>
                      <NumberInput
                        value={diminishingConfig.base}
                        onChange={(v) => setDiminishingConfig({ ...diminishingConfig, base: v })}
                        className="glass-input w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('perLevelGrowth')}</label>
                      <NumberInput
                        value={diminishingConfig.rate}
                        onChange={(v) => setDiminishingConfig({ ...diminishingConfig, rate: v })}
                        className="glass-input w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('softCap')}</label>
                      <NumberInput
                        value={diminishingConfig.softCap}
                        onChange={(v) => setDiminishingConfig({ ...diminishingConfig, softCap: v })}
                        className="glass-input w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('hardCap')}</label>
                      <NumberInput
                        value={diminishingConfig.hardCap}
                        onChange={(v) => setDiminishingConfig({ ...diminishingConfig, hardCap: v })}
                        className="glass-input w-full text-sm"
                      />
                    </div>
                  </div>
                  <div className="text-sm p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.03)', color: 'var(--text-secondary)' }}>
                    {t('diminishingHelp', { soft: diminishingConfig.softCap, hard: diminishingConfig.hardCap })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 다중 시나리오 비교 */}
          {viewMode === 'curve' && (
            <div className="glass-card p-4 space-y-3">
              <button
                onClick={() => setShowScenarios(!showScenarios)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all',
                  showScenarios && 'shadow-sm'
                )}
                style={{
                  background: showScenarios ? `${PANEL_COLOR}15` : 'var(--bg-tertiary)',
                  border: `1px solid ${showScenarios ? PANEL_COLOR : 'transparent'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <Copy className="w-4 h-4" style={{ color: showScenarios ? PANEL_COLOR : 'var(--text-secondary)' }} />
                  <span className="font-medium" style={{ color: showScenarios ? PANEL_COLOR : 'var(--text-secondary)' }}>{t('multiScenario')}</span>
                </div>
                <ToggleSwitch checked={showScenarios} color={PANEL_COLOR} />
              </button>

              {showScenarios && (
                <div className="space-y-3 mt-2">
                  {scenarios.map((scenario, idx) => (
                    <div
                      key={scenario.id}
                      className="glass-section p-3 space-y-2"
                      style={{ borderLeft: `3px solid ${scenario.color}` }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateScenario(scenario.id, { enabled: !scenario.enabled })}
                            className={cn(
                              'w-5 h-5 rounded-md flex items-center justify-center transition-all border',
                              scenario.enabled
                                ? 'border-transparent'
                                : 'border-[var(--border-primary)] bg-[var(--bg-tertiary)]'
                            )}
                            style={{
                              background: scenario.enabled ? scenario.color : undefined,
                            }}
                          >
                            {scenario.enabled && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                          </button>
                          <input
                            type="text"
                            value={scenario.name}
                            onChange={(e) => updateScenario(scenario.id, { name: e.target.value })}
                            className="glass-input text-sm font-medium px-2 py-1 w-24"
                            style={{ color: scenario.color }}
                          />
                        </div>
                        <button
                          onClick={() => removeScenario(scenario.id)}
                          className="p-1 rounded-lg hover:bg-red-500/10 transition-colors"
                          style={{ color: '#e86161' }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-label mb-1" style={{ color: 'var(--text-secondary)' }}>{t('baseValue')}</label>
                          <NumberInput
                            value={scenario.base}
                            onChange={(v) => updateScenario(scenario.id, { base: v })}
                            className="glass-input w-full text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-label mb-1" style={{ color: 'var(--text-secondary)' }}>{t('scRate')}</label>
                          <NumberInput
                            value={scenario.rate}
                            onChange={(v) => updateScenario(scenario.id, { rate: v })}
                            className="glass-input w-full text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-label mb-1" style={{ color: 'var(--text-secondary)' }}>{t('scType')}</label>
                          <CustomSelect
                            value={scenario.curveType}
                            onChange={(v) => updateScenario(scenario.id, { curveType: v as CurveType })}
                            options={[
                              { value: 'linear', label: t('typeLinear') },
                              { value: 'exponential', label: t('typeExp') },
                              { value: 'logarithmic', label: t('typeLog') },
                            ]}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={addScenario}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                  >
                    <Plus className="w-4 h-4" />
                    {t('addScenario')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 구간별 성장 곡선 */}
          {viewMode === 'curve' && (
            <div className="glass-card p-4 space-y-3">
              <button
                onClick={() => setShowSegmented(!showSegmented)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all',
                  showSegmented && 'shadow-sm'
                )}
                style={{
                  background: showSegmented ? `${CURVE_COLORS.segmented}15` : 'var(--bg-tertiary)',
                  border: `1px solid ${showSegmented ? CURVE_COLORS.segmented : 'transparent'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4" style={{ color: showSegmented ? CURVE_COLORS.segmented : 'var(--text-secondary)' }} />
                  <span className="font-medium" style={{ color: showSegmented ? CURVE_COLORS.segmented : 'var(--text-secondary)' }}>{t('segmentedCurve')}</span>
                </div>
                <ToggleSwitch checked={showSegmented} color={CURVE_COLORS.segmented} />
              </button>

              {showSegmented && (
                <div className="space-y-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('segmentSettings')}</span>
                    <button
                      onClick={addSegment}
                      className="glass-button flex items-center gap-1.5 !px-2.5 !py-1 text-sm"
                      style={{ color: CURVE_COLORS.segmented }}
                    >
                      <Plus className="w-3 h-3" />
                      {t('addSegment')}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {segments.map((segment, idx) => (
                      <div
                        key={segment.id}
                        className="glass-section p-3 space-y-2"
                        style={{ borderLeft: `3px solid ${CURVE_COLORS.segmented}` }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold" style={{ color: CURVE_COLORS.segmented }}>
                            {t('segment')} {idx + 1}
                          </span>
                          {segments.length > 1 && (
                            <button
                              onClick={() => removeSegment(segment.id)}
                              className="p-1 rounded-lg hover:bg-red-500/10 transition-colors"
                              style={{ color: '#e86161' }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('startLevel')}</label>
                            <NumberInput
                              value={segment.startLevel}
                              onChange={(v) => updateSegment(segment.id, { startLevel: v })}
                              min={1}
                              max={maxLevel}
                              className="glass-input w-full text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('endLevel')}</label>
                            <NumberInput
                              value={segment.endLevel}
                              onChange={(v) => updateSegment(segment.id, { endLevel: v })}
                              min={segment.startLevel}
                              max={maxLevel}
                              className="glass-input w-full text-sm"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('curveTypeLabel')}</label>
                            <CustomSelect
                              value={segment.curveType}
                              onChange={(v) => updateSegment(segment.id, { curveType: v as CurveType })}
                              options={[
                                { value: 'linear', label: t('linear') },
                                { value: 'exponential', label: t('exponential') },
                                { value: 'logarithmic', label: t('logarithmic') },
                                { value: 'quadratic', label: t('quadratic') },
                              ]}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('rate')}</label>
                            <NumberInput
                              value={segment.rate}
                              onChange={(v) => updateSegment(segment.id, { rate: v })}
                              className="glass-input w-full text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 보간 설정 */}
                  <div className="glass-section p-3 space-y-3">
                    <h5 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('interpolationSettings')}</h5>

                    <div className="flex gap-1">
                      {(['none', 'linear', 'smooth'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setInterpolation(type)}
                          className={cn(
                            'flex-1 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all',
                            interpolation === type && 'shadow-sm'
                          )}
                          style={{
                            background: interpolation === type ? `${CURVE_COLORS.segmented}20` : 'var(--bg-tertiary)',
                            color: interpolation === type ? CURVE_COLORS.segmented : 'var(--text-secondary)',
                            border: `1px solid ${interpolation === type ? CURVE_COLORS.segmented : 'transparent'}`,
                          }}
                        >
                          {t(`interpolation_${type}`)}
                        </button>
                      ))}
                    </div>

                    {interpolation !== 'none' && (
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('transitionWidth')}</label>
                        <NumberInput
                          value={transitionWidth}
                          onChange={setTransitionWidth}
                          min={1}
                          max={10}
                          className="glass-input w-full text-sm"
                        />
                      </div>
                    )}
                  </div>

                  <div className="text-sm p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.03)', color: 'var(--text-secondary)' }}>
                    {t('segmentedDesc')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 목표 역계산 (Goal Solver) */}
          <div className="glass-card p-4 space-y-3">
            <button
              onClick={() => setShowGoalSolver(!showGoalSolver)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all',
                showGoalSolver && 'shadow-sm'
              )}
              style={{
                background: showGoalSolver ? `#e5a44015` : 'var(--bg-tertiary)',
                border: `1px solid ${showGoalSolver ? '#e5a440' : 'transparent'}`,
              }}
            >
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" style={{ color: showGoalSolver ? '#e5a440' : 'var(--text-secondary)' }} />
                <span className="font-medium" style={{ color: showGoalSolver ? '#e5a440' : 'var(--text-secondary)' }}>{t('goalReverse')}</span>
              </div>
              <ToggleSwitch checked={showGoalSolver} color="#e5a440" />
            </button>

            {showGoalSolver && (
              <div className="glass-section p-3 space-y-3" style={{ borderLeft: '3px solid #e5a440' }}>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('targetLevel')}</label>
                    <NumberInput
                      value={goalSolverConfig.targetLevel}
                      onChange={(v) => setGoalSolverConfig({ ...goalSolverConfig, targetLevel: v })}
                      className="glass-input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('goalTarget')}</label>
                    <NumberInput
                      value={goalSolverConfig.targetValue}
                      onChange={(v) => setGoalSolverConfig({ ...goalSolverConfig, targetValue: v })}
                      className="glass-input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('goalSolveFor')}</label>
                    <CustomSelect
                      value={goalSolverConfig.solveFor}
                      onChange={(v) => setGoalSolverConfig({ ...goalSolverConfig, solveFor: v as typeof goalSolverConfig.solveFor })}
                      options={[
                        { value: 'rate', label: t('goalRate') },
                        { value: 'base', label: t('goalBase') },
                        { value: 'level', label: t('goalLevelLabel') },
                      ]}
                    />
                  </div>
                </div>
                <div className="p-2 rounded-lg" style={{ background: 'rgba(229,164,64,0.1)' }}>
                  <div className="text-sm font-medium mb-1" style={{ color: '#e5a440' }}>{t('calcResult')}</div>
                  <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {(() => {
                      const result = solveGoal();
                      if ('linear' in result) {
                        return (
                          <>
                            <div>{t('resultLinear')}<strong>{result.linear}</strong></div>
                            <div>{t('resultExp')}<strong>{result.exponential}</strong></div>
                          </>
                        );
                      } else if ('level' in result) {
                        return <div>{t('reachedLevel')}<strong>Lv.{result.level}</strong></div>;
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 차트 */}
        <div className="glass-card p-4 relative group">
          <button
            onClick={() => setShowChartModal(true)}
            className="absolute top-3 right-3 z-10 glass-button !p-2 opacity-0 group-hover:opacity-100 transition-opacity"
            title={t('enlargeGraph')}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
              {viewMode === 'xpRequired' ? (
                <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                  <XAxis dataKey="level" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(v) => v.toLocaleString()} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(v) => v.toLocaleString()} />
                  <Tooltip
                    formatter={(value: number, name: string) => [value.toLocaleString(), name === 'xpRequired' ? t('axisLevelUpXp') : t('axisCumXp')]}
                    contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '12px' }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="xpRequired" name={t('axisLevelUpXp')} fill="#e5a440" opacity={0.8} />
                  <Line yAxisId="right" type="monotone" dataKey="cumulativeXP" name={t('axisCumXp')} stroke="#9179f2" strokeWidth={2} dot={false} />
                </ComposedChart>
              ) : viewMode === 'timeProgress' ? (
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                  <XAxis dataKey="level" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(v) => t('axisDays', { days: v.toFixed(1) })} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === 'daysToReach' ? t('axisDaysReachVal', { days: value.toFixed(1) }) : t('axisHoursReachVal', { hours: value.toFixed(1) }),
                      name === 'daysToReach' ? t('axisDaysReach') : t('axisHoursReach')
                    ]}
                    contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '12px' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="daysToReach" name={t('axisDaysReach')} stroke="#9179f2" strokeWidth={2} dot={false} />
                  <ReferenceLine y={7} stroke="#e86161" strokeDasharray="3 3" label={{ value: t('ref1Week'), fill: '#e86161', fontSize: 10 }} />
                  <ReferenceLine y={30} stroke="#e5a440" strokeDasharray="3 3" label={{ value: t('ref1Month'), fill: '#e5a440', fontSize: 10 }} />
                  <ReferenceLine y={90} stroke="#3db88a" strokeDasharray="3 3" label={{ value: t('ref3Months'), fill: '#3db88a', fontSize: 10 }} />
                  <ReferenceLine y={180} stroke="#5a9cf5" strokeDasharray="3 3" label={{ value: t('ref6Months'), fill: '#5a9cf5', fontSize: 10 }} />
                  <ReferenceLine y={365} stroke="#9179f2" strokeDasharray="3 3" label={{ value: t('ref1Year'), fill: '#9179f2', fontSize: 10 }} />
                  <ReferenceLine y={1095} stroke="#e87aa8" strokeDasharray="3 3" label={{ value: t('ref3Years'), fill: '#e87aa8', fontSize: 10 }} />
                </LineChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                  <XAxis
                    dataKey="level"
                    label={{ value: t('levelUnit'), position: 'insideBottomRight', offset: -5, fill: 'var(--text-secondary)' }}
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  />
                  <YAxis
                    domain={['dataMin', 'dataMax']}
                    label={{ value: viewMode === 'growthRate' ? t('yLabelPercent') : t('yLabelValue'), angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)' }}
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    tickFormatter={(value) => viewMode === 'growthRate' ? `${value.toFixed(0)}%` : value.toLocaleString()}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      viewMode === 'growthRate' ? `${value.toFixed(2)}%` : value.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                      name
                    ]}
                    labelFormatter={(label) => `${t('levelUnit')} ${label}`}
                    contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '12px' }}
                  />
                  <Legend />
                  {viewMode === 'curve' && (
                    <Line type="monotone" dataKey="linear" name={t('linear')} stroke={CURVE_COLORS.linear} dot={false} strokeWidth={2} hide={!showCurves.linear} />
                  )}
                  {viewMode === 'curve' && (
                    <Line type="monotone" dataKey="exponential" name={t('exponential')} stroke={CURVE_COLORS.exponential} dot={false} strokeWidth={2} hide={!showCurves.exponential} />
                  )}
                  {viewMode === 'curve' && (
                    <Line type="monotone" dataKey="logarithmic" name={t('logarithmic')} stroke={CURVE_COLORS.logarithmic} dot={false} strokeWidth={2} hide={!showCurves.logarithmic} />
                  )}
                  {viewMode === 'curve' && (
                    <Line type="monotone" dataKey="quadratic" name={t('quadratic')} stroke={CURVE_COLORS.quadratic} dot={false} strokeWidth={2} hide={!showCurves.quadratic} />
                  )}
                  {viewMode === 'curve' && showCustom && (
                    <Line type="monotone" dataKey="custom" name={t('customCurve')} stroke={CURVE_COLORS.custom} dot={false} strokeWidth={2} strokeDasharray="5 5" />
                  )}
                  {viewMode === 'curve' && showSegmented && (
                    <Line type="monotone" dataKey="segmented" name={t('segmentedCurve')} stroke={CURVE_COLORS.segmented} dot={false} strokeWidth={2.5} />
                  )}
                  {viewMode === 'curve' && showDiminishing && (
                    <Line type="monotone" dataKey="diminishing" name={t('harvestDiminishing')} stroke={CURVE_COLORS.diminishing} dot={false} strokeWidth={2} />
                  )}
                  {viewMode === 'curve' && showScenarios && scenarios.filter(s => s.enabled).map(scenario => (
                    <Line
                      key={scenario.id}
                      type="monotone"
                      dataKey={`scenario_${scenario.id}`}
                      name={scenario.name}
                      stroke={scenario.color}
                      dot={false}
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  ))}
                  {viewMode === 'curve' && showSegmented && segments.map((segment, idx) => (
                    idx > 0 ? (
                      <ReferenceLine
                        key={`ref-${segment.id}`}
                        x={segment.startLevel}
                        stroke={CURVE_COLORS.segmented}
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                      />
                    ) : null
                  ))}
                  {viewMode === 'curve' && showDiminishing && (
                    <ReferenceLine y={diminishingConfig.softCap} stroke={CURVE_COLORS.diminishing} strokeDasharray="3 3" strokeOpacity={0.7} />
                  )}
                  {viewMode === 'curve' && showDiminishing && (
                    <ReferenceLine y={diminishingConfig.hardCap} stroke={CURVE_COLORS.diminishing} strokeDasharray="6 3" strokeOpacity={0.7} />
                  )}
                  {viewMode === 'growthRate' && (
                    <Line type="monotone" dataKey="linear" name={t('growthLinear')} stroke={CURVE_COLORS.linear} dot={false} strokeWidth={2} />
                  )}
                  {viewMode === 'growthRate' && (
                    <Line type="monotone" dataKey="exponential" name={t('growthExp')} stroke={CURVE_COLORS.exponential} dot={false} strokeWidth={2} />
                  )}
                  {viewMode === 'growthRate' && (
                    <Line type="monotone" dataKey="logarithmic" name={t('growthLog')} stroke={CURVE_COLORS.logarithmic} dot={false} strokeWidth={2} />
                  )}
                  {viewMode === 'growthRate' && (
                    <Line type="monotone" dataKey="quadratic" name={t('growthQuad')} stroke={CURVE_COLORS.quadratic} dot={false} strokeWidth={2} />
                  )}
                  {viewMode === 'growthRate' && (
                    <ReferenceLine y={growthWarnings.tooFast} stroke="#e86161" strokeDasharray="3 3" label={{ value: t('refSurge'), fill: '#e86161', fontSize: 10 }} />
                  )}
                  {viewMode === 'growthRate' && (
                    <ReferenceLine y={growthWarnings.tooSlow} stroke="#5a9cf5" strokeDasharray="3 3" label={{ value: t('refSlow'), fill: '#5a9cf5', fontSize: 10 }} />
                  )}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* 그래프 확대 모달 */}
        {showChartModal && (
          <div
            className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/75 backdrop-blur-sm"
            onClick={() => setShowChartModal(false)}
          >
            <div
              className="glass-panel w-full max-w-6xl h-[90vh] sm:h-[80vh] flex flex-col rounded-t-2xl sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="glass-panel-header">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${PANEL_COLOR}, ${PANEL_COLOR}cc)` }}
                  >
                    {viewMode === 'curve' && <TrendingUp className="w-4.5 h-4.5 text-white" />}
                    {viewMode === 'growthRate' && <Percent className="w-4.5 h-4.5 text-white" />}
                    {viewMode === 'xpRequired' && <BarChart3 className="w-4.5 h-4.5 text-white" />}
                    {viewMode === 'timeProgress' && <Timer className="w-4.5 h-4.5 text-white" />}
                  </div>
                  <div>
                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {viewMode === 'curve' && t('graphTitle')}
                      {viewMode === 'growthRate' && t('growthAnalysisTitle')}
                      {viewMode === 'xpRequired' && t('headerXpChart')}
                      {viewMode === 'timeProgress' && t('headerTimeProgress')}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {viewMode === 'curve' && t('subCurve')}
                      {viewMode === 'growthRate' && t('subGrowthRate')}
                      {viewMode === 'xpRequired' && t('subXpRequired')}
                      {viewMode === 'timeProgress' && t('subTimeProgress')}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowChartModal(false)} className="glass-button !p-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 p-6">
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                  {viewMode === 'xpRequired' ? (
                    <ComposedChart data={chartData} margin={{ top: 20, right: 60, left: 40, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                      <XAxis dataKey="level" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} label={{ value: t('levelUnit'), position: 'insideBottomRight', offset: -10, fill: 'var(--text-secondary)', fontSize: 14 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickFormatter={(v) => v.toLocaleString()} label={{ value: t('axisLevelUpXp'), angle: -90, position: 'insideLeft', fill: '#e5a440', fontSize: 14 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickFormatter={(v) => v.toLocaleString()} label={{ value: t('cumXpFull'), angle: 90, position: 'insideRight', fill: '#9179f2', fontSize: 14 }} />
                      <Tooltip
                        formatter={(value: number, name: string) => [value.toLocaleString(), name === 'xpRequired' ? t('axisLevelUpXp') : t('axisCumXp')]}
                        contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '12px', fontSize: 14 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 14 }} />
                      <Bar yAxisId="left" dataKey="xpRequired" name={t('axisLevelUpXp')} fill="#e5a440" opacity={0.8} />
                      <Line yAxisId="right" type="monotone" dataKey="cumulativeXP" name={t('axisCumXp')} stroke="#9179f2" strokeWidth={3} dot={false} />
                    </ComposedChart>
                  ) : viewMode === 'timeProgress' ? (
                    <LineChart data={chartData} margin={{ top: 20, right: 40, left: 40, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                      <XAxis dataKey="level" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} label={{ value: t('levelUnit'), position: 'insideBottomRight', offset: -10, fill: 'var(--text-secondary)', fontSize: 14 }} />
                      <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickFormatter={(v) => t('axisDays', { days: v.toFixed(1) })} label={{ value: t('axisDaysReach'), angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 14 }} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          name === 'daysToReach' ? t('axisDaysReachVal', { days: value.toFixed(1) }) : t('axisHoursReachVal', { hours: value.toFixed(1) }),
                          name === 'daysToReach' ? t('axisDaysReach') : t('axisHoursReach')
                        ]}
                        contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '12px', fontSize: 14 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 14 }} />
                      <Line type="monotone" dataKey="daysToReach" name={t('axisDaysReach')} stroke="#9179f2" strokeWidth={3} dot={false} />
                      <ReferenceLine y={7} stroke="#e86161" strokeDasharray="3 3" label={{ value: t('ref1Week'), fill: '#e86161', fontSize: 11 }} />
                      <ReferenceLine y={30} stroke="#e5a440" strokeDasharray="3 3" label={{ value: t('ref1Month'), fill: '#e5a440', fontSize: 11 }} />
                      <ReferenceLine y={90} stroke="#3db88a" strokeDasharray="3 3" label={{ value: t('ref3Months'), fill: '#3db88a', fontSize: 11 }} />
                      <ReferenceLine y={180} stroke="#5a9cf5" strokeDasharray="3 3" label={{ value: t('ref6Months'), fill: '#5a9cf5', fontSize: 11 }} />
                      <ReferenceLine y={365} stroke="#9179f2" strokeDasharray="3 3" label={{ value: t('ref1Year'), fill: '#9179f2', fontSize: 11 }} />
                      <ReferenceLine y={1095} stroke="#e87aa8" strokeDasharray="3 3" label={{ value: t('ref3Years'), fill: '#e87aa8', fontSize: 11 }} />
                      <ReferenceLine y={90} stroke="#3db88a" strokeDasharray="3 3" label={{ value: t('ref3Months'), fill: '#3db88a', fontSize: 12 }} />
                    </LineChart>
                  ) : viewMode === 'growthRate' ? (
                    <LineChart data={chartData} margin={{ top: 20, right: 40, left: 40, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                      <XAxis dataKey="level" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} label={{ value: t('levelUnit'), position: 'insideBottomRight', offset: -10, fill: 'var(--text-secondary)', fontSize: 14 }} />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickFormatter={(v) => `${v.toFixed(0)}%`} label={{ value: t('growthRatePercent'), angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 14 }} />
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
                        labelFormatter={(label) => `${t('levelUnit')} ${label}`}
                        contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '12px', fontSize: 14 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 14 }} />
                      <Line type="monotone" dataKey="linear" name={t('growthLinear')} stroke={CURVE_COLORS.linear} dot={false} strokeWidth={3} />
                      <Line type="monotone" dataKey="exponential" name={t('growthExp')} stroke={CURVE_COLORS.exponential} dot={false} strokeWidth={3} />
                      <Line type="monotone" dataKey="logarithmic" name={t('growthLog')} stroke={CURVE_COLORS.logarithmic} dot={false} strokeWidth={3} />
                      <Line type="monotone" dataKey="quadratic" name={t('growthQuad')} stroke={CURVE_COLORS.quadratic} dot={false} strokeWidth={3} />
                      <ReferenceLine y={growthWarnings.tooFast} stroke="#e86161" strokeDasharray="3 3" label={{ value: t('refSurgeWarn'), fill: '#e86161', fontSize: 12 }} />
                      <ReferenceLine y={growthWarnings.tooSlow} stroke="#5a9cf5" strokeDasharray="3 3" label={{ value: t('refSlowWarn'), fill: '#5a9cf5', fontSize: 12 }} />
                      <ReferenceLine y={10} stroke="#3db88a" strokeDasharray="6 3" strokeOpacity={0.5} label={{ value: t('refOptimal'), fill: '#3db88a', fontSize: 11 }} />
                    </LineChart>
                  ) : (
                    <LineChart data={chartData} margin={{ top: 20, right: 40, left: 40, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                      <XAxis
                        dataKey="level"
                        label={{ value: t('levelUnit'), position: 'insideBottomRight', offset: -10, fill: 'var(--text-secondary)', fontSize: 14 }}
                        tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                      />
                      <YAxis
                        domain={['dataMin', 'dataMax']}
                        label={{ value: t('yLabelValue'), angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 14 }}
                        tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                        tickFormatter={(value) => value.toLocaleString()}
                      />
                      <Tooltip
                        formatter={(value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        labelFormatter={(label) => `${t('levelUnit')} ${label}`}
                        contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '12px', fontSize: 14 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 14 }} />
                      <Line type="monotone" dataKey="linear" name={t('linear')} stroke={CURVE_COLORS.linear} dot={false} strokeWidth={3} hide={!showCurves.linear} />
                      <Line type="monotone" dataKey="exponential" name={t('exponential')} stroke={CURVE_COLORS.exponential} dot={false} strokeWidth={3} hide={!showCurves.exponential} />
                      <Line type="monotone" dataKey="logarithmic" name={t('logarithmic')} stroke={CURVE_COLORS.logarithmic} dot={false} strokeWidth={3} hide={!showCurves.logarithmic} />
                      <Line type="monotone" dataKey="quadratic" name={t('quadratic')} stroke={CURVE_COLORS.quadratic} dot={false} strokeWidth={3} hide={!showCurves.quadratic} />
                      {showCustom && (
                        <Line type="monotone" dataKey="custom" name={t('customCurve')} stroke={CURVE_COLORS.custom} dot={false} strokeWidth={3} strokeDasharray="5 5" />
                      )}
                      {showSegmented && (
                        <Line type="monotone" dataKey="segmented" name={t('segmentedCurve')} stroke={CURVE_COLORS.segmented} dot={false} strokeWidth={3} />
                      )}
                      {showDiminishing && (
                        <Line type="monotone" dataKey="diminishing" name={t('harvestDiminishing')} stroke={CURVE_COLORS.diminishing} dot={false} strokeWidth={3} />
                      )}
                      {showDiminishing && (
                        <ReferenceLine y={diminishingConfig.softCap} stroke={CURVE_COLORS.diminishing} strokeDasharray="3 3" strokeOpacity={0.7} label={{ value: t('softCapLabel'), fill: CURVE_COLORS.diminishing, fontSize: 12 }} />
                      )}
                      {showDiminishing && (
                        <ReferenceLine y={diminishingConfig.hardCap} stroke={CURVE_COLORS.diminishing} strokeDasharray="6 3" strokeOpacity={0.7} label={{ value: t('hardCapLabel'), fill: CURVE_COLORS.diminishing, fontSize: 12 }} />
                      )}
                      {showScenarios && scenarios.filter(s => s.enabled).map(scenario => (
                        <Line
                          key={scenario.id}
                          type="monotone"
                          dataKey={`scenario_${scenario.id}`}
                          name={scenario.name}
                          stroke={scenario.color}
                          dot={false}
                          strokeWidth={3}
                          strokeDasharray="4 2"
                        />
                      ))}
                      {showSegmented && segments.map((segment, idx) => (
                        idx > 0 ? (
                          <ReferenceLine
                            key={`ref-modal-${segment.id}`}
                            x={segment.startLevel}
                            stroke={CURVE_COLORS.segmented}
                            strokeDasharray="3 3"
                            strokeOpacity={0.5}
                            label={{ value: t('segmentLabel', { n: idx + 1 }), fill: CURVE_COLORS.segmented, fontSize: 11 }}
                          />
                        ) : null
                      ))}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
              {/* 모달 하단 요약 정보 */}
              <div className="px-6 pb-6">
                <div className="glass-section p-3 flex flex-wrap gap-4 justify-center text-sm">
                  {viewMode === 'curve' && (
                    <>
                      <span style={{ color: 'var(--text-secondary)' }}>{t('footMaxLevel')}<strong style={{ color: 'var(--text-primary)' }}>{maxLevel}</strong></span>
                      <span style={{ color: 'var(--text-secondary)' }}>{t('footBase')}<strong style={{ color: 'var(--text-primary)' }}>{base.toLocaleString()}</strong></span>
                      <span style={{ color: 'var(--text-secondary)' }}>{t('footRate')}<strong style={{ color: 'var(--text-primary)' }}>{rate}</strong></span>
                    </>
                  )}
                  {viewMode === 'growthRate' && growthStats && (
                    <>
                      <span style={{ color: 'var(--text-secondary)' }}>{t('footAvg')}<strong style={{ color: '#3db88a' }}>{growthStats.avg.toFixed(1)}%</strong></span>
                      <span style={{ color: 'var(--text-secondary)' }}>{t('footMax')}<strong style={{ color: '#e86161' }}>{growthStats.max.toFixed(1)}%</strong></span>
                      <span style={{ color: 'var(--text-secondary)' }}>{t('footMin')}<strong style={{ color: '#5a9cf5' }}>{growthStats.min.toFixed(1)}%</strong></span>
                    </>
                  )}
                  {viewMode === 'xpRequired' && (
                    <>
                      <span style={{ color: 'var(--text-secondary)' }}>{t('footFormula')}<strong style={{ color: '#e5a440' }}>{xpConfig.curveType === 'polynomial' ? `${xpConfig.baseXP} × level^${xpConfig.exponent}` : xpConfig.curveType === 'exponential' ? `${xpConfig.baseXP} × ${xpConfig.exponent}^level` : 'RuneScape'}</strong></span>
                      <span style={{ color: 'var(--text-secondary)' }}><strong style={{ color: '#9179f2' }}>{chartData[chartData.length - 1]?.cumulativeXP?.toLocaleString() || 0}</strong></span>
                    </>
                  )}
                  {viewMode === 'timeProgress' && timeStats && (
                    <>
                      <span style={{ color: 'var(--text-secondary)' }}>{t('footTargetLvCustom', { level: timeConfig.targetLevel })}<strong style={{ color: '#9179f2' }}>{t('daysExpected', { days: timeStats.daysToTarget.toFixed(1) })}</strong></span>
                      <span style={{ color: 'var(--text-secondary)' }}>{t('footXpPerHour')}<strong style={{ color: '#e5a440' }}>{timeConfig.xpPerHour.toLocaleString()}</strong></span>
                      <span style={{ color: 'var(--text-secondary)' }}>{t('footDailyPlay')}<strong style={{ color: '#3db88a' }}>{t('footHoursUnit', { hours: timeConfig.playHoursPerDay })}</strong></span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 레벨별 값 미리보기 */}
        {viewMode === 'curve' && (
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('levelPreview')}</span>
              <NumberInput
                value={previewLevel}
                onChange={setPreviewLevel}
                max={maxLevel}
                className="glass-input w-20 text-sm text-center"
              />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('levelUnit')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {showCurves.linear && (
                <PreviewCard color={CURVE_COLORS.linear} label={t('linear')} value={previewValues.linear} />
              )}
              {showCurves.exponential && (
                <PreviewCard color={CURVE_COLORS.exponential} label={t('exponential')} value={previewValues.exponential} />
              )}
              {showCurves.logarithmic && (
                <PreviewCard color={CURVE_COLORS.logarithmic} label={t('logarithmic')} value={previewValues.logarithmic} />
              )}
              {showCurves.quadratic && (
                <PreviewCard color={CURVE_COLORS.quadratic} label={t('quadratic')} value={previewValues.quadratic} />
              )}
              {showCustom && previewValues.custom !== null && (
                <PreviewCard color={CURVE_COLORS.custom} label={t('customCurve')} value={previewValues.custom} />
              )}
              {showSegmented && previewValues.segmented !== null && (
                <PreviewCard color={CURVE_COLORS.segmented} label={t('segmentedCurve')} value={previewValues.segmented} />
              )}
              {showDiminishing && previewValues.diminishing !== null && (
                <PreviewCard color={CURVE_COLORS.diminishing} label={t('harvestDiminishing')} value={previewValues.diminishing} />
              )}
            </div>
          </div>
        )}
      </div>
    </PanelShell>
  );
}

// 토글 스위치 컴포넌트
// ToggleSwitch / PreviewCard / NumberInput → growth-curve-chart/components.tsx
