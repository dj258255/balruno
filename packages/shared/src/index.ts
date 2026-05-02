/**
 * @balruno/shared — 플랫폼 비의존 공유 코드.
 *
 * web / desktop / (미래 mobile) 모두 import.
 *
 * 직접 사용: `import { ... } from '@balruno/shared/types'`
 *           `import { ... } from '@balruno/shared/lib/formulaEngine'`
 *
 * 또는 barrel: `import { Sheet, evaluateFormula } from '@balruno/shared'`
 */

export * from './types/index.js';
export * from './lib/formulaEngine.js';
export * from './lib/balanceAnalysis.js';
export * from './lib/economySimulator.js';
export * from './lib/curveFitting.js';
export * from './lib/imbalanceDetector.js';
export * from './lib/goalSolver.js';
export * from './lib/dpsVarianceSimulator.js';
export * from './lib/gameEngineExport.js';
export * from './lib/gameEngineImport.js';
export * from './lib/aiBehavior.js';
