/**
 * 불균형 패턴 자동 감지
 * 시트 데이터에서 밸런스 문제를 자동으로 찾아냄
 */

import type { Sheet, CellValue } from '../types';

// 불균형 문제 타입
export type ImbalanceType =
  | 'outlier'           // 이상치 (너무 높거나 낮은 값)
  | 'power_creep'       // 파워 크립 (후반으로 갈수록 급격히 증가)
  | 'stat_dominance'    // 스탯 지배 (하나의 스탯이 너무 효율적)
  | 'dead_zone'         // 데드존 (사용되지 않는 구간)
  | 'cliff'             // 절벽 (갑작스러운 난이도 상승)
  | 'diminishing'       // 수확체감 없음 (스탯 효율이 계속 좋음)
  | 'correlation'       // 상관관계 이상 (있어야 할 관계가 없거나 반대)
  | 'variance'          // 분산 문제 (같은 티어 내 큰 차이)
  | 'efficiency';       // 효율 불균형 (비용 대비 효율 차이)

// 심각도
export type Severity = 'critical' | 'warning' | 'info';

// 불균형 이슈
export interface ImbalanceIssue {
  id: string;
  type: ImbalanceType;
  severity: Severity;
  title: string;
  description: string;
  affectedRows: string[];
  affectedColumns: string[];
  suggestion?: string;
  data?: Record<string, unknown>;
}

// 감지 설정
export interface DetectionConfig {
  outlierThreshold?: number;      // 이상치 감지 Z-score (기본 2.5)
  powerCreepThreshold?: number;   // 파워크립 감지 배율 (기본 3)
  varianceThreshold?: number;     // 분산 임계값 (기본 0.3)
  cliffThreshold?: number;        // 절벽 감지 배율 (기본 2)
}

const DEFAULT_CONFIG: DetectionConfig = {
  outlierThreshold: 2.5,
  powerCreepThreshold: 3,
  varianceThreshold: 0.3,
  cliffThreshold: 2,
};

/**
 * 숫자 컬럼의 통계 계산
 */
function calculateStats(values: number[]): {
  mean: number;
  std: number;
  min: number;
  max: number;
  median: number;
} {
  if (values.length === 0) {
    return { mean: 0, std: 0, min: 0, max: 0, median: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);

  return {
    mean,
    std,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted[Math.floor(sorted.length / 2)],
  };
}

/**
 * 컬럼에서 숫자 값만 추출
 */
function extractNumericValues(sheet: Sheet, columnId: string): { rowId: string; value: number }[] {
  const result: { rowId: string; value: number }[] = [];

  for (const row of sheet.rows) {
    const cellValue = row.cells[columnId];
    const num = typeof cellValue === 'number' ? cellValue : parseFloat(String(cellValue));

    if (!isNaN(num)) {
      result.push({ rowId: row.id, value: num });
    }
  }

  return result;
}

/**
 * 이상치 감지
 */
function detectOutliers(
  sheet: Sheet,
  config: DetectionConfig,
  sheetName?: string
): ImbalanceIssue[] {
  const issues: ImbalanceIssue[] = [];
  const threshold = config.outlierThreshold || 2.5;

  for (const column of sheet.columns) {
    const data = extractNumericValues(sheet, column.id);
    if (data.length < 3) continue;

    const values = data.map(d => d.value);
    const stats = calculateStats(values);

    if (stats.std === 0) continue;

    // Z-score로 이상치 찾기
    for (const { rowId, value } of data) {
      const zScore = Math.abs((value - stats.mean) / stats.std);

      if (zScore > threshold) {
        const rowIndex = sheet.rows.findIndex(r => r.id === rowId) + 1;
        const direction = value > stats.mean ? '높음' : '낮음';
        const sheetLabel = sheetName ? `${sheetName} > ` : '';

        issues.push({
          id: `outlier-${column.id}-${rowId}`,
          type: 'outlier',
          severity: zScore > threshold * 1.5 ? 'critical' : 'warning',
          title: `이상치 감지: ${sheetLabel}${column.name}`,
          description: `${rowIndex}행의 값(${value.toFixed(1)})이 평균(${stats.mean.toFixed(1)})보다 ${zScore.toFixed(1)} 표준편차만큼 ${direction}`,
          affectedRows: [rowId],
          affectedColumns: [column.id],
          suggestion: `평균값(${stats.mean.toFixed(1)}) 또는 중앙값(${stats.median.toFixed(1)}) 근처로 조정을 고려하세요.`,
          data: { value, mean: stats.mean, zScore },
        });
      }
    }
  }

  return issues;
}

/**
 * 파워 크립 감지 (후반으로 갈수록 급격히 증가)
 */
function detectPowerCreep(
  sheet: Sheet,
  config: DetectionConfig,
  sheetName?: string
): ImbalanceIssue[] {
  const issues: ImbalanceIssue[] = [];
  const threshold = config.powerCreepThreshold || 3;

  // 레벨/순서 컬럼 찾기
  const levelColumn = sheet.columns.find(c =>
    c.name.toLowerCase().includes('level') ||
    c.name.toLowerCase().includes('레벨') ||
    c.name.toLowerCase().includes('tier') ||
    c.name.includes('티어') ||
    c.name.includes('단계')
  );

  if (!levelColumn) return issues;

  // 숫자 컬럼들에 대해 검사
  for (const column of sheet.columns) {
    if (column.id === levelColumn.id) continue;

    const data = extractNumericValues(sheet, column.id);
    if (data.length < 5) continue;

    const values = data.map(d => d.value);

    // 첫 1/3과 마지막 1/3 비교
    const third = Math.floor(values.length / 3);
    const earlyValues = values.slice(0, third);
    const lateValues = values.slice(-third);

    const earlyAvg = earlyValues.reduce((a, b) => a + b, 0) / earlyValues.length;
    const lateAvg = lateValues.reduce((a, b) => a + b, 0) / lateValues.length;

    if (earlyAvg > 0 && lateAvg / earlyAvg > threshold) {
      const sheetLabel = sheetName ? `${sheetName} > ` : '';

      issues.push({
        id: `power-creep-${column.id}`,
        type: 'power_creep',
        severity: lateAvg / earlyAvg > threshold * 1.5 ? 'critical' : 'warning',
        title: `파워 크립: ${sheetLabel}${column.name}`,
        description: `후반(평균 ${lateAvg.toFixed(1)})이 초반(평균 ${earlyAvg.toFixed(1)})보다 ${(lateAvg / earlyAvg).toFixed(1)}배 높습니다.`,
        affectedRows: data.slice(-third).map(d => d.rowId),
        affectedColumns: [column.id],
        suggestion: '성장 곡선을 완만하게 조정하거나, 초반 값을 높이는 것을 고려하세요.',
        data: { earlyAvg, lateAvg, ratio: lateAvg / earlyAvg },
      });
    }
  }

  return issues;
}

/**
 * 분산 문제 감지 (같은 그룹 내 큰 차이)
 */
function detectVarianceIssues(
  sheet: Sheet,
  config: DetectionConfig,
  sheetName?: string
): ImbalanceIssue[] {
  const issues: ImbalanceIssue[] = [];
  const threshold = config.varianceThreshold || 0.3;

  // 타입/역할 컬럼 찾기
  const typeColumn = sheet.columns.find(c =>
    c.name.toLowerCase().includes('type') ||
    c.name.toLowerCase().includes('타입') ||
    c.name.toLowerCase().includes('role') ||
    c.name.includes('역할') ||
    c.name.includes('등급')
  );

  if (!typeColumn) return issues;

  // 타입별 그룹화
  const groups = new Map<string, { rowId: string; cells: Record<string, CellValue> }[]>();

  for (const row of sheet.rows) {
    const typeValue = String(row.cells[typeColumn.id] || '');
    if (!typeValue) continue;

    if (!groups.has(typeValue)) {
      groups.set(typeValue, []);
    }
    groups.get(typeValue)!.push({ rowId: row.id, cells: row.cells });
  }

  // 각 그룹 내 분산 검사
  for (const [groupName, rows] of groups) {
    if (rows.length < 2) continue;

    for (const column of sheet.columns) {
      if (column.id === typeColumn.id) continue;

      const values: number[] = [];
      for (const row of rows) {
        const num = typeof row.cells[column.id] === 'number'
          ? row.cells[column.id] as number
          : parseFloat(String(row.cells[column.id]));

        if (!isNaN(num)) values.push(num);
      }

      if (values.length < 2) continue;

      const stats = calculateStats(values);
      const cv = stats.mean !== 0 ? stats.std / stats.mean : 0; // 변동계수

      if (cv > threshold) {
        const sheetLabel = sheetName ? `${sheetName} > ` : '';

        issues.push({
          id: `variance-${column.id}-${groupName}`,
          type: 'variance',
          severity: cv > threshold * 2 ? 'warning' : 'info',
          title: `분산 문제: ${sheetLabel}${column.name}`,
          description: `${typeColumn.name}="${groupName}" 그룹 내에서 값의 편차가 큽니다 (${stats.min.toFixed(1)} ~ ${stats.max.toFixed(1)}, CV=${(cv * 100).toFixed(1)}%).`,
          affectedRows: rows.map(r => r.rowId),
          affectedColumns: [column.id],
          suggestion: `같은 ${typeColumn.name} 내 값을 비슷한 범위로 맞추거나, 그룹을 세분화하는 것을 고려하세요.`,
          data: { min: stats.min, max: stats.max, cv, groupColumn: typeColumn.name },
        });
      }
    }
  }

  return issues;
}

/**
 * 절벽 감지 (갑작스러운 상승)
 */
function detectCliffs(
  sheet: Sheet,
  config: DetectionConfig,
  sheetName?: string
): ImbalanceIssue[] {
  const issues: ImbalanceIssue[] = [];
  const threshold = config.cliffThreshold || 2;

  for (const column of sheet.columns) {
    const data = extractNumericValues(sheet, column.id);
    if (data.length < 3) continue;

    const values = data.map(d => d.value);

    // 연속된 값 간의 증가율 검사
    for (let i = 1; i < values.length; i++) {
      const prev = values[i - 1];
      const curr = values[i];

      if (prev > 0 && curr / prev > threshold) {
        // 행 인덱스 찾기
        const prevRowIndex = sheet.rows.findIndex(r => r.id === data[i - 1].rowId) + 1;
        const currRowIndex = sheet.rows.findIndex(r => r.id === data[i].rowId) + 1;

        const sheetLabel = sheetName ? `${sheetName} > ` : '';

        issues.push({
          id: `cliff-${column.id}-${i}`,
          type: 'cliff',
          severity: curr / prev > threshold * 1.5 ? 'critical' : 'warning',
          title: `급격한 변화: ${sheetLabel}${column.name}`,
          description: `${prevRowIndex}행(${prev.toFixed(1)})에서 ${currRowIndex}행(${curr.toFixed(1)})으로 ${(curr / prev).toFixed(1)}배 급등합니다.`,
          affectedRows: [data[i - 1].rowId, data[i].rowId],
          affectedColumns: [column.id],
          suggestion: '중간 단계를 추가하거나, 값의 차이를 줄이는 것을 고려하세요.',
          data: { prevValue: prev, currValue: curr, ratio: curr / prev },
        });
      }
    }
  }

  return issues;
}

/**
 * 효율 불균형 감지
 */
function detectEfficiencyImbalance(
  sheet: Sheet,
  sheetName?: string
): ImbalanceIssue[] {
  const issues: ImbalanceIssue[] = [];

  // 비용 컬럼 찾기
  const costColumn = sheet.columns.find(c =>
    c.name.toLowerCase().includes('cost') ||
    c.name.toLowerCase().includes('price') ||
    c.name.includes('비용') ||
    c.name.includes('가격') ||
    c.name.includes('골드')
  );

  if (!costColumn) return issues;

  // 효과/스탯 컬럼들
  const statColumns = sheet.columns.filter(c =>
    c.id !== costColumn.id &&
    c.name.toLowerCase() !== 'name' &&
    !c.name.includes('이름') &&
    !c.name.includes('설명')
  );

  for (const statColumn of statColumns) {
    const efficiencies: { rowId: string; efficiency: number; cost: number; stat: number }[] = [];

    for (const row of sheet.rows) {
      const cost = typeof row.cells[costColumn.id] === 'number'
        ? row.cells[costColumn.id] as number
        : parseFloat(String(row.cells[costColumn.id]));

      const stat = typeof row.cells[statColumn.id] === 'number'
        ? row.cells[statColumn.id] as number
        : parseFloat(String(row.cells[statColumn.id]));

      if (!isNaN(cost) && !isNaN(stat) && cost > 0) {
        efficiencies.push({ rowId: row.id, efficiency: stat / cost, cost, stat });
      }
    }

    if (efficiencies.length < 2) continue;

    const efficValues = efficiencies.map(e => e.efficiency);
    const stats = calculateStats(efficValues);

    // 가장 효율적인 것과 비효율적인 것 찾기
    const maxEffic = efficiencies.reduce((a, b) => a.efficiency > b.efficiency ? a : b);
    const minEffic = efficiencies.reduce((a, b) => a.efficiency < b.efficiency ? a : b);

    if (maxEffic.efficiency > minEffic.efficiency * 2 && stats.std / stats.mean > 0.3) {
      const maxRowIndex = sheet.rows.findIndex(r => r.id === maxEffic.rowId) + 1;
      const minRowIndex = sheet.rows.findIndex(r => r.id === minEffic.rowId) + 1;
      const sheetLabel = sheetName ? `${sheetName} > ` : '';

      issues.push({
        id: `efficiency-${statColumn.id}`,
        type: 'efficiency',
        severity: maxEffic.efficiency / minEffic.efficiency > 3 ? 'warning' : 'info',
        title: `효율 불균형: ${sheetLabel}${statColumn.name}/${costColumn.name}`,
        description: `${maxRowIndex}행의 효율(${maxEffic.efficiency.toFixed(2)})이 ${minRowIndex}행(${minEffic.efficiency.toFixed(2)})의 ${(maxEffic.efficiency / minEffic.efficiency).toFixed(1)}배입니다.`,
        affectedRows: efficiencies.map(e => e.rowId),
        affectedColumns: [costColumn.id, statColumn.id],
        suggestion: '비용 대비 효율이 비슷하도록 조정하거나, 의도된 차이라면 다른 보상을 추가하세요.',
        data: { maxEfficiency: maxEffic.efficiency, minEfficiency: minEffic.efficiency },
      });
    }
  }

  return issues;
}

/**
 * 시트에서 불균형 문제 감지
 */
export function detectImbalances(
  sheet: Sheet,
  config: Partial<DetectionConfig> = {},
  sheetName?: string
): ImbalanceIssue[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const name = sheetName || sheet.name;

  const issues: ImbalanceIssue[] = [
    ...detectOutliers(sheet, cfg, name),
    ...detectPowerCreep(sheet, cfg, name),
    ...detectVarianceIssues(sheet, cfg, name),
    ...detectCliffs(sheet, cfg, name),
    ...detectEfficiencyImbalance(sheet, name),
  ];

  // 심각도 순으로 정렬
  const severityOrder: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return issues;
}

/**
 * 심각도별 색상
 */
export function getSeverityColor(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return 'var(--primary-red)';
    case 'warning':
      return 'var(--primary-yellow)';
    case 'info':
      return 'var(--primary-blue)';
  }
}

