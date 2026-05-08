/**
 * legacyStubSlice — no-op shims for v0.5 store actions that the
 * v0.6 cleanup removed when local-mode multi-project state moved
 * to server-canonical REST.
 *
 * These actions used to mutate the in-memory project tree directly;
 * the server-canonical replacements live in:
 *   - createProject / duplicateProject / deleteProject / updateProject
 *       → POST/DELETE/PATCH /api/v1/workspaces/:id/projects
 *   - createSheet / updateSheet / duplicateSheet / deleteSheet
 *       → sheet_tree REST mutations under /api/v1/projects/:id/sheets
 *   - createFolder / updateFolder / deleteFolder / moveSheetToFolder
 *       → tree mutation hooks (sheetTreeOps in /w/[slug]/p/[slug]/page.tsx)
 *   - reorderProjects / reorderSheets / closeSheetTab / reorderOpenTabs
 *       → not part of v0.7; defer until UX brief calls for them again
 *   - updateSticker / deleteSticker → sticker JSONB column not yet added
 *
 * The Sidebar / SheetTabs / BranchModal / etc. import these by name;
 * stubbing here lets the UI render and shows a visible alert when the
 * user clicks a button whose underlying action is not yet rewired,
 * so the regression is loud not silent.
 */

import type { Sheet, Project } from '@/types';

// SheetFolder + ProjectExportData were v0.5 types removed in cleanup;
// the legacy callers only see them via `unknown` here.

const todoMessage = (verb: string) =>
  `${verb} 은(는) v0.7 에서 server-canonical REST 와 재배선됩니다.`;

const todo = (verb: string) => () => {
  // eslint-disable-next-line no-alert
  if (typeof window !== 'undefined') alert(todoMessage(verb));
  // eslint-disable-next-line no-console
  console.warn(`[legacy-stub] ${verb} not yet rewired`);
};

export const createLegacyStubActions = () => ({
  // Project-level
  createProject: ((name: string) => {
    todo('새 프로젝트 생성')();
    return '';
  }) as (name: string, options?: unknown) => string,
  duplicateProject: ((projectId: string) => {
    todo('프로젝트 복제')();
    return '';
  }) as (projectId: string) => string,
  deleteProject: todo('프로젝트 삭제'),
  updateProject: todo('프로젝트 업데이트') as (
    projectId: string,
    updates: Partial<Project>,
  ) => void,
  createFromSample: ((..._args: unknown[]) => {
    todo('샘플로 새 프로젝트')();
    return '';
  }) as (...args: unknown[]) => string,
  reorderProjects: todo('프로젝트 순서 변경') as (...args: unknown[]) => void,

  // Sheet-level
  createSheet: ((..._args: unknown[]) => {
    todo('새 시트 생성')();
    return '';
  }) as (...args: unknown[]) => string,
  updateSheet: todo('시트 업데이트') as (
    projectId: string,
    sheetId: string,
    updates: Partial<Sheet>,
  ) => void,
  duplicateSheet: ((projectId: string, sheetId: string) => {
    todo('시트 복제')();
    return '';
  }) as (projectId: string, sheetId: string) => string,
  deleteSheet: todo('시트 삭제') as (projectId: string, sheetId: string) => void,
  reorderSheets: todo('시트 순서 변경') as (...args: unknown[]) => void,
  moveSheetToFolder: todo('시트 폴더 이동') as (
    projectId: string,
    sheetId: string,
    folderId: string | null,
  ) => void,
  moveSheetToProject: todo('시트 프로젝트 이동') as (
    fromProjectId: string,
    sheetId: string,
    toProjectId: string,
  ) => void,

  // Folder-level
  createFolder: ((projectId: string, name: string) => {
    todo('폴더 생성')();
    return '';
  }) as (projectId: string, name: string, parentId?: string) => string,
  updateFolder: todo('폴더 업데이트') as (
    projectId: string,
    folderId: string,
    updates: unknown,
  ) => void,
  deleteFolder: todo('폴더 삭제') as (projectId: string, folderId: string) => void,
  moveFolderToFolder: todo('폴더 이동') as (
    projectId: string,
    folderId: string,
    parentId: string | null,
  ) => void,
  toggleFolderExpanded: todo('폴더 펼침 토글') as (
    projectId: string,
    folderId: string,
  ) => void,

  // Tab-level
  closeSheetTab: todo('탭 닫기') as (sheetId: string) => void,
  reorderOpenTabs: todo('탭 순서 변경') as (...args: unknown[]) => void,

  // Sticker-level
  updateSticker: todo('스티커 업데이트') as (
    sheetId: string,
    stickerId: string,
    updates: unknown,
  ) => void,
  deleteSticker: todo('스티커 삭제') as (sheetId: string, stickerId: string) => void,

  // Export (used by ProjectMenu — wires to file-download)
  exportProject: ((projectId: string) => {
    todo('프로젝트 export')();
    return {};
  }) as (projectId: string) => unknown,
  importProject: todo('프로젝트 import') as (data: unknown) => void,
});
