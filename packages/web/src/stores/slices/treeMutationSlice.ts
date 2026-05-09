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
import type { Sheet } from '@/types';
import type { SheetMetadataPatch } from '@/lib/sync/opMapper';
import { setProjectPosition } from '@/lib/backend';
import { midpoint } from '@/lib/lexorank';
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
});

export type { TreeMoveEventDetail };
