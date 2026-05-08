/**
 * useBalanceAnalysisState - 밸런스 분석 상태 관리 훅
 */

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import type { UnitStats } from '@/lib/simulation/types';
import {
  calculateMatchupMatrix,
  analyzePerfectImbalance,
  analyzePowerCurve,
  analyzeCorrelations,
  type PerfectImbalanceResult,
  type PowerCurveAnalysis,
  type CorrelationResult,
} from '@/lib/balanceAnalysis';
import type { ColumnMapping } from '../components/ColumnMappingConfig';

export type AnalysisTab = 'matchup' | 'power' | 'correlation' | 'deadzone' | 'curve';

// 컬럼명 자동 감지 함수
function autoDetectColumn(
  columns: { id: string; name: string }[],
  patterns: string[]
): string | undefined {
  for (const pattern of patterns) {
    const found = columns.find(c =>
      c.name.toLowerCase() === pattern.toLowerCase() ||
      c.name.toLowerCase().includes(pattern.toLowerCase())
    );
    if (found) return found.id;
  }
  return undefined;
}

export function useBalanceAnalysisState(
  externalShowHelp?: boolean,
  externalSetShowHelp?: (value: boolean) => void
) {
  const t = useTranslations('balanceAnalysis');
  const { projects, currentProjectId, currentSheetId } = useProjectStore();
  const [activeTab, setActiveTab] = useState<AnalysisTab>('matchup');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [matchupResult, setMatchupResult] = useState<PerfectImbalanceResult | null>(null);
  const [powerResult, setPowerResult] = useState<PowerCurveAnalysis | null>(null);
  const [correlationResult, setCorrelationResult] = useState<CorrelationResult[] | null>(null);
  const [runsPerMatch, setRunsPerMatch] = useState(50);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [internalShowHelp, setInternalShowHelp] = useState(false);
  const [showTabDropdown, setShowTabDropdown] = useState(false);

  // 프로젝트 및 시트 선택 상태
  const [selectedProjectId, setSelectedProjectId] = useState<string>(currentProjectId || '');
  const [selectedSheetId, setSelectedSheetId] = useState<string>(currentSheetId || '');

  // 컬럼 매핑 상태
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});

  // 외부 상태가 있으면 사용, 없으면 내부 상태 사용
  const showHelp = externalShowHelp !== undefined ? externalShowHelp : internalShowHelp;
  const setShowHelp = externalSetShowHelp || setInternalShowHelp;

  const currentProject = projects.find(p => p.id === selectedProjectId);
  const currentSheet = currentProject?.sheets.find(s => s.id === selectedSheetId);

  // 시트가 변경되면 컬럼 자동 감지
  useEffect(() => {
    if (!currentSheet) return;

    const columns = currentSheet.columns;
    const autoMapping: ColumnMapping = {
      name: autoDetectColumn(columns, ['name', '이름', '유닛', 'unit']),
      hp: autoDetectColumn(columns, ['hp', '체력', 'health', 'HP']),
      atk: autoDetectColumn(columns, ['atk', '공격력', 'attack', 'damage', 'ATK']),
      def: autoDetectColumn(columns, ['def', '방어력', 'defense', 'DEF']),
      speed: autoDetectColumn(columns, ['speed', '속도', 'spd', 'SPD']),
      level: autoDetectColumn(columns, ['level', '레벨', 'lv', 'LV']),
    };

    setColumnMapping(autoMapping);
  }, [currentSheet?.id]);

  // 시트에서 유닛 데이터 추출 (컬럼 매핑 사용)
  const units = useMemo((): UnitStats[] => {
    if (!currentSheet) return [];

    return currentSheet.rows.map((row, index) => {
      const fallback = t('defaultUnitName', { n: index + 1 });
      const name = columnMapping.name
        ? String(row.cells[columnMapping.name] || fallback)
        : fallback;
      const hp = columnMapping.hp
        ? Number(row.cells[columnMapping.hp]) || 100
        : 100;
      const atk = columnMapping.atk
        ? Number(row.cells[columnMapping.atk]) || 10
        : 10;
      const def = columnMapping.def
        ? Number(row.cells[columnMapping.def]) || 0
        : 0;
      const speed = columnMapping.speed
        ? Number(row.cells[columnMapping.speed]) || 1
        : 1;

      return {
        id: row.id,
        name,
        hp,
        maxHp: hp,
        atk,
        def,
        speed: speed > 0 ? speed : 1,
      };
    }).filter(u => u.maxHp > 0);
  }, [currentSheet, columnMapping]);

  // Perfect Imbalance 분석 실행
  const runMatchupAnalysis = async () => {
    if (units.length < 2) return;

    setIsAnalyzing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const matrix = calculateMatchupMatrix(units, runsPerMatch);
      const result = analyzePerfectImbalance(matrix);
      setMatchupResult(result);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 파워 커브 분석 (컬럼 매핑 사용)
  const runPowerAnalysis = () => {
    if (!currentSheet) return;

    if (!columnMapping.level) {
      alert(t('alertSelectLevel'));
      return;
    }

    const data = currentSheet.rows.map((row, i) => {
      const level = Number(row.cells[columnMapping.level!]) || 1;
      const unit = units[i];
      const power = unit ? (unit.hp * 0.5 + unit.atk * 2 + unit.def * 1.5 + unit.speed * 5) : 0;
      return { level, power };
    }).filter(d => d.power > 0).sort((a, b) => a.level - b.level);

    const result = analyzePowerCurve(data);
    setPowerResult(result);
  };

  // 상관관계 분석 (선택된 스탯만)
  const runCorrelationAnalysis = () => {
    // 선택된 스탯만 필터링
    const selectedStats = (['hp', 'atk', 'def', 'speed'] as const).filter(
      stat => columnMapping[stat]
    );

    if (selectedStats.length < 2) {
      alert(t('alertSelectStats'));
      return;
    }

    const unitData = units.map(u => ({
      hp: u.maxHp,
      atk: u.atk,
      def: u.def,
      speed: u.speed,
    }));

    const result = analyzeCorrelations(unitData, selectedStats);
    setCorrelationResult(result);
  };

  // 프로젝트 변경 시 시트 초기화 및 분석 결과 초기화
  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    const project = projects.find(p => p.id === projectId);
    if (project && project.sheets.length > 0) {
      setSelectedSheetId(project.sheets[0].id);
    } else {
      setSelectedSheetId('');
    }
    setMatchupResult(null);
    setPowerResult(null);
    setCorrelationResult(null);
  };

  // 시트 변경 시 분석 결과 초기화
  const handleSheetChange = (sheetId: string) => {
    setSelectedSheetId(sheetId);
    setMatchupResult(null);
    setPowerResult(null);
    setCorrelationResult(null);
  };

  return {
    // 상태
    activeTab,
    setActiveTab,
    isAnalyzing,
    matchupResult,
    powerResult,
    correlationResult,
    runsPerMatch,
    setRunsPerMatch,
    showMatrixModal,
    setShowMatrixModal,
    showHelp,
    setShowHelp,
    showTabDropdown,
    setShowTabDropdown,
    units,
    currentSheet,
    columnMapping,
    setColumnMapping,
    // 프로젝트/시트 선택
    projects,
    selectedProjectId,
    setSelectedProjectId: handleProjectChange,
    selectedSheetId,
    setSelectedSheetId: handleSheetChange,
    // 액션
    runMatchupAnalysis,
    runPowerAnalysis,
    runCorrelationAnalysis,
  };
}
