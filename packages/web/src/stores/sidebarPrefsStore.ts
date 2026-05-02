import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 사이드바 UI 전용 persist store — 프로젝트 데이터와 분리된 "사용자 선호" 레이어.
 *
 * 여기 담기는 것:
 *  - pinnedSheetIds: 사용자가 핀한 시트 ID 모음 (전역, 프로젝트 상관없이)
 *  - activeWorkspaceId: 현재 선택된 워크스페이스 (지금은 단일 'default'. 백엔드 오면 확장)
 *
 * projectStore 와 분리된 이유: 프로젝트 데이터 (IDB 에 덤프) 와 UI 선호 (localStorage)
 * 를 섞지 않기 위함. 백엔드 연동 시에도 pin 은 서버 user prefs 로 쉽게 이관 가능.
 */

export type WorkspaceId = string;

export interface Workspace {
  id: WorkspaceId;
  name: string;
}

interface SidebarPrefsState {
  pinnedSheetIds: string[];
  activeWorkspaceId: WorkspaceId;
  /** UI 자리만. 실제 멀티 워크스페이스는 백엔드 연동 시 채워짐. */
  workspaces: Workspace[];
  /** 프로젝트별 활성 tag 필터 (AND 조건). key=projectId, value=tag[] */
  tagFilters: Record<string, string[]>;

  togglePinSheet: (sheetId: string) => void;
  isSheetPinned: (sheetId: string) => boolean;
  unpinSheet: (sheetId: string) => void;
  setActiveWorkspace: (id: WorkspaceId) => void;
  renameWorkspace: (id: WorkspaceId, name: string) => void;
  toggleTagFilter: (projectId: string, tag: string) => void;
  clearTagFilter: (projectId: string) => void;
}

export const useSidebarPrefs = create<SidebarPrefsState>()(
  persist(
    (set, get) => ({
      pinnedSheetIds: [],
      activeWorkspaceId: 'default',
      workspaces: [{ id: 'default', name: 'Default Workspace' }],
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

      renameWorkspace: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, name: trimmed } : w,
          ),
        }));
      },

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
