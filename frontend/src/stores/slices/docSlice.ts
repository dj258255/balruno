/**
 * Doc actions slice — Phase A.
 *
 * 문서(GDD · 설계안)의 CRUD. Y.Doc 에 저장, Zustand 는 현재 선택된 docId 와
 * 상단 탭바에 열린 문서 목록 (openDocTabs) 추적.
 */

import { v4 as uuidv4 } from 'uuid';
import type { StoreApi } from 'zustand';
import type { Doc } from '@/types';
import type { ProjectState } from '../projectStore';
import {
  getProjectDoc,
  addDocInDoc,
  updateDocInDoc,
  deleteDocInDoc,
} from '@/lib/ydoc';

type SetFn = StoreApi<ProjectState>['setState'];

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
      openDocTabs: state.openDocTabs.includes(id) ? state.openDocTabs : [...state.openDocTabs, id],
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
      const newOpenTabs = state.openDocTabs.filter((id) => id !== docId);
      return {
        openDocTabs: newOpenTabs,
        currentDocId:
          state.currentDocId === docId
            ? newOpenTabs.length > 0
              ? newOpenTabs[newOpenTabs.length - 1]
              : null
            : state.currentDocId,
      };
    });
  },

  /** 문서 선택 — null 로 닫기만 하고, id 면 탭 자동 열림 + 시트 activate 해제 */
  setCurrentDoc: (docId: string | null) => {
    if (!docId) {
      set({ currentDocId: null });
      return;
    }
    set((state) => ({
      currentDocId: docId,
      currentSheetId: null,
      openDocTabs: state.openDocTabs.includes(docId)
        ? state.openDocTabs
        : [...state.openDocTabs, docId],
    }));
  },

  openDocTab: (docId: string) => {
    set((state) => ({
      openDocTabs: state.openDocTabs.includes(docId)
        ? state.openDocTabs
        : [...state.openDocTabs, docId],
      currentDocId: docId,
      currentSheetId: null,
    }));
  },

  closeDocTab: (docId: string) => {
    set((state) => {
      const newTabs = state.openDocTabs.filter((id) => id !== docId);
      const needNewSelection = state.currentDocId === docId;
      return {
        openDocTabs: newTabs,
        currentDocId: needNewSelection
          ? newTabs.length > 0
            ? newTabs[newTabs.length - 1]
            : null
          : state.currentDocId,
      };
    });
  },
});
