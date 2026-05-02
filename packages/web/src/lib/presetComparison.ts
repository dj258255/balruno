/**
 * 프리셋 비교/차이 분석 유틸리티
 * - 컬럼 이름 기반 매칭 (ID가 달라도 비교 가능)
 * - 행 이름/인덱스 기반 매칭 (복제된 시트도 비교 가능)
 */

import type { Sheet, CellValue, Project } from '@/types';
import { evaluateFormula } from '@/lib/formulaEngine';

// 비교 결과 타입
export interface ComparisonResult {
  // 전체 요약
  summary: {
    totalRows: number;
    changedRows: number;
    addedRows: number;
    removedRows: number;
    totalColumns: number;
    changedCells: number;
  };

  // 행별 변경 사항
  rowChanges: RowChange[];

  // 열별 통계 변화
  columnStats: ColumnStatChange[];
}

export interface RowChange {
  rowId: string;
  rowName: string;
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  cellChanges: CellChange[];
}

export interface CellChange {
  columnId: string;
  columnName: string;
  oldValue: CellValue;
  newValue: CellValue;
  oldComputedValue?: number | null; // 수식인 경우 계산된 값
  newComputedValue?: number | null; // 수식인 경우 계산된 값
  diff: number | null; // 숫자인 경우 차이값
  diffPercent: number | null; // 숫자인 경우 퍼센트 차이
}

export interface ColumnStatChange {
  columnId: string;
  columnName: string;
  oldStats: ColumnStats;
  newStats: ColumnStats;
  avgDiff: number;
  avgDiffPercent: number;
}

export interface ColumnStats {
  min: number;
  max: number;
  avg: number;
  sum: number;
  count: number;
}

/**
 * 이름 컬럼 찾기 (다양한 이름 패턴 지원)
 */
function findNameColumn(columns: { id: string; name: string }[]): string | null {
  // 우선순위 1: 정확히 'name' 또는 '이름'
  const exactMatch = columns.find(c =>
    c.name.toLowerCase() === 'name' ||
    c.name === '이름'
  );
  if (exactMatch) return exactMatch.id;

  // 우선순위 2: 'name' 또는 '이름' 포함
  const partialMatch = columns.find(c =>
    c.name.toLowerCase().includes('name') ||
    c.name.includes('이름')
  );
  if (partialMatch) return partialMatch.id;

  // 우선순위 3: 두 번째 컬럼 (첫 번째가 보통 ID/번호)
  if (columns.length >= 2) return columns[1].id;

  // 우선순위 4: 첫 번째 컬럼
  if (columns.length >= 1) return columns[0].id;

  return null;
}

/**
 * 컬럼에서 값 가져오기 (컬럼 이름으로)
 */
function getValueByColumnName(
  row: { cells: Record<string, CellValue> },
  columnName: string,
  columnNameToId: Map<string, string>
): CellValue {
  const colId = columnNameToId.get(columnName);
  if (!colId) return null;
  return row.cells[colId] ?? null;
}

/**
 * 두 시트의 컬럼 통계 계산 (컬럼 이름 기반)
 */
function calculateColumnStats(
  sheet: Sheet,
  columnName: string,
  columnNameToId: Map<string, string>
): ColumnStats {
  const values: number[] = [];
  const colId = columnNameToId.get(columnName);

  if (!colId) {
    return { min: 0, max: 0, avg: 0, sum: 0, count: 0 };
  }

  for (const row of sheet.rows) {
    const value = row.cells[colId];
    if (typeof value === 'number') {
      values.push(value);
    } else if (typeof value === 'string') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        values.push(num);
      }
    }
  }

  if (values.length === 0) {
    return { min: 0, max: 0, avg: 0, sum: 0, count: 0 };
  }

  const sum = values.reduce((a, b) => a + b, 0);

  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: sum / values.length,
    sum,
    count: values.length,
  };
}

/**
 * 행의 고유 식별자 생성 (이름 컬럼 값 또는 인덱스)
 */
function getRowIdentifier(
  row: { cells: Record<string, CellValue> },
  nameColumnId: string | null,
  index: number
): string {
  if (nameColumnId) {
    const nameValue = row.cells[nameColumnId];
    if (nameValue !== null && nameValue !== undefined && String(nameValue).trim() !== '') {
      return String(nameValue).trim();
    }
  }
  // 이름이 없으면 인덱스 기반
  return `__index_${index}`;
}

/**
 * 시트의 모든 셀에 대해 계산된 값을 반환
 */
function computeSheetValues(
  sheet: Sheet,
  allSheets: Sheet[] = []
): Record<string, CellValue>[] {
  const result: Record<string, CellValue>[] = [];

  for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex++) {
    const row = sheet.rows[rowIndex];
    const computedRow: Record<string, CellValue> = { ...row.cells };

    for (const column of sheet.columns) {
      const rawValue = row.cells[column.id];

      // 셀 자체에 수식이 있는 경우
      if (typeof rawValue === 'string' && rawValue.startsWith('=')) {
        const evalResult = evaluateFormula(rawValue, {
          sheets: allSheets,
          currentSheet: sheet,
          currentRow: computedRow,
          currentRowIndex: rowIndex,
          allRows: result,
        });
        computedRow[column.id] = evalResult.error ? `#ERR: ${evalResult.error}` : evalResult.value;
        continue;
      }

      // 셀에 직접 값이 있으면 그 값 사용
      if (rawValue !== null && rawValue !== undefined) {
        computedRow[column.id] = rawValue;
        continue;
      }

      // 셀이 비어있고 컬럼이 formula 타입이면 컬럼 수식 사용
      if (column.type === 'formula' && column.formula) {
        const evalResult = evaluateFormula(column.formula, {
          sheets: allSheets,
          currentSheet: sheet,
          currentRow: computedRow,
          currentRowIndex: rowIndex,
          allRows: result,
        });
        computedRow[column.id] = evalResult.error ? `#ERR: ${evalResult.error}` : evalResult.value;
        continue;
      }

      computedRow[column.id] = rawValue;
    }

    result.push(computedRow);
  }

  return result;
}

/**
 * 두 시트 비교 (이름 기반 매칭)
 */
export function compareSheets(
  oldSheet: Sheet,
  newSheet: Sheet,
  options: {
    nameColumnId?: string; // 행 이름을 가져올 컬럼 (old 시트 기준)
    ignoreColumnNames?: string[]; // 무시할 컬럼 이름들
    allSheets?: Sheet[]; // 수식 계산을 위한 전체 시트 목록
  } = {}
): ComparisonResult {
  const { ignoreColumnNames = [], allSheets = [] } = options;

  // 계산된 값 미리 계산
  const oldComputedRows = computeSheetValues(oldSheet, allSheets);
  const newComputedRows = computeSheetValues(newSheet, allSheets);

  // 컬럼 이름 기반 매핑 생성
  const oldColumnNameToId = new Map(oldSheet.columns.map(c => [c.name, c.id]));
  const newColumnNameToId = new Map(newSheet.columns.map(c => [c.name, c.id]));

  // 모든 컬럼 이름 수집 (양쪽 시트의 합집합)
  const allColumnNames = new Set<string>();
  for (const col of oldSheet.columns) {
    if (!ignoreColumnNames.includes(col.name)) {
      allColumnNames.add(col.name);
    }
  }
  for (const col of newSheet.columns) {
    if (!ignoreColumnNames.includes(col.name)) {
      allColumnNames.add(col.name);
    }
  }

  // 이름 컬럼 찾기 (옵션으로 주어진 것 또는 자동 탐지)
  let nameColumnIdOld: string | null = options.nameColumnId || findNameColumn(oldSheet.columns);
  let nameColumnIdNew: string | null = null;

  // old 시트의 이름 컬럼 이름으로 new 시트의 이름 컬럼 ID 찾기
  if (nameColumnIdOld) {
    const nameColObj = oldSheet.columns.find(c => c.id === nameColumnIdOld);
    if (nameColObj) {
      const newNameColId = newColumnNameToId.get(nameColObj.name);
      nameColumnIdNew = newNameColId || findNameColumn(newSheet.columns);
    }
  } else {
    nameColumnIdNew = findNameColumn(newSheet.columns);
  }

  // 행 매핑 생성 (이름/인덱스 기반)
  const oldRowsByName = new Map<string, { row: typeof oldSheet.rows[0]; index: number }>();
  oldSheet.rows.forEach((row, index) => {
    const identifier = getRowIdentifier(row, nameColumnIdOld, index);
    oldRowsByName.set(identifier, { row, index });
  });

  const newRowsByName = new Map<string, { row: typeof newSheet.rows[0]; index: number }>();
  newSheet.rows.forEach((row, index) => {
    const identifier = getRowIdentifier(row, nameColumnIdNew, index);
    newRowsByName.set(identifier, { row, index });
  });

  // 모든 행 식별자 수집
  const allRowIdentifiers = new Set([...oldRowsByName.keys(), ...newRowsByName.keys()]);

  const rowChanges: RowChange[] = [];
  let changedCells = 0;

  for (const identifier of allRowIdentifiers) {
    const oldEntry = oldRowsByName.get(identifier);
    const newEntry = newRowsByName.get(identifier);

    // 행 이름 결정 (표시용)
    let rowName: string;
    if (identifier.startsWith('__index_')) {
      const index = parseInt(identifier.replace('__index_', ''), 10);
      rowName = `행 ${index + 1}`;
    } else {
      rowName = identifier;
    }

    if (!oldEntry) {
      // 새로 추가된 행
      const newComputedRow = newComputedRows[newEntry!.index];
      rowChanges.push({
        rowId: newEntry!.row.id,
        rowName,
        type: 'added',
        cellChanges: Array.from(allColumnNames).map(colName => {
          const colId = newColumnNameToId.get(colName);
          const newValue = getValueByColumnName(newEntry!.row, colName, newColumnNameToId);
          const newComputed = colId && newComputedRow ? newComputedRow[colId] : null;
          const isFormula = typeof newValue === 'string' && newValue.startsWith('=');
          return {
            columnId: colId || colName,
            columnName: colName,
            oldValue: null,
            newValue,
            oldComputedValue: null,
            newComputedValue: isFormula && typeof newComputed === 'number' ? newComputed : null,
            diff: null,
            diffPercent: null,
          };
        }),
      });
    } else if (!newEntry) {
      // 삭제된 행
      const oldComputedRow = oldComputedRows[oldEntry.index];
      rowChanges.push({
        rowId: oldEntry.row.id,
        rowName,
        type: 'removed',
        cellChanges: Array.from(allColumnNames).map(colName => {
          const colId = oldColumnNameToId.get(colName);
          const oldValue = getValueByColumnName(oldEntry.row, colName, oldColumnNameToId);
          const oldComputed = colId && oldComputedRow ? oldComputedRow[colId] : null;
          const isFormula = typeof oldValue === 'string' && oldValue.startsWith('=');
          return {
            columnId: colId || colName,
            columnName: colName,
            oldValue,
            newValue: null,
            oldComputedValue: isFormula && typeof oldComputed === 'number' ? oldComputed : null,
            newComputedValue: null,
            diff: null,
            diffPercent: null,
          };
        }),
      });
    } else {
      // 기존 행 - 셀 비교
      const cellChanges: CellChange[] = [];
      let hasChanges = false;
      const oldComputedRow = oldComputedRows[oldEntry.index];
      const newComputedRow = newComputedRows[newEntry.index];

      for (const colName of allColumnNames) {
        const oldColId = oldColumnNameToId.get(colName);
        const newColId = newColumnNameToId.get(colName);

        const oldValue = getValueByColumnName(oldEntry.row, colName, oldColumnNameToId);
        const newValue = getValueByColumnName(newEntry.row, colName, newColumnNameToId);

        // 계산된 값 가져오기
        const oldComputed = oldColId && oldComputedRow ? oldComputedRow[oldColId] : null;
        const newComputed = newColId && newComputedRow ? newComputedRow[newColId] : null;

        // 수식인지 확인
        const oldIsFormula = typeof oldValue === 'string' && oldValue.startsWith('=');
        const newIsFormula = typeof newValue === 'string' && newValue.startsWith('=');

        let diff: number | null = null;
        let diffPercent: number | null = null;

        // 계산된 값으로 숫자 비교 (수식인 경우 계산된 값 사용)
        const oldNum = oldIsFormula
          ? (typeof oldComputed === 'number' ? oldComputed : NaN)
          : (typeof oldValue === 'number' ? oldValue : parseFloat(String(oldValue)));
        const newNum = newIsFormula
          ? (typeof newComputed === 'number' ? newComputed : NaN)
          : (typeof newValue === 'number' ? newValue : parseFloat(String(newValue)));

        if (!isNaN(oldNum) && !isNaN(newNum)) {
          diff = newNum - oldNum;
          diffPercent = oldNum !== 0 ? ((newNum - oldNum) / oldNum) * 100 : (newNum !== 0 ? 100 : 0);
        }

        // 값이 다른지 확인 (계산된 값 기준으로 비교)
        const oldCompareValue = oldIsFormula ? oldComputed : oldValue;
        const newCompareValue = newIsFormula ? newComputed : newValue;
        const isDifferent = String(oldCompareValue ?? '') !== String(newCompareValue ?? '');

        if (isDifferent) {
          hasChanges = true;
          changedCells++;
        }

        cellChanges.push({
          columnId: newColId || oldColId || colName,
          columnName: colName,
          oldValue,
          newValue,
          oldComputedValue: oldIsFormula && typeof oldComputed === 'number' ? oldComputed : null,
          newComputedValue: newIsFormula && typeof newComputed === 'number' ? newComputed : null,
          diff: isDifferent ? diff : null,
          diffPercent: isDifferent ? diffPercent : null,
        });
      }

      rowChanges.push({
        rowId: newEntry.row.id,
        rowName,
        type: hasChanges ? 'modified' : 'unchanged',
        cellChanges,
      });
    }
  }

  // 컬럼 통계 변화 계산 (이름 기반)
  const columnStats: ColumnStatChange[] = [];

  for (const colName of allColumnNames) {
    const oldStats = calculateColumnStats(oldSheet, colName, oldColumnNameToId);
    const newStats = calculateColumnStats(newSheet, colName, newColumnNameToId);

    const avgDiff = newStats.avg - oldStats.avg;
    const avgDiffPercent = oldStats.avg !== 0
      ? ((newStats.avg - oldStats.avg) / oldStats.avg) * 100
      : (newStats.avg !== 0 ? 100 : 0);

    columnStats.push({
      columnId: newColumnNameToId.get(colName) || oldColumnNameToId.get(colName) || colName,
      columnName: colName,
      oldStats,
      newStats,
      avgDiff,
      avgDiffPercent,
    });
  }

  // 요약 계산
  const summary = {
    totalRows: allRowIdentifiers.size,
    changedRows: rowChanges.filter(r => r.type === 'modified').length,
    addedRows: rowChanges.filter(r => r.type === 'added').length,
    removedRows: rowChanges.filter(r => r.type === 'removed').length,
    totalColumns: allColumnNames.size,
    changedCells,
  };

  return {
    summary,
    rowChanges,
    columnStats,
  };
}

/**
 * 스냅샷 생성 (비교용)
 */
export function createSnapshot(sheet: Sheet): Sheet {
  return {
    ...sheet,
    id: `${sheet.id}_snapshot_${Date.now()}`,
    name: `${sheet.name} (스냅샷)`,
    columns: [...sheet.columns],
    rows: sheet.rows.map(r => ({
      ...r,
      cells: { ...r.cells },
    })),
  };
}

/**
 * 변경 사항 하이라이트 색상
 */
export function getChangeColor(type: 'added' | 'removed' | 'modified' | 'unchanged'): string {
  switch (type) {
    case 'added':
      return 'rgba(34, 197, 94, 0.2)'; // green
    case 'removed':
      return 'rgba(239, 68, 68, 0.2)'; // red
    case 'modified':
      return 'rgba(251, 191, 36, 0.2)'; // yellow
    default:
      return 'transparent';
  }
}

/**
 * 차이값 포맷
 */
export function formatDiff(diff: number | null, diffPercent: number | null): string {
  if (diff === null) return '';

  const sign = diff >= 0 ? '+' : '';
  const percentStr = diffPercent !== null ? ` (${sign}${diffPercent.toFixed(1)}%)` : '';

  return `${sign}${diff.toFixed(2)}${percentStr}`;
}
