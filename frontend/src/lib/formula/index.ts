/**
 * Formula engine 단일 진입점.
 *
 * 모든 시트는 Formualizer (MIT/Apache-2.0 · 320+ Excel 함수 · 상업 이용 가능) 를
 * 기본 사용. WASM 미초기화 시만 mathjs 로 자동 fallback (결과는 동등).
 *
 * 사용자 UI 엔 엔진 개념이 없음 — 자연스럽게 Excel 수식이 되는 스프레드시트.
 */
import type { FormulaResult } from '@/types';
import { selectBackend, type EvaluateContext } from './backend';
import { mathjsBackend } from './mathjsBackend';
import { formualizerBackend, initFormualizer, isFormualizerReady } from './formualizerBackend';

export { selectBackend } from './backend';
export type { EvaluateContext, FormulaBackend } from './backend';
export { initFormualizer, isFormualizerReady, mathjsBackend, formualizerBackend };

export function evaluate(formula: string, context: EvaluateContext): FormulaResult {
  const backend = selectBackend(context.currentSheet);
  if (backend === 'formualizer' && isFormualizerReady()) {
    return formualizerBackend.evaluate(formula, context);
  }
  return mathjsBackend.evaluate(formula, context);
}

export function validate(formula: string): { valid: boolean; error?: string } {
  return mathjsBackend.validate(formula);
}
