/**
 * @balruno/shared — placeholder
 *
 * Phase F-2 (Electron 데스크톱) 시작 시점에 packages/web/src/lib 와 packages/web/src/types
 * 중 플랫폼 비의존 부분을 여기로 추출한다.
 *
 * 추출 후보:
 * - lib/formulaEngine.ts
 * - lib/simulation/
 * - lib/balanceAnalysis.ts
 * - lib/economySimulator.ts
 * - lib/curveFitting.ts
 * - lib/imbalanceDetector.ts
 * - lib/goalSolver.ts
 * - lib/dpsVarianceSimulator.ts
 * - lib/templates/
 * - types/index.ts
 *
 * 추출 보류 (web 의존):
 * - lib/docExport.ts (DOM 조작 + window.open)
 * - lib/utils.ts 의 일부 (web 다운로드 트리거)
 *
 * 어댑터 (lib/kvStorage.ts, lib/platform.ts) 는 인터페이스만 shared 로,
 * 구현은 각 패키지 (web/desktop) 에서 주입.
 */

export {};
