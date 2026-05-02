/**
 * useDifficultyCurve - 난이도 커브 상태 관리 훅
 *
 * 현업 게임 디자이너 수준의 난이도 곡선 설계 지원:
 * - 다양한 곡선 타입 (선형, 지수, 로그, 시그모이드, 톱니)
 * - 플로우 존 시각화 (Csikszentmihalyi의 Flow Theory)
 * - 휴식 포인트 설계
 * - 동적 난이도 조절 시뮬레이션
 */

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';

// 곡선 타입 정의
export type CurveType = 'linear' | 'exponential' | 'logarithmic' | 'sigmoid' | 'sawtooth';

// 곡선 타입 정보
export const CURVE_TYPES: Record<CurveType, {
  name: string;
  description: string;
  formula: string;
}> = {
  linear: {
    name: 'Linear',
    description: 'Constant growth. Predictable progression.',
    formula: 'f(x) = base + rate × x',
  },
  exponential: {
    name: 'Exponential',
    description: 'Slow early, sharp late. RPG / idle games.',
    formula: 'f(x) = base × rate^x',
  },
  logarithmic: {
    name: 'Logarithmic',
    description: 'Sharp early, eased late. Skill-based games.',
    formula: 'f(x) = base + rate × log(x)',
  },
  sigmoid: {
    name: 'S-Curve',
    description: 'S-shaped. Eased early/late, sharp middle. Story games.',
    formula: 'f(x) = x^λ / (x^λ + σ^λ)',
  },
  sawtooth: {
    name: 'Sawtooth',
    description: 'Periodic rise and reset. New-mechanic introduction.',
    formula: 'f(x) = base + (x mod period) × rate',
  },
};

// 플로우 존 정의 (Csikszentmihalyi의 Flow Theory)
export type FlowZone = 'boredom' | 'flow' | 'anxiety';

export interface FlowZoneConfig {
  boredomThreshold: number;  // 이 비율 이상이면 지루함 (기본: 1.4)
  anxietyThreshold: number;  // 이 비율 이하면 불안함 (기본: 0.7)
}

// 휴식 포인트 정의
export interface RestPoint {
  stage: number;
  duration: number; // 휴식 구간 스테이지 수
  reason: string;   // 휴식 이유 (보스 전, 새 메카닉 등)
}

// 동적 난이도 조절 (DDA) 설정
export interface DDAConfig {
  enabled: boolean;
  adjustmentRate: number;    // 조정 비율 (0.1 = 10%)
  winStreakThreshold: number; // 연승 감지 기준
  lossStreakThreshold: number; // 연패 감지 기준
  maxAdjustment: number;     // 최대 조정 범위
}

// 벽 스테이지 타입 (게임 디자인 이론 기반)
export type WallType = 'boss' | 'gear' | 'level' | 'time';

// 벽 타입 정보
export const WALL_TYPES: Record<WallType, {
  name: string;
  description: string;
  defaultIntensity: number;
  defaultStuckTime: number;
}> = {
  boss: {
    name: 'Boss wall',
    description: 'Powerful boss. Requires pattern learning.',
    defaultIntensity: 1.8,
    defaultStuckTime: 2,
  },
  gear: {
    name: 'Gear wall',
    description: 'Gear upgrades / drops needed. Farming gate.',
    defaultIntensity: 1.5,
    defaultStuckTime: 4,
  },
  level: {
    name: 'Level wall',
    description: 'Level up needed. XP grind.',
    defaultIntensity: 1.3,
    defaultStuckTime: 3,
  },
  time: {
    name: 'Time wall',
    description: 'Soft gate. Wait period.',
    defaultIntensity: 1.2,
    defaultStuckTime: 24,
  },
};

// 벽 스테이지 데이터 (상세 설정 가능)
export interface WallData {
  stage: number;
  type: WallType;
  intensity: number;        // 난이도 배율 (1.2 ~ 2.0)
  expectedStuckTime: number; // 예상 막히는 시간 (시간 단위)
  description?: string;     // 벽 설명 (선택)
}

// 난이도 구간 정의
export interface DifficultySegment {
  stage: number;
  playerPower: number;
  enemyPower: number;
  ratio: number;
  type: 'easy' | 'normal' | 'wall' | 'reward';
  milestone?: string;
  flowZone: FlowZone;
  isRestPoint: boolean;
  ddaAdjustment: number;
}

export interface MilestoneData {
  name: string;
  powerBonus: number;
}

// 기본 난이도 곡선 프리셋
export const CURVE_PRESETS = {
  casual: {
    name: 'Casual',
    description: 'Slow growth, few walls',
    playerGrowth: 1.12,
    enemyGrowth: 1.08,
    wallInterval: 50,
  },
  balanced: {
    name: 'Balanced',
    description: 'Moderate, walls every 10 stages',
    playerGrowth: 1.10,
    enemyGrowth: 1.10,
    wallInterval: 10,
  },
  hardcore: {
    name: 'Hardcore',
    description: 'Fast growth, frequent walls',
    playerGrowth: 1.08,
    enemyGrowth: 1.12,
    wallInterval: 5,
  },
};

// 플레이타임 목표
export const PLAYTIME_TARGETS = {
  '30min': { name: '30 min/day', stagesPerDay: 10, wallInterval: 5, targetDaysPerWall: 1 },
  '1hr': { name: '1 hr/day', stagesPerDay: 20, wallInterval: 10, targetDaysPerWall: 1 },
  '2hr': { name: '2 hr/day', stagesPerDay: 40, wallInterval: 20, targetDaysPerWall: 1 },
  '4hr': { name: '4 hr/day', stagesPerDay: 80, wallInterval: 40, targetDaysPerWall: 1 },
};

export type PresetKey = keyof typeof CURVE_PRESETS;
export type PlaytimeKey = keyof typeof PLAYTIME_TARGETS;

// 곡선 함수들
export const curveFunctions = {
  linear: (x: number, base: number, rate: number) => base + rate * x,
  exponential: (x: number, base: number, rate: number) => base * Math.pow(rate, x),
  logarithmic: (x: number, base: number, rate: number) => base + rate * Math.log(x + 1) * 10,
  sigmoid: (x: number, base: number, rate: number, maxStage: number) => {
    // S자 곡선: 초반/후반 완만, 중반 급격
    const midpoint = maxStage / 2;
    const steepness = rate / 10;
    const normalizedX = (x - midpoint) / midpoint;
    const sigmoidValue = 1 / (1 + Math.exp(-normalizedX * steepness * 10));
    return base + (sigmoidValue * base * rate);
  },
  sawtooth: (x: number, base: number, rate: number, period: number) => {
    // 톱니파: 주기적으로 상승 후 하락
    const withinPeriod = x % period;
    const cycleNumber = Math.floor(x / period);
    const baseForCycle = base * Math.pow(1.5, cycleNumber); // 각 주기마다 기본값 증가
    return baseForCycle + (withinPeriod / period) * baseForCycle * rate;
  },
};

export function useDifficultyCurve() {
  const t = useTranslations('difficultyCurve.milestones');
  const [preset, setPreset] = useState<PresetKey>('balanced');
  const [playtime, setPlaytime] = useState<PlaytimeKey>('1hr');
  const [maxStage, setMaxStage] = useState(100);

  // 벽 스테이지 데이터 (상세 설정 포함)
  const [wallData, setWallData] = useState<WallData[]>([
    { stage: 10, type: 'gear', intensity: 1.5, expectedStuckTime: 2 },
    { stage: 30, type: 'boss', intensity: 1.8, expectedStuckTime: 3 },
    { stage: 50, type: 'gear', intensity: 1.6, expectedStuckTime: 4 },
    { stage: 100, type: 'boss', intensity: 2.0, expectedStuckTime: 6 },
  ]);

  // 호환성을 위한 wallStages 계산
  const wallStages = useMemo(() => wallData.map(w => w.stage), [wallData]);

  const [milestones, setMilestones] = useState<Record<number, MilestoneData>>({
    10: { name: t('gear'), powerBonus: 30 },
    30: { name: t('skill'), powerBonus: 40 },
    50: { name: t('awaken'), powerBonus: 50 },
    100: { name: t('endgame'), powerBonus: 0 },
  });

  // 곡선 타입 상태
  const [curveType, setCurveType] = useState<CurveType>('exponential');

  // 톱니파 주기 (sawtooth 곡선용)
  const [sawtoothPeriod, setSawtoothPeriod] = useState(10);

  // 플로우 존 설정
  const [flowZoneConfig, setFlowZoneConfig] = useState<FlowZoneConfig>({
    boredomThreshold: 1.3,  // 플레이어가 1.3배 이상 강하면 지루함
    anxietyThreshold: 0.8,  // 플레이어가 0.8배 이하면 불안/좌절
  });

  // 플로우 존 시각화 표시 여부
  const [showFlowZones, setShowFlowZones] = useState(true);

  // 휴식 포인트 (기본: 비어있음 - 사용자가 필요시 추가)
  const [restPoints, setRestPoints] = useState<RestPoint[]>([]);

  // 동적 난이도 조절 설정
  const [ddaConfig, setDDAConfig] = useState<DDAConfig>({
    enabled: false,
    adjustmentRate: 0.1,     // 10%씩 조정
    winStreakThreshold: 5,   // 5연승 시 적용
    lossStreakThreshold: 3,  // 3연패 시 적용
    maxAdjustment: 0.25,     // 최대 25% 조정
  });

  // DDA 시뮬레이션 상태 (연승/연패 시뮬레이션)
  const [ddaSimulation, setDDASimulation] = useState<{
    currentStreak: number;
    streakType: 'win' | 'loss' | 'none';
  }>({ currentStreak: 0, streakType: 'none' });

  // 전체화면 모달 상태
  const [showFullscreen, setShowFullscreen] = useState(false);

  // 줌/팬 상태
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // 비율 바 호버 상태
  const [hoveredStage, setHoveredStage] = useState<number | null>(null);

  const config = CURVE_PRESETS[preset];
  const targetPlaytime = PLAYTIME_TARGETS[playtime];

  // 줌 핸들러
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev * 1.3, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev / 1.3, 0.5));
  }, []);

  const handleResetView = useCallback(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // 팬 핸들러
  const handlePanStart = useCallback((e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  }, [panOffset]);

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  }, [isPanning, panStart]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // 휠 줌
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoomLevel(prev => Math.min(prev * 1.1, 5));
    } else {
      setZoomLevel(prev => Math.max(prev / 1.1, 0.5));
    }
  }, []);

  // 휴식 포인트 체크 헬퍼
  const isRestPointStage = useCallback((stage: number): RestPoint | undefined => {
    return restPoints.find(rp => stage >= rp.stage && stage < rp.stage + rp.duration);
  }, [restPoints]);

  // 플로우 존 계산 헬퍼
  const calculateFlowZone = useCallback((ratio: number): FlowZone => {
    if (ratio >= flowZoneConfig.boredomThreshold) return 'boredom';
    if (ratio <= flowZoneConfig.anxietyThreshold) return 'anxiety';
    return 'flow';
  }, [flowZoneConfig]);

  // DDA 조정값 계산
  const calculateDDAadjustment = useCallback((stage: number): number => {
    if (!ddaConfig.enabled) return 0;

    const { currentStreak, streakType } = ddaSimulation;

    if (streakType === 'win' && currentStreak >= ddaConfig.winStreakThreshold) {
      // 연승 시 난이도 증가 (적 강화)
      const adjustment = Math.min(
        (currentStreak - ddaConfig.winStreakThreshold + 1) * ddaConfig.adjustmentRate,
        ddaConfig.maxAdjustment
      );
      return -adjustment; // 음수 = 플레이어에게 불리
    } else if (streakType === 'loss' && currentStreak >= ddaConfig.lossStreakThreshold) {
      // 연패 시 난이도 감소 (적 약화)
      const adjustment = Math.min(
        (currentStreak - ddaConfig.lossStreakThreshold + 1) * ddaConfig.adjustmentRate,
        ddaConfig.maxAdjustment
      );
      return adjustment; // 양수 = 플레이어에게 유리
    }

    return 0;
  }, [ddaConfig, ddaSimulation]);

  // 난이도 곡선 데이터 생성
  const curveData = useMemo(() => {
    const data: DifficultySegment[] = [];
    let playerPower = 100;
    let enemyPower = 100;

    for (let stage = 1; stage <= maxStage; stage++) {
      const isWall = wallStages.includes(stage);
      const milestone = milestones[stage];
      const restPoint = isRestPointStage(stage);

      // 곡선 타입에 따른 성장률 계산
      let effectivePlayerGrowth = config.playerGrowth;
      let effectiveEnemyGrowth = config.enemyGrowth;

      switch (curveType) {
        case 'linear':
          // 선형: 일정한 증가
          effectivePlayerGrowth = 1 + (config.playerGrowth - 1);
          effectiveEnemyGrowth = 1 + (config.enemyGrowth - 1);
          break;
        case 'exponential':
          // 지수: 기본 동작 (원래 방식)
          break;
        case 'logarithmic':
          // 로그: 후반에 성장률 감소
          const logFactor = 1 / Math.log(stage + 2);
          effectivePlayerGrowth = 1 + (config.playerGrowth - 1) * logFactor * 2;
          effectiveEnemyGrowth = 1 + (config.enemyGrowth - 1) * logFactor * 2;
          break;
        case 'sigmoid':
          // 시그모이드: S자 곡선
          const midpoint = maxStage / 2;
          const distance = Math.abs(stage - midpoint) / midpoint;
          const sigmoidFactor = 1 - distance * 0.5; // 중간에서 최대
          effectivePlayerGrowth = 1 + (config.playerGrowth - 1) * sigmoidFactor;
          effectiveEnemyGrowth = 1 + (config.enemyGrowth - 1) * sigmoidFactor;
          break;
        case 'sawtooth':
          // 톱니: 주기적 하락
          const withinPeriod = stage % sawtoothPeriod;
          if (withinPeriod === 0 && stage > 1) {
            // 주기 시작: 난이도 감소 (새 메카닉 도입)
            effectiveEnemyGrowth = 0.7; // 적 약해짐
          } else {
            const progressInPeriod = withinPeriod / sawtoothPeriod;
            effectiveEnemyGrowth = 1 + (config.enemyGrowth - 1) * (1 + progressInPeriod);
          }
          break;
      }

      // 휴식 포인트에서는 난이도 증가 억제
      if (restPoint) {
        effectiveEnemyGrowth = 1.0; // 적 성장 정지
        effectivePlayerGrowth = config.playerGrowth; // 플레이어는 계속 성장
      }

      // 벽 스테이지: 해당 벽의 intensity 사용
      const wallInfo = wallData.find(w => w.stage === stage);
      if (wallInfo) {
        enemyPower *= wallInfo.intensity;
      }

      if (milestone && milestone.powerBonus > 0) {
        playerPower *= (1 + milestone.powerBonus / 100);
      }

      // DDA 조정 적용
      const ddaAdjustment = calculateDDAadjustment(stage);
      const adjustedRatio = playerPower / enemyPower * (1 + ddaAdjustment);

      const ratio = playerPower / enemyPower;
      let type: DifficultySegment['type'] = 'normal';
      if (isWall || adjustedRatio < 0.8) type = 'wall';
      else if (adjustedRatio > 1.3) type = 'easy';
      else if (milestone) type = 'reward';

      // 플로우 존 계산
      const flowZone = calculateFlowZone(adjustedRatio);

      data.push({
        stage,
        playerPower: Math.round(playerPower),
        enemyPower: Math.round(enemyPower),
        ratio: Math.round(ratio * 100) / 100,
        type,
        milestone: milestone?.name,
        flowZone,
        isRestPoint: !!restPoint,
        ddaAdjustment: Math.round(ddaAdjustment * 100) / 100,
      });

      playerPower *= effectivePlayerGrowth;
      enemyPower *= effectiveEnemyGrowth;
    }

    return data;
  }, [maxStage, wallStages, milestones, config, curveType, sawtoothPeriod, isRestPointStage, calculateFlowZone, calculateDDAadjustment]);

  // 예상 도달 일수 계산 (벽별 예상 막힘 시간 반영)
  const estimatedDays = useMemo(() => {
    const result: Record<number, number> = {};
    let totalStages = 0;
    let totalHours = 0;
    const hoursPerDay = parseInt(playtime.replace(/[^0-9]/g, '')) || 1; // 일일 플레이 시간

    for (const segment of curveData) {
      totalStages++;
      // 스테이지당 소요 시간 (플레이타임 기준)
      const hoursPerStage = hoursPerDay / targetPlaytime.stagesPerDay;
      totalHours += hoursPerStage;

      // 벽 스테이지에서 추가 시간 (expectedStuckTime 사용)
      const wallInfo = wallData.find(w => w.stage === segment.stage);
      if (wallInfo) {
        totalHours += wallInfo.expectedStuckTime;
      }

      // 일수로 환산 (일일 플레이시간 기준)
      result[segment.stage] = Math.ceil(totalHours / hoursPerDay);
    }

    return result;
  }, [curveData, targetPlaytime, wallData, playtime]);

  // 호버된 스테이지 데이터
  const hoveredData = hoveredStage !== null ? curveData.find(d => d.stage === hoveredStage) ?? null : null;

  // 벽 스테이지 추가 (기본 타입과 설정으로)
  const addWallStage = (stage: number, type: WallType = 'gear') => {
    if (!wallStages.includes(stage)) {
      const typeInfo = WALL_TYPES[type];
      const newWall: WallData = {
        stage,
        type,
        intensity: typeInfo.defaultIntensity,
        expectedStuckTime: typeInfo.defaultStuckTime,
      };
      setWallData(prev => [...prev, newWall].sort((a, b) => a.stage - b.stage));
    }
  };

  // 벽 스테이지 제거
  const removeWallStage = (stage: number) => {
    setWallData(prev => prev.filter(w => w.stage !== stage));
  };

  // 벽 스테이지 업데이트
  const updateWallStage = useCallback((stage: number, updates: Partial<WallData>) => {
    setWallData(prev => prev.map(w =>
      w.stage === stage ? { ...w, ...updates } : w
    ));
  }, []);

  // 벽 타입 변경 시 기본값으로 intensity와 stuckTime 업데이트
  const changeWallType = useCallback((stage: number, newType: WallType) => {
    const typeInfo = WALL_TYPES[newType];
    setWallData(prev => prev.map(w =>
      w.stage === stage ? {
        ...w,
        type: newType,
        intensity: typeInfo.defaultIntensity,
        expectedStuckTime: typeInfo.defaultStuckTime,
      } : w
    ));
  }, []);

  const generateRecommendedWalls = () => {
    const interval = targetPlaytime.wallInterval;
    const wallStagesList: number[] = [];
    const firstWall = Math.max(interval, 10);

    for (let stage = firstWall; stage <= maxStage; stage += interval) {
      wallStagesList.push(stage);
    }

    if (!wallStagesList.includes(maxStage)) {
      wallStagesList.push(maxStage);
    }

    // 게임 디자인 이론에 따른 벽 타입 패턴
    // 초반: 장비 벽 → 중반: 보스/레벨 교차 → 후반: 보스 벽
    const newWallData: WallData[] = wallStagesList.map((stage, index) => {
      const progress = stage / maxStage;
      let type: WallType;
      let intensity: number;
      let expectedStuckTime: number;

      if (progress <= 0.2) {
        // 초반 20%: 장비 벽 (낮은 강도)
        type = 'gear';
        intensity = 1.3 + (progress * 0.5);
        expectedStuckTime = 2;
      } else if (progress <= 0.5) {
        // 중반 20~50%: 레벨/장비 교차
        type = index % 2 === 0 ? 'level' : 'gear';
        intensity = 1.4 + (progress * 0.4);
        expectedStuckTime = 3;
      } else if (progress <= 0.8) {
        // 중후반 50~80%: 보스/장비 교차
        type = index % 2 === 0 ? 'boss' : 'gear';
        intensity = 1.5 + (progress * 0.3);
        expectedStuckTime = 4;
      } else {
        // 후반 80%+: 보스 벽 (높은 강도)
        type = 'boss';
        intensity = 1.8 + ((progress - 0.8) * 1.0);
        expectedStuckTime = 6;
      }

      // 마지막 스테이지는 항상 보스 (최종 보스)
      if (stage === maxStage) {
        type = 'boss';
        intensity = 2.0;
        expectedStuckTime = 8;
      }

      return {
        stage,
        type,
        intensity: Math.round(intensity * 10) / 10,
        expectedStuckTime,
      };
    });

    setWallData(newWallData);

    const newMilestones: Record<number, MilestoneData> = {};
    const milestoneTemplates: { name: string; powerBonus: number }[] = [
      { name: t('gear'), powerBonus: 30 },
      { name: t('skill'), powerBonus: 40 },
      { name: t('pet'), powerBonus: 25 },
      { name: t('awaken'), powerBonus: 50 },
      { name: t('guild'), powerBonus: 20 },
      { name: t('pvp'), powerBonus: 15 },
      { name: t('raid'), powerBonus: 35 },
      { name: t('endgame'), powerBonus: 0 },
    ];

    wallStagesList.forEach((wall, index) => {
      if (index < milestoneTemplates.length) {
        newMilestones[wall] = milestoneTemplates[index];
      }
    });

    setMilestones(newMilestones);
  };

  const updateMilestone = (stage: number, name: string, powerBonus?: number) => {
    if (name.trim()) {
      const existing = milestones[stage];
      setMilestones({
        ...milestones,
        [stage]: {
          name,
          powerBonus: powerBonus !== undefined ? powerBonus : (existing?.powerBonus ?? 30)
        }
      });
    } else {
      const newMilestones = { ...milestones };
      delete newMilestones[stage];
      setMilestones(newMilestones);
    }
  };

  const updateMilestonePowerBonus = (stage: number, powerBonus: number) => {
    const existing = milestones[stage];
    if (existing) {
      setMilestones({
        ...milestones,
        [stage]: { ...existing, powerBonus }
      });
    }
  };

  // 휴식 포인트 추가/제거
  const restPointDefault = t('restPoint');
  const addRestPoint = useCallback((stage: number, duration: number = 1, reason?: string) => {
    setRestPoints(prev => [...prev, { stage, duration, reason: reason ?? restPointDefault }].sort((a, b) => a.stage - b.stage));
  }, [restPointDefault]);

  const removeRestPoint = useCallback((stage: number) => {
    setRestPoints(prev => prev.filter(rp => rp.stage !== stage));
  }, []);

  const updateRestPoint = useCallback((stage: number, updates: Partial<RestPoint>) => {
    setRestPoints(prev => prev.map(rp =>
      rp.stage === stage ? { ...rp, ...updates } : rp
    ));
  }, []);

  // DDA 시뮬레이션 조작
  const simulateWinStreak = useCallback((count: number) => {
    setDDASimulation({ currentStreak: count, streakType: 'win' });
  }, []);

  const simulateLossStreak = useCallback((count: number) => {
    setDDASimulation({ currentStreak: count, streakType: 'loss' });
  }, []);

  const resetDDASimulation = useCallback(() => {
    setDDASimulation({ currentStreak: 0, streakType: 'none' });
  }, []);

  // 플로우 존 통계
  const flowZoneStats = useMemo(() => {
    const stats = { boredom: 0, flow: 0, anxiety: 0 };
    curveData.forEach(d => {
      stats[d.flowZone]++;
    });
    return {
      ...stats,
      boredomPercent: Math.round(stats.boredom / curveData.length * 100),
      flowPercent: Math.round(stats.flow / curveData.length * 100),
      anxietyPercent: Math.round(stats.anxiety / curveData.length * 100),
    };
  }, [curveData]);

  return {
    // 상태
    preset,
    setPreset,
    playtime,
    setPlaytime,
    maxStage,
    setMaxStage,
    wallStages,
    milestones,
    showFullscreen,
    setShowFullscreen,
    zoomLevel,
    panOffset,
    isPanning,
    hoveredStage,
    setHoveredStage,
    curveData,
    estimatedDays,
    hoveredData,
    config,
    targetPlaytime,

    // 곡선 타입
    curveType,
    setCurveType,
    sawtoothPeriod,
    setSawtoothPeriod,

    // 플로우 존
    flowZoneConfig,
    setFlowZoneConfig,
    showFlowZones,
    setShowFlowZones,
    flowZoneStats,

    // 휴식 포인트
    restPoints,
    addRestPoint,
    removeRestPoint,
    updateRestPoint,

    // DDA
    ddaConfig,
    setDDAConfig,
    ddaSimulation,
    simulateWinStreak,
    simulateLossStreak,
    resetDDASimulation,

    // 벽 스테이지 데이터
    wallData,

    // 액션
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    handleWheel,
    addWallStage,
    removeWallStage,
    updateWallStage,
    changeWallType,
    generateRecommendedWalls,
    updateMilestone,
    updateMilestonePowerBonus,
  };
}
