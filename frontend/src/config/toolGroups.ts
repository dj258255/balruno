/**
 * Track 6 — 17개 플로팅 도구를 9개 도킹 그룹으로 통합.
 *
 * 각 그룹은 우측 사이드 도킹 영역에 하나씩 펼쳐지며,
 * 그룹 내부는 탭으로 세부 도구 전환.
 */

export type ToolId =
  | 'calculator'
  | 'comparison'
  | 'chart'
  | 'preset'
  | 'imbalance'
  | 'goal'
  | 'balance'
  | 'economy'
  | 'dpsVariance'
  | 'curveFitting'
  | 'formulaHelper'
  | 'balanceValidator'
  | 'difficultyCurve'
  | 'simulation'
  | 'entityDefinition';

export type ToolGroupId =
  | 'formula-workbench'
  | 'balance-insights'
  | 'simulation'
  | 'charts'
  | 'economy'
  | 'curve-fitting'
  | 'entity-generator'
  | 'difficulty-curve'
  | 'goal-solver';

export interface ToolGroupConfig {
  id: ToolGroupId;
  titleKey: string;
  color: string;
  tools: ToolId[];
}

export const TOOL_GROUPS: ToolGroupConfig[] = [
  {
    id: 'formula-workbench',
    titleKey: 'toolGroups.formulaWorkbench',
    color: '#8b5cf6',
    tools: ['calculator', 'formulaHelper', 'preset'],
  },
  {
    id: 'balance-insights',
    titleKey: 'toolGroups.balanceInsights',
    color: '#ec4899',
    tools: ['balanceValidator', 'imbalance', 'balance'],
  },
  {
    id: 'simulation',
    titleKey: 'toolGroups.simulation',
    color: '#e11d48',
    tools: ['simulation', 'dpsVariance'],
  },
  {
    id: 'charts',
    titleKey: 'toolGroups.charts',
    color: '#3b82f6',
    tools: ['comparison', 'chart'],
  },
  {
    id: 'economy',
    titleKey: 'toolGroups.economy',
    color: '#f59e0b',
    tools: ['economy'],
  },
  {
    id: 'curve-fitting',
    titleKey: 'toolGroups.curveFitting',
    color: '#6366f1',
    tools: ['curveFitting'],
  },
  {
    id: 'entity-generator',
    titleKey: 'toolGroups.entityGenerator',
    color: '#06b6d4',
    tools: ['entityDefinition'],
  },
  {
    id: 'difficulty-curve',
    titleKey: 'toolGroups.difficultyCurve',
    color: '#a855f7',
    tools: ['difficultyCurve'],
  },
  {
    id: 'goal-solver',
    titleKey: 'toolGroups.goalSolver',
    color: '#14b8a6',
    tools: ['goal'],
  },
];

export function findGroupForTool(toolId: ToolId): ToolGroupConfig | undefined {
  return TOOL_GROUPS.find((g) => g.tools.includes(toolId));
}
