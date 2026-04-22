/**
 * MathjsBackend — 기존 formulaEngine.ts 를 FormulaBackend 인터페이스로 래핑.
 */
import type { FormulaResult } from '@/types';
import type { EvaluateContext, FormulaBackend } from './backend';
import { evaluateFormula as mathjsEvaluate, validateFormula as mathjsValidate } from '../formulaEngine';

export const mathjsBackend: FormulaBackend = {
  name: 'mathjs',

  evaluate(formula: string, context: EvaluateContext): FormulaResult {
    return mathjsEvaluate(formula, context);
  },

  validate(formula: string) {
    return mathjsValidate(formula);
  },
};
