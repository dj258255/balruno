/**
 * Economy Simulator - Faucet/Sink Balance Calculator
 * Based on game economy design principles from industry best practices
 *
 * References:
 * - Department of Play: https://departmentofplay.net/the-principles-of-building-a-game-economy/
 * - Machinations.io: https://machinations.io/
 * - ThinkingData: Real-time resource monitoring
 * - Unity Game Economy Guide: https://unity.com/how-to/design-balanced-in-game-economy-guide-part-3
 * - GDKeys Economic Systems: https://gdkeys.com/keys-to-economic-systems/
 */

// ========================================
// 온라인 게임 경제 (기존)
// ========================================

// Faucet (자원 생성원)
export interface Faucet {
  id: string;
  name: string;
  ratePerHour: number;      // 시간당 생성량
  playerPercentage: number; // 이 활동을 하는 플레이어 비율 (0-1)
  level?: number;           // 레벨에 따른 조정
  notes?: string;
}

// Sink (자원 소모처)
export interface Sink {
  id: string;
  name: string;
  costPerUse: number;       // 1회 사용 비용
  usesPerHour: number;      // 시간당 사용 횟수
  playerPercentage: number; // 이 활동을 하는 플레이어 비율 (0-1)
  isRequired: boolean;      // 필수 소모인지 (수리비 등)
  notes?: string;
}

// 경제 시뮬레이션 설정
export interface EconomyConfig {
  currencyName: string;
  playerCount: number;
  simulationDays: number;
  initialSupply: number;
  targetInflationRate: number; // 목표 인플레이션율 (예: 0.02 = 2%)
}

// 시뮬레이션 결과
export interface EconomyResult {
  // 기본 통계
  totalFaucetPerHour: number;
  totalSinkPerHour: number;
  netFlowPerHour: number;

  // 균형 지표
  faucetSinkRatio: number;      // Faucet/Sink 비율 (1.0이 이상적)
  inflationRate: number;        // 예상 인플레이션율
  daysToDouble: number | null;  // 통화량 2배 되는 데 걸리는 일수

  // 시간별 예측
  supplyOverTime: { day: number; supply: number; inflation: number }[];

  // 핀치 포인트 분석
  pinchPointAnalysis: {
    isHealthy: boolean;
    recommendation: string;
    severity: 'good' | 'warning' | 'critical';
  };

  // 개별 항목 분석
  faucetBreakdown: { name: string; contribution: number; percentage: number }[];
  sinkBreakdown: { name: string; contribution: number; percentage: number }[];

  // 위험 요소
  warnings: string[];
}

/**
 * 경제 시뮬레이션 실행
 */
export function simulateEconomy(
  faucets: Faucet[],
  sinks: Sink[],
  config: EconomyConfig
): EconomyResult {
  const warnings: string[] = [];

  // 시간당 총 Faucet 계산 (플레이어 전체 기준)
  const faucetBreakdown = faucets.map(f => {
    const contribution = f.ratePerHour * f.playerPercentage * config.playerCount;
    return {
      name: f.name,
      contribution,
      percentage: 0 // 나중에 계산
    };
  });

  const totalFaucetPerHour = faucetBreakdown.reduce((sum, f) => sum + f.contribution, 0);

  // Faucet 퍼센티지 계산
  faucetBreakdown.forEach(f => {
    f.percentage = totalFaucetPerHour > 0 ? (f.contribution / totalFaucetPerHour) * 100 : 0;
  });

  // 시간당 총 Sink 계산
  const sinkBreakdown = sinks.map(s => {
    const contribution = s.costPerUse * s.usesPerHour * s.playerPercentage * config.playerCount;
    return {
      name: s.name,
      contribution,
      percentage: 0
    };
  });

  const totalSinkPerHour = sinkBreakdown.reduce((sum, s) => sum + s.contribution, 0);

  // Sink 퍼센티지 계산
  sinkBreakdown.forEach(s => {
    s.percentage = totalSinkPerHour > 0 ? (s.contribution / totalSinkPerHour) * 100 : 0;
  });

  // 순 유입량
  const netFlowPerHour = totalFaucetPerHour - totalSinkPerHour;

  // Faucet/Sink 비율
  const faucetSinkRatio = totalSinkPerHour > 0
    ? totalFaucetPerHour / totalSinkPerHour
    : totalFaucetPerHour > 0 ? Infinity : 1;

  // 인플레이션율 계산 (일간 기준)
  const dailyNetFlow = netFlowPerHour * 24;
  const inflationRate = config.initialSupply > 0
    ? dailyNetFlow / config.initialSupply
    : 0;

  // 통화량 2배 걸리는 일수 (복리 기준)
  let daysToDouble: number | null = null;
  if (inflationRate > 0) {
    daysToDouble = Math.log(2) / Math.log(1 + inflationRate);
  }

  // 시간별 예측
  const supplyOverTime: { day: number; supply: number; inflation: number }[] = [];
  let currentSupply = config.initialSupply;

  for (let day = 0; day <= config.simulationDays; day++) {
    const dailyInflation = currentSupply > 0
      ? (dailyNetFlow / currentSupply) * 100
      : 0;

    supplyOverTime.push({
      day,
      supply: Math.round(currentSupply),
      inflation: dailyInflation
    });

    currentSupply += dailyNetFlow;
    if (currentSupply < 0) currentSupply = 0;
  }

  // 핀치 포인트 분석
  let pinchPointAnalysis: EconomyResult['pinchPointAnalysis'];

  if (faucetSinkRatio >= 0.95 && faucetSinkRatio <= 1.05) {
    pinchPointAnalysis = {
      isHealthy: true,
      recommendation: '균형 잡힌 경제입니다. 현재 설정을 유지하세요.',
      severity: 'good'
    };
  } else if (faucetSinkRatio > 1.05 && faucetSinkRatio <= 1.2) {
    pinchPointAnalysis = {
      isHealthy: true,
      recommendation: '약간의 인플레이션이 있습니다. 장기적으로 Sink를 추가하는 것을 고려하세요.',
      severity: 'warning'
    };
  } else if (faucetSinkRatio > 1.2) {
    pinchPointAnalysis = {
      isHealthy: false,
      recommendation: '심각한 인플레이션 위험! Sink를 대폭 추가하거나 Faucet을 줄여야 합니다.',
      severity: 'critical'
    };
    warnings.push(`높은 인플레이션 위험: Faucet이 Sink보다 ${((faucetSinkRatio - 1) * 100).toFixed(0)}% 많습니다.`);
  } else if (faucetSinkRatio < 0.95 && faucetSinkRatio >= 0.8) {
    pinchPointAnalysis = {
      isHealthy: true,
      recommendation: '약간의 디플레이션이 있습니다. 플레이어가 자원 부족을 느낄 수 있습니다.',
      severity: 'warning'
    };
  } else {
    pinchPointAnalysis = {
      isHealthy: false,
      recommendation: '심각한 디플레이션 위험! 플레이어가 진행에 어려움을 겪을 수 있습니다.',
      severity: 'critical'
    };
    warnings.push(`높은 디플레이션 위험: Sink가 Faucet보다 ${((1 - faucetSinkRatio) * 100).toFixed(0)}% 많습니다.`);
  }

  // 추가 경고
  if (faucets.length === 0) {
    warnings.push('Faucet이 없습니다. 자원 생성원을 추가하세요.');
  }

  if (sinks.length === 0) {
    warnings.push('Sink가 없습니다. 자원 소모처를 추가하세요.');
  }

  const requiredSinks = sinks.filter(s => s.isRequired);
  if (requiredSinks.length === 0 && sinks.length > 0) {
    warnings.push('필수 Sink가 없습니다. 수리비, 세금 등 강제 소모처를 고려하세요.');
  }

  // 목표 인플레이션과 비교
  if (Math.abs(inflationRate - config.targetInflationRate) > 0.01) {
    const direction = inflationRate > config.targetInflationRate ? '높습니다' : '낮습니다';
    warnings.push(`현재 인플레이션율(${(inflationRate * 100).toFixed(2)}%)이 목표(${(config.targetInflationRate * 100).toFixed(2)}%)보다 ${direction}.`);
  }

  return {
    totalFaucetPerHour,
    totalSinkPerHour,
    netFlowPerHour,
    faucetSinkRatio,
    inflationRate,
    daysToDouble,
    supplyOverTime,
    pinchPointAnalysis,
    faucetBreakdown: faucetBreakdown.sort((a, b) => b.contribution - a.contribution),
    sinkBreakdown: sinkBreakdown.sort((a, b) => b.contribution - a.contribution),
    warnings
  };
}

/**
 * 균형을 맞추기 위한 제안 계산
 */
export function calculateBalanceSuggestions(
  faucets: Faucet[],
  sinks: Sink[],
  config: EconomyConfig
): {
  suggestedFaucetMultiplier: number;
  suggestedSinkMultiplier: number;
  suggestedNewSinkRate: number;
  explanation: string;
} {
  const result = simulateEconomy(faucets, sinks, config);

  if (result.faucetSinkRatio >= 0.95 && result.faucetSinkRatio <= 1.05) {
    return {
      suggestedFaucetMultiplier: 1,
      suggestedSinkMultiplier: 1,
      suggestedNewSinkRate: 0,
      explanation: '현재 경제가 균형 상태입니다.'
    };
  }

  if (result.faucetSinkRatio > 1.05) {
    // 인플레이션 - Sink를 늘리거나 Faucet을 줄여야 함
    const targetSink = result.totalFaucetPerHour; // 1:1 균형 목표
    const sinkMultiplier = result.totalSinkPerHour > 0
      ? targetSink / result.totalSinkPerHour
      : 1;
    const faucetMultiplier = result.totalSinkPerHour > 0
      ? result.totalSinkPerHour / result.totalFaucetPerHour
      : 0.5;
    const newSinkNeeded = result.totalFaucetPerHour - result.totalSinkPerHour;

    return {
      suggestedFaucetMultiplier: faucetMultiplier,
      suggestedSinkMultiplier: sinkMultiplier,
      suggestedNewSinkRate: newSinkNeeded,
      explanation: `균형을 위해 Sink를 ${((sinkMultiplier - 1) * 100).toFixed(0)}% 증가시키거나, Faucet을 ${((1 - faucetMultiplier) * 100).toFixed(0)}% 감소시키거나, 시간당 ${newSinkNeeded.toFixed(0)}의 새로운 Sink를 추가하세요.`
    };
  } else {
    // 디플레이션 - Faucet을 늘리거나 Sink를 줄여야 함
    const targetFaucet = result.totalSinkPerHour;
    const faucetMultiplier = result.totalFaucetPerHour > 0
      ? targetFaucet / result.totalFaucetPerHour
      : 2;
    const sinkMultiplier = result.totalFaucetPerHour > 0
      ? result.totalFaucetPerHour / result.totalSinkPerHour
      : 0.5;
    const newFaucetNeeded = result.totalSinkPerHour - result.totalFaucetPerHour;

    return {
      suggestedFaucetMultiplier: faucetMultiplier,
      suggestedSinkMultiplier: sinkMultiplier,
      suggestedNewSinkRate: -newFaucetNeeded, // 음수로 Faucet 필요량 표시
      explanation: `균형을 위해 Faucet을 ${((faucetMultiplier - 1) * 100).toFixed(0)}% 증가시키거나, Sink를 ${((1 - sinkMultiplier) * 100).toFixed(0)}% 감소시키세요.`
    };
  }
}

// 기본 템플릿 - MMO 경제 기준 (Faucet/Sink 비율 ≈ 1.02 목표)
// 참고: https://departmentofplay.net/the-principles-of-building-a-game-economy/
//
// === Faucet 계산 (플레이어당 시간당 획득량) ===
// 몬스터 드롭: 300 × 0.85 = 255
// 퀘스트 보상: 150 × 0.40 = 60  (퀘스트는 항상 하진 않음)
// 일일 보상: 500 / 24 × 0.70 = 14.6  (하루 총량을 시간당으로 환산)
// 던전 보상: 800 × 0.25 = 200  (던전은 25% 플레이어만)
// 거래소 판매: 100 × 0.15 = 15  (거래는 소수만)
// 총 Faucet: ~545/시간/플레이어
//
// === Sink 계산 (플레이어당 시간당 소모량) ===
// 장비 수리: 80 × 1.5 × 0.80 = 96
// 포션/소모품: 25 × 4 × 0.70 = 70
// 거래 수수료: 200 × 0.3 × 0.15 = 9  (거래할 때 5% 세금)
// 강화/제작: 300 × 0.5 × 0.30 = 45
// 이동/텔레포트: 20 × 2 × 0.50 = 20
// NPC 상점 구매: 150 × 0.8 × 0.40 = 48
// 길드 기부금: 100 × 0.2 × 0.25 = 5
// 스킬 습득: 500 × 0.1 × 0.20 = 10
// 창고 확장: 1000 × 0.02 × 0.10 = 2
// 외형 아이템: 200 × 0.05 × 0.05 = 0.5
// 총 Sink: ~305/시간/플레이어 (필수) + ~200 (선택적)
//
// 비율: 545 / 505 ≈ 1.08 (약간의 인플레이션 - 성장 느낌 제공)

export const DEFAULT_FAUCETS: Faucet[] = [
  // 총 Faucet: ~600/플레이어/시간 (Sink와 균형)
  { id: 'monster', name: '몬스터 드롭', ratePerHour: 350, playerPercentage: 0.85, notes: '일반 사냥 시 획득' },          // 297.5
  { id: 'quest', name: '퀘스트 보상', ratePerHour: 200, playerPercentage: 0.45, notes: '퀘스트 완료 보상' },             // 90
  { id: 'daily', name: '일일 보상', ratePerHour: 25, playerPercentage: 0.70, notes: '600골드/일 ÷ 24시간' },            // 17.5
  { id: 'dungeon', name: '던전 보상', ratePerHour: 600, playerPercentage: 0.30, notes: '던전/레이드 클리어' },           // 180
  { id: 'trade_sell', name: '거래소 판매', ratePerHour: 120, playerPercentage: 0.15, notes: '다른 플레이어에게 판매' },  // 18
];

export const DEFAULT_SINKS: Sink[] = [
  // 필수 Sink (플레이 시 반드시 발생) - 총 ~310/플레이어/시간
  { id: 'repair', name: '장비 수리', costPerUse: 120, usesPerHour: 2, playerPercentage: 0.85, isRequired: true, notes: '전투 후 장비 내구도 수리' },        // 204
  { id: 'potion', name: '포션/소모품', costPerUse: 30, usesPerHour: 5, playerPercentage: 0.75, isRequired: true, notes: 'HP/MP 포션, 버프 아이템' },         // 112.5
  { id: 'travel', name: '이동/텔레포트', costPerUse: 30, usesPerHour: 3, playerPercentage: 0.60, isRequired: true, notes: '빠른 이동 비용' },                 // 54
  // 선택적 Sink (진행/성장 관련) - 총 ~220/플레이어/시간
  { id: 'enhance', name: '강화/제작', costPerUse: 400, usesPerHour: 0.8, playerPercentage: 0.35, isRequired: false, notes: '장비 강화, 아이템 제작' },       // 112
  { id: 'npc_shop', name: 'NPC 상점 구매', costPerUse: 200, usesPerHour: 1, playerPercentage: 0.45, isRequired: false, notes: 'NPC에게 아이템 구매' },       // 90
  { id: 'trade_tax', name: '거래 수수료', costPerUse: 150, usesPerHour: 0.5, playerPercentage: 0.20, isRequired: true, notes: '거래소 이용 시 5% 세금' },    // 15
  { id: 'skill', name: '스킬 습득', costPerUse: 300, usesPerHour: 0.15, playerPercentage: 0.25, isRequired: false, notes: '새 스킬 배우기' },                // 11.25
  { id: 'guild', name: '길드 기부금', costPerUse: 80, usesPerHour: 0.3, playerPercentage: 0.30, isRequired: false, notes: '길드 발전 기여' },                // 7.2
];

export const DEFAULT_CONFIG: EconomyConfig = {
  currencyName: '골드',
  playerCount: 1000,           // 동시접속자 수
  simulationDays: 30,          // 30일 시뮬레이션
  initialSupply: 50000000,     // 초기 서버 총 재화량 (5천만)
  targetInflationRate: 0.02,   // 목표 인플레이션 2%/일
};

// ========================================
// 싱글 플레이어 게임 경제
// ========================================

// 스테이지별 재화 획득원 (Source)
export interface SinglePlayerSource {
  id: string;
  name: string;
  baseAmount: number;          // 스테이지 1에서의 기본 획득량
  growthType: 'linear' | 'exponential' | 'logarithmic' | 'custom';
  growthRate: number;          // 성장률 (linear: 증가량, exponential: 배율, logarithmic: 계수)
  occurrence: 'per_stage' | 'per_enemy' | 'per_boss' | 'milestone';
  occurrenceCount?: number;    // 스테이지당 발생 횟수 (per_enemy, per_boss용)
  startStage?: number;         // 시작 스테이지 (기본 1)
  notes?: string;
}

// 스테이지별 재화 소모처 (Sink)
export interface SinglePlayerSink {
  id: string;
  name: string;
  baseCost: number;            // 스테이지 1에서의 기본 비용
  growthType: 'linear' | 'exponential' | 'logarithmic' | 'custom';
  growthRate: number;          // 성장률
  category: 'upgrade' | 'consumable' | 'unlock' | 'repair' | 'optional';
  isRequired: boolean;         // 진행에 필수인지
  frequency: number;           // 스테이지당 평균 사용 횟수
  unlockStage?: number;        // 언락되는 스테이지
  notes?: string;
}

// 싱글 플레이어 경제 설정
export interface SinglePlayerConfig {
  currencyName: string;
  totalStages: number;         // 총 스테이지 수
  initialCurrency: number;     // 시작 재화
  // 진행도별 밸런스 조절
  earlyGameEnd: number;        // 초반 종료 스테이지 (예: 10)
  midGameEnd: number;          // 중반 종료 스테이지 (예: 50)
  // 난이도 커브
  difficultyMultiplier: number; // 전체 난이도 배율
}

// 싱글 플레이어 시뮬레이션 결과
export interface SinglePlayerResult {
  // 스테이지별 데이터
  stageData: {
    stage: number;
    income: number;            // 해당 스테이지 획득량
    expense: number;           // 해당 스테이지 소모량
    netGain: number;           // 순 획득량
    cumulativeBalance: number; // 누적 잔액
    canProgress: boolean;      // 진행 가능 여부
    phase: 'early' | 'mid' | 'late';
  }[];

  // 전체 통계
  totalIncome: number;
  totalExpense: number;
  finalBalance: number;

  // 밸런스 지표
  averageNetGainPerStage: number;
  incomeToExpenseRatio: number;

  // Source/Sink 비중 분석 (스테이지 구간별)
  sourceBreakdown: {
    phase: 'early' | 'mid' | 'late';
    sources: { name: string; total: number; percentage: number }[];
  }[];
  sinkBreakdown: {
    phase: 'early' | 'mid' | 'late';
    sinks: { name: string; total: number; percentage: number }[];
  }[];

  // 핀치 포인트 분석
  pinchPoints: {
    stage: number;
    issue: 'currency_shortage' | 'progression_block' | 'surplus';
    severity: 'minor' | 'major' | 'critical';
    message: string;
  }[];

  // 권장사항
  recommendations: string[];

  // 페이싱 분석
  pacing: {
    earlyGameRatio: number;    // 초반 수입/지출 비율
    midGameRatio: number;      // 중반 수입/지출 비율
    lateGameRatio: number;     // 후반 수입/지출 비율
    isBalanced: boolean;
  };
}

/**
 * 성장 공식에 따른 값 계산
 */
function calculateGrowthValue(
  baseValue: number,
  stage: number,
  growthType: 'linear' | 'exponential' | 'logarithmic' | 'custom',
  growthRate: number
): number {
  switch (growthType) {
    case 'linear':
      // baseValue + (stage - 1) * growthRate
      return baseValue + (stage - 1) * growthRate;
    case 'exponential':
      // baseValue * growthRate^(stage - 1)
      return baseValue * Math.pow(growthRate, stage - 1);
    case 'logarithmic':
      // baseValue * (1 + growthRate * log(stage))
      return baseValue * (1 + growthRate * Math.log(stage));
    case 'custom':
    default:
      return baseValue * growthRate * stage;
  }
}

/**
 * 싱글 플레이어 경제 시뮬레이션
 */
export function simulateSinglePlayerEconomy(
  sources: SinglePlayerSource[],
  sinks: SinglePlayerSink[],
  config: SinglePlayerConfig
): SinglePlayerResult {
  const stageData: SinglePlayerResult['stageData'] = [];
  const pinchPoints: SinglePlayerResult['pinchPoints'] = [];
  const recommendations: string[] = [];

  let cumulativeBalance = config.initialCurrency;
  let totalIncome = 0;
  let totalExpense = 0;

  // 구간별 수입/지출 누적
  const phaseIncome = { early: 0, mid: 0, late: 0 };
  const phaseExpense = { early: 0, mid: 0, late: 0 };

  // 구간별 Source/Sink 누적
  const phaseSourceTotals: Record<'early' | 'mid' | 'late', Record<string, number>> = {
    early: {}, mid: {}, late: {}
  };
  const phaseSinkTotals: Record<'early' | 'mid' | 'late', Record<string, number>> = {
    early: {}, mid: {}, late: {}
  };

  // 스테이지별 시뮬레이션
  for (let stage = 1; stage <= config.totalStages; stage++) {
    // 현재 구간 판단
    const phase: 'early' | 'mid' | 'late' =
      stage <= config.earlyGameEnd ? 'early' :
      stage <= config.midGameEnd ? 'mid' : 'late';

    // 스테이지 수입 계산
    let stageIncome = 0;
    for (const source of sources) {
      if (source.startStage && stage < source.startStage) continue;

      const baseAmount = calculateGrowthValue(
        source.baseAmount,
        stage,
        source.growthType,
        source.growthRate
      );

      let amount = baseAmount;
      if (source.occurrence === 'per_enemy' || source.occurrence === 'per_boss') {
        amount *= (source.occurrenceCount || 1);
      }

      stageIncome += amount;

      // 구간별 Source 누적
      if (!phaseSourceTotals[phase][source.name]) {
        phaseSourceTotals[phase][source.name] = 0;
      }
      phaseSourceTotals[phase][source.name] += amount;
    }

    // 스테이지 지출 계산
    let stageExpense = 0;
    let requiredExpense = 0;
    for (const sink of sinks) {
      if (sink.unlockStage && stage < sink.unlockStage) continue;

      const baseCost = calculateGrowthValue(
        sink.baseCost,
        stage,
        sink.growthType,
        sink.growthRate
      );

      const cost = baseCost * sink.frequency * config.difficultyMultiplier;
      stageExpense += cost;

      if (sink.isRequired) {
        requiredExpense += cost;
      }

      // 구간별 Sink 누적
      if (!phaseSinkTotals[phase][sink.name]) {
        phaseSinkTotals[phase][sink.name] = 0;
      }
      phaseSinkTotals[phase][sink.name] += cost;
    }

    const netGain = stageIncome - stageExpense;
    cumulativeBalance += netGain;

    totalIncome += stageIncome;
    totalExpense += stageExpense;

    phaseIncome[phase] += stageIncome;
    phaseExpense[phase] += stageExpense;

    // 진행 가능 여부 체크
    const canProgress = cumulativeBalance >= 0 && cumulativeBalance >= requiredExpense * 0.5;

    stageData.push({
      stage,
      income: Math.round(stageIncome),
      expense: Math.round(stageExpense),
      netGain: Math.round(netGain),
      cumulativeBalance: Math.round(cumulativeBalance),
      canProgress,
      phase
    });

    // 핀치 포인트 감지
    if (cumulativeBalance < 0) {
      pinchPoints.push({
        stage,
        issue: 'currency_shortage',
        severity: 'critical',
        message: `스테이지 ${stage}에서 재화 부족 (잔액: ${Math.round(cumulativeBalance)})`
      });
    } else if (cumulativeBalance < requiredExpense) {
      pinchPoints.push({
        stage,
        issue: 'progression_block',
        severity: 'major',
        message: `스테이지 ${stage}에서 필수 비용 지불 어려움`
      });
    } else if (netGain > stageIncome * 0.8) {
      // 너무 많이 남는 경우
      if (stage > config.earlyGameEnd) {
        pinchPoints.push({
          stage,
          issue: 'surplus',
          severity: 'minor',
          message: `스테이지 ${stage}에서 재화 과잉 (잉여: ${Math.round(netGain)})`
        });
      }
    }
  }

  // 구간별 Source 분석
  const sourceBreakdown: SinglePlayerResult['sourceBreakdown'] = [];
  for (const phase of ['early', 'mid', 'late'] as const) {
    const totals = phaseSourceTotals[phase];
    const phaseTotal = Object.values(totals).reduce((a, b) => a + b, 0);
    const sources = Object.entries(totals)
      .map(([name, total]) => ({
        name,
        total: Math.round(total),
        percentage: phaseTotal > 0 ? (total / phaseTotal) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
    sourceBreakdown.push({ phase, sources });
  }

  // 구간별 Sink 분석
  const sinkBreakdown: SinglePlayerResult['sinkBreakdown'] = [];
  for (const phase of ['early', 'mid', 'late'] as const) {
    const totals = phaseSinkTotals[phase];
    const phaseTotal = Object.values(totals).reduce((a, b) => a + b, 0);
    const sinks = Object.entries(totals)
      .map(([name, total]) => ({
        name,
        total: Math.round(total),
        percentage: phaseTotal > 0 ? (total / phaseTotal) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
    sinkBreakdown.push({ phase, sinks });
  }

  // 페이싱 분석
  const earlyGameRatio = phaseExpense.early > 0 ? phaseIncome.early / phaseExpense.early : 1;
  const midGameRatio = phaseExpense.mid > 0 ? phaseIncome.mid / phaseExpense.mid : 1;
  const lateGameRatio = phaseExpense.late > 0 ? phaseIncome.late / phaseExpense.late : 1;

  // 이상적인 페이싱: 초반 > 중반 > 후반 (점점 빡빡해짐)
  const isBalanced = earlyGameRatio >= 1.2 && midGameRatio >= 0.9 && lateGameRatio >= 0.8;

  const pacing = {
    earlyGameRatio,
    midGameRatio,
    lateGameRatio,
    isBalanced
  };

  // 권장사항 생성
  if (earlyGameRatio < 1.2) {
    recommendations.push('초반 재화 획득량을 늘려 좋은 첫 경험을 제공하세요.');
  }
  if (midGameRatio < 0.9) {
    recommendations.push('중반 난이도가 너무 높습니다. Source를 늘리거나 Sink를 줄이세요.');
  }
  if (lateGameRatio > 1.5) {
    recommendations.push('후반 재화가 너무 많이 남습니다. 엔드게임 Sink를 추가하세요.');
  }
  if (pinchPoints.filter(p => p.severity === 'critical').length > 0) {
    recommendations.push('진행 불가능한 구간이 있습니다. 해당 스테이지의 밸런스를 조정하세요.');
  }
  if (recommendations.length === 0) {
    recommendations.push('경제 밸런스가 양호합니다.');
  }

  return {
    stageData,
    totalIncome: Math.round(totalIncome),
    totalExpense: Math.round(totalExpense),
    finalBalance: Math.round(cumulativeBalance),
    averageNetGainPerStage: Math.round((totalIncome - totalExpense) / config.totalStages),
    incomeToExpenseRatio: totalExpense > 0 ? totalIncome / totalExpense : 1,
    sourceBreakdown,
    sinkBreakdown,
    pinchPoints,
    recommendations,
    pacing
  };
}

// 싱글 플레이어 기본 템플릿 (30스테이지 기준)
// 초반(1-5): 넉넉함, 중반(6-15): 균형, 후반(16-30): 도전적
export const DEFAULT_SINGLE_SOURCES: SinglePlayerSource[] = [
  {
    id: 'enemy_drop',
    name: '적 처치 보상',
    baseAmount: 15,
    growthType: 'linear',
    growthRate: 3,              // 스테이지당 +3 (스테이지 30에서 102)
    occurrence: 'per_enemy',
    occurrenceCount: 5          // 스테이지당 적 5마리
  },
  {
    id: 'boss_reward',
    name: '보스 처치 보상',
    baseAmount: 80,
    growthType: 'linear',
    growthRate: 20,             // 스테이지당 +20 (스테이지 30에서 660)
    occurrence: 'per_boss',
    occurrenceCount: 1
  },
  {
    id: 'stage_clear',
    name: '스테이지 클리어',
    baseAmount: 30,
    growthType: 'linear',
    growthRate: 5,              // 스테이지당 +5 (스테이지 30에서 175)
    occurrence: 'per_stage'
  },
  {
    id: 'chest',
    name: '보물상자',
    baseAmount: 20,
    growthType: 'linear',
    growthRate: 2,              // 스테이지당 +2 (스테이지 30에서 78)
    occurrence: 'per_stage',
    startStage: 2
  }
];

export const DEFAULT_SINGLE_SINKS: SinglePlayerSink[] = [
  {
    id: 'weapon_upgrade',
    name: '무기 강화',
    baseCost: 40,
    growthType: 'linear',
    growthRate: 10,             // 스테이지당 +10 (스테이지 30에서 330)
    category: 'upgrade',
    isRequired: true,
    frequency: 0.4              // 2-3스테이지마다 1회
  },
  {
    id: 'armor_upgrade',
    name: '방어구 강화',
    baseCost: 30,
    growthType: 'linear',
    growthRate: 8,              // 스테이지당 +8 (스테이지 30에서 262)
    category: 'upgrade',
    isRequired: true,
    frequency: 0.3              // 3-4스테이지마다 1회
  },
  {
    id: 'potion',
    name: '포션 구매',
    baseCost: 10,
    growthType: 'linear',
    growthRate: 2,              // 스테이지당 +2 (스테이지 30에서 68)
    category: 'consumable',
    isRequired: false,
    frequency: 1.5              // 스테이지당 평균 1.5개
  },
  {
    id: 'skill_unlock',
    name: '스킬 해금',
    baseCost: 150,
    growthType: 'linear',
    growthRate: 30,             // 스테이지당 +30 (스테이지 30에서 900)
    category: 'unlock',
    isRequired: false,
    frequency: 0.15,            // 6-7스테이지마다 1회
    unlockStage: 5
  }
];

export const DEFAULT_SINGLE_CONFIG: SinglePlayerConfig = {
  currencyName: '골드',
  totalStages: 30,
  initialCurrency: 50,
  earlyGameEnd: 5,              // 1-5 스테이지: 초반
  midGameEnd: 15,               // 6-15 스테이지: 중반
  difficultyMultiplier: 1.0
};
