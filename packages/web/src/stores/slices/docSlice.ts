/**
 * Doc actions slice — Phase A.
 *
 * 문서(GDD · 설계안)의 CRUD. Y.Doc 에 저장, Zustand 는 현재 선택된 docId 와
 * 통합 탭 배열 (openTabs: TabEntry[]) 에 문서 entry 를 추가/제거한다.
 */

import { v4 as uuidv4 } from 'uuid';
import type { StoreApi } from 'zustand';
import type { Doc } from '@/types';
import type { ProjectState, TabEntry } from '../projectStore';
import {
  getProjectDoc,
  addDocInDoc,
  updateDocInDoc,
  deleteDocInDoc,
} from '@/lib/ydoc';

type SetFn = StoreApi<ProjectState>['setState'];

/** Lightweight read-only access to project state — wired from projectStore at module init. */
const useProjectStoreGetters: { getProject: (projectId: string) => { docs?: Doc[] } | undefined } = {
  getProject: () => undefined,
};
export function bindDocSliceGetters(getProject: (projectId: string) => { docs?: Doc[] } | undefined) {
  useProjectStoreGetters.getProject = getProject;
}

/** Recursive walk of the doc tree to find every descendant of a node (excluding the node itself). */
function collectDescendantDocIds(allDocs: Doc[], rootId: string): string[] {
  const out: string[] = [];
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const parent = queue.shift()!;
    for (const d of allDocs) {
      if (d.parentId === parent) {
        out.push(d.id);
        queue.push(d.id);
      }
    }
  }
  return out;
}

// --- Tab 유틸 (sheetSlice 와 동일 로직, 재정의) ---
const hasTab = (tabs: TabEntry[], kind: TabEntry['kind'], id: string) =>
  tabs.some((t) => t.kind === kind && t.id === id);

const withTab = (tabs: TabEntry[], kind: TabEntry['kind'], id: string): TabEntry[] =>
  hasTab(tabs, kind, id) ? tabs : [...tabs, { kind, id }];

const withoutTab = (tabs: TabEntry[], kind: TabEntry['kind'], id: string): TabEntry[] =>
  tabs.filter((t) => !(t.kind === kind && t.id === id));

const nextActiveAfterClose = (tabs: TabEntry[]): TabEntry | null => {
  return tabs.length > 0 ? tabs[tabs.length - 1] : null;
};

export const createDocActions = (set: SetFn) => ({
  createDoc: (
    projectId: string,
    name: string,
    content?: string,
    options?: { parentId?: string },
  ): string => {
    const id = uuidv4();
    const now = Date.now();
    const newDoc: Doc = {
      id,
      name,
      // 기본 아이콘 — 사용자가 이모지 피커로 바꿀 때까지 보여줄 fallback.
      // '📄' (page facing up) 은 문서의 일반적 표현.
      icon: '📄',
      content: content ?? '',
      parentId: options?.parentId,
      isExpanded: true,
      position: now, // 시간 기반 단조 증가 → 같은 부모 안에서 끝에 추가
      createdAt: now,
      updatedAt: now,
    };
    addDocInDoc(getProjectDoc(projectId), newDoc);
    set((state) => ({
      currentDocId: id,
      currentSheetId: null,
      openTabs: withTab(state.openTabs, 'doc', id),
    }));
    return id;
  },

  updateDoc: (
    projectId: string,
    docId: string,
    updates: Partial<Pick<Doc, 'name' | 'content' | 'icon' | 'parentId' | 'isExpanded' | 'position'>>
  ) => {
    updateDocInDoc(getProjectDoc(projectId), docId, updates);
  },

  deleteDoc: (projectId: string, docId: string) => {
    // Cascade: gather all descendants first so we can close their tabs too.
    const project = useProjectStoreGetters.getProject(projectId);
    const descendants = collectDescendantDocIds(project?.docs ?? [], docId);
    const allIds = new Set<string>([docId, ...descendants]);

    // Delete root + descendants from YDoc.
    for (const id of allIds) {
      deleteDocInDoc(getProjectDoc(projectId), id);
    }

    set((state) => {
      let newTabs = state.openTabs;
      for (const id of allIds) newTabs = withoutTab(newTabs, 'doc', id);
      if (!allIds.has(state.currentDocId ?? '')) {
        return { openTabs: newTabs };
      }
      const next = nextActiveAfterClose(newTabs);
      return {
        openTabs: newTabs,
        currentDocId: next?.kind === 'doc' ? next.id : null,
        currentSheetId: next?.kind === 'sheet' ? next.id : null,
      };
    });
  },

  /** 부모 변경 — 트리 안에서 다른 위치로 이동. parentId === undefined 면 루트로. */
  moveDoc: (projectId: string, docId: string, parentId: string | undefined, position?: number) => {
    updateDocInDoc(getProjectDoc(projectId), docId, {
      parentId,
      ...(position !== undefined ? { position } : {}),
    });
  },

  /** 사이드바 펼침/접힘 토글. */
  toggleDocExpanded: (projectId: string, docId: string) => {
    const project = useProjectStoreGetters.getProject(projectId);
    const doc = project?.docs?.find((d) => d.id === docId);
    if (!doc) return;
    updateDocInDoc(getProjectDoc(projectId), docId, { isExpanded: !doc.isExpanded });
  },

  /** 문서 선택 — null 이면 단순 해제. id 면 탭 자동 열림 + 시트 해제. */
  setCurrentDoc: (docId: string | null) => {
    if (!docId) {
      set({ currentDocId: null });
      return;
    }
    set((state) => ({
      currentDocId: docId,
      currentSheetId: null,
      openTabs: withTab(state.openTabs, 'doc', docId),
    }));
  },

  openDocTab: (docId: string) => {
    set((state) => ({
      openTabs: withTab(state.openTabs, 'doc', docId),
      currentDocId: docId,
      currentSheetId: null,
    }));
  },

  closeDocTab: (docId: string) => {
    set((state) => {
      const newTabs = withoutTab(state.openTabs, 'doc', docId);
      if (state.currentDocId !== docId) {
        return { openTabs: newTabs };
      }
      const next = nextActiveAfterClose(newTabs);
      return {
        openTabs: newTabs,
        currentDocId: next?.kind === 'doc' ? next.id : null,
        currentSheetId: next?.kind === 'sheet' ? next.id : null,
      };
    });
  },
});
