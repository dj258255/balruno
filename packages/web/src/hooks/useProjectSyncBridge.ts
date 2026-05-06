/**
 * Project sync wiring — connects {@link useProjectSync} to the
 * module-level write queue and the zustand project store
 * (ADR 0018 Stages B + D + F).
 *
 * The page component calls this hook instead of useProjectSync
 * directly. It does four jobs:
 *
 *   1. Mount useProjectSync as before (WS connect / sync.full /
 *      op.acked / broadcast lifecycle).
 *   2. Register the hook's send() function on the writeQueue at
 *      mount and clear it on unmount.
 *   3. Watch inbound traffic and update the writeQueue's per-region
 *      baseVersions so the next outbound op carries a fresh version.
 *   4. Apply broadcast frames (peer ops) directly to projectStore
 *      via setState — bypassing cellSlice's Y.Doc-based mutation
 *      (which only propagates to state through useYDocSync, not
 *      mounted on the server-canonical project page).
 *
 * Tree broadcasts (sheet_tree / doc_tree) only update the version
 * counter for now — the apply path lands with Stage G.
 */

import { useEffect } from 'react';

import { useProjectSync, type ServerMsg, type SyncFullPayload } from './useProjectSync';
import { setSyncSender, setVersions, bumpVersion } from '@/lib/sync/writeQueue';
import { useProjectStore } from '@/stores/projectStore';
import type { CellValue, Column, Row, Sheet, TreeNode } from '@balruno/shared';

interface UseProjectSyncBridgeOptions {
  projectId: string | null;
  enabled?: boolean;
}

export function useProjectSyncBridge({
  projectId,
  enabled = true,
}: UseProjectSyncBridgeOptions): { status: ReturnType<typeof useProjectSync>['status'] } {
  const { status, send } = useProjectSync({
    projectId,
    enabled,
    onMessage: (msg) => {
      if (projectId) handleServerMsg(msg, projectId);
    },
  });

  useEffect(() => {
    if (!enabled || !projectId) return;
    setSyncSender(send);
    return () => {
      setSyncSender(null);
    };
  }, [enabled, projectId, send]);

  return { status };
}

function handleServerMsg(msg: ServerMsg, projectId: string): void {
  switch (msg.type) {
    case 'sync.full':
      setVersions(msg.versions);
      hydrateProjectFromSyncFull(projectId, msg);
      break;
    case 'op.acked':
      bumpVersion('data', msg.version);
      bumpVersion('sheetTree', msg.version);
      bumpVersion('docTree', msg.version);
      break;
    case 'conflict':
      break;
    default:
      handleBroadcast(msg, projectId);
      break;
  }
}

function handleBroadcast(msg: Exclude<ServerMsg, { type: 'sync.full' | 'op.acked' | 'conflict' }>,
                          projectId: string): void {
  // Region version bump — same routing table as writeQueue.regionOf.
  if (msg.type === 'cell.update' ||
      msg.type === 'row.add' || msg.type === 'row.delete' || msg.type === 'row.move' ||
      msg.type === 'column.add' || msg.type === 'column.update' || msg.type === 'column.delete') {
    bumpVersion('data', msg.version);
  } else if (msg.type === 'tree.add' || msg.type === 'tree.move' ||
             msg.type === 'tree.delete' || msg.type === 'tree.rename') {
    const treeKind = (msg.op as { treeKind?: 'SHEET' | 'DOC' } | null)?.treeKind;
    if (treeKind === 'SHEET') bumpVersion('sheetTree', msg.version);
    else if (treeKind === 'DOC') bumpVersion('docTree', msg.version);
  }

  // Store apply — direct setState, Y.Doc-bypass. The sender's own
  // ops echo back (ADR 0008 v2.0 Q7); idempotent because each
  // mutator is "find by id and apply", not "append blindly".
  switch (msg.type) {
    case 'cell.update': {
      const op = msg.op as {
        sheetId?: string;
        rowId?: string;
        columnId?: string;
        value?: CellValue;
      } | null;
      if (op?.sheetId && op.rowId && op.columnId) {
        applyToSheet(projectId, op.sheetId, (sheet) => ({
          ...sheet,
          rows: sheet.rows.map((r) =>
            r.id !== op.rowId
              ? r
              : { ...r, cells: { ...r.cells, [op.columnId!]: op.value as CellValue } },
          ),
        }));
      }
      break;
    }
    case 'row.add': {
      const op = msg.op as {
        sheetId?: string;
        row?: { id?: string; cells?: Record<string, CellValue> };
      } | null;
      if (op?.sheetId && op.row?.id) {
        const newRow: Row = { id: op.row.id, cells: op.row.cells ?? {} };
        applyToSheet(projectId, op.sheetId, (sheet) =>
          sheet.rows.some((r) => r.id === newRow.id)
            ? sheet
            : { ...sheet, rows: [...sheet.rows, newRow] },
        );
      }
      break;
    }
    case 'row.delete': {
      const op = msg.op as { sheetId?: string; rowId?: string } | null;
      if (op?.sheetId && op.rowId) {
        applyToSheet(projectId, op.sheetId, (sheet) => ({
          ...sheet,
          rows: sheet.rows.filter((r) => r.id !== op.rowId),
        }));
      }
      break;
    }
    case 'row.move': {
      const op = msg.op as { sheetId?: string; rowId?: string; toIndex?: number } | null;
      if (op?.sheetId && op.rowId && typeof op.toIndex === 'number') {
        applyToSheet(projectId, op.sheetId, (sheet) => {
          const fromIdx = sheet.rows.findIndex((r) => r.id === op.rowId);
          if (fromIdx < 0) return sheet;
          const clamped = Math.max(0, Math.min(sheet.rows.length - 1, op.toIndex!));
          if (clamped === fromIdx) return sheet;
          const next = [...sheet.rows];
          const [moved] = next.splice(fromIdx, 1);
          next.splice(clamped, 0, moved);
          return { ...sheet, rows: next };
        });
      }
      break;
    }
    case 'column.add': {
      const op = msg.op as {
        sheetId?: string;
        column?: { id?: string } & Record<string, unknown>;
      } | null;
      if (op?.sheetId && op.column?.id) {
        const newColumn = op.column as unknown as Column;
        applyToSheet(projectId, op.sheetId, (sheet) =>
          sheet.columns.some((c) => c.id === newColumn.id)
            ? sheet
            : { ...sheet, columns: [...sheet.columns, newColumn] },
        );
      }
      break;
    }
    case 'column.update': {
      const op = msg.op as {
        sheetId?: string;
        columnId?: string;
        patch?: Partial<Column>;
      } | null;
      if (op?.sheetId && op.columnId && op.patch) {
        applyToSheet(projectId, op.sheetId, (sheet) => ({
          ...sheet,
          columns: sheet.columns.map((c) =>
            c.id !== op.columnId ? c : { ...c, ...op.patch },
          ),
        }));
      }
      break;
    }
    case 'column.delete': {
      const op = msg.op as { sheetId?: string; columnId?: string } | null;
      if (op?.sheetId && op.columnId) {
        applyToSheet(projectId, op.sheetId, (sheet) => ({
          ...sheet,
          columns: sheet.columns.filter((c) => c.id !== op.columnId),
        }));
      }
      break;
    }
    default:
      // tree.* — apply path lands with Stage G.
      break;
  }
}

/**
 * Apply a mutator to a single sheet inside the project's sheets
 * array. Pure setState, no Y.Doc — the page reads cell values off
 * store state directly, so this is the actual visible-state path
 * for server-canonical mode. Returning the same sheet reference
 * unchanged keeps the React subtree stable when a broadcast doesn't
 * affect any visible field (e.g. row.add for a row that already
 * exists from the sender's own echo).
 */
function applyToSheet(
  projectId: string,
  sheetId: string,
  mutator: (sheet: Sheet) => Sheet,
): void {
  useProjectStore.setState((state) => ({
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

export function hydrateProjectFromSyncFull(
  projectId: string,
  msg: SyncFullPayload,
): void {
  const sheets: Sheet[] = Array.isArray(msg.data) ? (msg.data as Sheet[]) : [];
  const sheetTree: TreeNode[] = Array.isArray(msg.sheetTree)
    ? (msg.sheetTree as TreeNode[])
    : [];
  useProjectStore.setState((state) => {
    const idx = state.projects.findIndex((p) => p.id === projectId);
    if (idx >= 0) {
      const next = [...state.projects];
      next[idx] = { ...next[idx], sheets, sheetTree };
      return { projects: next };
    }
    const now = Date.now();
    return {
      projects: [
        ...state.projects,
        { id: projectId, name: '', sheets, sheetTree, createdAt: now, updatedAt: now },
      ],
    };
  });
}
