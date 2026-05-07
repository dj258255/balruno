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
import type { CellValue } from '@/types';
import type { UndoableOp } from './undoStack';

export function applyUndoableOp(op: UndoableOp): void {
  const store = useProjectStore.getState();
  switch (op.type) {
    case 'cell.update': {
      // Find the projectId from the active store — undo entries are
      // per-project but the op shape doesn't carry projectId. The
      // active project is whatever's currently selected.
      const projectId = store.currentProjectId;
      if (!projectId) return;
      // origin: 'local' so the emit fires (peers see the undo);
      // skipUndoPush so Cmd+Z+Cmd+Z doesn't chase its tail.
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
    // row.* / column.* / tree.* paths land in follow-up commits as
    // their respective inverse generators come online. The undoStack
    // already accepts those op types so the wire is hot-pluggable.
    default:
      break;
  }
}
