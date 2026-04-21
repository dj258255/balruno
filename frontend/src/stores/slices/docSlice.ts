/**
 * Doc actions slice — Phase A.
 *
 * 문서(GDD · 설계안)의 CRUD. Y.Doc 에 저장, Zustand 는 현재 선택된 docId 만 추적.
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
    set({ currentDocId: id });
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
    set((state) => ({
      currentDocId: state.currentDocId === docId ? null : state.currentDocId,
    }));
  },

  setCurrentDoc: (docId: string | null) => {
    set({ currentDocId: docId });
  },
});
