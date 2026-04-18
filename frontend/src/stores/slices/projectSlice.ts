/**
 * Project + Folder actions slice.
 *
 * projectStore 에서 상위 상태(projects, currentProjectId, lastSaved, isLoading)와
 * 프로젝트 수준 행위(create/update/delete/duplicate) + 폴더 트리 관리를 담당.
 */

import { v4 as uuidv4 } from 'uuid';
import type { StoreApi } from 'zustand';
import type { Project, Sheet, Folder, CellValue, CellStyle } from '@/types';
import { getSampleById } from '@/data/sampleProjects';
import type { ProjectState } from '../projectStore';

type SetFn = StoreApi<ProjectState>['setState'];
type GetFn = StoreApi<ProjectState>['getState'];

export const createProjectActions = (set: SetFn, get: GetFn) => ({
  createProject: (name: string, description?: string): string => {
    const id = uuidv4();
    const now = Date.now();
    const newProject: Project = {
      id,
      name,
      description,
      createdAt: now,
      updatedAt: now,
      sheets: [],
    };

    set((state) => ({
      projects: [...state.projects, newProject],
      currentProjectId: id,
    }));

    return id;
  },

  createFromSample: (
    sampleId: string,
    name: string,
    t: (key: string) => string,
    description?: string
  ): string | null => {
    const sample = getSampleById(sampleId);
    if (!sample) return null;

    const project = sample.createProject(t);
    project.name = name;
    project.description = description || '';

    set((state) => ({
      projects: [...state.projects, project],
      currentProjectId: project.id,
      currentSheetId: project.sheets.length > 0 ? project.sheets[0].id : null,
      openSheetTabs: project.sheets.length > 0 ? [project.sheets[0].id] : [],
    }));

    return project.id;
  },

  updateProject: (
    id: string,
    updates: Partial<Pick<Project, 'name' | 'description' | 'syncMode' | 'syncRoomId'>>
  ) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
      ),
    }));
  },

  deleteProject: (id: string) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
      currentSheetId: state.currentProjectId === id ? null : state.currentSheetId,
    }));
  },

  duplicateProject: (id: string): string => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return '';

    const newProjectId = uuidv4();
    const now = Date.now();

    // 시트를 복제하면서 컬럼 ID와 행 ID 모두 새로 생성
    const newSheets: Sheet[] = project.sheets.map((sheet) => {
      const newSheetId = uuidv4();

      const columnIdMap: Record<string, string> = {};
      const newColumns = sheet.columns.map((col) => {
        const newColId = uuidv4();
        columnIdMap[col.id] = newColId;
        return { ...col, id: newColId };
      });

      const newRows = sheet.rows.map((row) => {
        const newCells: Record<string, CellValue> = {};
        const newCellStyles: Record<string, CellStyle> = {};
        const newCellMemos: Record<string, string> = {};

        Object.entries(row.cells).forEach(([oldColId, value]) => {
          const newColId = columnIdMap[oldColId];
          if (newColId) {
            newCells[newColId] = value;
          }
        });

        if (row.cellStyles) {
          Object.entries(row.cellStyles).forEach(([oldColId, style]) => {
            const newColId = columnIdMap[oldColId];
            if (newColId) {
              newCellStyles[newColId] = style;
            }
          });
        }

        if (row.cellMemos) {
          Object.entries(row.cellMemos).forEach(([oldColId, memo]) => {
            const newColId = columnIdMap[oldColId];
            if (newColId) {
              newCellMemos[newColId] = memo;
            }
          });
        }

        return {
          ...row,
          id: uuidv4(),
          cells: newCells,
          cellStyles: Object.keys(newCellStyles).length > 0 ? newCellStyles : undefined,
          cellMemos: Object.keys(newCellMemos).length > 0 ? newCellMemos : undefined,
        };
      });

      const newStickers = (sheet.stickers || []).map((sticker) => ({
        ...sticker,
        id: uuidv4(),
        createdAt: now,
      }));

      return {
        ...sheet,
        id: newSheetId,
        columns: newColumns,
        rows: newRows,
        stickers: newStickers,
        createdAt: now,
        updatedAt: now,
      };
    });

    const newProject: Project = {
      id: newProjectId,
      name: `${project.name} (복사본)`,
      description: project.description,
      createdAt: now,
      updatedAt: now,
      sheets: newSheets,
    };

    set((state) => ({
      projects: [...state.projects, newProject],
      currentProjectId: newProjectId,
      currentSheetId: newSheets.length > 0 ? newSheets[0].id : null,
      openSheetTabs: newSheets.length > 0 ? [newSheets[0].id] : [],
    }));

    return newProjectId;
  },

  reorderProjects: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const projects = [...state.projects];
      const [removed] = projects.splice(fromIndex, 1);
      projects.splice(toIndex, 0, removed);
      return { projects };
    });
  },

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

  // ==== 폴더 ====

  createFolder: (projectId: string, name: string, parentId?: string): string => {
    const id = uuidv4();
    const now = Date.now();
    const newFolder: Folder = {
      id,
      name,
      parentId,
      isExpanded: true,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? { ...p, folders: [...(p.folders || []), newFolder], updatedAt: now }
          : p
      ),
    }));

    return id;
  },

  updateFolder: (
    projectId: string,
    folderId: string,
    updates: Partial<Pick<Folder, 'name' | 'color' | 'isExpanded'>>
  ) => {
    const now = Date.now();
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              folders: (p.folders || []).map((f) =>
                f.id === folderId ? { ...f, ...updates, updatedAt: now } : f
              ),
              updatedAt: now,
            }
          : p
      ),
    }));
  },

  deleteFolder: (projectId: string, folderId: string, deleteContents: boolean = false) => {
    const now = Date.now();
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p;

        const foldersToDelete = new Set<string>();
        const collectFolders = (id: string) => {
          foldersToDelete.add(id);
          (p.folders || [])
            .filter((f) => f.parentId === id)
            .forEach((f) => collectFolders(f.id));
        };
        collectFolders(folderId);

        let newSheets = p.sheets;
        if (deleteContents) {
          newSheets = p.sheets.filter((s) => !s.folderId || !foldersToDelete.has(s.folderId));
        } else {
          newSheets = p.sheets.map((s) =>
            s.folderId && foldersToDelete.has(s.folderId)
              ? { ...s, folderId: undefined, updatedAt: now }
              : s
          );
        }

        return {
          ...p,
          folders: (p.folders || []).filter((f) => !foldersToDelete.has(f.id)),
          sheets: newSheets,
          updatedAt: now,
        };
      }),
    }));
  },

  toggleFolderExpanded: (projectId: string, folderId: string) => {
    const now = Date.now();
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              folders: (p.folders || []).map((f) =>
                f.id === folderId ? { ...f, isExpanded: !f.isExpanded, updatedAt: now } : f
              ),
              updatedAt: now,
            }
          : p
      ),
    }));
  },

  moveSheetToFolder: (projectId: string, sheetId: string, folderId: string | null) => {
    const now = Date.now();
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              sheets: p.sheets.map((s) =>
                s.id === sheetId
                  ? { ...s, folderId: folderId || undefined, updatedAt: now }
                  : s
              ),
              updatedAt: now,
            }
          : p
      ),
    }));
  },

  moveFolderToFolder: (
    projectId: string,
    folderId: string,
    parentId: string | null
  ) => {
    const now = Date.now();
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p;

        // 순환 참조 방지: parentId 가 folderId 의 하위 폴더이면 이동 금지
        const isDescendant = (checkId: string | undefined, ancestorId: string): boolean => {
          if (!checkId) return false;
          if (checkId === ancestorId) return true;
          const folder = (p.folders || []).find((f) => f.id === checkId);
          return folder ? isDescendant(folder.parentId, ancestorId) : false;
        };

        if (parentId && isDescendant(parentId, folderId)) {
          return p;
        }

        return {
          ...p,
          folders: (p.folders || []).map((f) =>
            f.id === folderId
              ? { ...f, parentId: parentId || undefined, updatedAt: now }
              : f
          ),
          updatedAt: now,
        };
      }),
    }));
  },

  reorderFolders: (
    projectId: string,
    parentId: string | null,
    fromIndex: number,
    toIndex: number
  ) => {
    const now = Date.now();
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p;

        const sameLevelFolders = (p.folders || []).filter((f) =>
          parentId ? f.parentId === parentId : !f.parentId
        );
        const otherFolders = (p.folders || []).filter((f) =>
          parentId ? f.parentId !== parentId : f.parentId
        );

        const [removed] = sameLevelFolders.splice(fromIndex, 1);
        sameLevelFolders.splice(toIndex, 0, removed);

        return {
          ...p,
          folders: [...otherFolders, ...sameLevelFolders],
          updatedAt: now,
        };
      }),
    }));
  },
});
