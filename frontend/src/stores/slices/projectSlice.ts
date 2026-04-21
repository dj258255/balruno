/**
 * Project + Folder actions slice.
 *
 * 프로젝트 수준 (create/delete/duplicate/reorder/load) 은 Zustand 가 진실의 소스.
 * 프로젝트 내부 (name/description, folders) 은 Y.Doc 을 경유. useYDocSync observer 가
 * Zustand 로 반사.
 */

import { v4 as uuidv4 } from 'uuid';
import type { StoreApi } from 'zustand';
import type { Project, Sheet, Folder, CellValue, CellStyle } from '@/types';
import { getSampleById } from '@/data/sampleProjects';
import type { ProjectState } from '../projectStore';
import {
  getProjectDoc,
  hydrateDocFromProject,
  detachDoc,
  updateProjectMeta,
  addFolderInDoc,
  updateFolderInDoc,
  deleteFolderInDoc,
  toggleFolderExpandedInDoc,
  moveSheetToFolderInDoc,
  moveFolderToFolderInDoc,
  reorderFoldersInDoc,
} from '@/lib/ydoc';

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

    // Y.Doc 선제 hydrate → 이후 write 가 observer 로 sync 되도록
    hydrateDocFromProject(getProjectDoc(id), newProject);

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

    hydrateDocFromProject(getProjectDoc(project.id), project);

    set((state) => ({
      projects: [...state.projects, project],
      currentProjectId: project.id,
      currentSheetId: project.sheets.length > 0 ? project.sheets[0].id : null,
      openTabs: project.sheets.length > 0 ? [{ kind: 'sheet' as const, id: project.sheets[0].id }] : [],
    }));

    return project.id;
  },

  updateProject: (
    id: string,
    updates: Partial<Pick<Project, 'name' | 'description' | 'syncMode' | 'syncRoomId'>>
  ) => {
    // name/description 은 Y.Doc meta — observer 가 반사. syncMode/syncRoomId 는
    // Y.Doc 에서 저장은 가능하지만 updateProjectMeta 가 name/description 만 처리하므로
    // 나머지는 Zustand 에 직접 세팅 (sync 모드는 meta 가 아니라 컨피그 수준).
    const { name, description, syncMode, syncRoomId } = updates;
    if (name !== undefined || description !== undefined) {
      updateProjectMeta(getProjectDoc(id), {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      });
    }
    if (syncMode !== undefined || syncRoomId !== undefined) {
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id
            ? {
                ...p,
                ...(syncMode !== undefined && { syncMode }),
                ...(syncRoomId !== undefined && { syncRoomId }),
                updatedAt: Date.now(),
              }
            : p
        ),
      }));
    }
  },

  deleteProject: (id: string) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
      currentSheetId: state.currentProjectId === id ? null : state.currentSheetId,
    }));
    // Y.Doc 메모리 해제 + y-indexeddb provider 분리
    detachDoc(id);
  },

  duplicateProject: (id: string): string => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return '';

    const newProjectId = uuidv4();
    const now = Date.now();

    // 시트 복제: column/row ID 재생성, cells/cellStyles/cellMemos 매핑 갱신
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
          if (newColId) newCells[newColId] = value;
        });

        if (row.cellStyles) {
          Object.entries(row.cellStyles).forEach(([oldColId, style]) => {
            const newColId = columnIdMap[oldColId];
            if (newColId) newCellStyles[newColId] = style;
          });
        }

        if (row.cellMemos) {
          Object.entries(row.cellMemos).forEach(([oldColId, memo]) => {
            const newColId = columnIdMap[oldColId];
            if (newColId) newCellMemos[newColId] = memo;
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

    hydrateDocFromProject(getProjectDoc(newProjectId), newProject);

    set((state) => ({
      projects: [...state.projects, newProject],
      currentProjectId: newProjectId,
      currentSheetId: newSheets.length > 0 ? newSheets[0].id : null,
      openTabs: newSheets.length > 0 ? [{ kind: 'sheet' as const, id: newSheets[0].id }] : [],
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
    // IndexedDB 또는 Undo/Redo 에서 전체 교체. useYDocSync 가 각 프로젝트 Y.Doc
    // hydrate + observer 재등록을 처리.
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

    addFolderInDoc(getProjectDoc(projectId), newFolder);
    return id;
  },

  updateFolder: (
    projectId: string,
    folderId: string,
    updates: Partial<Pick<Folder, 'name' | 'color' | 'isExpanded'>>
  ) => {
    updateFolderInDoc(getProjectDoc(projectId), folderId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },

  deleteFolder: (projectId: string, folderId: string, deleteContents: boolean = false) => {
    deleteFolderInDoc(getProjectDoc(projectId), folderId, deleteContents);
  },

  toggleFolderExpanded: (projectId: string, folderId: string) => {
    toggleFolderExpandedInDoc(getProjectDoc(projectId), folderId);
  },

  moveSheetToFolder: (projectId: string, sheetId: string, folderId: string | null) => {
    moveSheetToFolderInDoc(getProjectDoc(projectId), sheetId, folderId);
  },

  moveFolderToFolder: (
    projectId: string,
    folderId: string,
    parentId: string | null
  ) => {
    moveFolderToFolderInDoc(getProjectDoc(projectId), folderId, parentId);
  },

  reorderFolders: (
    projectId: string,
    parentId: string | null,
    fromIndex: number,
    toIndex: number
  ) => {
    reorderFoldersInDoc(getProjectDoc(projectId), parentId, fromIndex, toIndex);
  },
});
