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
import type { Sheet, Project } from '@/types';
import type { SheetMetadataPatch } from '@/lib/sync/opMapper';
import {
  deleteProject as deleteProjectRest,
  duplicateSheet as duplicateSheetRest,
  duplicateDoc as duplicateDocRest,
  setProjectPosition,
  updateProject as updateProjectRest,
} from '@/lib/backend';
import { midpoint } from '@/lib/lexorank';
import { newId } from '@/lib/uuid';
import type { ProjectState } from '../projectStore';

type SetFn = StoreApi<ProjectState>['setState'];
type GetFn = StoreApi<ProjectState>['getState'];

interface TreeMoveEventDetail {
  kind: 'SHEET' | 'DOC';
  nodeId: string;
  newParentId: string | null;
  newPosition: number;
}

interface TreeAddEventDetail {
  kind: 'SHEET' | 'DOC';
  parentId: string | null;
  position: number;
  node: unknown; // tree leaf or group; shape matches the on-wire op
}

interface TreeDeleteEventDetail {
  kind: 'SHEET' | 'DOC';
  nodeId: string;
}

interface TreeRenameEventDetail {
  kind: 'SHEET' | 'DOC';
  nodeId: string;
  newName: string;
}

function emitTreeMove(detail: TreeMoveEventDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<TreeMoveEventDetail>('balruno:tree-move', { detail }),
  );
}
function emitTreeAdd(detail: TreeAddEventDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<TreeAddEventDetail>('balruno:tree-add', { detail }),
  );
}
function emitTreeDelete(detail: TreeDeleteEventDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<TreeDeleteEventDetail>('balruno:tree-delete', { detail }),
  );
}
function emitTreeRename(detail: TreeRenameEventDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<TreeRenameEventDetail>('balruno:tree-rename', { detail }),
  );
}

export const createTreeMutationActions = (set: SetFn, get: GetFn) => ({
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

  /**
   * Sidebar drag-drop project reorder. Computes a lexorank midpoint
   * between the two siblings the dragged project lands between,
   * POSTs `/projects/:id/position`, and on success patches the
   * dragged project's sortKey in the local store + re-sorts the list.
   *
   * No optimistic splice on the way out — the local rows carry
   * sheet/tree state hydrated by the sync bridge, and we don't want
   * to risk drifting that off the canonical row order while the
   * write is in flight. The backend round-trip on a single project
   * is fast enough that the post-confirm re-sort lands within the
   * same drag's animation window.
   */
  reorderProjects: ((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const all = get().projects;
    const moved = all[fromIndex];
    if (!moved) return;
    // Walk a hypothetical post-move list to pick the dragged
    // project's new neighbours; their sortKeys define the midpoint.
    const reordered = [...all];
    reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const left = reordered[toIndex - 1];
    const right = reordered[toIndex + 1];
    const newKey = midpoint(left?.sortKey, right?.sortKey);

    void (async () => {
      try {
        await setProjectPosition(moved.id, newKey);
        // Patch the moved row's sortKey in place, then re-sort the
        // entire list by sortKey so the sidebar reflects the new
        // position without losing per-row sheet/tree state.
        set((state) => ({
          projects: state.projects
            .map((p) => (p.id === moved.id ? { ...p, sortKey: newKey } : p))
            .slice()
            .sort((a, b) => (a.sortKey ?? '').localeCompare(b.sortKey ?? '')),
        }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '순서 변경 실패');
      }
    })();
  }) as (...args: unknown[]) => void,

  // Sheet metadata mutations (kind, exportClassName, name, icon, view
  // settings...). The legacy `updateSheet(projectId, sheetId, patch)` API
  // is preserved so the sidebar context menus don't have to know about
  // the new shape; we just forward to sheetSlice.updateSheetMetadata,
  // which already emits a sheet.metadata.update op via emitOp.
  updateSheet: ((
    projectId: string,
    sheetId: string,
    updates: Partial<Sheet>,
  ) => {
    get().updateSheetMetadata(projectId, sheetId, updates as SheetMetadataPatch);
  }) as (projectId: string, sheetId: string, updates: Partial<Sheet>) => void,

  // ── Sheet / folder tree mutations (sheet_tree.* ops) ────────────────

  /**
   * Create a new sheet under the given project (root) or folder.
   * Emits tree.add + cell-set seed via WorkspaceShell's sheetTreeOps.
   * Sheet metadata (rows/columns) is populated by the bridge from the
   * default empty-sheet shape — server-canonical mode.
   */
  createSheet: ((projectId: string, name: string, folderId?: string) => {
    void projectId;
    const sheetId = newId();
    emitTreeAdd({
      kind: 'SHEET',
      parentId: folderId ?? null,
      position: Number.MAX_SAFE_INTEGER, // append; insertNodeAt clamps
      node: { id: sheetId, type: 'sheet', name },
    });
    return sheetId;
  }) as (...args: unknown[]) => string,

  createFolder: ((projectId: string, name: string, parentId?: string) => {
    void projectId;
    const folderId = newId();
    emitTreeAdd({
      kind: 'SHEET',
      parentId: parentId ?? null,
      position: Number.MAX_SAFE_INTEGER,
      node: { id: folderId, type: 'folder', name, children: [] },
    });
    return folderId;
  }) as (...args: unknown[]) => string,

  deleteSheet: ((projectId: string, sheetId: string) => {
    void projectId;
    emitTreeDelete({ kind: 'SHEET', nodeId: sheetId });
  }) as (projectId: string, sheetId: string) => void,

  deleteFolder: ((projectId: string, folderId: string) => {
    void projectId;
    emitTreeDelete({ kind: 'SHEET', nodeId: folderId });
  }) as (projectId: string, folderId: string) => void,

  // Folder rename (sheet rename uses sheet.metadata.update via the
  // updateSheet override above — sheet leaf names live on the sheet
  // metadata, group node names live on the tree node).
  updateFolder: ((projectId: string, folderId: string, updates: { name?: string }) => {
    void projectId;
    if (typeof updates?.name === 'string' && updates.name.trim()) {
      emitTreeRename({
        kind: 'SHEET',
        nodeId: folderId,
        newName: updates.name.trim(),
      });
    }
  }) as (projectId: string, folderId: string, updates: unknown) => void,

  // ── Project-level mutations (REST) ──────────────────────────────────

  updateProject: ((projectId: string, updates: Partial<Project> & { visibility?: unknown }) => {
    if ('visibility' in updates) {
      toast.error('프로젝트 가시성(Private/Teamspace) 은 곧 지원됩니다.');
      return;
    }
    const patch: { name?: string; slug?: string; description?: string | null } = {};
    if (typeof updates.name === 'string' && updates.name.trim()) patch.name = updates.name.trim();
    if (typeof updates.description === 'string' || updates.description === null) {
      patch.description = updates.description as string | null;
    }
    if (Object.keys(patch).length === 0) return;
    void (async () => {
      try {
        const updated = await updateProjectRest(projectId, patch);
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, name: updated.name, description: updated.description ?? undefined }
              : p,
          ),
        }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '프로젝트 업데이트 실패');
      }
    })();
  }) as (projectId: string, updates: Partial<Project>) => void,

  deleteProject: ((projectId: string) => {
    void (async () => {
      try {
        await deleteProjectRest(projectId);
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          currentProjectId:
            state.currentProjectId === projectId ? null : state.currentProjectId,
          currentSheetId: state.currentProjectId === projectId ? null : state.currentSheetId,
        }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '프로젝트 삭제 실패');
      }
    })();
  }) as (projectId: string) => void,

  duplicateProject: ((projectId: string) => {
    void projectId;
    toast.error('프로젝트 복제는 곧 지원됩니다.');
    return '';
  }) as (projectId: string) => string,

  /**
   * Server-side sheet duplicate. Backend deep-clones the source sheet
   * with fresh ids, inserts a new tree leaf next to the source, and
   * broadcasts sync.full so peers re-hydrate. We can't return the new
   * sheet id synchronously (the legacy signature expected an immediate
   * string), so we kick off the request, wait for the response, then
   * setCurrentSheet to the duplicate. Returning '' for the legacy
   * signature is harmless — none of the callers use the return value.
   */
  duplicateSheet: ((projectId: string, sheetId: string) => {
    void (async () => {
      try {
        const { newSheetId } = await duplicateSheetRest(projectId, sheetId);
        // Sync.full from the backend will hydrate the duplicated sheet
        // into the store; pointing the active selection at it lets the
        // sidebar + main panel land on the new sheet without a manual
        // click.
        get().setCurrentSheet(newSheetId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '시트 복제 실패');
      }
    })();
    return '';
  }) as (projectId: string, sheetId: string) => string,

  /**
   * Server-side doc duplicate. Backend clones documents.ydoc_state +
   * grafts a new doc_tree leaf, then broadcasts sync.full so peers
   * re-hydrate. After ack we setCurrentDoc to the duplicate so the
   * caller lands on it.
   */
  duplicateDoc: ((projectId: string, docId: string) => {
    void (async () => {
      try {
        const { newDocId } = await duplicateDocRest(projectId, docId);
        get().setCurrentDoc(newDocId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '문서 복제 실패');
      }
    })();
    return '';
  }) as (projectId: string, docId: string) => string,
});

export type { TreeMoveEventDetail };
