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
  createDoc: (projectId: string, name: string, content?: string): string => {
    const id = uuidv4();
    const now = Date.now();
    const newDoc: Doc = {
      id,
      name,
      content: content ?? '',
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
    updates: Partial<Pick<Doc, 'name' | 'content'>>
  ) => {
    updateDocInDoc(getProjectDoc(projectId), docId, updates);
  },

  deleteDoc: (projectId: string, docId: string) => {
    deleteDocInDoc(getProjectDoc(projectId), docId);
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
