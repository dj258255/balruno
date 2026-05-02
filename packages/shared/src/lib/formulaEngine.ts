import { create, all, MathJsInstance } from 'mathjs';
import * as formulajs from '@formulajs/formulajs';
import type { Sheet, CellValue, CurveType, FormulaResult } from '../types';
import { formulaBundle, SCALE } from './formulas';

// 공개 API에서 재노출 (기존 import 경로 유지)
export {
  SCALE, DAMAGE, DPS, TTK, EHP, DROP_RATE, GACHA_PITY, COST, WAVE_POWER,
  CLAMP, LERP, INVERSE_LERP, REMAP, CHANCE, EXPECTED_ATTEMPTS, COMPOUND,
  DIMINISHING, ELEMENT_MULT, STAMINA_REGEN, COMBO_MULT, STAR_RATING, TIER_INDEX,
} from './formulas';

// mathjs 인스턴스 생성 + 커스텀 함수 등록.
//
// 엔진 스택 (우선순위 낮은 것부터 덮어쓰기):
//  1. mathjs 기본 (+-*/·삼각·상수 등)
//  2. formulajs (@formulajs/formulajs) — Excel 호환 300+ 함수 (VLOOKUP / SUMIF / FILTER /
//     LEFT / RIGHT / DATE / WEEKDAY / XLOOKUP 등). MIT · 순수 JS · 주간 DL 240K+.
//  3. formulaBundle — 우리 게임 함수 40+ (SCALE / DAMAGE / DPS / LTV 등). 동일 이름 충돌 시 승리.
//
// formulajs 함수는 Error 값을 throw 대신 return 하므로, 아래 evaluateFormulaInternal 에서
// 결과가 Error 인스턴스이면 에러 문자열로 변환.
const math: MathJsInstance = create(all);
// formulajs 의 default export / TypedArray 등 함수가 아닌 속성 필터링
const formulajsFunctions: Record<string, unknown> = {};
for (const [name, fn] of Object.entries(formulajs as Record<string, unknown>)) {
  if (typeof fn === 'function' && /^[A-Z][A-Z0-9_]*$/.test(name)) {
    formulajsFunctions[name] = fn;
  }
}
// formulajs 는 native JS 배열/값을 기대 — mathjs Matrix 타입을 그대로 넘기면 SUMIF/VLOOKUP
// 같은 배열 함수가 깨짐. wrap: true 로 호출 시 mathjs 타입 → native JS 자동 언래핑.
// silent: true 로 mathjs 기본 함수와 동명 충돌(ABS/SIN/COS 등) 시 조용히 스킵 — mathjs 정의 승리.
math.import(formulajsFunctions, { override: false, silent: true, wrap: true });
math.import(formulaBundle, { override: true });


// 시트 참조 함수를 위한 컨텍스트
interface FormulaContext {
  sheets: Sheet[];
  currentSheet: Sheet;
  currentRow: Record<string, CellValue>;
  currentRowIndex?: number;  // 현재 행 인덱스 (이전행 참조용)
  allRows?: Record<string, CellValue>[];  // 모든 행 데이터 (이전행 참조용)
  computedSheetsCache?: Map<string, Record<string, CellValue>[]>;  // 시트별 계산된 값 캐시
  _recursionDepth?: number;  // 재귀 깊이 추적
}

// 최대 재귀 깊이 (순환 참조 방지)
const MAX_RECURSION_DEPTH = 10;

/**
 * REF - 다른 시트 참조 함수
 */
function createREF(context: FormulaContext) {
  return function REF(sheetName: string, rowIdentifier: string | number, columnName: string): CellValue {
    const sheet = context.sheets.find(s => s.name === sheetName);
    if (!sheet) return null;

    const column = sheet.columns.find(c => c.name === columnName);
    if (!column) return null;

    let row;
    if (typeof rowIdentifier === 'number') {
      row = sheet.rows[rowIdentifier];
    } else {
      // ID 컬럼이나 이름 컬럼으로 찾기
      const idColumn = sheet.columns.find(c => c.name === 'ID' || c.name === 'id');
      const nameColumn = sheet.columns.find(c => c.name === '이름' || c.name === 'name');

      row = sheet.rows.find(r => {
        if (idColumn && r.cells[idColumn.id] === rowIdentifier) return true;
        if (nameColumn && r.cells[nameColumn.id] === rowIdentifier) return true;
        return false;
      });
    }

    if (!row) return null;
    return row.cells[column.id] ?? null;
  };
}

/**
 * 시트 참조 처리 결과
 */
interface SheetReferenceResult {
  expression: string;
  scope: Record<string, CellValue>;
  errors: string[];  // 참조 에러 메시지
}

/**
 * 성능 최적화: 시트 계산 결과를 sheets 배열 참조 기준으로 캐시.
 *
 * 문제: 과거에는 REF() 호출 시마다 computeCellValue가 computeSheetRows를
 *       재호출해 O(N²) 블로우업 발생 (200행에서 30초+).
 * 해결: WeakMap으로 동일한 sheets 배열(=동일 Zustand 스냅샷) 내에서
 *       각 시트 결과를 한 번만 계산하고 재사용.
 * 안전성: Zustand는 변경 시 새 배열을 만들기 때문에, 상태 변경 시 자동으로
 *         새 WeakMap 엔트리가 생성됨 → 스테일 데이터 불가능.
 */
const computeCache = new WeakMap<Sheet[], Map<string, Record<string, CellValue>[]>>();

/**
 * 시트의 전체 행을 계산하여 computedRows 반환
 * (외부에서도 사용 가능 - useComputedRows, useEntityDefinition 등)
 */
export function computeSheetRows(
  sheet: Sheet,
  sheets: Sheet[],
  recursionDepth: number = 0
): Record<string, CellValue>[] {
  if (recursionDepth >= MAX_RECURSION_DEPTH) {
    return sheet.rows.map(r => r.cells as Record<string, CellValue>);
  }

  // 캐시 조회 (sheets 배열 참조 기준)
  let cache = computeCache.get(sheets);
  if (cache) {
    const cached = cache.get(sheet.id);
    if (cached) return cached;
  } else {
    cache = new Map<string, Record<string, CellValue>[]>();
    computeCache.set(sheets, cache);
  }

  const result: Record<string, CellValue>[] = [];

  for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex++) {
    const row = sheet.rows[rowIndex];
    const computedRow: Record<string, CellValue> = { ...row.cells };

    for (const column of sheet.columns) {
      const rawValue = row.cells[column.id];

      // 셀 자체에 수식이 있는 경우
      if (typeof rawValue === 'string' && rawValue.startsWith('=')) {
        const evalResult = evaluateFormulaInternal(rawValue, {
          sheets,
          currentSheet: sheet,
          currentRow: computedRow,
          currentRowIndex: rowIndex,
          allRows: result,
          _recursionDepth: recursionDepth + 1,
        });
        computedRow[column.id] = evalResult.error ? 0 : (evalResult.value ?? 0);
        continue;
      }

      // 셀에 직접 값이 있으면 사용
      if (rawValue !== null && rawValue !== undefined) {
        computedRow[column.id] = rawValue;
        continue;
      }

      // 컬럼 수식 사용
      if (column.type === 'formula' && column.formula) {
        const evalResult = evaluateFormulaInternal(column.formula, {
          sheets,
          currentSheet: sheet,
          currentRow: computedRow,
          currentRowIndex: rowIndex,
          allRows: result,
          _recursionDepth: recursionDepth + 1,
        });
        computedRow[column.id] = evalResult.error ? 0 : (evalResult.value ?? 0);
        continue;
      }

      computedRow[column.id] = rawValue;
    }

    result.push(computedRow);
  }

  // 완료된 결과 캐시에 저장 (동일한 sheets 참조 내 후속 호출은 이 결과 재사용)
  cache.set(sheet.id, result);

  return result;
}

/**
 * 시트의 특정 행에서 컬럼 값을 계산 (수식인 경우 평가)
 */
function computeCellValue(
  sheet: Sheet,
  row: { id: string; cells: Record<string, CellValue> },
  column: { id: string; name: string; type?: string; formula?: string },
  sheets: Sheet[],
  recursionDepth: number
): CellValue {
  // 재귀 깊이 초과 시 에러
  if (recursionDepth >= MAX_RECURSION_DEPTH) {
    return 0;  // 순환 참조 가능성 - 0 반환
  }

  // 해당 시트의 전체 행을 계산
  const computedRows = computeSheetRows(sheet, sheets, recursionDepth);
  const rowIndex = sheet.rows.findIndex(r => r.id === row.id);

  if (rowIndex === -1 || !computedRows[rowIndex]) {
    return 0;
  }

  // 계산된 행에서 해당 컬럼 값 반환
  return computedRows[rowIndex][column.id] ?? 0;
}

/**
 * 링크 컬럼 traversal: `{링크컬럼}.타겟컬럼` 문법.
 *
 * 현재 행에서 link 타입 컬럼을 찾아 → 그 값(rowId) 으로 대상 시트 row 를 조회 →
 * 타겟 컬럼 값을 반환. 다중 링크(linkedMultiple) 는 첫 번째 row 만 사용 (MVP).
 *
 * 예: `={무기}.데미지` → 현재 row.cells[무기_col_id] = "weapon_123"
 *     → 무기 시트에서 id=weapon_123 row → 데미지 컬럼 값.
 *
 * 대괄호 `{}` 로 감싼 이유: 일반 컬럼 참조(중간점 없음) 와 구분하기 위함.
 */
function processLinkTraversal(
  expression: string,
  currentSheet: Sheet,
  currentRow: Record<string, CellValue>,
  sheets: Sheet[],
  scope: Record<string, CellValue>,
  recursionDepth: number = 0,
): SheetReferenceResult {
  let convertedExpr = expression;
  const errors: string[] = [];
  const replacements: { original: string; varName: string; value: CellValue }[] = [];
  let refIndex = Object.keys(scope).filter((k) => k.startsWith('__link')).length;

  const pattern = /\{([가-힣a-zA-Z_][가-힣a-zA-Z0-9_]*)\}\.([가-힣a-zA-Z_][가-힣a-zA-Z0-9_()%]*)/g;
  const matches = Array.from(expression.matchAll(pattern));
  for (const match of matches) {
    const [fullMatch, linkColName, targetColName] = match;
    const linkCol = currentSheet.columns.find((c) => c.name === linkColName);
    if (!linkCol || linkCol.type !== 'link' || !linkCol.linkedSheetId) {
      errors.push(`'${linkColName}' 은 link 타입 컬럼이 아닙니다`);
      replacements.push({ original: fullMatch, varName: `__link${refIndex}__`, value: 0 });
      refIndex++;
      continue;
    }
    const targetSheet = sheets.find((s) => s.id === linkCol.linkedSheetId);
    if (!targetSheet) {
      errors.push(`링크 대상 시트 없음: "${linkColName}"`);
      replacements.push({ original: fullMatch, varName: `__link${refIndex}__`, value: 0 });
      refIndex++;
      continue;
    }
    const linkValue = currentRow[linkCol.id];
    if (linkValue === null || linkValue === undefined || linkValue === '') {
      replacements.push({ original: fullMatch, varName: `__link${refIndex}__`, value: 0 });
      refIndex++;
      continue;
    }
    const rowIds = String(linkValue).split(',').map((s) => s.trim()).filter(Boolean);
    const targetRowId = rowIds[0]; // MVP: 첫 번째만
    const targetRow = targetSheet.rows.find((r) => r.id === targetRowId);
    if (!targetRow) {
      errors.push(`링크 row 없음: "${targetRowId}" in ${targetSheet.name}`);
      replacements.push({ original: fullMatch, varName: `__link${refIndex}__`, value: 0 });
      refIndex++;
      continue;
    }
    const targetCol = targetSheet.columns.find((c) => c.name === targetColName);
    if (!targetCol) {
      errors.push(`링크 대상 컬럼 없음: "${targetColName}" in ${targetSheet.name}`);
      replacements.push({ original: fullMatch, varName: `__link${refIndex}__`, value: 0 });
      refIndex++;
      continue;
    }
    const value = computeCellValue(targetSheet, targetRow, targetCol, sheets, recursionDepth + 1);
    replacements.push({ original: fullMatch, varName: `__link${refIndex}__`, value });
    refIndex++;
  }

  for (const rep of replacements) {
    convertedExpr = convertedExpr.split(rep.original).join(rep.varName);
    scope[rep.varName] = rep.value;
  }
  return { expression: convertedExpr, scope, errors };
}

/**
 * 시트 참조 (시트명.참조명) 처리
 * 예: 글로벌설정.BASE_HP, 캐릭터스탯.공격력
 *
 * 두 가지 모드 지원:
 * 1. 세로형 설정 시트 (글로벌설정): '변수명' 컬럼에서 참조명을 찾고 '값' 컬럼의 값을 반환
 * 2. 가로형 데이터 시트: 참조명이 컬럼명이면 첫 번째 행의 해당 컬럼 값 반환
 */
function processSheetReferences(
  expression: string,
  sheets: Sheet[],
  scope: Record<string, CellValue>,
  recursionDepth: number = 0
): SheetReferenceResult {
  let convertedExpr = expression;
  let refIndex = 0;
  const errors: string[] = [];
  const replacements: { original: string; varName: string; value: CellValue }[] = [];

  // 1. 먼저 3단계 참조 처리: 시트명.행ID.컬럼명 (예: 캐릭터스탯.CHAR_001.DPS)
  const threePartPattern = /([가-힣a-zA-Z_][가-힣a-zA-Z0-9_]*)\.([가-힣a-zA-Z0-9_]+)\.([가-힣a-zA-Z_][가-힣a-zA-Z0-9_()%]*)/g;

  let match;
  while ((match = threePartPattern.exec(expression)) !== null) {
    const [fullMatch, sheetName, rowId, colName] = match;

    // 이전행 참조는 별도로 처리
    if (sheetName === '이전행' || sheetName === 'PREV') continue;

    const sheet = sheets.find(s => s.name === sheetName);
    if (!sheet) {
      errors.push(`시트를 찾을 수 없음: "${sheetName}" (${fullMatch})`);
      replacements.push({ original: fullMatch, varName: `__ref${refIndex}__`, value: 0 });
      refIndex++;
      continue;
    }

    // ID 컬럼 찾기 (ID, id, 캐릭터ID, CharID 등)
    const idCol = sheet.columns.find(c =>
      c.name === 'ID' || c.name === 'id' || c.name === '캐릭터ID' ||
      c.name === 'CharID' || c.name === '아이템ID' || c.name === 'ItemID' ||
      c.name === '무기ID' || c.name === 'WeaponID' || c.name === '몬스터ID' ||
      c.name.toLowerCase().endsWith('id')
    );

    // 대상 컬럼 찾기
    const targetCol = sheet.columns.find(c => c.name === colName);

    if (!targetCol) {
      errors.push(`컬럼을 찾을 수 없음: "${colName}" (시트: ${sheetName})`);
      replacements.push({ original: fullMatch, varName: `__ref${refIndex}__`, value: 0 });
      refIndex++;
      continue;
    }

    // 행 찾기: ID 컬럼이 있으면 ID로, 없으면 첫 번째 컬럼 값으로 검색
    let row;
    if (idCol) {
      row = sheet.rows.find(r => String(r.cells[idCol.id]) === rowId);
    }
    // ID 컬럼이 없거나 못 찾으면 첫 번째 컬럼으로 시도
    if (!row) {
      const firstCol = sheet.columns[0];
      if (firstCol) {
        row = sheet.rows.find(r => String(r.cells[firstCol.id]) === rowId);
      }
    }

    if (!row) {
      errors.push(`행을 찾을 수 없음: "${rowId}" (시트: ${sheetName})`);
      replacements.push({ original: fullMatch, varName: `__ref${refIndex}__`, value: 0 });
      refIndex++;
      continue;
    }

    // 셀 값 계산 (수식인 경우 재귀적으로 평가)
    const value = computeCellValue(sheet, row, targetCol, sheets, recursionDepth);
    replacements.push({ original: fullMatch, varName: `__ref${refIndex}__`, value });
    refIndex++;
  }

  // 2. 그 다음 2단계 참조 처리: 시트명.참조명 (예: 글로벌설정.BASE_HP)
  const twoPartPattern = /([가-힣a-zA-Z_][가-힣a-zA-Z0-9_]*)\.([가-힣a-zA-Z_][가-힣a-zA-Z0-9_()%]*)/g;

  while ((match = twoPartPattern.exec(expression)) !== null) {
    const [fullMatch, sheetName, refName] = match;

    // 이미 3단계 참조로 처리된 부분인지 확인
    if (replacements.some(r => r.original.includes(fullMatch) || fullMatch.includes(r.original.split('.').slice(0, 2).join('.')))) {
      // 3단계 참조의 일부인 경우 스킵
      const isPartOfThreePart = replacements.some(r => {
        const parts = r.original.split('.');
        return parts.length === 3 && r.original.startsWith(fullMatch + '.');
      });
      if (isPartOfThreePart) continue;
    }

    // 이전행 참조는 별도로 처리
    if (sheetName === '이전행' || sheetName === 'PREV') continue;

    // 이미 처리된 참조인지 확인
    if (replacements.some(r => r.original === fullMatch)) continue;

    const sheet = sheets.find(s => s.name === sheetName);
    if (!sheet) {
      errors.push(`시트를 찾을 수 없음: "${sheetName}" (${fullMatch})`);
      replacements.push({ original: fullMatch, varName: `__ref${refIndex}__`, value: 0 });
      refIndex++;
      continue;
    }

    let value: CellValue = 0;

    // 세로형 설정 시트 확인 (변수명/값 구조)
    const varNameCol = sheet.columns.find(c =>
      c.name === '변수명' || c.name === 'name' || c.name === 'Name' || c.name === 'ID' || c.name === 'id'
    );
    const valueCol = sheet.columns.find(c =>
      c.name === '값' || c.name === 'value' || c.name === 'Value'
    );

    if (varNameCol && valueCol) {
      // 세로형 설정 시트: 변수명 컬럼에서 refName을 찾아 값 컬럼의 값을 반환
      const row = sheet.rows.find(r => r.cells[varNameCol.id] === refName);
      if (row) {
        const rawValue = row.cells[valueCol.id];
        value = rawValue === null || rawValue === undefined ? 0 : rawValue;
      } else {
        errors.push(`변수를 찾을 수 없음: "${refName}" (시트: ${sheetName})`);
      }
    } else {
      // 가로형 데이터 시트: refName이 컬럼명이면 첫 번째 행의 해당 컬럼 값 반환
      const column = sheet.columns.find(c => c.name === refName);
      if (column && sheet.rows[0]) {
        const rawValue = sheet.rows[0].cells[column.id];
        value = rawValue === null || rawValue === undefined ? 0 : rawValue;
      } else if (!column) {
        errors.push(`컬럼을 찾을 수 없음: "${refName}" (시트: ${sheetName})`);
      } else {
        errors.push(`시트에 데이터가 없음: "${sheetName}"`);
      }
    }

    replacements.push({ original: fullMatch, varName: `__ref${refIndex}__`, value });
    refIndex++;
  }

  // 긴 참조부터 치환 (부분 매칭 방지)
  replacements.sort((a, b) => b.original.length - a.original.length);

  for (const rep of replacements) {
    const escapedOriginal = rep.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    convertedExpr = convertedExpr.replace(new RegExp(escapedOriginal, 'g'), rep.varName);
    scope[rep.varName] = rep.value;
  }

  return { expression: convertedExpr, scope, errors };
}

/**
 * 이전행 참조 처리 결과
 */
interface PrevRowReferenceResult {
  expression: string;
  scope: Record<string, CellValue>;
  errors: string[];
  warnings: string[];
}

/**
 * 이전행 참조 (이전행.컬럼명 또는 PREV.컬럼명) 처리
 * 예: 이전행.누적EXP, 이전행.레벨, PREV.CumulativeEXP, PREV.Level
 */
function processPreviousRowReferences(
  expression: string,
  columns: { id: string; name: string }[],
  allRows: Record<string, CellValue>[] | undefined,
  currentRowIndex: number | undefined,
  scope: Record<string, CellValue>
): PrevRowReferenceResult {
  let convertedExpr = expression;
  let prevIndex = 0;
  const errors: string[] = [];
  const warnings: string[] = [];

  // 이전행.컬럼명 또는 PREV.컬럼명 패턴 찾기 (한글/영어 둘 다 지원)
  const prevRowPattern = /(?:이전행|PREV)\.([가-힣a-zA-Z_][가-힣a-zA-Z0-9_()%]*)/g;

  let match;
  const replacements: { original: string; varName: string; value: CellValue }[] = [];

  while ((match = prevRowPattern.exec(expression)) !== null) {
    const [fullMatch, columnName] = match;

    const column = columns.find(c => c.name === columnName);

    // 컬럼을 찾지 못한 경우 - 에러
    if (!column) {
      errors.push(`컬럼을 찾을 수 없음: "${columnName}" (${fullMatch})`);
      replacements.push({ original: fullMatch, varName: `__prev${prevIndex}__`, value: 0 });
      prevIndex++;
      continue;
    }

    // 첫 번째 행인 경우 - 경고 (0으로 처리)
    if (currentRowIndex === undefined || !allRows || currentRowIndex <= 0) {
      warnings.push(`첫 번째 행에서 이전행 참조는 0으로 처리됨: ${fullMatch}`);
      replacements.push({ original: fullMatch, varName: `__prev${prevIndex}__`, value: 0 });
      prevIndex++;
      continue;
    }

    const prevRow = allRows[currentRowIndex - 1];
    if (!prevRow) {
      warnings.push(`이전 행 데이터 없음: ${fullMatch}`);
      replacements.push({ original: fullMatch, varName: `__prev${prevIndex}__`, value: 0 });
      prevIndex++;
      continue;
    }

    const rawValue = prevRow[column.id];
    let value: CellValue = 0;

    if (rawValue !== null && rawValue !== undefined) {
      if (typeof rawValue === 'string' && rawValue.startsWith('#ERR')) {
        // 이전 행에 에러가 있으면 에러 전파
        errors.push(`이전 행에 에러 발생: ${fullMatch} → ${rawValue}`);
        value = rawValue;  // 에러 값 그대로 전파
      } else if (typeof rawValue === 'number') {
        value = rawValue;
      } else {
        // 문자열이지만 숫자로 파싱 가능하면 숫자로 변환
        const num = parseFloat(String(rawValue));
        value = isNaN(num) ? 0 : num;
      }
    }

    replacements.push({ original: fullMatch, varName: `__prev${prevIndex}__`, value });
    prevIndex++;
  }

  // 긴 참조부터 치환 (부분 매칭 방지)
  replacements.sort((a, b) => b.original.length - a.original.length);

  for (const rep of replacements) {
    const escapedOriginal = rep.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    convertedExpr = convertedExpr.replace(new RegExp(escapedOriginal, 'g'), rep.varName);
    scope[rep.varName] = rep.value;
  }

  return { expression: convertedExpr, scope, errors, warnings };
}

/**
 * 한글 변수명 변환 결과
 */
export interface ConvertResult {
  expression: string;
  scope: Record<string, CellValue>;
  errors: string[];
  warnings: string[];
}

/**
 * 한글 변수명을 영어로 변환
 */
function convertKoreanToScope(
  expression: string,
  columns: { id: string; name: string }[],
  currentRow: Record<string, CellValue>,
  context?: FormulaContext,
  recursionDepth: number = 0
): ConvertResult {
  let scope: Record<string, CellValue> = {};
  let convertedExpr = expression;
  let varIndex = 0;
  const errors: string[] = [];
  const warnings: string[] = [];

  // 0. 링크 컬럼 traversal: {링크컬럼}.타겟컬럼
  // 예: {무기}.데미지 = 현재 행의 무기 링크가 가리키는 row 의 데미지 컬럼
  if (context?.currentSheet && context?.sheets) {
    const linkResult = processLinkTraversal(
      convertedExpr,
      context.currentSheet,
      context.currentRow,
      context.sheets,
      scope,
      recursionDepth,
    );
    convertedExpr = linkResult.expression;
    scope = linkResult.scope;
    errors.push(...linkResult.errors);
  }

  // 1. 시트 참조 처리 (시트명.컬럼명)
  if (context?.sheets) {
    const sheetResult = processSheetReferences(convertedExpr, context.sheets, scope, recursionDepth);
    convertedExpr = sheetResult.expression;
    scope = sheetResult.scope;
    errors.push(...sheetResult.errors);
  }

  // 2. 이전행 참조 처리 (이전행.컬럼명)
  const prevResult = processPreviousRowReferences(
    convertedExpr,
    columns,
    context?.allRows,
    context?.currentRowIndex,
    scope
  );
  convertedExpr = prevResult.expression;
  scope = prevResult.scope;
  errors.push(...prevResult.errors);
  warnings.push(...prevResult.warnings);

  // 3. 현재 행의 컬럼 변수 처리
  // 긴 이름부터 치환 (부분 매칭 방지)
  const sortedColumns = [...columns].sort((a, b) => b.name.length - a.name.length);

  for (const col of sortedColumns) {
    const rawValue = currentRow[col.id];
    // null/undefined는 0으로 처리 (수식 계산을 위해)
    // 수식 문자열(=로 시작)은 아직 평가되지 않은 것이므로 0으로 처리
    let value: CellValue = 0;
    if (rawValue !== null && rawValue !== undefined) {
      if (typeof rawValue === 'string') {
        if (rawValue.startsWith('=')) {
          value = 0;  // 미평가 수식은 0으로 처리
        } else if (rawValue.startsWith('#ERR')) {
          // 에러 값 전파 - 에러를 추가하고 값은 그대로 전파
          errors.push(`참조한 컬럼에 에러: "${col.name}" → ${rawValue}`);
          value = rawValue;
        } else {
          // 문자열이지만 숫자로 파싱 가능하면 숫자로
          const num = parseFloat(rawValue);
          value = isNaN(num) ? rawValue : num;
        }
      } else {
        value = rawValue;
      }
    }

    // 한글이 포함된 컬럼명인지 확인
    if (/[가-힣]/.test(col.name)) {
      const varName = `__kor${varIndex++}__`;
      // 수식에서 해당 컬럼명을 변수명으로 치환
      const escapedName = col.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      convertedExpr = convertedExpr.replace(new RegExp(escapedName, 'g'), varName);
      scope[varName] = value;
    } else {
      scope[col.name] = value;
    }
  }

  return { expression: convertedExpr, scope, errors, warnings };
}

/**
 * 내부용 수식 평가 (재귀 깊이 추적)
 */
function evaluateFormulaInternal(
  formula: string,
  context?: FormulaContext
): FormulaResult {
  try {
    // 재귀 깊이 체크
    const recursionDepth = context?._recursionDepth ?? 0;
    if (recursionDepth >= MAX_RECURSION_DEPTH) {
      return {
        value: null,
        error: '최대 참조 깊이 초과 (순환 참조 가능성)',
      };
    }

    // 수식이 =로 시작하면 제거
    const expression = formula.startsWith('=') ? formula.slice(1) : formula;

    // 컨텍스트가 있으면 REF 함수 등록
    if (context) {
      math.import({ REF: createREF(context) }, { override: true });

      // 한글 컬럼명을 영어 변수로 변환하고 scope 생성
      // context를 전달하여 시트참조와 이전행 참조도 처리
      const { expression: convertedExpr, scope, errors, warnings } = convertKoreanToScope(
        expression,
        context.currentSheet.columns,
        context.currentRow,
        context,
        recursionDepth
      );

      // 참조 에러가 있으면 첫 번째 에러 반환
      if (errors.length > 0) {
        return {
          value: null,
          error: errors[0],
          warnings: warnings.length > 0 ? warnings : undefined,
        };
      }

      // scope에 에러 값이 있는지 확인 (에러 전파)
      for (const [key, value] of Object.entries(scope)) {
        if (typeof value === 'string' && value.startsWith('#ERR')) {
          return {
            value: null,
            error: `참조 에러 전파: ${value}`,
            warnings: warnings.length > 0 ? warnings : undefined,
          };
        }
      }

      const result = math.evaluate(convertedExpr, scope);
      // formulajs 는 Error 인스턴스를 throw 대신 return (예: VLOOKUP 미스 → #N/A)
      if (result instanceof Error) {
        return {
          value: null,
          error: result.message,
          warnings: warnings.length > 0 ? warnings : undefined,
        };
      }
      return {
        value: typeof result === 'number' ? result : String(result),
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    const result = math.evaluate(expression);
    if (result instanceof Error) {
      return { value: null, error: result.message };
    }
    return { value: typeof result === 'number' ? result : String(result) };
  } catch (error) {
    return {
      value: null,
      error: error instanceof Error ? error.message : '수식 오류',
    };
  }
}

/**
 * 수식 평가 (외부 API) — 단일 엔진 (mathjs + formulajs + 게임 함수 plugin).
 * 모든 Excel 호환 함수(VLOOKUP·SUMIF·FILTER·LEFT·TODAY 등) 가 동일 컨텍스트에서 동작.
 */
export function evaluateFormula(
  formula: string,
  context?: FormulaContext
): FormulaResult {
  return evaluateFormulaInternal(formula, context);
}


/**
 * 수식 검증 결과 타입
 */
export interface FormulaValidationResult {
  valid: boolean;
  error?: string;
  warnings: string[];
  referencedColumns: string[];
  referencedSheets: string[];
  usedFunctions: string[];
}

/**
 * 수식에서 참조하는 컬럼 이름 추출
 */
export function extractColumnReferences(
  formula: string,
  availableColumns: string[]
): string[] {
  if (!formula || !formula.startsWith('=')) return [];
  const expression = formula.slice(1);
  const refs: string[] = [];

  // 긴 이름부터 매칭 (부분 매칭 방지)
  const sortedColumns = [...availableColumns].sort((a, b) => b.length - a.length);

  for (const colName of sortedColumns) {
    const escapedName = colName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 단어 경계 매칭 (한글 포함)
    const regex = new RegExp(`(?<![가-힣a-zA-Z0-9_])${escapedName}(?![가-힣a-zA-Z0-9_])`, 'g');
    if (regex.test(expression) && !refs.includes(colName)) {
      refs.push(colName);
    }
  }

  return refs;
}

/**
 * 수식 검증 (순환 참조 등)
 */
export function validateFormula(formula: string): { valid: boolean; error?: string } {
  try {
    let expression = formula.startsWith('=') ? formula.slice(1) : formula;
    // 한글 변수명을 임시 영어 변수로 치환해서 파싱
    let varIndex = 0;
    expression = expression.replace(/[가-힣]+/g, () => `__kor${varIndex++}__`);
    math.parse(expression);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : '유효하지 않은 수식',
    };
  }
}


// 사용 가능한 함수 목록
export const availableFunctions = [
  // 기본 전투/밸런스
  {
    name: 'SCALE',
    description: '레벨 스케일링',
    syntax: 'SCALE(base, level, rate, curveType)',
    example: 'SCALE(100, 10, 1.5, "exponential")',
    category: 'combat',
    formula: 'linear: base + level × rate | exponential: base × rate^level | logarithmic: base + rate × ln(level) | quadratic: base + rate × level²',
  },
  {
    name: 'DAMAGE',
    description: '데미지 계산 (감소율 공식)',
    syntax: 'DAMAGE(atk, def, multiplier?)',
    example: 'DAMAGE(150, 50)',
    category: 'combat',
    formula: 'atk × (100 / (100 + def)) × multiplier',
  },
  {
    name: 'DPS',
    description: '초당 데미지',
    syntax: 'DPS(damage, attackSpeed, critRate?, critDamage?)',
    example: 'DPS(100, 2, 0.3, 2)',
    category: 'combat',
    formula: 'damage × (1 + critRate × (critDamage - 1)) × attackSpeed',
    paramHint: 'critRate: 0~1 (30%=0.3), critDamage: 배율 (2=200%)',
  },
  {
    name: 'TTK',
    description: 'Time To Kill',
    syntax: 'TTK(targetHP, damage, attackSpeed)',
    example: 'TTK(1000, 100, 2)',
    category: 'combat',
    formula: '(ceil(targetHP / damage) - 1) / attackSpeed',
  },
  {
    name: 'EHP',
    description: '유효 체력',
    syntax: 'EHP(hp, def, damageReduction?)',
    example: 'EHP(1000, 50)',
    category: 'combat',
    formula: 'hp × (1 + def/100) × (1 / (1 - damageReduction))',
  },

  // 확률/경제
  {
    name: 'DROP_RATE',
    description: '드랍 확률 보정',
    syntax: 'DROP_RATE(baseRate, luck?, levelDiff?)',
    example: 'DROP_RATE(0.1, 50, 5)',
    category: 'economy',
  },
  {
    name: 'GACHA_PITY',
    description: '가챠 천장 확률',
    syntax: 'GACHA_PITY(baseRate, currentPull, softPityStart?, hardPity?)',
    example: 'GACHA_PITY(0.006, 75)',
    category: 'economy',
  },
  {
    name: 'COST',
    description: '강화 비용',
    syntax: 'COST(baseCost, level, rate?, curveType?)',
    example: 'COST(100, 5, 1.5)',
    category: 'economy',
  },
  {
    name: 'CHANCE',
    description: 'N회 시도 시 1회 이상 성공 확률',
    syntax: 'CHANCE(baseChance, attempts)',
    example: 'CHANCE(0.1, 10)',
    category: 'economy',
  },
  {
    name: 'EXPECTED_ATTEMPTS',
    description: '1회 성공까지 평균 시도 횟수',
    syntax: 'EXPECTED_ATTEMPTS(successRate)',
    example: 'EXPECTED_ATTEMPTS(0.01)',
    category: 'economy',
  },
  {
    name: 'COMPOUND',
    description: '복리 성장',
    syntax: 'COMPOUND(principal, rate, periods)',
    example: 'COMPOUND(1000, 0.1, 10)',
    category: 'economy',
  },

  // 스테이지/웨이브
  {
    name: 'WAVE_POWER',
    description: '웨이브 적 파워',
    syntax: 'WAVE_POWER(basePower, wave, rate?)',
    example: 'WAVE_POWER(100, 10, 1.1)',
    category: 'stage',
  },
  {
    name: 'ELEMENT_MULT',
    description: '속성 상성 배율',
    syntax: 'ELEMENT_MULT(atkElement, defElement, strong?, weak?)',
    example: 'ELEMENT_MULT(0, 1, 1.5, 0.5)',
    category: 'stage',
  },
  {
    name: 'COMBO_MULT',
    description: '콤보 배율',
    syntax: 'COMBO_MULT(comboCount, baseMult?, perCombo?, maxBonus?)',
    example: 'COMBO_MULT(10, 1, 0.1, 2)',
    category: 'stage',
  },

  // 유틸리티
  {
    name: 'CLAMP',
    description: '값 범위 제한',
    syntax: 'CLAMP(value, min, max)',
    example: 'CLAMP(150, 0, 100)',
    category: 'util',
  },
  {
    name: 'LERP',
    description: '선형 보간',
    syntax: 'LERP(start, end, t)',
    example: 'LERP(0, 100, 0.5)',
    category: 'util',
  },
  {
    name: 'REMAP',
    description: '값 범위 매핑',
    syntax: 'REMAP(value, inMin, inMax, outMin, outMax)',
    example: 'REMAP(50, 0, 100, 0, 1)',
    category: 'util',
  },
  {
    name: 'DIMINISHING',
    description: '체감 수익 (소프트캡)',
    syntax: 'DIMINISHING(base, input, softcap, hardcap?)',
    example: 'DIMINISHING(0, 150, 100, 200)',
    category: 'util',
  },
  {
    name: 'STAMINA_REGEN',
    description: '스태미나 재생량',
    syntax: 'STAMINA_REGEN(maxStamina, regenTime, elapsed)',
    example: 'STAMINA_REGEN(100, 480, 60)',
    category: 'util',
  },
  {
    name: 'STAR_RATING',
    description: '별점 계산',
    syntax: 'STAR_RATING(value, maxValue, maxStars?)',
    example: 'STAR_RATING(80, 100, 5)',
    category: 'util',
  },
  {
    name: 'TIER_INDEX',
    description: '티어 인덱스',
    syntax: 'TIER_INDEX(value, ...thresholds)',
    example: 'TIER_INDEX(1500, 1000, 1200, 1400, 1600)',
    category: 'util',
  },

  // 참조
  {
    name: 'REF',
    description: '다른 시트 참조',
    syntax: 'REF(sheetName, rowId, columnName)',
    example: 'REF("Monsters", "Goblin", "HP")',
    category: 'ref',
  },

  // 수학 함수
  {
    name: 'POWER',
    description: '거듭제곱',
    syntax: 'POWER(base, exponent)',
    example: 'POWER(2, 10)',
    category: 'math',
  },
  {
    name: 'ABS',
    description: '절대값',
    syntax: 'ABS(value)',
    example: 'ABS(-5)',
    category: 'math',
  },
  {
    name: 'SQRT',
    description: '제곱근',
    syntax: 'SQRT(value)',
    example: 'SQRT(16)',
    category: 'math',
  },
  {
    name: 'LOG',
    description: '로그 (밑 지정 가능)',
    syntax: 'LOG(value, base?)',
    example: 'LOG(100, 10)',
    category: 'math',
  },
  {
    name: 'LOG10',
    description: '상용로그 (밑 10)',
    syntax: 'LOG10(value)',
    example: 'LOG10(100)',
    category: 'math',
  },
  {
    name: 'LOG2',
    description: '이진로그 (밑 2)',
    syntax: 'LOG2(value)',
    example: 'LOG2(8)',
    category: 'math',
  },
  {
    name: 'EXP',
    description: 'e의 거듭제곱',
    syntax: 'EXP(value)',
    example: 'EXP(1)',
    category: 'math',
  },
  {
    name: 'ROUND',
    description: '반올림 (소수점 자리 지정 가능)',
    syntax: 'ROUND(value, decimals?)',
    example: 'ROUND(3.14159, 2)',
    category: 'math',
  },
  {
    name: 'FLOOR',
    description: '내림',
    syntax: 'FLOOR(value, decimals?)',
    example: 'FLOOR(3.7)',
    category: 'math',
  },
  {
    name: 'CEIL',
    description: '올림',
    syntax: 'CEIL(value, decimals?)',
    example: 'CEIL(3.2)',
    category: 'math',
  },
  {
    name: 'TRUNC',
    description: '소수점 버림',
    syntax: 'TRUNC(value, decimals?)',
    example: 'TRUNC(3.7)',
    category: 'math',
  },
  {
    name: 'MOD',
    description: '나머지',
    syntax: 'MOD(value, divisor)',
    example: 'MOD(10, 3)',
    category: 'math',
  },
  {
    name: 'SIGN',
    description: '부호 (-1, 0, 1)',
    syntax: 'SIGN(value)',
    example: 'SIGN(-5)',
    category: 'math',
  },

  // 통계 함수
  {
    name: 'SUM',
    description: '합계',
    syntax: 'SUM(a, b, ...)',
    example: 'SUM(10, 20, 30)',
    category: 'stat',
  },
  {
    name: 'AVERAGE',
    description: '평균',
    syntax: 'AVERAGE(a, b, ...)',
    example: 'AVERAGE(10, 20, 30)',
    category: 'stat',
  },
  {
    name: 'MIN',
    description: '최소값',
    syntax: 'MIN(a, b, ...)',
    example: 'MIN(10, 20, 5)',
    category: 'stat',
  },
  {
    name: 'MAX',
    description: '최대값',
    syntax: 'MAX(a, b, ...)',
    example: 'MAX(10, 20, 5)',
    category: 'stat',
  },
  {
    name: 'COUNT',
    description: '개수',
    syntax: 'COUNT(a, b, ...)',
    example: 'COUNT(1, 2, 3)',
    category: 'stat',
  },
  {
    name: 'MEDIAN',
    description: '중앙값',
    syntax: 'MEDIAN(a, b, ...)',
    example: 'MEDIAN(1, 5, 3)',
    category: 'stat',
  },
  {
    name: 'STDEV',
    description: '표준편차',
    syntax: 'STDEV(a, b, ...)',
    example: 'STDEV(10, 20, 30)',
    category: 'stat',
  },
  {
    name: 'VARIANCE',
    description: '분산',
    syntax: 'VARIANCE(a, b, ...)',
    example: 'VARIANCE(10, 20, 30)',
    category: 'stat',
  },

  // 삼각함수
  {
    name: 'SIN',
    description: '사인 (라디안)',
    syntax: 'SIN(radians)',
    example: 'SIN(PI/2)',
    category: 'trig',
  },
  {
    name: 'COS',
    description: '코사인 (라디안)',
    syntax: 'COS(radians)',
    example: 'COS(0)',
    category: 'trig',
  },
  {
    name: 'TAN',
    description: '탄젠트 (라디안)',
    syntax: 'TAN(radians)',
    example: 'TAN(PI/4)',
    category: 'trig',
  },
  {
    name: 'ASIN',
    description: '아크사인',
    syntax: 'ASIN(value)',
    example: 'ASIN(1)',
    category: 'trig',
  },
  {
    name: 'ACOS',
    description: '아크코사인',
    syntax: 'ACOS(value)',
    example: 'ACOS(0)',
    category: 'trig',
  },
  {
    name: 'ATAN',
    description: '아크탄젠트',
    syntax: 'ATAN(value)',
    example: 'ATAN(1)',
    category: 'trig',
  },
  {
    name: 'ATAN2',
    description: '아크탄젠트2 (y, x)',
    syntax: 'ATAN2(y, x)',
    example: 'ATAN2(1, 1)',
    category: 'trig',
  },
  {
    name: 'DEGREES',
    description: '라디안 → 도',
    syntax: 'DEGREES(radians)',
    example: 'DEGREES(PI)',
    category: 'trig',
  },
  {
    name: 'RADIANS',
    description: '도 → 라디안',
    syntax: 'RADIANS(degrees)',
    example: 'RADIANS(180)',
    category: 'trig',
  },

  // 조건/논리 함수
  {
    name: 'IF',
    description: '조건문',
    syntax: 'IF(condition, trueValue, falseValue)',
    example: 'IF(HP > 100, 1, 0)',
    category: 'logic',
  },
  {
    name: 'AND',
    description: '모두 참이면 참',
    syntax: 'AND(a, b, ...)',
    example: 'AND(HP > 0, ATK > 10)',
    category: 'logic',
  },
  {
    name: 'OR',
    description: '하나라도 참이면 참',
    syntax: 'OR(a, b, ...)',
    example: 'OR(HP < 10, DEF < 5)',
    category: 'logic',
  },
  {
    name: 'NOT',
    description: '논리 부정',
    syntax: 'NOT(value)',
    example: 'NOT(0)',
    category: 'logic',
  },

  // 랜덤 함수
  {
    name: 'RAND',
    description: '0~1 랜덤값',
    syntax: 'RAND()',
    example: 'RAND()',
    category: 'util',
  },
  {
    name: 'RANDBETWEEN',
    description: '범위 내 랜덤 정수',
    syntax: 'RANDBETWEEN(min, max)',
    example: 'RANDBETWEEN(1, 100)',
    category: 'util',
  },

  // 상수
  {
    name: 'PI',
    description: '원주율 (π)',
    syntax: 'PI',
    example: 'PI',
    category: 'math',
  },
  {
    name: 'E',
    description: '자연상수 (e)',
    syntax: 'E',
    example: 'E',
    category: 'math',
  },

  // 특수 참조 문법
  {
    name: 'SheetRef',
    description: '다른 시트 값 참조',
    syntax: 'SheetName.VarName',
    example: 'Settings.BASE_HP',
    category: 'ref',
  },
  {
    name: 'PrevRow',
    description: '이전 행의 값 참조',
    syntax: 'PREV.ColumnName (또는 이전행.컬럼명)',
    example: 'PREV.CumulativeEXP',
    category: 'ref',
  },

  // ===== Excel 호환 함수 (자주 쓰이는 것) =====
  // 수치는 mathjs 에 기본 포함되어 있거나 조합으로 표현 가능 — 레퍼런스 표시 목적
  {
    name: 'IFS',
    description: '다중 조건 체인 (중첩 IF 대체)',
    syntax: 'IFS(cond1, val1, cond2, val2, ..., default)',
    example: 'IFS(HP < 30, 1, HP < 70, 2, 3)',
    category: 'logic',
  },
  {
    name: 'SWITCH',
    description: '값 비교 분기',
    syntax: 'SWITCH(expr, case1, val1, case2, val2, default)',
    example: 'SWITCH(rarity, 1, 10, 2, 50, 3, 200, 0)',
    category: 'logic',
  },
  {
    name: 'IFERROR',
    description: '에러 방어 (0으로 나누기 등)',
    syntax: 'IFERROR(expr, fallback)',
    example: 'IFERROR(COST / sales, 0)',
    category: 'logic',
  },
  {
    name: 'LARGE',
    description: 'N 번째 큰 값',
    syntax: 'LARGE(array, n)',
    example: 'LARGE([10, 20, 30, 40], 2) = 30',
    category: 'stat',
  },
  {
    name: 'SMALL',
    description: 'N 번째 작은 값',
    syntax: 'SMALL(array, n)',
    example: 'SMALL([10, 20, 30], 1) = 10',
    category: 'stat',
  },
  {
    name: 'PERCENTILE',
    description: '백분위 값',
    syntax: 'PERCENTILE(array, k)',
    example: 'PERCENTILE([...], 0.9)',
    category: 'stat',
  },
  {
    name: 'RANK',
    description: '순위',
    syntax: 'RANK(value, array)',
    example: 'RANK(80, [90, 80, 70, 60]) = 2',
    category: 'stat',
  },
  {
    name: 'ISBLANK',
    description: '빈 셀 체크',
    syntax: 'ISBLANK(value)',
    example: 'IF(ISBLANK(HP), 100, HP)',
    category: 'logic',
  },
  {
    name: 'ISNUMBER',
    description: '숫자 여부',
    syntax: 'ISNUMBER(value)',
    example: 'ISNUMBER(HP)',
    category: 'logic',
  },
  {
    name: 'ISERROR',
    description: '에러 여부',
    syntax: 'ISERROR(expr)',
    example: 'ISERROR(A / B)',
    category: 'logic',
  },
  {
    name: 'CHOOSE',
    description: 'index 기반 값 선택',
    syntax: 'CHOOSE(index, val1, val2, ...)',
    example: 'CHOOSE(rarity, "common", "rare", "epic")',
    category: 'logic',
  },

  // === Excel 호환 확장 — Formualizer 엔진으로 모든 시트에서 기본 사용 가능 ===
  // Lookup & Reference
  { name: 'VLOOKUP', description: '세로 룩업 (등급→스탯 매핑)', syntax: 'VLOOKUP(key, table, col, [exactMatch])', example: 'VLOOKUP("Legendary", grades, 3, FALSE)', category: 'lookup' },
  { name: 'HLOOKUP', description: '가로 룩업', syntax: 'HLOOKUP(key, table, row, [exactMatch])', example: 'HLOOKUP("HP", stats, 2, FALSE)', category: 'lookup' },
  { name: 'XLOOKUP', description: '양방향 룩업 (VLOOKUP 상위호환)', syntax: 'XLOOKUP(key, lookupArr, returnArr, [notFound])', example: 'XLOOKUP(level, levels, exp, 0)', category: 'lookup' },
  { name: 'INDEX', description: '위치 기반 값 추출', syntax: 'INDEX(array, row, [col])', example: 'INDEX(stats, MATCH("ATK", keys, 0))', category: 'lookup' },
  { name: 'MATCH', description: '값의 인덱스 찾기', syntax: 'MATCH(key, array, [matchType])', example: 'MATCH("Rare", grades, 0)', category: 'lookup' },
  // Conditional Aggregation
  { name: 'SUMIF', description: '조건부 합', syntax: 'SUMIF(range, criterion, [sumRange])', example: 'SUMIF(grades, "Legendary", damage)', category: 'condAgg' },
  { name: 'SUMIFS', description: '다중 조건부 합', syntax: 'SUMIFS(sumRange, critRange1, crit1, ...)', example: 'SUMIFS(dmg, grade, "L", tier, ">=5")', category: 'condAgg' },
  { name: 'COUNTIF', description: '조건부 개수', syntax: 'COUNTIF(range, criterion)', example: 'COUNTIF(tier, ">=5")', category: 'condAgg' },
  { name: 'COUNTIFS', description: '다중 조건부 개수', syntax: 'COUNTIFS(range1, crit1, ...)', example: 'COUNTIFS(grade,"L",hp,">1000")', category: 'condAgg' },
  { name: 'AVERAGEIF', description: '조건부 평균', syntax: 'AVERAGEIF(range, criterion, [avgRange])', example: 'AVERAGEIF(grade, "Rare", hp)', category: 'condAgg' },
  // Text
  { name: 'LEFT', description: '왼쪽 N 글자', syntax: 'LEFT(text, [n])', example: 'LEFT(id, 3)', category: 'text' },
  { name: 'RIGHT', description: '오른쪽 N 글자', syntax: 'RIGHT(text, [n])', example: 'RIGHT(code, 2)', category: 'text' },
  { name: 'MID', description: '중간 추출', syntax: 'MID(text, start, len)', example: 'MID(skuCode, 4, 3)', category: 'text' },
  { name: 'LEN', description: '글자 수', syntax: 'LEN(text)', example: 'LEN(name)', category: 'text' },
  { name: 'FIND', description: '부분 문자열 위치 (대소문자 구분)', syntax: 'FIND(search, text)', example: 'FIND("+", name)', category: 'text' },
  { name: 'SEARCH', description: '부분 문자열 위치 (대소문자 무시)', syntax: 'SEARCH(search, text)', example: 'SEARCH("ex", name)', category: 'text' },
  { name: 'CONCATENATE', description: '문자열 합치기', syntax: 'CONCATENATE(t1, t2, ...)', example: 'CONCATENATE(grade, "-", tier)', category: 'text' },
  { name: 'TRIM', description: '양끝 공백 제거', syntax: 'TRIM(text)', example: 'TRIM(input)', category: 'text' },
  { name: 'UPPER', description: '대문자 변환', syntax: 'UPPER(text)', example: 'UPPER(name)', category: 'text' },
  { name: 'LOWER', description: '소문자 변환', syntax: 'LOWER(text)', example: 'LOWER(name)', category: 'text' },
  { name: 'SUBSTITUTE', description: '문자열 치환', syntax: 'SUBSTITUTE(text, oldStr, newStr)', example: 'SUBSTITUTE(name, " ", "_")', category: 'text' },
  // Date
  { name: 'TODAY', description: '오늘 날짜', syntax: 'TODAY()', example: 'TODAY()', category: 'date' },
  { name: 'NOW', description: '현재 시각', syntax: 'NOW()', example: 'NOW()', category: 'date' },
  { name: 'DATE', description: '연·월·일 → 날짜', syntax: 'DATE(year, month, day)', example: 'DATE(2026, 5, 1)', category: 'date' },
  { name: 'YEAR', description: '연도 추출', syntax: 'YEAR(date)', example: 'YEAR(releaseDate)', category: 'date' },
  { name: 'MONTH', description: '월 추출', syntax: 'MONTH(date)', example: 'MONTH(releaseDate)', category: 'date' },
  { name: 'WEEKDAY', description: '요일 (일=1)', syntax: 'WEEKDAY(date, [type])', example: 'WEEKDAY(releaseDate)', category: 'date' },
  // Dynamic reference
  { name: 'INDIRECT', description: '동적 참조', syntax: 'INDIRECT(refText)', example: 'INDIRECT("Sheet1.A1")', category: 'ref' },
];

