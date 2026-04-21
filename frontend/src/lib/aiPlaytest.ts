/**
 * AI Playtest — 여러 시뮬을 자동 실행해 imbalance 리포트.
 *
 * 게임 스튜디오에서 "플레이테스트" 는 실제 유저 테스트와 동일한 중요성.
 * 수백 번의 시뮬을 돌려 지표 이상을 자동 탐지하는 게 업계 표준:
 *   - Riot: 챔피언 출시 전 수백만 시뮬
 *   - Blizzard: Overwatch 히어로 밸런스 AI 플레이
 *   - Supercell: Clash Royale 카드 winrate 프로덕션 스트리밍
 *
 * 우리 구현:
 *  - 여러 시나리오 정의 (scenario): 각 도메인의 시뮬 실행 callback + 기대 지표
 *  - 배치 실행 → 결과 수집 → imbalance 분류 (warn/critical)
 *  - 리포트: 도메인별 각 test case 요약 + 개선 제안
 */

export type PlaytestDomain = 'unit' | 'fps' | 'deck' | 'moba' | 'mmo-raid' | 'auto-battler' | 'horde';

export type IssueSeverity = 'ok' | 'warn' | 'critical';

export interface PlaytestScenario {
  id: string;
  name: string;
  domain: PlaytestDomain;
  /** 시뮬 실행 — 결과 지표 반환 */
  run: () => Promise<Record<string, number>> | Record<string, number>;
  /** 지표 검증 — 정상 범위 벗어나면 issue 반환 */
  validators: Array<{
    metricKey: string;
    /** 기대 범위 [min, max] */
    expected: [number, number];
    /** 벗어나면 심각도 */
    severity: IssueSeverity;
    /** 지표 이름 (사람 읽기) */
    label: string;
    /** 벗어났을 때 추천 메시지 */
    recommendation?: string;
  }>;
  /** 반복 실행 횟수 (Monte Carlo) */
  runs: number;
}

export interface PlaytestIssue {
  scenarioId: string;
  scenarioName: string;
  metricKey: string;
  metricLabel: string;
  observedValue: number;
  expectedRange: [number, number];
  severity: IssueSeverity;
  recommendation?: string;
}

export interface PlaytestScenarioResult {
  scenarioId: string;
  scenarioName: string;
  domain: PlaytestDomain;
  metrics: Record<string, { avg: number; min: number; max: number; stdev: number }>;
  issues: PlaytestIssue[];
  runCount: number;
  durationMs: number;
}

export interface PlaytestReport {
  scenarios: PlaytestScenarioResult[];
  totalIssues: number;
  criticalCount: number;
  warnCount: number;
  /** 전체 도메인별 상태 (최악 케이스 집계) */
  domainHealth: Record<PlaytestDomain, IssueSeverity>;
  /** 종합 점수 0-100 (100=모두 ok) */
  overallScore: number;
  durationMs: number;
}

// ============================================================================
// 배치 실행
// ============================================================================

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export async function runPlaytest(scenarios: PlaytestScenario[]): Promise<PlaytestReport> {
  const startTime = Date.now();
  const results: PlaytestScenarioResult[] = [];

  for (const scenario of scenarios) {
    const scenarioStart = Date.now();
    const rawMetrics: Record<string, number[]> = {};

    for (let i = 0; i < scenario.runs; i++) {
      const result = await scenario.run();
      for (const [key, value] of Object.entries(result)) {
        if (!rawMetrics[key]) rawMetrics[key] = [];
        rawMetrics[key].push(value);
      }
    }

    // 집계
    const metrics: PlaytestScenarioResult['metrics'] = {};
    for (const [key, values] of Object.entries(rawMetrics)) {
      metrics[key] = {
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        stdev: stdev(values),
      };
    }

    // Validator 체크
    const issues: PlaytestIssue[] = [];
    for (const validator of scenario.validators) {
      const metric = metrics[validator.metricKey];
      if (!metric) continue;
      const [min, max] = validator.expected;
      if (metric.avg < min || metric.avg > max) {
        issues.push({
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          metricKey: validator.metricKey,
          metricLabel: validator.label,
          observedValue: metric.avg,
          expectedRange: validator.expected,
          severity: validator.severity,
          recommendation: validator.recommendation,
        });
      }
    }

    results.push({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      domain: scenario.domain,
      metrics,
      issues,
      runCount: scenario.runs,
      durationMs: Date.now() - scenarioStart,
    });
  }

  // 집계
  let criticalCount = 0;
  let warnCount = 0;
  const domainHealth: Record<PlaytestDomain, IssueSeverity> = {
    unit: 'ok', fps: 'ok', deck: 'ok', moba: 'ok',
    'mmo-raid': 'ok', 'auto-battler': 'ok', horde: 'ok',
  };

  for (const r of results) {
    for (const issue of r.issues) {
      if (issue.severity === 'critical') criticalCount++;
      if (issue.severity === 'warn') warnCount++;
      // domain health — 최악이 critical > warn > ok
      if (issue.severity === 'critical') domainHealth[r.domain] = 'critical';
      else if (issue.severity === 'warn' && domainHealth[r.domain] !== 'critical') {
        domainHealth[r.domain] = 'warn';
      }
    }
  }

  const totalIssues = criticalCount + warnCount;
  const overallScore = Math.max(0, 100 - criticalCount * 15 - warnCount * 5);

  return {
    scenarios: results,
    totalIssues,
    criticalCount,
    warnCount,
    domainHealth,
    overallScore,
    durationMs: Date.now() - startTime,
  };
}

// ============================================================================
// 기본 시나리오 빌더 — 기존 lib 시뮬들을 래핑
// ============================================================================

import { simulateBattle } from './simulation/battleEngine';
import { simulateFpsDuel, aimSkillToProfile, WEAPON_PRESETS } from './fpsSimulation';
import { simulateDeck, CARD_PRESETS } from './deckSimulation';
import { simulateLaning, CHAMPION_PRESETS } from './mobaLaning';
import type { UnitStats } from './simulation/types';

export function defaultPlaytestScenarios(): PlaytestScenario[] {
  return [
    // Unit 1v1 — 동일 스탯이면 50% 근사
    {
      id: 'unit-mirror',
      name: '유닛 1v1 대칭 매치',
      domain: 'unit',
      runs: 30,
      run: () => {
        const unit: UnitStats = { id: 'a', name: 'A', hp: 600, maxHp: 600, atk: 80, def: 15, speed: 1.2 };
        let wins = 0;
        for (let i = 0; i < 10; i++) {
          const r = simulateBattle(unit, { ...unit, id: 'b', name: 'B' }, [], [], { maxDuration: 60, timeStep: 0.1 });
          if (r.winner === 'unit1') wins++;
        }
        return { unit1WinRate: wins / 10 };
      },
      validators: [
        {
          metricKey: 'unit1WinRate',
          expected: [0.35, 0.65],
          severity: 'warn',
          label: '대칭 매치 승률 편향',
          recommendation: '동일 스탯 유닛 간 공격 순서 / RNG 편향 확인',
        },
      ],
    },
    // FPS Duel — SMG vs AR
    {
      id: 'fps-smg-vs-ar',
      name: 'FPS SMG vs Assault Rifle',
      domain: 'fps',
      runs: 10,
      run: () => {
        const ar = WEAPON_PRESETS[0];
        const smg = WEAPON_PRESETS[1];
        const aim = aimSkillToProfile(50);
        const player = { hp: 100, shield: 0, armor: 0 };
        const r = simulateFpsDuel(
          smg, aim, ar, aim, player, player,
          { distance: 20, firstShot: 'both-aware', bothAwareDelayMs: 100 },
          200,
        );
        return { smgWinRate: r.aWinRate };
      },
      validators: [
        {
          metricKey: 'smgWinRate',
          expected: [0.3, 0.7],
          severity: 'warn',
          label: 'SMG vs AR 중거리 밸런스',
          recommendation: 'Range falloff 또는 RPM/피해 조정 필요',
        },
      ],
    },
    // Deck — 기본 Ironclad 덱이 쉬운 몹 클리어
    {
      id: 'deck-ironclad-dummy',
      name: '덱: Ironclad vs 더미',
      domain: 'deck',
      runs: 5,
      run: () => {
        const r = simulateDeck({
          cards: CARD_PRESETS,
          handSize: 5,
          baseEnergy: 3,
          turnsPerCombat: 10,
          enemies: [{ id: 'dummy', name: 'Dummy', hp: 80 }],
        }, 200);
        return { clearRate: r.clearRate ?? 0, avgDpt: r.avgDpt };
      },
      validators: [
        {
          metricKey: 'clearRate',
          expected: [0.7, 1.0],
          severity: 'critical',
          label: '기본 덱 클리어율',
          recommendation: '기본 덱이 쉬운 몹도 못 잡음 — 초기 카드 강도 재검토',
        },
      ],
    },
    // MOBA — Yasuo vs Thresh 라인전
    {
      id: 'moba-yasuo-vs-thresh',
      name: 'MOBA Yasuo vs Thresh (미드 vs 서폿)',
      domain: 'moba',
      runs: 3,
      run: () => {
        const r = simulateLaning({
          blue: CHAMPION_PRESETS[1],  // Yasuo
          red: CHAMPION_PRESETS[3],   // Thresh
          laneType: '1v1',
          durationSec: 600,
          minionsPerWave: 6,
          waveIntervalSec: 30,
          cannonEveryNWaves: 6,
        });
        return {
          laneDominance: r.laneDominanceScore,
          goldDiff: r.finalGoldDiff,
        };
      },
      validators: [
        {
          metricKey: 'laneDominance',
          expected: [-40, 100],  // Yasuo 가 전반 유리해야 정상 (역할 차이)
          severity: 'warn',
          label: 'Yasuo 미드 라인 우세',
          recommendation: 'Yasuo CS skill / aggression 수치 확인',
        },
      ],
    },
  ];
}
