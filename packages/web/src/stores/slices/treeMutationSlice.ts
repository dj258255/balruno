/**
 * treeMutationSlice — server-canonical re-wiring of the legacy
 * project tree mutations (reorder, move-to-folder, move-folder).
 *
 * Spread AFTER createLegacyStubActions in the projectStore composition
 * so these implementations override the alert-stubs left over from
 * the v0.5 → v0.6 cleanup. Each mutation maps to a single
 * `tree.move` op against the SHEET tree on the active project.
 *
 * The actual op send / Y.Doc apply is owned by WorkspaceShell's
 * sheetTreeOps; this slice just forwards a CustomEvent the shell
 * listens for. Keeping the bridge here means the store layer stays
 * free of React/hook context (sheetTreeOps lives inside a render),
 * matching the same pattern already used for the open-gallery /
 * open-new-project flows.
 *
 * Cross-project sheet moves and project reordering itself are not
 * currently supported by the backend (sheet_tree is project-scoped,
 * projects have no sort_key column). Those mutations surface a
 * sonner toast instead of silently no-op'ing.
 */
import { toast } from 'sonner';
import type { StoreApi } from 'zustand';
import type { ProjectState } from '../projectStore';

type SetFn = StoreApi<ProjectState>['setState'];
type GetFn = StoreApi<ProjectState>['getState'];

interface TreeMoveEventDetail {
  kind: 'SHEET' | 'DOC';
  nodeId: string;
  newParentId: string | null;
  newPosition: number;
}

function emitTreeMove(detail: TreeMoveEventDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<TreeMoveEventDetail>('balruno:tree-move', { detail }),
  );
}

export const createTreeMutationActions = (_set: SetFn, get: GetFn) => ({
  reorderSheets: ((projectId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const project = get().projects.find((p) => p.id === projectId);
    const sheet = project?.sheets?.[fromIndex];
    if (!sheet) return;
    emitTreeMove({
      kind: 'SHEET',
      nodeId: sheet.id,
      newParentId: sheet.folderId ?? null,
      newPosition: toIndex,
    });
  }) as (...args: unknown[]) => void,

  moveSheetToFolder: (projectId: string, sheetId: string, folderId: string | null) => {
    const project = get().projects.find((p) => p.id === projectId);
    const target = folderId
      ? project?.sheets?.filter((s) => s.folderId === folderId).length ?? 0
      : project?.sheets?.filter((s) => !s.folderId).length ?? 0;
    emitTreeMove({
      kind: 'SHEET',
      nodeId: sheetId,
      newParentId: folderId,
      newPosition: target,
    });
  },

  moveFolderToFolder: (projectId: string, folderId: string, parentId: string | null) => {
    void projectId;
    emitTreeMove({
      kind: 'SHEET',
      nodeId: folderId,
      newParentId: parentId,
      newPosition: 0,
    });
  },

  moveSheetToProject: (
    _fromProjectId: string,
    _sheetId: string,
    _toProjectId: string,
  ) => {
    toast.error('다른 프로젝트로 시트 이동은 곧 지원됩니다.');
  },

  reorderProjects: ((..._args: unknown[]) => {
    toast.error('프로젝트 순서 변경은 곧 지원됩니다.');
  }) as (...args: unknown[]) => void,
});

export type { TreeMoveEventDetail };
