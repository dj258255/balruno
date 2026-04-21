/**
 * BottomDock / DockedToolbox 그룹화 — 유저 목적 기반 6 그룹 (동사형).
 *
 * 원칙:
 *  - 명사(기능 분류: "차트", "시뮬") 아닌 동사(유저 목적: "비교", "시뮬").
 *  - 솔로 그룹(1 도구) 금지 — 독바 슬롯 낭비 + 그룹화 의미 없음.
 *  - 한 도구는 한 그룹만. Track 16+ 확장 시 이 6 범주 중 하나에 넣을 수 있어야 함.
 *
 * 매핑 근거:
 *  - build: 설계 대상 정의 (수식/엔티티/난이도)
 *  - check: 정적 점검 — 이상치, 매치업, 민감도
 *  - simulate: 동적 실행 — 전투/경제 Monte Carlo
 *  - compare: 여러 값/곡선 나란히 (curve fitting 포함 — 모양 비교)
 *  - auto: 수작업 자동화 — 역산/룰/트리거
 *  - share: 팀과 나누기 — 대시보드/히스토리/코멘트
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
  | 'entityDefinition'
  | 'autoBalancer'
  | 'lootSimulator'
  | 'powerCurveCompare'
  | 'comments'
  | 'interfaceDesigner'
  | 'automations'
  | 'sensitivity'
  | 'changeHistory'
  | 'fpsSimulation'
  | 'fpsTeamSimulation'
  | 'deckSimulation'
  | 'frameData'
  | 'aiBehavior'
  | 'matchupMatrix'
  | 'replayTimeline'
  | 'snapshotCompare'
  | 'mobaLaning'
  | 'rtsBuildOrder'
  | 'mmoRaid';

export type ToolGroupId =
  | 'build'
  | 'check'
  | 'simulate'
  | 'compare'
  | 'auto'
  | 'share';

export interface ToolGroupConfig {
  id: ToolGroupId;
  titleKey: string;
  color: string;
  tools: ToolId[];
}

export const TOOL_GROUPS: ToolGroupConfig[] = [
  {
    id: 'build',
    titleKey: 'toolGroups.build',
    color: '#8b5cf6',
    tools: ['calculator', 'formulaHelper', 'preset', 'entityDefinition', 'difficultyCurve'],
  },
  {
    id: 'check',
    titleKey: 'toolGroups.check',
    color: '#ec4899',
    tools: ['balance', 'imbalance', 'balanceValidator', 'sensitivity', 'matchupMatrix'],
  },
  {
    id: 'simulate',
    titleKey: 'toolGroups.simulate',
    color: '#e11d48',
    tools: ['simulation', 'fpsSimulation', 'fpsTeamSimulation', 'deckSimulation', 'frameData', 'dpsVariance', 'lootSimulator', 'economy', 'replayTimeline', 'mobaLaning', 'rtsBuildOrder', 'mmoRaid'],
  },
  {
    id: 'compare',
    titleKey: 'toolGroups.compare',
    color: '#3b82f6',
    tools: ['comparison', 'chart', 'powerCurveCompare', 'curveFitting'],
  },
  {
    id: 'auto',
    titleKey: 'toolGroups.auto',
    color: '#f43f5e',
    tools: ['goal', 'autoBalancer', 'automations', 'aiBehavior'],
  },
  {
    id: 'share',
    titleKey: 'toolGroups.share',
    color: '#0ea5e9',
    tools: ['interfaceDesigner', 'changeHistory', 'comments', 'snapshotCompare'],
  },
];

export function findGroupForTool(toolId: ToolId): ToolGroupConfig | undefined {
  return TOOL_GROUPS.find((g) => g.tools.includes(toolId));
}

/**
 * 각 도구의 "언제 쓰는지" 한 줄 설명 i18n 키.
 * ToolDropdown · PanelShell subtitle · CommandPalette 에서 일관되게 사용.
 * 유사 기능 도구 여러 개 중 어느 것을 써야 할지 유저가 즉시 판단하게 돕는 목적.
 */
export const TOOL_DESCRIPTIONS: Record<ToolId, string> = {
  // build — 만들기
  calculator: 'toolDesc.calculator',           // 수치 입력 → DPS/TTK/EHP 즉시 계산
  formulaHelper: 'toolDesc.formulaHelper',     // 90+ 함수 레퍼런스 검색
  preset: 'toolDesc.preset',                   // 완성된 수식 프리셋 시트에 붙이기
  entityDefinition: 'toolDesc.entityDefinition', // 시트 → 레벨 테이블 자동 생성
  difficultyCurve: 'toolDesc.difficultyCurve', // 스테이지 벽·마일스톤 설계

  // check — 점검
  balance: 'toolDesc.balance',                 // 매치업 매트릭스 · Perfect Imbalance
  imbalance: 'toolDesc.imbalance',             // Z-score 통계적 이상치 자동 탐지
  balanceValidator: 'toolDesc.balanceValidator', // 런칭 전 룰 기반 최종 검증
  sensitivity: 'toolDesc.sensitivity',         // 변수 민감도 · Tornado/Spider
  matchupMatrix: 'toolDesc.matchupMatrix',     // N×N 매치업 heatmap · Perfect Imbalance
  replayTimeline: 'toolDesc.replayTimeline',   // 전투 로그 scrubber · step-by-step 디버깅
  snapshotCompare: 'toolDesc.snapshotCompare', // 시뮬 스냅샷 저장 · rebalance 전후 diff
  mobaLaning: 'toolDesc.mobaLaning',           // LoL/Dota 라인전 CS/gold/XP 곡선
  rtsBuildOrder: 'toolDesc.rtsBuildOrder',     // SC2/AoE 빌드 오더 경제·병력 타이밍
  mmoRaid: 'toolDesc.mmoRaid',                 // MMO 레이드 DPS race · enrage · 페이즈

  // simulate — 시뮬
  simulation: 'toolDesc.simulation',           // 1:1/팀 전투 Monte Carlo
  fpsSimulation: 'toolDesc.fpsSimulation',     // FPS 무기 TTK · BTK · 거리별 DPS
  fpsTeamSimulation: 'toolDesc.fpsTeamSimulation', // FPS 팀 전투 trade-kill · clutch
  deckSimulation: 'toolDesc.deckSimulation',   // 덱빌더 DPT · deadHand · 에너지 낭비
  frameData: 'toolDesc.frameData',             // 격투 프레임 · 유리/불리 · 콤보 라우트
  aiBehavior: 'toolDesc.aiBehavior',           // AI 조건→액션 규칙 에디터
  dpsVariance: 'toolDesc.dpsVariance',         // DPS 분포·백분위·히스토그램
  lootSimulator: 'toolDesc.lootSimulator',     // 가챠 피티·드롭 확률
  economy: 'toolDesc.economy',                 // Faucet/Sink·인플레이션

  // compare — 비교
  comparison: 'toolDesc.comparison',           // 여러 엔티티 레이더 차트
  chart: 'toolDesc.chart',                     // 성장 곡선 라인차트
  powerCurveCompare: 'toolDesc.powerCurveCompare', // 여러 시트 곡선 오버레이
  curveFitting: 'toolDesc.curveFitting',       // 데이터 → 수식 역산 (회귀)

  // auto — 자동
  goal: 'toolDesc.goal',                       // 목표값 → 필요 입력 역산
  autoBalancer: 'toolDesc.autoBalancer',       // 여러 엔티티 일괄 자동 조정
  automations: 'toolDesc.automations',         // 트리거·조건·액션 파이프라인

  // share — 공유
  interfaceDesigner: 'toolDesc.interfaceDesigner', // 대시보드·KPI 위젯 조립
  changeHistory: 'toolDesc.changeHistory',     // 셀 변경 히스토리·사유
  comments: 'toolDesc.comments',               // 셀 코멘트·논의 스레드
};
