/**
 * 엔티티 레벨 테이블 생성 모듈
 *
 * 캐릭터/몬스터 정의에서 레벨별 스탯 테이블을 자동 생성
 */

import type {
  CurveType,
  InterpolationType,
  EntityDefinition,
  StatOverride,
  LevelTableRow,
  LevelTableConfig,
  Sheet,
  Column,
  Row,
  CellValue,
} from '@/types';
import { SCALE } from '@/lib/formulaEngine';

// ============================================
// 스탯 계산 함수
// ============================================

/**
 * 특정 레벨의 스탯 값 계산
 */
function calculateStatAtLevel(
  baseStat: number,
  level: number,
  curveType: CurveType,
  growthRate: number
): number {
  // level은 1부터 시작, SCALE 함수는 0부터 계산하므로 level-1 사용
  const result = SCALE(baseStat, level - 1, growthRate, curveType);
  return Math.round(result);
}

/**
 * 보간 함수들
 */
function linearInterpolation(t: number): number {
  return t;
}

function stepInterpolation(t: number): number {
  // 스텝: 50% 미만은 이전값, 50% 이상은 다음값
  return t < 0.5 ? 0 : 1;
}

function easeInOutInterpolation(t: number): number {
  // ease-in-out: 부드러운 S커브
  return t < 0.5
    ? 2 * t * t
    : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function getInterpolationFunction(type: InterpolationType): (t: number) => number {
  switch (type) {
    case 'step': return stepInterpolation;
    case 'ease-in-out': return easeInOutInterpolation;
    case 'linear':
    default: return linearInterpolation;
  }
}

/**
 * 오버라이드 포인트 사이의 값을 보간
 * 오버라이드가 있는 경우, 그 사이 레벨들은 지정된 방식으로 보간
 */
function interpolateWithOverrides(
  baseStat: number,
  level: number,
  curveType: CurveType,
  growthRate: number,
  overrides: StatOverride[],
  statName: string,
  interpolationType: InterpolationType = 'linear'
): { value: number; isOverridden: boolean } {
  // 해당 레벨에 직접 오버라이드가 있는 경우
  const directOverride = overrides.find(o => o.level === level);
  if (directOverride && directOverride.stats[statName] !== undefined) {
    return { value: directOverride.stats[statName], isOverridden: true };
  }

  // 오버라이드 포인트들을 레벨 순으로 정렬
  const sortedOverrides = overrides
    .filter(o => o.stats[statName] !== undefined)
    .sort((a, b) => a.level - b.level);

  if (sortedOverrides.length === 0) {
    // 오버라이드 없음 - 순수 공식 계산
    return { value: calculateStatAtLevel(baseStat, level, curveType, growthRate), isOverridden: false };
  }

  // 현재 레벨 앞뒤의 오버라이드 찾기
  let prevOverride: StatOverride | null = null;
  let nextOverride: StatOverride | null = null;

  for (const override of sortedOverrides) {
    if (override.level < level) {
      prevOverride = override;
    } else if (override.level > level && !nextOverride) {
      nextOverride = override;
      break;
    }
  }

  // 보간 로직
  if (prevOverride && nextOverride) {
    // 두 오버라이드 사이 - 지정된 방식으로 보간
    const rawT = (level - prevOverride.level) / (nextOverride.level - prevOverride.level);
    const interpolate = getInterpolationFunction(interpolationType);
    const t = interpolate(rawT);
    const prevValue = prevOverride.stats[statName]!;
    const nextValue = nextOverride.stats[statName]!;
    return { value: Math.round(prevValue + (nextValue - prevValue) * t), isOverridden: false };
  } else if (prevOverride && !nextOverride) {
    // 마지막 오버라이드 이후 - 해당 오버라이드 기준으로 공식 적용
    const overrideLevel = prevOverride.level;
    const overrideValue = prevOverride.stats[statName]!;
    const levelDiff = level - overrideLevel;
    // 오버라이드 포인트에서의 성장률로 이후 레벨 계산
    const multiplier = calculateStatAtLevel(1, levelDiff + 1, curveType, growthRate);
    return { value: Math.round(overrideValue * multiplier), isOverridden: false };
  } else if (!prevOverride && nextOverride) {
    // 첫 오버라이드 이전 - 역산으로 레벨 1부터 계산
    const overrideLevel = nextOverride.level;
    const overrideValue = nextOverride.stats[statName]!;
    // 레벨 1에서 오버라이드 레벨까지의 배율
    const multiplier = calculateStatAtLevel(1, overrideLevel, curveType, growthRate);
    const estimatedBase = overrideValue / multiplier;
    return { value: Math.round(calculateStatAtLevel(estimatedBase, level, curveType, growthRate)), isOverridden: false };
  }

  // 기본 계산
  return { value: calculateStatAtLevel(baseStat, level, curveType, growthRate), isOverridden: false };
}

// ============================================
// 엔티티 정의 파싱
// ============================================

/**
 * 시트에서 스탯 컬럼 자동 감지
 * "기본*" 패턴의 컬럼을 스탯으로 인식
 * 예: 기본HP, 기본ATK, 기본DEF, 기본SPD, 기본CRIT 등
 */
function detectStatColumns(sheet: Sheet): string[] {
  const stats: string[] = [];
  const basePattern = /^기본(.+)$/;

  for (const col of sheet.columns) {
    const match = col.name.match(basePattern);
    if (match) {
      stats.push(match[1]); // "기본HP" -> "HP"
    }
  }

  return stats;
}


// ============================================
// 레벨 테이블 생성
// ============================================

/**
 * 엔티티 정의에서 레벨 테이블 행 생성
 */
export function generateLevelTableRows(entity: EntityDefinition): LevelTableRow[] {
  const rows: LevelTableRow[] = [];

  for (let level = 1; level <= entity.maxLevel; level++) {
    const stats: Record<string, number> = {};
    const isOverridden: Record<string, boolean> = {};

    for (const [statName, baseStat] of Object.entries(entity.baseStats)) {
      const curve = entity.growthCurves[statName];
      if (!curve) {
        stats[statName] = baseStat;
        isOverridden[statName] = false;
        continue;
      }

      const result = interpolateWithOverrides(
        baseStat,
        level,
        curve.curveType,
        curve.growthRate,
        entity.overrides,
        statName
      );

      stats[statName] = result.value;
      isOverridden[statName] = result.isOverridden;
    }

    rows.push({
      entityId: entity.id,
      entityName: entity.name,
      level,
      stats,
      isOverridden,
    });
  }

  return rows;
}




// ============================================
// 미리보기 데이터 생성
// ============================================

/**
 * 미리보기용 샘플 레벨 데이터 생성 (1, 10, 25, 50, 100 레벨 등)
 */
export function generatePreviewData(
  entity: EntityDefinition,
  previewLevels: number[] = [1, 5, 10, 25, 50]
): LevelTableRow[] {
  const allRows = generateLevelTableRows(entity);
  const filteredLevels = previewLevels.filter(l => l <= entity.maxLevel);

  return allRows.filter(row => filteredLevels.includes(row.level));
}

/**
 * 성장 곡선 그래프용 데이터 생성
 */
export function generateCurvePreviewData(
  baseStat: number,
  maxLevel: number,
  curveType: CurveType,
  growthRate: number,
  overrides?: StatOverride[],
  statName?: string,
  interpolationType: InterpolationType = 'linear'
): { level: number; value: number; isOverridden: boolean }[] {
  const data: { level: number; value: number; isOverridden: boolean }[] = [];

  for (let level = 1; level <= maxLevel; level++) {
    if (overrides && statName) {
      const result = interpolateWithOverrides(
        baseStat,
        level,
        curveType,
        growthRate,
        overrides,
        statName,
        interpolationType
      );
      data.push({
        level,
        value: result.value,
        isOverridden: result.isOverridden,
      });
    } else {
      data.push({
        level,
        value: calculateStatAtLevel(baseStat, level, curveType, growthRate),
        isOverridden: false,
      });
    }
  }

  return data;
}

// ============================================
// 유틸리티
// ============================================

/**
 * 성장 곡선 타입 목록
 */
export const CURVE_TYPES: { value: CurveType; label: string; description: string }[] = [
  { value: 'linear', label: '선형', description: '일정한 증가량 (base + level × rate)' },
  { value: 'exponential', label: '지수', description: '점점 빠르게 증가 (base × rate^level)' },
  { value: 'logarithmic', label: '로그', description: '점점 느리게 증가 (base + rate × ln(level))' },
  { value: 'quadratic', label: '2차', description: '가속 증가 (base + rate × level²)' },
  { value: 'scurve', label: 'S-커브', description: '초반 느림 → 중반 빠름 → 후반 느림' },
];

/**
 * 기본 성장률 추천값
 */
export const DEFAULT_GROWTH_RATES: Record<CurveType, number> = {
  linear: 10,        // 레벨당 +10
  exponential: 1.08, // 레벨당 ×1.08 (8% 증가)
  logarithmic: 50,   // 로그 계수
  quadratic: 0.5,    // 2차 계수
  scurve: 0.1,       // S-커브 기울기
};

/**
 * 엔티티 타입 목록
 */
export const ENTITY_TYPES: { value: EntityDefinition['entityType']; label: string }[] = [
  { value: 'character', label: '캐릭터' },
  { value: 'monster', label: '몬스터' },
  { value: 'npc', label: 'NPC' },
  { value: 'item', label: '아이템' },
];
