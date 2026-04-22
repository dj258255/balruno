/**
 * FormulaBackend — 수식 엔진 추상 인터페이스.
 *
 * 목적: 기존 mathjs 엔진과 새 Formualizer (Rust + WASM, MIT/Apache-2.0) 엔진
 * 을 동일 인터페이스로 추상화하여 시트 단위로 엔진 선택 가능.
 *
 * Formualizer 는 상업 이용 허용 (MIT OR Apache-2.0) — PowerBalance SaaS
 * 배포에 라이선스 제약 없음.
 */
import type { Sheet, CellValue, FormulaResult } from '@/types';

export interface EvaluateContext {
  sheets: Sheet[];
  currentSheet: Sheet;
  currentRow: Record<string, CellValue>;
  currentRowIndex?: number;
  allRows?: Record<string, CellValue>[];
  computedSheetsCache?: Map<string, Record<string, CellValue>[]>;
  _recursionDepth?: number;
}

export interface FormulaBackend {
  readonly name: 'mathjs' | 'formualizer';
  /** 동기 평가. Formualizer 는 WASM 미초기화 시 error FormulaResult 를 반환 (throw 하지 않음). */
  evaluate(formula: string, context: EvaluateContext): FormulaResult;
  validate(formula: string): { valid: boolean; error?: string };
}

/**
 * 백엔드 선택.
 * 기본은 Formualizer (모든 시트에서 Excel 호환).
 * localStorage['balruno:formula:backend'] = 'mathjs' 로 개발자 강제 override 가능.
 */
export function selectBackend(_sheet: Sheet | undefined): 'mathjs' | 'formualizer' {
  if (typeof window !== 'undefined') {
    const override = window.localStorage?.getItem('balruno:formula:backend');
    if (override === 'mathjs') return 'mathjs';
  }
  return 'formualizer';
}
