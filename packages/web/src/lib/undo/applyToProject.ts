/**
 * Pure UndoableOp -> Project applier (ADR 0022 v2.2 Diff baseline).
 *
 * Sibling of {@link applyUndoableOps}: same op semantics but takes
 * a Project value and returns a new Project. Doesn't mutate input,
 * doesn't emit wire ops, doesn't touch the store. Used to
 * reconstruct historical baselines from op_idempotency.inverse_payload
 * — apply N inverses in sequence to currentProject and you get the
 * project state from N edits ago.
 *
 * Each branch mirrors the matching cellSlice / tree action so the
 * reconstruction matches what the live store would compute.
 */

import type { CellValue, CellStyle, Column, Project, Row, Sheet, TreeNode } from '@/types';
import type { UndoableOp } from './undoStack';
import {
  insertNodeAt,
  removeNodeFromTree,
  renameNodeInTree,
  moveNodeInTreeRaw,
} from '@/lib/tree';

export function applyOpsToProject(project: Project, ops: UndoableOp[]): Project {
  let next = project;
  for (const op of ops) next = applyOne(next, op);
  return next;
}

function applyOne(project: Project, op: UndoableOp): Project {
  switch (op.type) {
    case 'cell.update':
      return mapSheet(project, op.sheetId, (s) => ({
        ...s,
        rows: s.rows.map((r) =>
          r.id !== op.rowId
            ? r
            : { ...r, cells: { ...r.cells, [op.columnId]: op.value as CellValue } },
        ),
      }));

    case 'row.add': {
      const r = op.row as { id?: string; cells?: Record<string, CellValue>; cellStyles?: Record<string, CellStyle> } | null;
      if (!r?.id) return project;
      const newRow: Row = { id: r.id, cells: r.cells ?? {}, ...(r.cellStyles ? { cellStyles: r.cellStyles } : {}) };
      return mapSheet(project, op.sheetId, (s) =>
        s.rows.some((row) => row.id === newRow.id) ? s : { ...s, rows: [...s.rows, newRow] },
      );
    }

    case 'row.update': {
      const patch = op.patch as Record<string, unknown>;
      return mapSheet(project, op.sheetId, (s) => ({
        ...s,
        rows: s.rows.map((r) => {
          if (r.id !== op.rowId) return r;
          const next: Row & Record<string, unknown> = { ...r };
          for (const [key, value] of Object.entries(patch)) {
            if (key === 'id' || key === 'cells' || key === 'cellStyles') continue;
            next[key] = value;
          }
          return next;
        }),
      }));
    }

    case 'row.delete':
      return mapSheet(project, op.sheetId, (s) => ({
        ...s,
        rows: s.rows.filter((r) => r.id !== op.rowId),
      }));

    case 'row.move':
      return mapSheet(project, op.sheetId, (s) => {
        const fromIdx = s.rows.findIndex((r) => r.id === op.rowId);
        if (fromIdx < 0) return s;
        const target = Math.max(0, Math.min(s.rows.length - 1, op.toIndex));
        if (target === fromIdx) return s;
        const next = [...s.rows];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(target, 0, moved);
        return { ...s, rows: next };
      });

    case 'column.add': {
      const c = op.column as Column | null;
      if (!c?.id) return project;
      return mapSheet(project, op.sheetId, (s) =>
        s.columns.some((col) => col.id === c.id) ? s : { ...s, columns: [...s.columns, c] },
      );
    }

    case 'column.update': {
      const patch = op.patch as Partial<Column>;
      return mapSheet(project, op.sheetId, (s) => ({
        ...s,
        columns: s.columns.map((c) => (c.id !== op.columnId ? c : { ...c, ...patch })),
      }));
    }

    case 'column.delete':
      return mapSheet(project, op.sheetId, (s) => ({
        ...s,
        columns: s.columns.filter((c) => c.id !== op.columnId),
        rows: s.rows.map((r) => {
          if (!(op.columnId in r.cells)) return r;
          const { [op.columnId]: _, ...rest } = r.cells;
          return { ...r, cells: rest };
        }),
      }));

    case 'tree.rename':
      // newName / newIcon are both optional patches on the wire
      // (extended 2026-05-10). Skip the rename helper if newName is
      // absent — icon-only patches don't change the displayed label.
      if (op.newName === undefined) return project;
      return mapTree(project, op.treeKind, (t) => renameNodeInTree(t, op.nodeId, op.newName!));

    case 'tree.add': {
      const node = op.node as TreeNode | null;
      if (!node?.id) return project;
      const parentId = (op.parentId as string | null) ?? null;
      const position = typeof op.position === 'number' ? op.position : 0;
      return mapTree(project, op.treeKind, (t) => insertNodeAt(t, parentId, position, node));
    }

    case 'tree.delete':
      return mapTree(project, op.treeKind, (t) => removeNodeFromTree(t, op.nodeId));

    case 'tree.move': {
      const newParentId = op.newParentId ?? null;
      const newPosition = typeof op.newPosition === 'number' ? op.newPosition : 0;
      return mapTree(project, op.treeKind, (t) => moveNodeInTreeRaw(t, op.nodeId, newParentId, newPosition));
    }

    default:
      return project;
  }
}

function mapSheet(
  project: Project,
  sheetId: string,
  mutator: (sheet: Sheet) => Sheet,
): Project {
  return {
    ...project,
    sheets: project.sheets.map((s) => (s.id !== sheetId ? s : mutator(s))),
  };
}

function mapTree(
  project: Project,
  _treeKind: 'SHEET',
  mutator: (tree: TreeNode[]) => TreeNode[],
): Project {
  const field = 'sheetTree';
  return {
    ...project,
    [field]: mutator((project[field] as TreeNode[] | undefined) ?? []),
  };
}
