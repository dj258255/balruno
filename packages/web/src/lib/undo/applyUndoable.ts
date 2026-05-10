/**
 * Apply a stored UndoableOp — re-emits via the existing store
 * actions so the same paired-commit path runs (direct setState +
 * wss broadcast). The inverse op is applied with `origin='remote'`
 * to suppress the *next* undo push (we don't want undo to push its
 * own undo onto the stack — Cmd+Z+Cmd+Z would chase its tail).
 *
 * Each op type maps to the matching cellSlice / docSlice / page
 * handler. Doing this through the store actions instead of raw
 * writeQueue.send lets the rest of the pipeline (link cascade,
 * presence cleanup, etc.) keep working unmodified.
 */

import { useProjectStore } from '@/stores/projectStore';
import type { CellValue, Column, Project, TreeNode } from '@/types';
import type { UndoableOp } from './undoStack';
import {
  renameNodeInTree,
  removeNodeFromTree,
  moveNodeInTreeRaw,
  insertNodeAt,
} from '@/lib/tree';
import { emitOp } from '@/lib/sync/writeQueue';

/**
 * Apply a sequence of UndoableOps in order. Phase 2b promoted the
 * UndoEntry forward/inverse fields from scalar to array because
 * deleteRow / deleteColumn need a multi-op restore (column.add +
 * cell.update[] for column, row.add + row.move for row). Single-op
 * entries (cell.update, addRow, addColumn) are length-1 arrays.
 *
 * Each op runs through the matching store action with skipUndoPush
 * (so the redo path doesn't push duplicate entries). Failures in
 * one op do not abort the rest — partial undo is better than no
 * undo at all when a peer raced us.
 */
export function applyUndoableOps(ops: UndoableOp[]): void {
  for (const op of ops) applySingle(op);
}

function applySingle(op: UndoableOp): void {
  const store = useProjectStore.getState();
  const projectId = store.currentProjectId;
  if (!projectId) return;
  switch (op.type) {
    case 'cell.update': {
      // origin: 'local' (default) so the emit fires + peers see the
      // undo. skipUndoPush so Cmd+Z+Cmd+Z doesn't chase its tail.
      store.updateCell(
        projectId,
        op.sheetId,
        op.rowId,
        op.columnId,
        op.value as CellValue,
        { skipUndoPush: true },
      );
      break;
    }
    case 'row.add': {
      // The forward op for "user added a row" — re-applied on redo.
      // Pass the original rowId so the same identity is restored
      // (peers reconcile by id; differing ids would create a ghost
      // row on every redo cycle).
      const r = op.row as { id?: string; cells?: Record<string, CellValue> } | null;
      if (!r || typeof r !== 'object') return;
      store.addRow(projectId, op.sheetId, r.cells ?? {}, {
        rowId: r.id,
        skipUndoPush: true,
      });
      break;
    }
    case 'row.delete': {
      // The inverse op for "user added a row" — applied on undo.
      // Phase 2b will let this *also* be a forward op (with a
      // multi-op inverse capturing the row's cells); the deleteRow
      // store action stays the same.
      store.deleteRow(projectId, op.sheetId, op.rowId);
      break;
    }
    case 'column.add': {
      const c = op.column as Column | null;
      if (!c || typeof c !== 'object' || !c.id) return;
      const { id, ...rest } = c;
      store.addColumn(projectId, op.sheetId, rest, {
        columnId: id,
        skipUndoPush: true,
      });
      break;
    }
    case 'column.delete': {
      store.deleteColumn(projectId, op.sheetId, op.columnId, { skipUndoPush: true });
      break;
    }
    case 'row.update': {
      // op.patch carries either (a) the user's new partial — when
      // forward is replayed for redo, or (b) the inverse partial
      // capturing the original field values, when undo replays.
      store.updateRow(projectId, op.sheetId, op.rowId, op.patch as Record<string, unknown>, {
        skipUndoPush: true,
      });
      break;
    }
    case 'row.move': {
      // Reorder the row to op.toIndex. Both forward + inverse reuse
      // the same op type — the inverse just carries the original
      // fromIndex so undo and redo are symmetric without needing a
      // dedicated row.move-back op.
      store.reorderRow(projectId, op.sheetId, op.rowId, op.toIndex, {
        skipUndoPush: true,
      });
      break;
    }
    case 'column.update': {
      // op.patch carries either (a) the user's new partial — when
      // forward is replayed for redo, or (b) the inverse partial
      // capturing the original field values, when undo replays.
      // Both directions go through the same updateColumn signature.
      store.updateColumn(projectId, op.sheetId, op.columnId, op.patch as Record<string, unknown>, {
        skipUndoPush: true,
      });
      break;
    }
    case 'tree.rename':
    case 'tree.add':
    case 'tree.delete':
    case 'tree.move': {
      // The page handlers do (setTree + emitOp). Mirror that here:
      // mutate the active project's sheetTree / docTree slot, then
      // re-emit the op so peers see the undo. Idempotent helpers
      // in /lib/tree (insertNodeAt's containsNodeId guard, etc.)
      // make replays safe even if the broadcast echo races.
      applyTreeOp(projectId, op);
      break;
    }
    default:
      break;
  }
}

function treeFieldFor(treeKind: 'SHEET' | 'DOC'): 'sheetTree' | 'docTree' {
  return treeKind === 'SHEET' ? 'sheetTree' : 'docTree';
}

function applyTreeOp(projectId: string, op: UndoableOp): void {
  if (
    op.type !== 'tree.add'
    && op.type !== 'tree.delete'
    && op.type !== 'tree.rename'
    && op.type !== 'tree.move'
  ) {
    return;
  }
  const treeField = treeFieldFor(op.treeKind);
  const setTree = (mutator: (tree: TreeNode[]) => TreeNode[]) => {
    useProjectStore.setState((state) => ({
      projects: state.projects.map((p: Project) =>
        p.id !== projectId
          ? p
          : { ...p, [treeField]: mutator((p[treeField] as TreeNode[] | undefined) ?? []) },
      ),
    }));
  };
  switch (op.type) {
    case 'tree.rename':
      // newName / newIcon are both optional patches (extended
      // 2026-05-10). Apply only the parts that landed in the op.
      if (op.newName !== undefined) {
        setTree((tree) => renameNodeInTree(tree, op.nodeId, op.newName!));
      }
      emitOp({
        kind: 'tree.rename',
        treeKind: op.treeKind,
        nodeId: op.nodeId,
        newName: op.newName,
        newIcon: op.newIcon,
      });
      break;
    case 'tree.add': {
      const node = op.node as TreeNode | null;
      if (!node || !node.id) return;
      const parentId = (op.parentId as string | null) ?? null;
      const position = typeof op.position === 'number' ? op.position : 0;
      setTree((tree) => insertNodeAt(tree, parentId, position, node));
      emitOp({
        kind: 'tree.add',
        treeKind: op.treeKind,
        parentId,
        position,
        node,
      });
      break;
    }
    case 'tree.delete':
      setTree((tree) => removeNodeFromTree(tree, op.nodeId));
      emitOp({ kind: 'tree.delete', treeKind: op.treeKind, nodeId: op.nodeId });
      break;
    case 'tree.move': {
      const newParentId = op.newParentId ?? null;
      const newPosition = typeof op.newPosition === 'number' ? op.newPosition : 0;
      setTree((tree) => moveNodeInTreeRaw(tree, op.nodeId, newParentId, newPosition));
      emitOp({
        kind: 'tree.move',
        treeKind: op.treeKind,
        nodeId: op.nodeId,
        newParentId,
        newPosition,
      });
      break;
    }
  }
}
