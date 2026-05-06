import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 사이드바 UI 전용 persist store — 프로젝트 데이터 + 워크스페이스 목록과
 * 분리된 "사용자 선호" 레이어.
 *
 * 여기 담기는 것:
 *  - pinnedSheetIds: 핀한 시트 ID 모음 (전역, 프로젝트 상관없이)
 *  - activeWorkspaceId: 현재 선택된 워크스페이스 ID (서버 ws id)
 *  - tagFilters: 프로젝트별 활성 tag 필터 (AND 조건)
 *
 * 워크스페이스 목록 자체는 server-canonical (Linear 모델) 로
 * useWorkspaceListStore 가 fetch + 캐시. 활성 ID 는 사용자 선호이므로
 * 여기에 persist 한다 — 다음 로그인 시 마지막으로 본 ws 로 복귀.
 *
 * Persisted 키 'balruno:sidebar-prefs' 는 옛 버전에서 'workspaces'
 * 필드를 같이 저장했었지만 zustand persist 는 unknown key 를 무해하게
 * 무시하므로 별도 마이그레이션 불필요. activeWorkspaceId 가 옛
 * 'default' 값으로 남아있어도 useWorkspaceListStore 의 reconcile 이
 * 첫 서버 ws 로 교체.
 */

export type WorkspaceId = string;

interface SidebarPrefsState {
  pinnedSheetIds: string[];
  activeWorkspaceId: WorkspaceId;
  /** 프로젝트별 활성 tag 필터 (AND 조건). key=projectId, value=tag[] */
  tagFilters: Record<string, string[]>;

  togglePinSheet: (sheetId: string) => void;
  isSheetPinned: (sheetId: string) => boolean;
  unpinSheet: (sheetId: string) => void;
  setActiveWorkspace: (id: WorkspaceId) => void;
  toggleTagFilter: (projectId: string, tag: string) => void;
  clearTagFilter: (projectId: string) => void;
}

export const useSidebarPrefs = create<SidebarPrefsState>()(
  persist(
    (set, get) => ({
      pinnedSheetIds: [],
      activeWorkspaceId: '',
      tagFilters: {},

      togglePinSheet: (sheetId) => {
        set((state) => {
          const has = state.pinnedSheetIds.includes(sheetId);
          return {
            pinnedSheetIds: has
              ? state.pinnedSheetIds.filter((id) => id !== sheetId)
              : [...state.pinnedSheetIds, sheetId],
          };
        });
      },

      isSheetPinned: (sheetId) => get().pinnedSheetIds.includes(sheetId),

      unpinSheet: (sheetId) => {
        set((state) => ({
          pinnedSheetIds: state.pinnedSheetIds.filter((id) => id !== sheetId),
        }));
      },

      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

      toggleTagFilter: (projectId, tag) => {
        set((state) => {
          const cur = state.tagFilters[projectId] ?? [];
          const next = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag];
          return { tagFilters: { ...state.tagFilters, [projectId]: next } };
        });
      },

      clearTagFilter: (projectId) => {
        set((state) => ({
          tagFilters: { ...state.tagFilters, [projectId]: [] },
        }));
      },
    }),
    { name: 'balruno:sidebar-prefs' },
  ),
);
