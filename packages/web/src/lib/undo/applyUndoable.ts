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
import type { CellValue, Column } from '@/types';
import type { UndoableOp } from './undoStack';

export function applyUndoableOp(op: UndoableOp): void {
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
      store.deleteColumn(projectId, op.sheetId, op.columnId);
      break;
    }
    // row.move / column.update / tree.* paths land in follow-up
    // commits as their inverse generators come online. The
    // undoStack already accepts those op types so the wire is
    // hot-pluggable.
    default:
      break;
  }
}
