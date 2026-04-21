/**
 * RTS Build Order 시뮬 — StarCraft 2 / AoE 4 / Warcraft 3 경제 밸런싱.
 *
 * 핵심 지표:
 *  - Worker count over time (일꾼 수)
 *  - Resource income rate (분당 자원 수입)
 *  - Supply cap progression
 *  - Army value timing (분/병력 가치)
 *  - Tech timing (2nd tier, 3rd tier 도달)
 *
 * 모델 (SC2 기준 근사):
 *  - 기본 일꾼 1명이 광물 1tick (초당 약 0.92 minerals) 수확
 *  - 가스 일꾼은 초당 0.65 가스 (SC2 기준)
 *  - 최대 일꾼 = 본진당 16 (saturation)
 *  - 일꾼 트레이닝: 12초 / 50 mineral
 *  - 기본 병영(supplies): 서플라이 디포 8 + 본진 15
 */

export type ActionType =
  | 'build-worker'       // SCV/Probe/Drone 생성
  | 'build-supply'       // 서플라이 디포 / 파일런
  | 'build-production'   // 배럭 / 게이트웨이 / 해처리 등
  | 'build-tech'         // 팩토리 / 엔지니어링 베이 / 레어
  | 'build-expansion'    // 멀티 본진
  | 'train-unit'         // 병력 생산
  | 'train-worker-alt';  // 본진이 아닌 곳에서 생산 (예: 확장지)

export interface BuildStep {
  id: string;
  /** 실행 시점 — 게임 시작 후 몇 초 (supply 표기는 UI) */
  timeSec: number;
  action: ActionType;
  /** 자원 비용 (minerals, gas) */
  mineralCost: number;
  gasCost?: number;
  /** 소모 서플라이 (유닛 생산) — 제공 서플라이는 음수 */
  supplyUsed?: number;
  /** 제공 서플라이 (서플라이 디포 등) */
  supplyProvided?: number;
  /** 빌드 소요 시간 (완성까지) */
  buildDurationSec: number;
  /** 이름 (UI 표시용) */
  label: string;
}

export interface RtsSimConfig {
  /** 빌드 스텝 목록 — 시간순 */
  steps: BuildStep[];
  /** 시뮬 지속 시간 (초) */
  durationSec: number;
  /** 초기 일꾼 수 (기본 12 — SC2 시작 값) */
  startingWorkers: number;
  /** 분당 광물 수입 / 일꾼 (기본 45 = SC2 최적) */
  mineralPerWorkerPerMin: number;
  /** 분당 가스 수입 / 가스 일꾼 */
  gasPerWorkerPerMin: number;
  /** 본진당 최대 saturation 일꾼 수 */
  workersPerBase: number;
  /** 기본 서플라이 캡 (본진 제공) */
  baseSupplyCap: number;
  /** 초기 자원 (minerals, gas) */
  startingMinerals: number;
  startingGas: number;
  /** 일꾼 트레이닝 시간 / 비용 */
  workerTrainSec: number;
  workerMineralCost: number;
}

export interface RtsSample {
  timeSec: number;
  minerals: number;
  gas: number;
  workers: number;
  supplyUsed: number;
  supplyCap: number;
  mineralIncomePerMin: number;
  armyValue: number;     // 병력 자원 가치 합
  completedActions: string[];  // 이 시점까지 완료된 빌드 id
}

export interface RtsSimResult {
  samples: RtsSample[];
  /** 각 스텝 실행 실패 여부 (자원 부족 등) */
  failures: Array<{ stepId: string; reason: string; timeSec: number }>;
  /** 최종 army value */
  finalArmyValue: number;
  /** 최종 일꾼 수 */
  finalWorkers: number;
  /** 최종 수입 */
  finalIncomePerMin: number;
  /** 전체 빌드 효율 — 유휴 자원 비율 (낮을수록 좋음) */
  idleResourceRatio: number;
}

// ============================================================================
// 메인 시뮬
// ============================================================================

const DEFAULT_CONFIG: Omit<RtsSimConfig, 'steps' | 'durationSec'> = {
  startingWorkers: 12,
  mineralPerWorkerPerMin: 45,
  gasPerWorkerPerMin: 38,
  workersPerBase: 16,
  baseSupplyCap: 15,
  startingMinerals: 50,
  startingGas: 0,
  workerTrainSec: 12,
  workerMineralCost: 50,
};

export function mergeDefaults(
  partial: Partial<RtsSimConfig> & { steps: BuildStep[]; durationSec: number },
): RtsSimConfig {
  return { ...DEFAULT_CONFIG, ...partial };
}

export function simulateBuildOrder(
  cfgInput: Partial<RtsSimConfig> & { steps: BuildStep[]; durationSec: number },
): RtsSimResult {
  const cfg = mergeDefaults(cfgInput);
  const samples: RtsSample[] = [];
  const failures: RtsSimResult['failures'] = [];
  const completedActions: string[] = [];

  // state
  let minerals = cfg.startingMinerals;
  let gas = cfg.startingGas;
  let workers = cfg.startingWorkers;
  let supplyUsed = cfg.startingWorkers;
  let supplyCap = cfg.baseSupplyCap;
  let armyValue = 0;
  let idleMineralAccum = 0;
  let totalIncomeAccum = 0;

  // 건설 중 / 훈련 중 작업들 (completion time 기준)
  interface InFlight {
    step: BuildStep;
    completeAt: number;
  }
  const inFlight: InFlight[] = [];
  const stepsSorted = [...cfg.steps].sort((a, b) => a.timeSec - b.timeSec);
  let stepIdx = 0;

  const tickSec = 1;
  for (let t = 0; t <= cfg.durationSec; t += tickSec) {
    // 완성된 작업들 처리
    const doneNow = inFlight.filter((f) => f.completeAt <= t);
    for (const d of doneNow) {
      completedActions.push(d.step.id);
      if (d.step.supplyProvided) supplyCap = Math.min(200, supplyCap + d.step.supplyProvided);
      if (d.step.action === 'build-worker' || d.step.action === 'train-worker-alt') {
        workers += 1;
      }
      if (d.step.action === 'train-unit') {
        armyValue += d.step.mineralCost + (d.step.gasCost ?? 0);
      }
    }
    const stillInFlight = inFlight.filter((f) => f.completeAt > t);
    inFlight.length = 0;
    inFlight.push(...stillInFlight);

    // 자원 수입 — 일꾼 × rate/60
    const harvestingWorkers = Math.min(workers, cfg.workersPerBase * 2); // 2 본진 가정
    const mineralIncome = (harvestingWorkers * cfg.mineralPerWorkerPerMin) / 60;
    const gasIncome = Math.max(0, (workers - harvestingWorkers) * cfg.gasPerWorkerPerMin / 60);
    minerals += mineralIncome;
    gas += gasIncome;
    totalIncomeAccum += mineralIncome;

    // 시간 도래한 step 실행
    while (stepIdx < stepsSorted.length && stepsSorted[stepIdx].timeSec <= t) {
      const step = stepsSorted[stepIdx];
      const canAfford = minerals >= step.mineralCost && gas >= (step.gasCost ?? 0);
      const hasSupply = (step.supplyUsed ?? 0) === 0 || supplyUsed + (step.supplyUsed ?? 0) <= supplyCap;
      if (!canAfford) {
        failures.push({ stepId: step.id, reason: `자원 부족 (min ${Math.round(minerals)}/${step.mineralCost})`, timeSec: t });
        stepIdx++;
        continue;
      }
      if (!hasSupply) {
        failures.push({ stepId: step.id, reason: '서플라이 부족', timeSec: t });
        stepIdx++;
        continue;
      }
      // 자원 소모 + 진행
      minerals -= step.mineralCost;
      gas -= step.gasCost ?? 0;
      if (step.supplyUsed) supplyUsed += step.supplyUsed;
      inFlight.push({ step, completeAt: t + step.buildDurationSec });
      stepIdx++;
    }

    // 유휴 자원 (production 막힘) — 너무 많이 쌓이면 비효율
    if (minerals > 400) idleMineralAccum += (minerals - 400);

    if (t % 5 === 0) { // 5초마다 샘플
      samples.push({
        timeSec: t,
        minerals: Math.round(minerals),
        gas: Math.round(gas),
        workers,
        supplyUsed,
        supplyCap,
        mineralIncomePerMin: Math.round(mineralIncome * 60),
        armyValue,
        completedActions: [...completedActions],
      });
    }
  }

  const finalSample = samples[samples.length - 1];
  const idleResourceRatio = totalIncomeAccum > 0 ? idleMineralAccum / totalIncomeAccum : 0;

  return {
    samples,
    failures,
    finalArmyValue: armyValue,
    finalWorkers: workers,
    finalIncomePerMin: finalSample?.mineralIncomePerMin ?? 0,
    idleResourceRatio: Math.min(1, idleResourceRatio),
  };
}

// ============================================================================
// 프리셋 — SC2 Terran 15/17 Marine Rush, Zerg 12 Pool 등
// ============================================================================

/** SC2 Terran 1/1/1 Marine 빌드 (초보~중수) */
export const SC2_TERRAN_MARINE_RUSH: BuildStep[] = [
  { id: 's1', timeSec: 0,   action: 'build-worker', label: 'SCV',          mineralCost: 50, supplyUsed: 1, buildDurationSec: 12 },
  { id: 's2', timeSec: 15,  action: 'build-supply', label: 'Supply Depot', mineralCost: 100, buildDurationSec: 21, supplyProvided: 8 },
  { id: 's3', timeSec: 30,  action: 'build-worker', label: 'SCV',          mineralCost: 50, supplyUsed: 1, buildDurationSec: 12 },
  { id: 's4', timeSec: 50,  action: 'build-production', label: 'Barracks', mineralCost: 150, buildDurationSec: 46 },
  { id: 's5', timeSec: 60,  action: 'build-worker', label: 'SCV',          mineralCost: 50, supplyUsed: 1, buildDurationSec: 12 },
  { id: 's6', timeSec: 100, action: 'train-unit', label: 'Marine',         mineralCost: 50, supplyUsed: 1, buildDurationSec: 18 },
  { id: 's7', timeSec: 130, action: 'train-unit', label: 'Marine',         mineralCost: 50, supplyUsed: 1, buildDurationSec: 18 },
  { id: 's8', timeSec: 160, action: 'train-unit', label: 'Marine',         mineralCost: 50, supplyUsed: 1, buildDurationSec: 18 },
  { id: 's9', timeSec: 180, action: 'build-supply', label: 'Supply Depot', mineralCost: 100, buildDurationSec: 21, supplyProvided: 8 },
];

/** AoE 4 — 빠른 페오달(2 tier) 빌드 */
export const AOE4_FEUDAL_RUSH: BuildStep[] = [
  { id: 'b1', timeSec: 0,   action: 'build-worker', label: 'Villager',    mineralCost: 50,  buildDurationSec: 20 },
  { id: 'b2', timeSec: 30,  action: 'build-supply', label: 'House',       mineralCost: 50,  buildDurationSec: 35, supplyProvided: 5 },
  { id: 'b3', timeSec: 60,  action: 'build-worker', label: 'Villager',    mineralCost: 50,  buildDurationSec: 20 },
  { id: 'b4', timeSec: 120, action: 'build-tech', label: 'Lumber Camp',   mineralCost: 50,  buildDurationSec: 35 },
  { id: 'b5', timeSec: 180, action: 'build-tech', label: 'Mining Camp',   mineralCost: 50,  buildDurationSec: 35 },
  { id: 'b6', timeSec: 300, action: 'build-tech', label: 'Feudal Age',    mineralCost: 200, buildDurationSec: 90 },
];
