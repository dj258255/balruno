/**
 * useSimulationActions - 시뮬레이션 액션 훅
 *
 * 시뮬레이션 실행, 결과 내보내기 등의 액션 로직
 */

import { useCallback } from 'react';
import type {
  UnitStats,
  SimulationResult,
  BattleConfig,
  DefenseFormulaType,
  ArmorPenetrationConfig,
  TeamBattleConfig,
  Skill,
} from '@/lib/simulation/types';
import { runMonteCarloSimulationAsync } from '@/lib/simulation/monteCarloSimulator';
import { runTeamMonteCarloSimulation } from '@/lib/simulation/battleEngine';
import { useReplayStore } from '@/stores/replayStore';
import type { TeamResult } from './useSimulationState';

interface UseSimulationActionsProps {
  // 1v1 유닛
  unit1Stats: UnitStats;
  unit2Stats: UnitStats;
  unit1Skills: Skill[];
  unit2Skills: Skill[];

  // 팀 유닛
  team1Units: UnitStats[];
  team2Units: UnitStats[];

  // 설정
  runs: number;
  maxDuration: number;
  damageFormula: BattleConfig['damageFormula'];
  defenseFormula: DefenseFormulaType;
  useArmorPen: boolean;
  armorPen: ArmorPenetrationConfig;
  targetingMode: TeamBattleConfig['targetingMode'];

  // 상태 setters
  setIsRunning: (value: boolean) => void;
  setProgress: (value: number) => void;
  setResult: (value: SimulationResult | null) => void;
  setTeamResult: (value: TeamResult | null) => void;
  setSelectedBattleIndex: (value: number) => void;
}

export function useSimulationActions({
  unit1Stats,
  unit2Stats,
  unit1Skills,
  unit2Skills,
  team1Units,
  team2Units,
  runs,
  maxDuration,
  damageFormula,
  defenseFormula,
  useArmorPen,
  armorPen,
  targetingMode,
  setIsRunning,
  setProgress,
  setResult,
  setTeamResult,
  setSelectedBattleIndex,
}: UseSimulationActionsProps) {
  // 1v1 시뮬레이션 실행
  const runSimulation = useCallback(async () => {
    if (
      !unit1Stats.name ||
      !unit2Stats.name ||
      unit1Stats.maxHp <= 0 ||
      unit2Stats.maxHp <= 0
    ) {
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setResult(null);

    try {
      const simulationResult = await runMonteCarloSimulationAsync(
        unit1Stats,
        unit2Stats,
        unit1Skills,
        unit2Skills,
        {
          runs,
          config: {
            maxDuration,
            timeStep: 0.1,
            damageFormula,
            defenseFormula,
            armorPenetration: useArmorPen ? armorPen : undefined,
          },
          saveSampleBattles: 10,
          onProgress: setProgress,
        }
      );

      setResult(simulationResult);
      setSelectedBattleIndex(0);

      // 첫 번째 샘플 전투를 Replay 패널에 publish — step-by-step 검사 가능
      const firstSample = simulationResult.sampleBattles[0];
      if (firstSample) {
        useReplayStore.getState().publish({
          unit1: unit1Stats,
          unit2: unit2Stats,
          skills1: unit1Skills,
          skills2: unit2Skills,
          result: firstSample,
          source: '전투 시뮬 1:1',
        });
      }
    } catch (error) {
      console.error('Simulation failed:', error);
    } finally {
      setIsRunning(false);
      setProgress(100);
    }
  }, [
    unit1Stats,
    unit2Stats,
    unit1Skills,
    unit2Skills,
    runs,
    maxDuration,
    damageFormula,
    defenseFormula,
    useArmorPen,
    armorPen,
    setIsRunning,
    setProgress,
    setResult,
    setSelectedBattleIndex,
  ]);

  // 팀 시뮬레이션 실행
  const runTeamSimulation = useCallback(() => {
    if (team1Units.length === 0 || team2Units.length === 0) return;

    setIsRunning(true);
    setProgress(0);
    setTeamResult(null);

    setTimeout(() => {
      try {
        const teamSimResult = runTeamMonteCarloSimulation(team1Units, team2Units, runs, {
          maxDuration,
          timeStep: 0.1,
          damageFormula,
          defenseFormula,
          armorPenetration: useArmorPen ? armorPen : undefined,
          teamSize: Math.max(team1Units.length, team2Units.length),
          targetingMode,
        });

        setTeamResult(teamSimResult);
      } catch (error) {
        console.error('Team simulation failed:', error);
      } finally {
        setIsRunning(false);
        setProgress(100);
      }
    }, 10);
  }, [
    team1Units,
    team2Units,
    runs,
    maxDuration,
    damageFormula,
    defenseFormula,
    useArmorPen,
    armorPen,
    targetingMode,
    setIsRunning,
    setProgress,
    setTeamResult,
  ]);

  // 결과 내보내기
  const exportResults = useCallback(
    (format: 'json' | 'csv', result: SimulationResult | null) => {
      if (!result) return;

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `simulation_${unit1Stats.name}_vs_${unit2Stats.name}_${timestamp}`;

      if (format === 'json') {
        const exportData = {
          meta: {
            exportedAt: new Date().toISOString(),
            unit1: unit1Stats,
            unit2: unit2Stats,
            config: {
              runs,
              maxDuration,
              damageFormula,
              defenseFormula,
              armorPenetration: useArmorPen ? armorPen : undefined,
            },
          },
          summary: {
            totalRuns: result.totalRuns,
            unit1Wins: result.unit1Wins,
            unit2Wins: result.unit2Wins,
            draws: result.draws,
            unit1WinRate: result.unit1WinRate,
            unit2WinRate: result.unit2WinRate,
          },
          statistics: {
            avgDuration: result.avgDuration,
            minDuration: result.minDuration,
            maxDuration: result.maxDuration,
            unit1: {
              avgDamage: result.unit1AvgDamage,
              avgDps: result.unit1AvgDps,
              avgSurvivalHp: result.unit1AvgSurvivalHp,
              ttkStats: result.ttkStats?.unit1,
            },
            unit2: {
              avgDamage: result.unit2AvgDamage,
              avgDps: result.unit2AvgDps,
              avgSurvivalHp: result.unit2AvgSurvivalHp,
              ttkStats: result.ttkStats?.unit2,
            },
          },
          critStats: result.critStats,
          reversalAnalysis: result.reversalAnalysis,
          winRateConfidence: result.winRateConfidence,
          theoreticalDps: result.theoreticalDps,
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const rows = [
          ['Metric', 'Unit 1', 'Unit 2', 'Notes'],
          ['Name', unit1Stats.name, unit2Stats.name, ''],
          ['Total Runs', result.totalRuns.toString(), '', ''],
          [
            'Wins',
            result.unit1Wins.toString(),
            result.unit2Wins.toString(),
            `Draws: ${result.draws}`,
          ],
          [
            'Win Rate',
            `${(result.unit1WinRate * 100).toFixed(2)}%`,
            `${(result.unit2WinRate * 100).toFixed(2)}%`,
            '',
          ],
          [
            'Avg Duration',
            `${result.avgDuration.toFixed(2)}s`,
            '',
            `Range: ${result.minDuration.toFixed(1)}-${result.maxDuration.toFixed(1)}s`,
          ],
          ['Avg Damage', result.unit1AvgDamage.toFixed(0), result.unit2AvgDamage.toFixed(0), ''],
          ['Avg DPS', result.unit1AvgDps.toFixed(2), result.unit2AvgDps.toFixed(2), ''],
          [
            'Avg Survival HP',
            result.unit1AvgSurvivalHp.toFixed(0),
            result.unit2AvgSurvivalHp.toFixed(0),
            'When winning',
          ],
        ];

        if (result.ttkStats) {
          rows.push([
            'TTK Avg',
            `${result.ttkStats.unit1.avg.toFixed(2)}s`,
            `${result.ttkStats.unit2.avg.toFixed(2)}s`,
            'Time to Kill',
          ]);
        }

        if (result.critStats) {
          rows.push([
            'Total Crits',
            result.critStats.unit1.totalCrits.toString(),
            result.critStats.unit2.totalCrits.toString(),
            '',
          ]);
          rows.push([
            'Actual Crit Rate',
            `${(result.critStats.unit1.avgCritRate * 100).toFixed(2)}%`,
            `${(result.critStats.unit2.avgCritRate * 100).toFixed(2)}%`,
            '',
          ]);
        }

        if (result.reversalAnalysis) {
          rows.push([
            'Reversals',
            result.reversalAnalysis.unit1Reversals.toString(),
            result.reversalAnalysis.unit2Reversals.toString(),
            '',
          ]);
          rows.push([
            'Crit Reversals',
            result.reversalAnalysis.critCausedReversals.toString(),
            '',
            'Total',
          ]);
          rows.push([
            'Close Matches',
            result.reversalAnalysis.closeMatches.toString(),
            '',
            'HP <= 10%',
          ]);
        }

        const csvContent = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    [unit1Stats, unit2Stats, runs, maxDuration, damageFormula, defenseFormula, useArmorPen, armorPen]
  );

  return {
    runSimulation,
    runTeamSimulation,
    exportResults,
  };
}
