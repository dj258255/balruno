/**
 * useSimulationState - 시뮬레이션 상태 관리 훅
 *
 * SimulationPanel의 모든 상태를 하나의 훅으로 관리
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useSimulationPreload } from '@/stores/simulationPreloadStore';
import type {
  UnitStats,
  SimulationResult,
  BattleConfig,
  DefenseFormulaType,
  ArmorPenetrationConfig,
  TeamBattleConfig,
  Skill,
} from '@/lib/simulation/types';

// 기본 유닛 스탯
const DEFAULT_STATS: UnitStats = {
  id: '',
  name: '',
  hp: 100,
  maxHp: 100,
  atk: 10,
  def: 0,
  speed: 1,
  critRate: 0,
  critDamage: 1.5,
  accuracy: 1,
  evasion: 0,
};

// 유닛별 통계
export interface UnitBattleStats {
  unitId: string;
  unitName: string;
  team: 'team1' | 'team2';
  survivalRate: number;          // 생존율 (0-1)
  avgDamageDealt: number;        // 평균 가한 데미지
  avgDamageTaken: number;        // 평균 받은 데미지
  avgKills: number;              // 평균 킬 수
  totalDamageDealt: number;      // 총 가한 데미지
  totalKills: number;            // 총 킬 수
  dps: number;                   // 초당 데미지
  mvpCount: number;              // MVP 횟수 (팀 내 최고 데미지)
}

// 팀 결과 타입
export interface TeamResult {
  totalRuns: number;
  team1Wins: number;
  team2Wins: number;
  draws: number;
  team1WinRate: number;
  team2WinRate: number;
  avgDuration: number;
  avgTeam1Survivors: number;
  avgTeam2Survivors: number;

  // 확장 통계
  // 전투 시간 분포
  durationDistribution: number[];
  minDuration: number;
  maxDuration: number;

  // 팀 총 데미지
  avgTeam1Damage: number;
  avgTeam2Damage: number;
  team1DPS: number;
  team2DPS: number;

  // 유닛별 상세 통계
  unitStats: UnitBattleStats[];

  // 승리 시 평균 생존 HP 비율
  avgTeam1SurvivorHpRatio: number;
  avgTeam2SurvivorHpRatio: number;

  // 샘플 전투 (상세 분석용)
  sampleBattles: import('@/lib/simulation/types').TeamBattleResult[];

  // 역전 분석
  team1Reversals: number;  // Team1이 불리한 상황에서 역전한 횟수
  team2Reversals: number;
  closeMatches: number;    // 박빙 (1명 차이로 끝난 경기)
}

// 팀 유닛 모달 상태 타입
export interface TeamUnitModalState {
  isOpen: boolean;
  teamNumber: 1 | 2;
  editUnit: UnitStats | null;
}

// 컬럼 매핑 타입
export interface ColumnMapping {
  name: string;
  hp: string;
  atk: string;
  def: string;
  speed: string;
  critRate: string;
  critDamage: string;
}

export function useSimulationState() {
  const { projects, currentProjectId, currentSheetId } = useProjectStore();

  // 현재 시트 데이터
  const currentProject = projects.find((p) => p.id === currentProjectId);
  const currentSheet = currentProject?.sheets.find((s) => s.id === currentSheetId);

  // === 1v1 상태 ===
  const [unit1Stats, setUnit1Stats] = useState<UnitStats>({
    ...DEFAULT_STATS,
    id: 'unit1',
    name: '유닛 A',
  });
  const [unit2Stats, setUnit2Stats] = useState<UnitStats>({
    ...DEFAULT_STATS,
    id: 'unit2',
    name: '유닛 B',
  });
  const [unit1Skills, setUnit1Skills] = useState<Skill[]>([]);
  const [unit2Skills, setUnit2Skills] = useState<Skill[]>([]);
  const [showUnit1Skills, setShowUnit1Skills] = useState(false);
  const [showUnit2Skills, setShowUnit2Skills] = useState(false);

  // === 설정 상태 ===
  const [runs, setRuns] = useState(10000);
  const [damageFormula, setDamageFormula] = useState<BattleConfig['damageFormula']>('simple');
  const [defenseFormula, setDefenseFormula] = useState<DefenseFormulaType>('subtractive');
  const [maxDuration, setMaxDuration] = useState(300);
  const [useArmorPen, setUseArmorPen] = useState(false);
  const [armorPen, setArmorPen] = useState<ArmorPenetrationConfig>({
    flatPenetration: 0,
    percentPenetration: 0,
  });

  // === 실행 상태 ===
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SimulationResult | null>(null);

  // === UI 상태 ===
  const [showSettings, setShowSettings] = useState(false);
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [selectedBattleIndex, setSelectedBattleIndex] = useState(0);
  const [battleMode, setBattleMode] = useState<'1v1' | 'team'>('1v1');

  // === 팀 전투 상태 ===
  const [team1Units, setTeam1Units] = useState<UnitStats[]>([]);
  const [team2Units, setTeam2Units] = useState<UnitStats[]>([]);
  const [targetingMode, setTargetingMode] = useState<TeamBattleConfig['targetingMode']>('random');
  const [teamResult, setTeamResult] = useState<TeamResult | null>(null);
  const [teamUnitModal, setTeamUnitModal] = useState<TeamUnitModalState>({
    isOpen: false,
    teamNumber: 1,
    editUnit: null,
  });

  // === 컬럼 매핑 ===
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    name: '',
    hp: '',
    atk: '',
    def: '',
    speed: '',
    critRate: '',
    critDamage: '',
  });

  // 자동 컬럼 감지
  const autoDetectedColumns = useMemo(() => {
    if (!currentSheet)
      return { name: '', hp: '', atk: '', def: '', speed: '', critRate: '', critDamage: '' };

    const columns = currentSheet.columns;
    const findCol = (patterns: string[]) => {
      const col = columns.find((c) =>
        patterns.some((p) => c.name.toLowerCase() === p.toLowerCase() || c.name.includes(p))
      );
      return col?.id || '';
    };

    return {
      name: findCol(['name', '이름']),
      hp: findCol(['hp', 'maxhp', '체력', 'HP']),
      atk: findCol(['atk', 'attack', '공격력', 'damage', '데미지', 'ATK']),
      def: findCol(['def', 'defense', '방어력', 'DEF']),
      speed: findCol(['speed', '속도', 'spd']),
      critRate: findCol(['critrate', 'crit_rate', '치명타율', '크리티컬']),
      critDamage: findCol(['critdmg', 'crit_damage', '치명타피해', '크리티컬데미지']),
    };
  }, [currentSheet]);

  // 실제 사용할 매핑
  const effectiveMapping = useMemo(
    () => ({
      name: columnMapping.name || autoDetectedColumns.name,
      hp: columnMapping.hp || autoDetectedColumns.hp,
      atk: columnMapping.atk || autoDetectedColumns.atk,
      def: columnMapping.def || autoDetectedColumns.def,
      speed: columnMapping.speed || autoDetectedColumns.speed,
      critRate: columnMapping.critRate || autoDetectedColumns.critRate,
      critDamage: columnMapping.critDamage || autoDetectedColumns.critDamage,
    }),
    [columnMapping, autoDetectedColumns]
  );

  // 시트에서 유닛 목록 추출
  const units = useMemo(() => {
    if (!currentSheet) return [];

    const sheetName = currentSheet.name;

    return currentSheet.rows
      .map((row, index) => {
        const rowNumber = index + 1;
        let displayName: string;

        if (effectiveMapping.name) {
          const rawName = row.cells[effectiveMapping.name];
          if (rawName !== null && rawName !== undefined && String(rawName).trim() !== '') {
            displayName = String(rawName);
          } else {
            displayName = `${sheetName} #${rowNumber}`;
          }
        } else {
          displayName = `${sheetName} #${rowNumber}`;
        }

        const hp = effectiveMapping.hp ? Number(row.cells[effectiveMapping.hp]) || 100 : 100;
        const atk = effectiveMapping.atk ? Number(row.cells[effectiveMapping.atk]) || 10 : 10;
        const def = effectiveMapping.def ? Number(row.cells[effectiveMapping.def]) || 0 : 0;
        const speed = effectiveMapping.speed ? Number(row.cells[effectiveMapping.speed]) || 1 : 1;
        const critRate = effectiveMapping.critRate
          ? Number(row.cells[effectiveMapping.critRate]) || 0
          : 0;
        const critDamage = effectiveMapping.critDamage
          ? Number(row.cells[effectiveMapping.critDamage]) || 1.5
          : 1.5;

        return {
          id: row.id,
          name: displayName,
          hp,
          maxHp: hp,
          atk,
          def,
          speed: speed > 0 ? speed : 1,
          critRate: critRate > 1 ? critRate / 100 : critRate,
          critDamage,
          accuracy: 1,
          evasion: 0,
        } as UnitStats;
      })
      .filter((u) => u.name && u.maxHp > 0);
  }, [currentSheet, effectiveMapping]);

  // === 액션 ===

  // 시트에서 유닛 불러오기
  const loadFromSheet = useCallback((unitNumber: 1 | 2, sheetUnit: UnitStats) => {
    if (unitNumber === 1) {
      setUnit1Stats({ ...sheetUnit });
    } else {
      setUnit2Stats({ ...sheetUnit });
    }
  }, []);

  // 팀에 유닛 추가
  const addToTeam = useCallback((team: 1 | 2, unit: UnitStats) => {
    if (team === 1) {
      setTeam1Units((prev) => {
        if (!prev.find((u) => u.id === unit.id)) {
          return [...prev, unit];
        }
        return prev;
      });
    } else {
      setTeam2Units((prev) => {
        if (!prev.find((u) => u.id === unit.id)) {
          return [...prev, unit];
        }
        return prev;
      });
    }
  }, []);

  // 팀에서 유닛 제거
  const removeFromTeam = useCallback((team: 1 | 2, unitId: string) => {
    if (team === 1) {
      setTeam1Units((prev) => prev.filter((u) => u.id !== unitId));
    } else {
      setTeam2Units((prev) => prev.filter((u) => u.id !== unitId));
    }
  }, []);

  // 팀 유닛 업데이트
  const updateTeamUnit = useCallback((team: 1 | 2, unit: UnitStats) => {
    const updateFn = (prev: UnitStats[]) => {
      const existingIndex = prev.findIndex((u) => u.id === unit.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = unit;
        return updated;
      } else {
        return [...prev, unit];
      }
    };

    if (team === 1) {
      setTeam1Units(updateFn);
    } else {
      setTeam2Units(updateFn);
    }
  }, []);

  // 팀 swap — team1 ↔ team2 일괄 교환 (자동 분배 후 사용자가 한 번에 뒤집기)
  const swapTeams = useCallback(() => {
    setTeam1Units((prev1) => {
      setTeam2Units(prev1);
      return team2Units;
    });
  }, [team2Units]);

  // 결과 초기화
  const resetResults = useCallback(() => {
    setResult(null);
    setTeamResult(null);
    setProgress(0);
    setSelectedBattleIndex(0);
  }, []);

  // 외부 진입점 (시트 행 우클릭 등) 에서 push 한 preload 를 마운트 시 consume.
  // 1v1: unit1Stats / unit2Stats 자동 채움 + 모드 전환
  // team: team1Units / team2Units 자동 채움 + 모드 전환
  useEffect(() => {
    const payload = useSimulationPreload.getState().consume();
    if (!payload) return;
    if (payload.mode === '1v1') {
      setBattleMode('1v1');
      setUnit1Stats({ ...payload.unit1 });
      if (payload.unit2) setUnit2Stats({ ...payload.unit2 });
    } else {
      setBattleMode('team');
      setTeam1Units(payload.team1);
      setTeam2Units(payload.team2);
    }
  }, []);

  return {
    // 현재 시트
    currentSheet,
    currentProject,

    // 1v1 상태
    unit1Stats,
    setUnit1Stats,
    unit2Stats,
    setUnit2Stats,
    unit1Skills,
    setUnit1Skills,
    unit2Skills,
    setUnit2Skills,
    showUnit1Skills,
    setShowUnit1Skills,
    showUnit2Skills,
    setShowUnit2Skills,

    // 설정
    runs,
    setRuns,
    damageFormula,
    setDamageFormula,
    defenseFormula,
    setDefenseFormula,
    maxDuration,
    setMaxDuration,
    useArmorPen,
    setUseArmorPen,
    armorPen,
    setArmorPen,

    // 실행 상태
    isRunning,
    setIsRunning,
    progress,
    setProgress,
    result,
    setResult,

    // UI 상태
    showSettings,
    setShowSettings,
    showDetailedStats,
    setShowDetailedStats,
    selectedBattleIndex,
    setSelectedBattleIndex,
    battleMode,
    setBattleMode,

    // 팀 전투
    team1Units,
    setTeam1Units,
    team2Units,
    setTeam2Units,
    targetingMode,
    setTargetingMode,
    teamResult,
    setTeamResult,
    teamUnitModal,
    setTeamUnitModal,

    // 컬럼 매핑
    columnMapping,
    setColumnMapping,
    autoDetectedColumns,
    effectiveMapping,
    units,

    // 액션
    loadFromSheet,
    addToTeam,
    removeFromTeam,
    updateTeamUnit,
    swapTeams,
    resetResults,
  };
}
