/**
 * Project actions slice — local UI state only.
 *
 * Project CRUD lives on the backend (REST under @/lib/backend);
 * this slice is the in-memory mirror useProjectSyncBridge writes
 * into. Folder mutations migrated to /lib/tree wire ops.
 */

import type { StoreApi } from 'zustand';
import type { Project } from '@/types';
import type { ProjectState } from '../projectStore';

type SetFn = StoreApi<ProjectState>['setState'];
type GetFn = StoreApi<ProjectState>['getState'];

export const createProjectActions = (set: SetFn, get: GetFn) => ({
  setCurrentProject: (id: string | null) => {
    set({ currentProjectId: id, currentSheetId: null });
  },

  loadProjects: (projects: Project[]) => {
    set({ projects });
  },

  getCurrentProject: (): Project | null => {
    const { projects, currentProjectId } = get();
    return projects.find((p) => p.id === currentProjectId) || null;
  },

  setLastSaved: (timestamp: number) => {
    set({ lastSaved: timestamp });
  },
});
