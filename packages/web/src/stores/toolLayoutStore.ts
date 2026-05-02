import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 패널 도구 (하단에 표시되는 패널들)
export type PanelToolId = 'formulaHelper' | 'balanceValidator' | 'difficultyCurve' | 'simulation' | 'entityDefinition';

// 사이드바 도구
export type SidebarToolId = 'calculator' | 'comparison' | 'chart' | 'presetComparison' | 'imbalanceDetector' | 'goalSolver' | 'balanceAnalysis' | 'economy' | 'dpsVariance' | 'curveFitting';

// 모든 도구
export type AllToolId = PanelToolId | SidebarToolId;

export type ToolLocation = 'sidebar' | 'bottom';

interface BottomToolPosition {
  x: number; // 좌측에서의 픽셀 위치
}

interface ToolLayoutState {
  // 각 도구의 위치 (sidebar 또는 bottom)
  toolLocations: Record<AllToolId, ToolLocation>;

  // 하단에 있는 도구들의 X 좌표 (자유 배치)
  bottomToolPositions: Record<string, BottomToolPosition>;

  // 사이드바에 있는 도구 순서
  sidebarToolOrder: AllToolId[];

  // 하단 도구 z-index 순서 (마지막이 가장 위)
  bottomToolZOrder: AllToolId[];

  // 고정된 도구들 (상단에 우선 표시)
  pinnedTools: AllToolId[];

  // 사이드바 너비 (px)
  sidebarWidth: number;

  // 도구 섹션 높이 (px)
  toolsSectionHeight: number;

  // 사이드바 너비 설정
  setSidebarWidth: (width: number) => void;

  // 도구 섹션 높이 설정
  setToolsSectionHeight: (height: number) => void;

  // 도구 위치 변경 (sidebar <-> bottom)
  // insertIndex: 하단으로 이동할 때 특정 위치에 삽입 (선택적)
  moveToolToLocation: (toolId: AllToolId, location: ToolLocation, insertIndex?: number) => void;

  // 하단 도구의 X 좌표 업데이트
  updateBottomToolPosition: (toolId: AllToolId, x: number) => void;

  // 하단 도구를 맨 위로 올리기
  bringToolToFront: (toolId: AllToolId) => void;

  // 사이드바 도구 순서 변경
  reorderSidebarTools: (fromIndex: number, toIndex: number) => void;

  // 하단 도구 순서 변경
  reorderBottomTools: (fromIndex: number, toIndex: number) => void;

  // 하단 도구 순서 배열
  bottomToolOrder: AllToolId[];

  // 도구 고정/해제
  togglePinTool: (toolId: AllToolId) => void;

  // 도구 고정 여부 확인
  isPinned: (toolId: AllToolId) => boolean;

  // 하단에 있는 도구 목록 가져오기
  getBottomTools: () => AllToolId[];

  // 사이드바에 있는 도구 목록 가져오기 (고정된 도구 우선)
  getSidebarTools: () => AllToolId[];

  // 도구의 z-index 가져오기
  getToolZIndex: (toolId: AllToolId) => number;

  // 모든 도구 목록 가져오기 (위치와 상관없이)
  getAllTools: () => AllToolId[];

  // 초기화
  resetLayout: () => void;
}

// 기본값: 패널 도구는 하단, 사이드바 도구는 사이드바
const DEFAULT_LOCATIONS: Record<AllToolId, ToolLocation> = {
  // 패널 도구 - 하단
  formulaHelper: 'bottom',
  balanceValidator: 'bottom',
  difficultyCurve: 'bottom',
  simulation: 'bottom',
  entityDefinition: 'bottom',
  // 사이드바 도구 - 사이드바
  calculator: 'sidebar',
  comparison: 'sidebar',
  chart: 'sidebar',
  presetComparison: 'sidebar',
  imbalanceDetector: 'sidebar',
  goalSolver: 'sidebar',
  balanceAnalysis: 'sidebar',
  economy: 'sidebar',
  dpsVariance: 'sidebar',
  curveFitting: 'sidebar',
};

// 하단 도구 기본 위치 - 빈 객체면 가운데 정렬
const DEFAULT_BOTTOM_POSITIONS: Record<string, BottomToolPosition> = {};

// 사이드바 도구 기본 순서
const DEFAULT_SIDEBAR_ORDER: AllToolId[] = [
  'calculator',
  'comparison',
  'chart',
  'presetComparison',
  'imbalanceDetector',
  'goalSolver',
  'balanceAnalysis',
  'economy',
  'dpsVariance',
  'curveFitting',
];

// 하단 도구 기본 순서
const DEFAULT_BOTTOM_ORDER: AllToolId[] = [
  'formulaHelper',
  'balanceValidator',
  'difficultyCurve',
  'simulation',
  'entityDefinition',
];

export const useToolLayoutStore = create<ToolLayoutState>()(
  persist(
    (set, get) => ({
      toolLocations: { ...DEFAULT_LOCATIONS },
      bottomToolPositions: { ...DEFAULT_BOTTOM_POSITIONS },
      sidebarToolOrder: [...DEFAULT_SIDEBAR_ORDER],
      bottomToolOrder: [...DEFAULT_BOTTOM_ORDER],
      bottomToolZOrder: ['formulaHelper', 'balanceValidator', 'difficultyCurve', 'simulation', 'entityDefinition'] as AllToolId[],
      pinnedTools: [] as AllToolId[],
      sidebarWidth: 256, // 기본값 256px (w-64)
      toolsSectionHeight: 200, // 기본값 200px

      setSidebarWidth: (width) => {
        // 최소 200px, 최대 400px
        const clampedWidth = Math.max(200, Math.min(400, width));
        set({ sidebarWidth: clampedWidth });
      },

      setToolsSectionHeight: (height) => {
        // 최소 60px, 최대 600px
        const clampedHeight = Math.max(60, Math.min(600, height));
        set({ toolsSectionHeight: clampedHeight });
      },

      moveToolToLocation: (toolId, location, insertIndex) => {
        const { toolLocations, bottomToolPositions, sidebarToolOrder, bottomToolOrder, bottomToolZOrder } = get();
        const currentLocation = toolLocations[toolId];

        if (currentLocation === location) return;

        const newToolLocations = { ...toolLocations, [toolId]: location };
        let newSidebarOrder = [...sidebarToolOrder];
        let newBottomOrder = [...bottomToolOrder];
        let newBottomPositions = { ...bottomToolPositions };
        let newZOrder = [...bottomToolZOrder];

        if (location === 'bottom') {
          // 사이드바에서 하단으로 이동
          newSidebarOrder = newSidebarOrder.filter(id => id !== toolId);
          // 하단 순서에 추가 (특정 위치 또는 맨 뒤)
          newBottomOrder = newBottomOrder.filter(id => id !== toolId);
          if (insertIndex !== undefined && insertIndex >= 0) {
            newBottomOrder.splice(insertIndex, 0, toolId);
          } else {
            newBottomOrder.push(toolId);
          }
          // z-order에 추가 (맨 위로)
          newZOrder = newZOrder.filter(id => id !== toolId);
          newZOrder.push(toolId);
        } else {
          // 하단에서 사이드바로 이동
          delete newBottomPositions[toolId];
          newBottomOrder = newBottomOrder.filter(id => id !== toolId);
          // 사이드바 순서에서 기존 위치 제거 후 새 위치에 삽입
          newSidebarOrder = newSidebarOrder.filter(id => id !== toolId);
          if (insertIndex !== undefined && insertIndex >= 0) {
            newSidebarOrder.splice(insertIndex, 0, toolId);
          } else {
            newSidebarOrder.push(toolId);
          }
          // z-order에서 제거
          newZOrder = newZOrder.filter(id => id !== toolId);
        }

        set({
          toolLocations: newToolLocations,
          bottomToolPositions: newBottomPositions,
          sidebarToolOrder: newSidebarOrder,
          bottomToolOrder: newBottomOrder,
          bottomToolZOrder: newZOrder,
        });
      },

      updateBottomToolPosition: (toolId, x) => {
        const { bottomToolPositions, bottomToolZOrder } = get();
        // z-order도 업데이트 (맨 위로)
        const newZOrder = bottomToolZOrder.filter(id => id !== toolId);
        newZOrder.push(toolId);
        set({
          bottomToolPositions: {
            ...bottomToolPositions,
            [toolId]: { x },
          },
          bottomToolZOrder: newZOrder,
        });
      },

      bringToolToFront: (toolId) => {
        const { bottomToolZOrder } = get();
        const newZOrder = bottomToolZOrder.filter(id => id !== toolId);
        newZOrder.push(toolId);
        set({ bottomToolZOrder: newZOrder });
      },

      reorderSidebarTools: (fromIndex, toIndex) => {
        const { sidebarToolOrder } = get();
        const newOrder = [...sidebarToolOrder];
        const [moved] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, moved);
        set({ sidebarToolOrder: newOrder });
      },

      reorderBottomTools: (fromIndex, toIndex) => {
        const { bottomToolOrder } = get();
        const newOrder = [...bottomToolOrder];
        const [moved] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, moved);
        set({ bottomToolOrder: newOrder });
      },

      togglePinTool: (toolId) => {
        const { pinnedTools } = get();
        const isPinned = pinnedTools.includes(toolId);
        if (isPinned) {
          set({ pinnedTools: pinnedTools.filter(id => id !== toolId) });
        } else {
          set({ pinnedTools: [...pinnedTools, toolId] });
        }
      },

      isPinned: (toolId) => {
        const { pinnedTools } = get();
        return pinnedTools.includes(toolId);
      },

      getBottomTools: () => {
        const { toolLocations, bottomToolOrder } = get();
        // bottomToolOrder 순서대로 반환, order에 없는 것은 뒤에 추가
        const orderedTools = bottomToolOrder.filter(id => toolLocations[id] === 'bottom');
        const allBottomTools = (Object.keys(toolLocations) as AllToolId[]).filter(
          id => toolLocations[id] === 'bottom' && !orderedTools.includes(id)
        );
        return [...orderedTools, ...allBottomTools];
      },

      getSidebarTools: () => {
        const { toolLocations, sidebarToolOrder, pinnedTools } = get();
        // sidebarToolOrder에 있고 location이 sidebar인 것 반환
        const orderedTools = sidebarToolOrder.filter(id => toolLocations[id] === 'sidebar');
        // sidebarToolOrder에 없지만 location이 sidebar인 도구도 추가 (마이그레이션 대응)
        const allSidebarTools = (Object.keys(toolLocations) as AllToolId[]).filter(
          id => toolLocations[id] === 'sidebar' && !orderedTools.includes(id)
        );
        const tools = [...orderedTools, ...allSidebarTools];
        // 고정된 도구를 맨 앞으로 정렬
        return tools.sort((a, b) => {
          const aPinned = pinnedTools.includes(a);
          const bPinned = pinnedTools.includes(b);
          if (aPinned && !bPinned) return -1;
          if (!aPinned && bPinned) return 1;
          return 0;
        });
      },

      getToolZIndex: (toolId) => {
        const { bottomToolZOrder } = get();
        const index = bottomToolZOrder.indexOf(toolId);
        return index === -1 ? 0 : index + 30; // 기본 z-index 30부터 시작
      },

      getAllTools: () => {
        const { sidebarToolOrder, bottomToolOrder, pinnedTools } = get();
        // 사이드바 도구 + 하단 도구 순서대로, 중복 제거
        const allTools: AllToolId[] = [];
        const seen = new Set<AllToolId>();

        // 사이드바 도구 먼저
        for (const tool of sidebarToolOrder) {
          if (!seen.has(tool)) {
            seen.add(tool);
            allTools.push(tool);
          }
        }
        // 하단 도구
        for (const tool of bottomToolOrder) {
          if (!seen.has(tool)) {
            seen.add(tool);
            allTools.push(tool);
          }
        }

        // 고정된 도구를 맨 앞으로 정렬
        return allTools.sort((a, b) => {
          const aPinned = pinnedTools.includes(a);
          const bPinned = pinnedTools.includes(b);
          if (aPinned && !bPinned) return -1;
          if (!aPinned && bPinned) return 1;
          return 0;
        });
      },

      resetLayout: () => {
        set({
          toolLocations: { ...DEFAULT_LOCATIONS },
          bottomToolPositions: { ...DEFAULT_BOTTOM_POSITIONS },
          sidebarToolOrder: [...DEFAULT_SIDEBAR_ORDER],
          bottomToolOrder: [...DEFAULT_BOTTOM_ORDER],
          bottomToolZOrder: ['formulaHelper', 'balanceValidator', 'difficultyCurve', 'simulation', 'entityDefinition'] as AllToolId[],
          pinnedTools: [] as AllToolId[],
          sidebarWidth: 256,
          toolsSectionHeight: 200,
        });
      },
    }),
    {
      name: 'tool-layout',
      partialize: (state) => ({
        toolLocations: state.toolLocations,
        bottomToolPositions: state.bottomToolPositions,
        sidebarToolOrder: state.sidebarToolOrder,
        bottomToolOrder: state.bottomToolOrder,
        bottomToolZOrder: state.bottomToolZOrder,
        pinnedTools: state.pinnedTools,
        sidebarWidth: state.sidebarWidth,
        toolsSectionHeight: state.toolsSectionHeight,
      }),
    }
  )
);
