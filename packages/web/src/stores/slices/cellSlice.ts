/**
 * Column + Row + Cell actions slice.
 *
 * Server-canonical writes — every action calls writeSheet() / writeCell()
 * for the local mutation, then emitOp() for the wire op + UndoMeta.
 * useProjectSyncBridge echoes peer ops back via setState (origin='remote').
 */

import { newId } from '@/lib/uuid';
import type { StoreApi } from 'zustand';
import type { Column, Row, CellValue, CellStyle } from '@/types';
import type { ProjectState } from '../projectStore';
import { wouldCreateCycle } from '@/lib/linkGraph';
import { toast } from '@/components/ui/Toast';
import { emitOp } from '@/lib/sync/writeQueue';
import { pushUndo, type UndoableOp } from '@/lib/undo/undoStack';
import type { UndoMeta } from '@/hooks/useProjectSync';
import { getClientSessionId } from '@/lib/undo/sessionId';
import { nextActionGroupId } from '@/lib/undo/actionGroup';
import { useAuthStore } from '@/stores/authStore';

/**
 * Build the UndoMeta wire envelope for an UndoEntry that the local
 * stack already records (ADR 0021 v2.3 Phase 5 — Pattern C). Each
 * pushXxxUndo helper returns the meta to its caller; the caller
 * passes it as the second argument to emitOp so the server gets
 * the same forward + inverse arrays the local stack just kept.
 *
 * actionGroupId rotates per Baserow's MAX_UNDOABLE_ACTIONS_PER_ACTION_GROUP
 * + 30s idle heuristic; clientSessionId is tab-stable from
 * sessionStorage (ADR 0021 v2.3 §4.4).
 */
function metaOf(entry: { forward: UndoableOp[]; inverse: UndoableOp[] }): UndoMeta {
  return {
    forward: entry.forward,
    inverse: entry.inverse,
    actionGroupId: nextActionGroupId(),
    clientSessionId: getClientSessionId(),
  };
}
type SetFn = StoreApi<ProjectState>['setState'];
type GetFn = StoreApi<ProjectState>['getState'];

// 기본 셀 스타일 — 스타일이 없는 셀에 기본값 적용
const DEFAULT_CELL_STYLE: CellStyle = {
  fontSize: 15,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  hAlign: 'center',
  vAlign: 'middle',
  textRotation: 0,
};

/**
 * Sheet-scoped write — direct setState. v0.6 cleanup retired the
 * Y.Doc fallback (every project page mounts useProjectSyncBridge
 * which registers the sender; the broadcast handler echoes the
 * mutation back so the sender + every peer converge on the same
 * shape). The signature shrinks accordingly.
 */
function writeSheet(
  set: SetFn,
  projectId: string,
  sheetId: string,
  mutator: (sheet: import('@/types').Sheet) => import('@/types').Sheet,
): void {
  set((state) => ({
    projects: state.projects.map((p) =>
      p.id !== projectId
        ? p
        : {
            ...p,
            sheets: p.sheets.map((s) => (s.id !== sheetId ? s : mutator(s))),
          },
    ),
  }));
}

/**
 * Push an undo entry for a row.add — the inverse is a row.delete
 * by id. Captures the cells the row was created with so a redo
 * (re-applying the forward) restores those values; the undo path
 * just deletes by id since the row's full state already lives in
 * the local store + every peer.
 *
 * MVP scope: addRow append-only at end of sheet. Restoring at the
 * original index after a deletion needs Phase 2b (snapshot-based
 * inverse with row.add + row.move).
 */
function pushAddRowUndo(
  projectId: string,
  sheetId: string,
  rowId: string,
  cells: Record<string, CellValue>,
): UndoMeta | null {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return null;
  const forward: UndoableOp[] = [{
    type: 'row.add',
    sheetId,
    row: { id: rowId, cells },
    baseVersion: 0,
    clientMsgId: '',
  }];
  const inverse: UndoableOp[] = [{
    type: 'row.delete',
    sheetId,
    rowId,
    baseVersion: 0,
    clientMsgId: '',
  }];
  pushUndo(userId, projectId, {
    label: 'Row add',
    forward,
    inverse,
    timestamp: Date.now(),
  });
  return metaOf({ forward, inverse });
}

/**
 * Push an undo entry for a row.delete — captures the row snapshot
 * + its original index so the inverse can restore both the cells
 * and the position. The inverse is multi-op: row.add appends to
 * end, then row.move puts it back at the original index.
 *
 * If the row was at the last index already the row.move is a
 * no-op on the wire (server short-circuits same-index moves), but
 * we still emit it to keep the inverse shape uniform — easier to
 * read than a conditional.
 */
function pushDeleteRowUndo(
  projectId: string,
  sheetId: string,
  rowId: string,
  cells: Record<string, CellValue>,
  originalIndex: number,
): UndoMeta | null {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return null;
  const forward: UndoableOp[] = [{
    type: 'row.delete',
    sheetId,
    rowId,
    baseVersion: 0,
    clientMsgId: '',
  }];
  const inverse: UndoableOp[] = [
    {
      type: 'row.add',
      sheetId,
      row: { id: rowId, cells },
      baseVersion: 0,
      clientMsgId: '',
    },
    {
      type: 'row.move',
      sheetId,
      rowId,
      toIndex: originalIndex,
      baseVersion: 0,
      clientMsgId: '',
    },
  ];
  pushUndo(userId, projectId, {
    label: 'Row delete',
    forward,
    inverse,
    timestamp: Date.now(),
  });
  return metaOf({ forward, inverse });
}

/**
 * Push an undo entry for a row.move — both forward and inverse
 * are row.move; only the toIndex differs. fromIndex is captured
 * before the mutation so undo lands the row exactly where it was.
 */
function pushReorderRowUndo(
  projectId: string,
  sheetId: string,
  rowId: string,
  fromIndex: number,
  toIndex: number,
): UndoMeta | null {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return null;
  if (fromIndex === toIndex) return null;
  const forward: UndoableOp[] = [{
    type: 'row.move',
    sheetId,
    rowId,
    toIndex,
    baseVersion: 0,
    clientMsgId: '',
  }];
  const inverse: UndoableOp[] = [{
    type: 'row.move',
    sheetId,
    rowId,
    toIndex: fromIndex,
    baseVersion: 0,
    clientMsgId: '',
  }];
  pushUndo(userId, projectId, {
    label: 'Row move',
    forward,
    inverse,
    timestamp: Date.now(),
  });
  return metaOf({ forward, inverse });
}

/**
 * Push an undo entry for a column.add — inverse is column.delete.
 * Linked-column bidirectional creation (link + reverse) bypasses
 * this helper because the addColumn path returns early before
 * reaching the simple bottom-of-function emit. That's deliberate:
 * undoing a bidirectional link requires deleting *two* columns
 * across two sheets, which Phase 2a's single-op inverse can't
 * express. Phase 2b extends UndoEntry to carry UndoableOp[].
 */
function pushAddColumnUndo(
  projectId: string,
  sheetId: string,
  column: Column,
): UndoMeta | null {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return null;
  const forward: UndoableOp[] = [{
    type: 'column.add',
    sheetId,
    column,
    baseVersion: 0,
    clientMsgId: '',
  }];
  const inverse: UndoableOp[] = [{
    type: 'column.delete',
    sheetId,
    columnId: column.id,
    baseVersion: 0,
    clientMsgId: '',
  }];
  pushUndo(userId, projectId, {
    label: 'Column add',
    forward,
    inverse,
    timestamp: Date.now(),
  });
  return metaOf({ forward, inverse });
}

/**
 * Push an undo entry for a column.delete — multi-op inverse with
 * column.add (restores column metadata) followed by cell.update
 * for each non-empty cell that the column held. Empty cells are
 * skipped because cell.update on a never-set cell is a no-op on
 * the wire and just bloats the inverse list.
 *
 * Position recovery: column.add appends to the end of the
 * sheet's columns. ClientOp has no column.move — the column
 * lands at the right edge after undo and the user can drag it
 * back. Adding column.move to the wire protocol is its own ADR
 * decision; for now Phase 2b accepts the position drift on undo.
 */
function pushDeleteColumnUndo(
  projectId: string,
  sheetId: string,
  column: Column,
  cellValues: Array<{ rowId: string; value: CellValue }>,
): UndoMeta | null {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return null;
  const forward: UndoableOp[] = [{
    type: 'column.delete',
    sheetId,
    columnId: column.id,
    baseVersion: 0,
    clientMsgId: '',
  }];
  const inverse: UndoableOp[] = [{
    type: 'column.add',
    sheetId,
    column,
    baseVersion: 0,
    clientMsgId: '',
  }];
  for (const { rowId, value } of cellValues) {
    inverse.push({
      type: 'cell.update',
      sheetId,
      rowId,
      columnId: column.id,
      value,
      baseVersion: 0,
      clientMsgId: '',
    });
  }
  pushUndo(userId, projectId, {
    label: 'Column delete',
    forward,
    inverse,
    timestamp: Date.now(),
  });
  return metaOf({ forward, inverse });
}

/**
 * Push an undo entry for a column.update — inverse carries the
 * *original* values of the same fields the user changed. Only the
 * touched fields are stored so the inverse stays minimal.
 */
function pushUpdateColumnUndo(
  projectId: string,
  sheetId: string,
  columnId: string,
  prevPatch: Record<string, unknown>,
  newPatch: Record<string, unknown>,
): UndoMeta | null {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return null;
  const forward: UndoableOp[] = [{
    type: 'column.update',
    sheetId,
    columnId,
    patch: newPatch,
    baseVersion: 0,
    clientMsgId: '',
  }];
  const inverse: UndoableOp[] = [{
    type: 'column.update',
    sheetId,
    columnId,
    patch: prevPatch,
    baseVersion: 0,
    clientMsgId: '',
  }];
  pushUndo(userId, projectId, {
    label: 'Column update',
    forward,
    inverse,
    timestamp: Date.now(),
  });
  return metaOf({ forward, inverse });
}

/**
 * Push an undo entry for a *bidirectional* link column add. The
 * forward sequence creates both the forward + reverse columns
 * (single Cmd+Shift+Z restores both); the inverse sequence
 * deletes them in reverse order. Stays on a single UndoEntry so
 * one Cmd+Z press unwinds the cascade — the alternative (two
 * separate entries) would require two Cmd+Z presses and could
 * leave a half-state if the user only undid one.
 *
 * Phase 2c — addColumn's link-cascade path skipped Phase 2a
 * because a single UndoableOp couldn't represent the pair.
 * Phase 2b promoted UndoEntry.forward / inverse to UndoableOp[];
 * this helper just consumes that capability.
 */
function pushAddLinkColumnsUndo(
  projectId: string,
  forwardSheetId: string,
  forwardCol: Column,
  reverseSheetId: string,
  reverseCol: Column,
): UndoMeta | null {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return null;
  const forward: UndoableOp[] = [
    {
      type: 'column.add',
      sheetId: forwardSheetId,
      column: forwardCol,
      baseVersion: 0,
      clientMsgId: '',
    },
    {
      type: 'column.add',
      sheetId: reverseSheetId,
      column: reverseCol,
      baseVersion: 0,
      clientMsgId: '',
    },
  ];
  const inverse: UndoableOp[] = [
    {
      type: 'column.delete',
      sheetId: reverseSheetId,
      columnId: reverseCol.id,
      baseVersion: 0,
      clientMsgId: '',
    },
    {
      type: 'column.delete',
      sheetId: forwardSheetId,
      columnId: forwardCol.id,
      baseVersion: 0,
      clientMsgId: '',
    },
  ];
  pushUndo(userId, projectId, {
    label: 'Link columns add',
    forward,
    inverse,
    timestamp: Date.now(),
  });
  return metaOf({ forward, inverse });
}

/**
 * Push an undo entry for a *bidirectional* link column delete.
 * Inverse re-creates both columns + restores all cell values per
 * row on both sides. Order matters for the inverse: reverse
 * column.add lands first (so the forward column.add can include
 * reverseColumnId pointing at the just-restored target), then the
 * forward column.add, then the cell.update[]s.
 */
function pushDeleteLinkColumnsUndo(
  projectId: string,
  forwardSheetId: string,
  forwardCol: Column,
  forwardCells: Array<{ rowId: string; value: CellValue }>,
  reverseSheetId: string,
  reverseCol: Column,
  reverseCells: Array<{ rowId: string; value: CellValue }>,
): UndoMeta | null {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return null;
  const forward: UndoableOp[] = [
    {
      type: 'column.delete',
      sheetId: forwardSheetId,
      columnId: forwardCol.id,
      baseVersion: 0,
      clientMsgId: '',
    },
    {
      type: 'column.delete',
      sheetId: reverseSheetId,
      columnId: reverseCol.id,
      baseVersion: 0,
      clientMsgId: '',
    },
  ];
  const inverse: UndoableOp[] = [
    {
      type: 'column.add',
      sheetId: reverseSheetId,
      column: reverseCol,
      baseVersion: 0,
      clientMsgId: '',
    },
    {
      type: 'column.add',
      sheetId: forwardSheetId,
      column: forwardCol,
      baseVersion: 0,
      clientMsgId: '',
    },
  ];
  for (const { rowId, value } of forwardCells) {
    inverse.push({
      type: 'cell.update',
      sheetId: forwardSheetId,
      rowId,
      columnId: forwardCol.id,
      value,
      baseVersion: 0,
      clientMsgId: '',
    });
  }
  for (const { rowId, value } of reverseCells) {
    inverse.push({
      type: 'cell.update',
      sheetId: reverseSheetId,
      rowId,
      columnId: reverseCol.id,
      value,
      baseVersion: 0,
      clientMsgId: '',
    });
  }
  pushUndo(userId, projectId, {
    label: 'Link columns delete',
    forward,
    inverse,
    timestamp: Date.now(),
  });
  return metaOf({ forward, inverse });
}

/**
 * Push an undo entry for a cell.update — captures the (forward,
 * inverse) pair the user just performed. Reads the current user
 * from authStore at call time; missing user (anonymous / pre-auth
 * race) drops the entry silently. baseVersion / clientMsgId on the
 * stored ops are placeholders — writeQueue.emitOp fills them in
 * when the inverse is later replayed.
 */
function pushCellUpdateUndo(
  projectId: string,
  sheetId: string,
  rowId: string,
  columnId: string,
  prevValue: CellValue,
  newValue: CellValue,
): UndoMeta | null {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return null;
  const forward: UndoableOp[] = [{
    type: 'cell.update',
    sheetId,
    rowId,
    columnId,
    value: newValue,
    baseVersion: 0,
    clientMsgId: '',
  }];
  const inverse: UndoableOp[] = [{
    type: 'cell.update',
    sheetId,
    rowId,
    columnId,
    value: prevValue,
    baseVersion: 0,
    clientMsgId: '',
  }];
  pushUndo(userId, projectId, {
    label: 'Cell update',
    forward,
    inverse,
    timestamp: Date.now(),
  });
  return metaOf({ forward, inverse });
}

/** writeCell — narrow case for cell.update (most frequent op). */
function writeCell(
  set: SetFn,
  projectId: string,
  sheetId: string,
  rowId: string,
  columnId: string,
  value: CellValue,
): void {
  writeSheet(set, projectId, sheetId, (sheet) => ({
    ...sheet,
    rows: sheet.rows.map((r) =>
      r.id !== rowId ? r : { ...r, cells: { ...r.cells, [columnId]: value } },
    ),
  }));
}

export const createCellActions = (set: SetFn, get: GetFn) => ({
  // ==== 컬럼 ====

  addColumn: (
    projectId: string,
    sheetId: string,
    column: Omit<Column, 'id'>,
    options?: { origin?: 'local' | 'remote'; columnId?: string; skipUndoPush?: boolean }
  ): string => {
    const isRemote = options?.origin === 'remote';
    const skipUndoPush = options?.skipUndoPush ?? false;
    const id = options?.columnId ?? newId();

    // link/lookup/rollup 사이클 사전 검사. 생성 차단.
    if (column.type === 'link' || column.type === 'lookup' || column.type === 'rollup') {
      const state = get();
      const project = state.projects.find((p) => p.id === projectId);
      if (project) {
        const cycle = wouldCreateCycle(project.sheets, sheetId, { ...column, id } as Column);
        if (cycle.hasCycle) {
          toast.error(`순환 참조 감지: ${cycle.pathNames.join(' → ')}\n컬럼이 생성되지 않았습니다.`, 6000);
          return '';
        }
      }
    }

    // Track양방향 미러링: link 타입이면 대상 시트에 reverse 컬럼 자동 생성
    if (column.type === 'link' && column.linkedSheetId && !column.isReverseLink) {
      const state = get();
      const project = state.projects.find((p) => p.id === projectId);
      const sourceSheet = project?.sheets.find((s) => s.id === sheetId);
      const targetSheet = project?.sheets.find((s) => s.id === column.linkedSheetId);
      if (sourceSheet && targetSheet) {
        const reverseId = newId();
        const forwardCol: Column = { ...column, id, reverseColumnId: reverseId };
        const reverseCol: Column = {
          id: reverseId,
          name: `${sourceSheet.name} (역참조)`,
          type: 'link',
          linkedSheetId: sheetId,
          linkedDisplayColumnId: undefined,
          linkedMultiple: true,
          reverseColumnId: id,
          isReverseLink: true,
          width: 160,
        };
        const linkedSheetId = column.linkedSheetId;
        writeSheet(
          set,
          projectId,
          sheetId,
          (s) =>
            s.columns.some((c) => c.id === forwardCol.id)
              ? s
              : { ...s, columns: [...s.columns, forwardCol] },
        );
        writeSheet(
          set,
          projectId,
          linkedSheetId,
          (s) =>
            s.columns.some((c) => c.id === reverseCol.id)
              ? s
              : { ...s, columns: [...s.columns, reverseCol] },
        );
        // Cascade UndoMeta rides on the FIRST emit only — server
        // gets one op_idempotency row with both ops in the forward
        // + inverse arrays. The SECOND emit goes out as a normal
        // (non-undoable) op so the cascade collapses to a single
        // Cmd+Z press. (op_idempotency_undo_lookup partial index
        // filters NULL inverse_payload rows out of the lookup.)
        const linkAddMeta = !isRemote && !skipUndoPush
          ? pushAddLinkColumnsUndo(
              projectId,
              sheetId,
              forwardCol,
              linkedSheetId,
              reverseCol,
            )
          : null;
        if (!isRemote) {
          emitOp({ kind: 'column.add', sheetId, column: forwardCol }, linkAddMeta);
          emitOp({
            kind: 'column.add',
            sheetId: linkedSheetId,
            column: reverseCol,
          });
        }
        return id;
      }
    }

    const fullColumn = { ...column, id };
    writeSheet(
      set,
      projectId,
      sheetId,
      (s) =>
        s.columns.some((c) => c.id === fullColumn.id)
          ? s
          : { ...s, columns: [...s.columns, fullColumn] },
    );
    const addColumnMeta = !isRemote && !skipUndoPush
      ? pushAddColumnUndo(projectId, sheetId, fullColumn)
      : null;
    if (!isRemote) emitOp({ kind: 'column.add', sheetId, column: fullColumn }, addColumnMeta);

    // Trackfix: formula 타입 컬럼 추가 시 기존 행들에 formula 값 prefill
    // (addRow 에서는 이미 처리됨, addColumn 경로에서는 누락되어 있었음)
    if (fullColumn.type === 'formula' && fullColumn.formula) {
      const state = get();
      const project = state.projects.find((p) => p.id === projectId);
      const sheet = project?.sheets.find((s) => s.id === sheetId);
      if (sheet && sheet.rows.length > 0) {
        for (const row of sheet.rows) {
          const existing = row.cells[id];
          // 빈 셀에만 prefill — 기존 값 덮어쓰기 방지
          if (existing === undefined || existing === null || existing === '') {
            writeCell(set, projectId, sheetId, row.id, id, fullColumn.formula!);
          }
        }
      }
    }

    return id;
  },

  insertColumn: (
    projectId: string,
    sheetId: string,
    column: Omit<Column, 'id'>,
    atIndex: number
  ): string => {
    const id = newId();
    const fullColumn = { ...column, id } as Column;
    writeSheet(
      set,
      projectId,
      sheetId,
      (s) => {
        if (s.columns.some((c) => c.id === id)) return s;
        const next = s.columns.slice();
        next.splice(Math.max(0, Math.min(next.length, atIndex)), 0, fullColumn);
        return { ...s, columns: next };
      },
    );
    return id;
  },

  updateColumn: (
    projectId: string,
    sheetId: string,
    columnId: string,
    updates: Partial<Column>,
    options?: { origin?: 'local' | 'remote'; skipUndoPush?: boolean }
  ) => {
    const isRemote = options?.origin === 'remote';
    const skipUndoPush = options?.skipUndoPush ?? false;

    // link/lookup/rollup 관련 필드 변경 시 사이클 사전 검사
    const touchesLink = (
      'type' in updates || 'linkedSheetId' in updates
      || 'lookupLinkColumnId' in updates || 'lookupTargetColumnId' in updates
    );
    if (touchesLink) {
      const state = get();
      const project = state.projects.find((p) => p.id === projectId);
      const sheet = project?.sheets.find((s) => s.id === sheetId);
      const existing = sheet?.columns.find((c) => c.id === columnId);
      if (project && existing) {
        const merged = { ...existing, ...updates } as Column;
        if (merged.type === 'link' || merged.type === 'lookup' || merged.type === 'rollup') {
          const cycle = wouldCreateCycle(project.sheets, sheetId, merged);
          if (cycle.hasCycle) {
            toast.error(`순환 참조 감지: ${cycle.pathNames.join(' → ')}\n변경이 적용되지 않았습니다.`, 6000);
            return;
          }
        }
      }
    }

    // Snapshot only the fields the user touched — minimal inverse.
    let prevPatch: Record<string, unknown> | null = null;
    if (!isRemote && !skipUndoPush) {
      const sheet = get().getSheet(projectId, sheetId);
      const existing = sheet?.columns.find((c) => c.id === columnId);
      if (existing) {
        prevPatch = {};
        for (const key of Object.keys(updates)) {
          (prevPatch as Record<string, unknown>)[key] =
            (existing as unknown as Record<string, unknown>)[key];
        }
      }
    }

    writeSheet(
      set,
      projectId,
      sheetId,
      (s) => ({
        ...s,
        columns: s.columns.map((c) =>
          c.id !== columnId ? c : ({ ...c, ...updates } as Column),
        ),
      }),
    );
    const updateColumnMeta = prevPatch
      ? pushUpdateColumnUndo(
          projectId,
          sheetId,
          columnId,
          prevPatch,
          updates as Record<string, unknown>,
        )
      : null;
    if (!isRemote) {
      emitOp({ kind: 'column.update', sheetId, columnId, patch: updates }, updateColumnMeta);
    }
  },

  deleteColumn: (
    projectId: string,
    sheetId: string,
    columnId: string,
    options?: { origin?: 'local' | 'remote'; skipUndoPush?: boolean }
  ) => {
    const isRemote = options?.origin === 'remote';
    const skipUndoPush = options?.skipUndoPush ?? false;
    const state = get();
    const project = state.projects.find((p) => p.id === projectId);
    const sourceSheet = project?.sheets.find((s) => s.id === sheetId);
    const column = sourceSheet?.columns.find((c) => c.id === columnId);

    // Capture (column metadata + per-row cell values) before the
    // mutation. The link bidirectional case (column.linkedSheetId
    // + reverseColumnId) returns early below — undoing two coupled
    // column.delete ops needs a richer multi-op inverse than we
    // build here, so the link path doesn't push undo. Single-column
    // delete is the common path; that's what the snapshot covers.
    let snapshotCells: Array<{ rowId: string; value: CellValue }> | null = null;
    if (
      !isRemote
      && !skipUndoPush
      && column
      && !(column.type === 'link' && column.linkedSheetId && column.reverseColumnId)
      && sourceSheet
    ) {
      snapshotCells = [];
      for (const row of sourceSheet.rows) {
        const v = row.cells[columnId];
        if (v !== undefined && v !== null && v !== '') {
          snapshotCells.push({ rowId: row.id, value: v });
        }
      }
    }

    const removeColumnAndCells = (s: import('@/types').Sheet, colId: string) => ({
      ...s,
      columns: s.columns.filter((c) => c.id !== colId),
      rows: s.rows.map((r) => {
        if (!(colId in r.cells)) return r;
        const { [colId]: _, ...rest } = r.cells;
        return { ...r, cells: rest };
      }),
    });

    // Trackcascade: link 컬럼 삭제 시 반대편 reverse 컬럼도 삭제
    if (column?.type === 'link' && column.linkedSheetId && column.reverseColumnId) {
      const linkedSheetId = column.linkedSheetId;
      const reverseColumnId = column.reverseColumnId;

      // Snapshot reverse-side column metadata + cell values for the
      // multi-sheet undo. Forward + reverse columns + their cells
      // get one shared UndoEntry — Cmd+Z restores both sheets in
      // one Cmd+Z press.
      const targetSheet = project?.sheets.find((s) => s.id === linkedSheetId);
      const reverseColumn = targetSheet?.columns.find((c) => c.id === reverseColumnId);
      const forwardCells: Array<{ rowId: string; value: CellValue }> = [];
      if (sourceSheet) {
        for (const row of sourceSheet.rows) {
          const v = row.cells[columnId];
          if (v !== undefined && v !== null && v !== '') {
            forwardCells.push({ rowId: row.id, value: v });
          }
        }
      }
      const reverseCells: Array<{ rowId: string; value: CellValue }> = [];
      if (targetSheet) {
        for (const row of targetSheet.rows) {
          const v = row.cells[reverseColumnId];
          if (v !== undefined && v !== null && v !== '') {
            reverseCells.push({ rowId: row.id, value: v });
          }
        }
      }

      writeSheet(
        set,
        projectId,
        sheetId,
        (s) => removeColumnAndCells(s, columnId),
      );
      writeSheet(
        set,
        projectId,
        linkedSheetId,
        (s) => removeColumnAndCells(s, reverseColumnId),
      );
      // Cascade UndoMeta on the FIRST emit only (same pattern as
      // addColumn link branch — server gets one op_idempotency row
      // covering both column deletes for atomic Cmd+Z).
      const linkDeleteMeta = !isRemote && !skipUndoPush && column && reverseColumn
        ? pushDeleteLinkColumnsUndo(
            projectId,
            sheetId,
            column,
            forwardCells,
            linkedSheetId,
            reverseColumn,
            reverseCells,
          )
        : null;
      if (!isRemote) {
        emitOp({ kind: 'column.delete', sheetId, columnId }, linkDeleteMeta);
        emitOp({
          kind: 'column.delete',
          sheetId: linkedSheetId,
          columnId: reverseColumnId,
        });
      }
      return;
    }
    writeSheet(
      set,
      projectId,
      sheetId,
      (s) => removeColumnAndCells(s, columnId),
    );
    const deleteColumnMeta = snapshotCells && column
      ? pushDeleteColumnUndo(projectId, sheetId, column, snapshotCells)
      : null;
    if (!isRemote) emitOp({ kind: 'column.delete', sheetId, columnId }, deleteColumnMeta);
  },

  reorderColumns: (projectId: string, sheetId: string, columnIds: string[]) => {
    writeSheet(
      set,
      projectId,
      sheetId,
      (s) => {
        const byId = new Map(s.columns.map((c) => [c.id, c]));
        const reordered: Column[] = [];
        for (const id of columnIds) {
          const col = byId.get(id);
          if (col) reordered.push(col);
        }
        // Append any columns missing from columnIds at the end so a
        // partial reorder request never silently drops a column.
        for (const c of s.columns) {
          if (!columnIds.includes(c.id)) reordered.push(c);
        }
        return { ...s, columns: reordered };
      },
    );
  },

  // ==== 행 ====

  addRow: (
    projectId: string,
    sheetId: string,
    cells: Record<string, CellValue> = {},
    options?: { origin?: 'local' | 'remote'; rowId?: string; skipUndoPush?: boolean }
  ): string => {
    const isRemote = options?.origin === 'remote';
    const skipUndoPush = options?.skipUndoPush ?? false;
    const id = options?.rowId ?? newId();
    const sheet = get().getSheet(projectId, sheetId);

    // 수식 컬럼의 formula 를 새 행에 자동 prefill
    const formulaCells: Record<string, CellValue> = {};
    sheet?.columns.forEach((col) => {
      if (col.type === 'formula' && col.formula) {
        formulaCells[col.id] = col.formula;
      }
    });

    const row = { id, cells: { ...formulaCells, ...cells } };
    writeSheet(
      set,
      projectId,
      sheetId,
      (s) => (s.rows.some((r) => r.id === id) ? s : { ...s, rows: [...s.rows, row] }),
    );
    const addRowMeta = !isRemote && !skipUndoPush
      ? pushAddRowUndo(projectId, sheetId, id, row.cells)
      : null;
    if (!isRemote) emitOp({ kind: 'row.add', sheetId, row }, addRowMeta);
    return id;
  },

  insertRow: (
    projectId: string,
    sheetId: string,
    atIndex: number,
    cells: Record<string, CellValue> = {},
    options?: { origin?: 'local' | 'remote'; rowId?: string }
  ): string => {
    const isRemote = options?.origin === 'remote';
    const id = options?.rowId ?? newId();
    const sheet = get().getSheet(projectId, sheetId);

    const formulaCells: Record<string, CellValue> = {};
    sheet?.columns.forEach((col) => {
      if (col.type === 'formula' && col.formula) {
        formulaCells[col.id] = col.formula;
      }
    });

    const row = { id, cells: { ...formulaCells, ...cells } };
    writeSheet(
      set,
      projectId,
      sheetId,
      (s) => {
        if (s.rows.some((r) => r.id === id)) return s;
        const next = s.rows.slice();
        next.splice(Math.max(0, Math.min(next.length, atIndex)), 0, row);
        return { ...s, rows: next };
      },
    );
    if (!isRemote) {
      // backend RowAdd is append-only — emit row.add then row.move to
      // reach the requested atIndex. Two ops, not atomic on the wire,
      // so peers may briefly see the row at the end before the move
      // lands. Acceptable v1 trade-off (insertRow is rare; full atomic
      // insert needs ADR 0008 v2.1 with a position field on row.add).
      emitOp({ kind: 'row.add', sheetId, row });
      emitOp({ kind: 'row.move', sheetId, rowId: id, toIndex: atIndex });
    }
    return id;
  },

  updateRow: (
    projectId: string,
    sheetId: string,
    rowId: string,
    updates: Partial<Row>
  ) => {
    writeSheet(
      set,
      projectId,
      sheetId,
      (s) => ({
        ...s,
        rows: s.rows.map((r) => (r.id !== rowId ? r : { ...r, ...updates })),
      }),
    );
  },

  updateCell: (
    projectId: string,
    sheetId: string,
    rowId: string,
    columnId: string,
    value: CellValue,
    options?: { origin?: 'local' | 'remote'; skipUndoPush?: boolean }
  ) => {
    // origin='remote' is set by the broadcast handler when applying
    // a peer's op back into the store; that path must not re-emit
    // the op or the sender would echo to itself indefinitely.
    // skipUndoPush is set by the undo/redo replay path — emit must
    // happen (peers see the undo) but we mustn't push *another*
    // undo entry or Cmd+Z+Cmd+Z chases its tail.
    const isRemote = options?.origin === 'remote';
    const skipUndoPush = options?.skipUndoPush ?? false;
    const state = get();
    const project = state.projects.find((p) => p.id === projectId);
    const sourceSheet = project?.sheets.find((s) => s.id === sheetId);
    const column = sourceSheet?.columns.find((c) => c.id === columnId);

    // Track양방향 미러링: link 타입 셀 업데이트 시 반대쪽도 동기화
    if (
      column?.type === 'link' &&
      column.linkedSheetId &&
      column.reverseColumnId &&
      sourceSheet
    ) {
      const targetSheet = project?.sheets.find((s) => s.id === column.linkedSheetId);
      if (targetSheet) {
        const oldValue = sourceSheet.rows.find((r) => r.id === rowId)?.cells[columnId];
        const oldIds = String(oldValue ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        const newIds = String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        const added = newIds.filter((x) => !oldIds.includes(x));
        const removed = oldIds.filter((x) => !newIds.includes(x));
        const reverseColId = column.reverseColumnId;
        const targetSheetId = column.linkedSheetId;

        writeCell(set, projectId, sheetId, rowId, columnId, value);
        if (!isRemote) emitOp({ kind: 'cell.update', sheetId, rowId, columnId, value });
        // 추가된 target row 의 reverse 컬럼에 현재 rowId 추가
        for (const targetRowId of added) {
          const targetRow = targetSheet.rows.find((r) => r.id === targetRowId);
          if (!targetRow) continue;
          const currentLinks = String(targetRow.cells[reverseColId] ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          if (!currentLinks.includes(rowId)) {
            const next = [...currentLinks, rowId].join(',');
            writeCell(set, projectId, targetSheetId, targetRowId, reverseColId, next);
            if (!isRemote) {
              emitOp({
                kind: 'cell.update',
                sheetId: targetSheetId,
                rowId: targetRowId,
                columnId: reverseColId,
                value: next,
              });
            }
          }
        }
        // 제거된 target row 의 reverse 컬럼에서 현재 rowId 제거
        for (const targetRowId of removed) {
          const targetRow = targetSheet.rows.find((r) => r.id === targetRowId);
          if (!targetRow) continue;
          const currentLinks = String(targetRow.cells[reverseColId] ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          const next = currentLinks.filter((x) => x !== rowId).join(',');
          writeCell(set, projectId, targetSheetId, targetRowId, reverseColId, next);
          if (!isRemote) {
            emitOp({
              kind: 'cell.update',
              sheetId: targetSheetId,
              rowId: targetRowId,
              columnId: reverseColId,
              value: next,
            });
          }
        }
        return;
      }
    }

    const prevValue = sourceSheet?.rows.find((r) => r.id === rowId)?.cells[columnId] ?? null;
    writeCell(set, projectId, sheetId, rowId, columnId, value);
    if (!isRemote) {
      const cellUpdateMeta = !skipUndoPush
        ? pushCellUpdateUndo(projectId, sheetId, rowId, columnId, prevValue, value)
        : null;
      emitOp({ kind: 'cell.update', sheetId, rowId, columnId, value }, cellUpdateMeta);
    }
  },

  updateCellStyle: (
    projectId: string,
    sheetId: string,
    rowId: string,
    columnId: string,
    style: Partial<CellStyle>,
  ) => {
    // ADR 0008 v2.2 — server-canonical cell style. Direct setState +
    // emitOp, mirroring updateCell. No Y.Doc fallback (post v0.6 ζ).
    const existing = get().getCellStyle(projectId, sheetId, rowId, columnId) ?? {};
    const merged: CellStyle = { ...DEFAULT_CELL_STYLE, ...existing, ...style };
    writeSheet(set, projectId, sheetId, (sheet) => ({
      ...sheet,
      rows: sheet.rows.map((r) =>
        r.id !== rowId
          ? r
          : { ...r, cellStyles: { ...(r.cellStyles ?? {}), [columnId]: merged } },
      ),
    }));
    emitOp({ kind: 'cell.style.update', sheetId, rowId, columnId, style: merged });
  },

  updateCellsStyle: (
    projectId: string,
    sheetId: string,
    cells: Array<{ rowId: string; columnId: string }>,
    style: Partial<CellStyle>,
  ) => {
    // Build the merged styles first, then apply locally + emit per-cell
    // (one cell.style.update op per target). Multi-cell select-and-bold
    // = N ops. Server's idempotency cache + version_++ semantics stay
    // unchanged — same as multi-cell pastes already work.
    const targets = cells.map(({ rowId, columnId }) => {
      const existing = get().getCellStyle(projectId, sheetId, rowId, columnId) ?? {};
      const merged: CellStyle = { ...DEFAULT_CELL_STYLE, ...existing, ...style };
      return { rowId, columnId, style: merged };
    });
    writeSheet(set, projectId, sheetId, (sheet) => ({
      ...sheet,
      rows: sheet.rows.map((r) => {
        const matches = targets.filter((t) => t.rowId === r.id);
        if (matches.length === 0) return r;
        const nextStyles = { ...(r.cellStyles ?? {}) };
        for (const m of matches) nextStyles[m.columnId] = m.style;
        return { ...r, cellStyles: nextStyles };
      }),
    }));
    for (const { rowId, columnId, style: merged } of targets) {
      emitOp({ kind: 'cell.style.update', sheetId, rowId, columnId, style: merged });
    }
  },

  getCellStyle: (
    projectId: string,
    sheetId: string,
    rowId: string,
    columnId: string
  ): CellStyle | undefined => {
    const project = get().projects.find((p) => p.id === projectId);
    const sheet = project?.sheets.find((s) => s.id === sheetId);
    const row = sheet?.rows.find((r) => r.id === rowId);
    return row?.cellStyles?.[columnId];
  },

  deleteRow: (
    projectId: string,
    sheetId: string,
    rowId: string,
    options?: { origin?: 'local' | 'remote'; skipUndoPush?: boolean }
  ) => {
    const isRemote = options?.origin === 'remote';
    const skipUndoPush = options?.skipUndoPush ?? false;

    // Snapshot the row state *before* the mutation so the inverse
    // can restore both the cells and the original index. If the
    // row isn't in the local sheet (e.g. peer race) the snapshot is
    // null and we skip the undo push — there's nothing meaningful
    // to undo.
    let snapshot: { cells: Record<string, CellValue>; index: number } | null = null;
    if (!isRemote && !skipUndoPush) {
      const sheet = get().getSheet(projectId, sheetId);
      const idx = sheet?.rows.findIndex((r) => r.id === rowId) ?? -1;
      if (idx >= 0 && sheet) {
        snapshot = { cells: { ...sheet.rows[idx].cells }, index: idx };
      }
    }

    writeSheet(
      set,
      projectId,
      sheetId,
      (s) => ({ ...s, rows: s.rows.filter((r) => r.id !== rowId) }),
    );
    const deleteRowMeta = snapshot
      ? pushDeleteRowUndo(projectId, sheetId, rowId, snapshot.cells, snapshot.index)
      : null;
    if (!isRemote) emitOp({ kind: 'row.delete', sheetId, rowId }, deleteRowMeta);
  },

  reorderRow: (
    projectId: string,
    sheetId: string,
    rowId: string,
    targetIndex: number,
    options?: { origin?: 'local' | 'remote'; skipUndoPush?: boolean }
  ) => {
    const isRemote = options?.origin === 'remote';
    const skipUndoPush = options?.skipUndoPush ?? false;

    // Snapshot the source index before the mutation. Same shape as
    // deleteRow: skip the undo push if the row isn't there (peer
    // race) — nothing meaningful to undo.
    let fromIndex = -1;
    if (!isRemote && !skipUndoPush) {
      const sheet = get().getSheet(projectId, sheetId);
      fromIndex = sheet?.rows.findIndex((r) => r.id === rowId) ?? -1;
    }

    writeSheet(
      set,
      projectId,
      sheetId,
      (s) => {
        const fromIdx = s.rows.findIndex((r) => r.id === rowId);
        if (fromIdx < 0) return s;
        const clamped = Math.max(0, Math.min(s.rows.length - 1, targetIndex));
        if (clamped === fromIdx) return s;
        const next = s.rows.slice();
        const [moving] = next.splice(fromIdx, 1);
        next.splice(clamped, 0, moving);
        return { ...s, rows: next };
      },
    );
    const reorderRowMeta = fromIndex >= 0
      ? pushReorderRowUndo(projectId, sheetId, rowId, fromIndex, targetIndex)
      : null;
    if (!isRemote) {
      emitOp({ kind: 'row.move', sheetId, rowId, toIndex: targetIndex }, reorderRowMeta);
    }
  },

  addMultipleRows: (projectId: string, sheetId: string, count: number) => {
    const sheet = get().getSheet(projectId, sheetId);
    const formulaCells: Record<string, CellValue> = {};
    sheet?.columns.forEach((col) => {
      if (col.type === 'formula' && col.formula) {
        formulaCells[col.id] = col.formula;
      }
    });

    const newRows: Row[] = Array.from({ length: count }, () => ({
      id: newId(),
      cells: { ...formulaCells },
    }));

    writeSheet(
      set,
      projectId,
      sheetId,
      (s) => ({ ...s, rows: [...s.rows, ...newRows] }),
    );
    // emit one row.add per new row — addMultipleRows has no remote
    // origin path (peers receive individual row.add broadcasts that
    // the inbound handler dispatches one by one).
    for (const row of newRows) {
      emitOp({ kind: 'row.add', sheetId, row });
    }
  },

});
