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
 * Tree broadcasts (sheet_tree) only update the version
 * counter for now — the apply path lands with Stage G.
 */

import { useEffect } from 'react';

import { useProjectSync, type ServerMsg, type SyncFullPayload } from './useProjectSync';
import { setSyncSender, setVersions, bumpVersion, setRegionVersion } from '@/lib/sync/writeQueue';
import { useProjectStore } from '@/stores/projectStore';
import { usePresenceStore } from '@/stores/presenceStore';
import type { CellValue, Column, Row, Sheet, TreeNode } from '@balruno/shared';
import {
  renameNodeInTree,
  removeNodeFromTree,
  moveNodeInTreeRaw,
  insertNodeAt,
  withDerivedFolders,
} from '@/lib/tree';

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
      // Advance ONLY the region this op rode. The version columns are
      // independent (ADR 0008 v2.0 §3); bumping both let a high-traffic
      // region — e.g. sheet edits — inflate the idle tree counter via
      // Math.max.
      if (msg.scope) {
        bumpVersion(msg.scope, msg.version);
      } else {
        // Pre-scope server (older deploy): fall back to the legacy
        // bump-all so a frontend-before-backend rollout still acks.
        bumpVersion('data', msg.version);
        bumpVersion('sheetTree', msg.version);
      }
      break;
    case 'conflict':
      // Self-heal: adopt the server's authoritative version for the
      // conflicting region so the next op rides the correct base
      // instead of looping on the same stale value. setRegionVersion
      // (not bumpVersion) because our local counter ran *ahead* and
      // must be pulled back down.
      if (msg.scope) {
        setRegionVersion(msg.scope, msg.serverVersion);
      }
      break;
    case 'presence':
      handlePresence(msg, projectId);
      break;
    default: {
      // ADR 0024 Stage C: comment.* events ride the same channel
      // but don't go through the op log path — dispatch them as
      // window events so CellCommentPanel can listen without
      // pulling in a sync dependency. The msg.type is narrowed to
      // BroadcastPayload's union by this point, so cast through
      // string for the comment dispatch.
      const t = msg.type as string;
      if (
        t === 'comment.added' ||
        t === 'comment.updated' ||
        t === 'comment.deleted'
      ) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('balruno:comment-event', {
              detail: { projectId, type: t, payload: (msg as unknown as { payload?: unknown }).payload },
            }),
          );
        }
        break;
      }
      handleBroadcast(msg, projectId);
      break;
    }
  }
}

/**
 * Presence broadcast → presenceStore upsert. The cursor payload
 * carries an optional {scope, cellKey?, displayName?, color?} so
 * the same frame works for both sheet and doc focus surfaces.
 * Empty / unknown cursor shapes degrade gracefully (skip).
 */
function handlePresence(msg: { userId: string; cursor: unknown }, projectId: string): void {
  void projectId; // scope is encoded in the cursor; future hooks can route per-project if needed.
  const cursor = msg.cursor as
    | {
        scope?: string;
        cellKey?: { rowId?: string; columnId?: string };
        cursor?: { x: number; y: number };
        displayName?: string;
        color?: string;
      }
    | null;
  const scope = cursor?.scope;
  if (!scope) return;
  const cellKey =
    cursor?.cellKey?.rowId && cursor?.cellKey?.columnId
      ? { rowId: cursor.cellKey.rowId, columnId: cursor.cellKey.columnId }
      : undefined;
  usePresenceStore.getState().upsert(scope, {
    userId: msg.userId,
    displayName: cursor?.displayName ?? 'Anonymous',
    color: cursor?.color ?? '#94a3b8',
    cellKey,
    cursor: cursor?.cursor,
  });
}

function handleBroadcast(msg: Exclude<ServerMsg, { type: 'sync.full' | 'op.acked' | 'conflict' }>,
                          projectId: string): void {
  // Region version bump — same routing table as writeQueue.regionOf.
  if (msg.type === 'cell.update' ||
      msg.type === 'row.add' || msg.type === 'row.update' || msg.type === 'row.delete' || msg.type === 'row.move' ||
      msg.type === 'column.add' || msg.type === 'column.update' || msg.type === 'column.delete') {
    bumpVersion('data', msg.version);
  } else if (msg.type === 'tree.add' || msg.type === 'tree.move' ||
             msg.type === 'tree.delete' || msg.type === 'tree.rename') {
    const treeKind = (msg.op as { treeKind?: 'SHEET' } | null)?.treeKind;
    if (treeKind === 'SHEET') bumpVersion('sheetTree', msg.version);
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
    case 'cell.style.update': {
      // ADR 0008 v2.2 — server-canonical cell style. Mirror of cell.update,
      // but writes to row.cellStyles map instead of row.cells. Peers see
      // the bold / color / background apply in real-time.
      const op = msg.op as {
        sheetId?: string;
        rowId?: string;
        columnId?: string;
        style?: Record<string, unknown>;
      } | null;
      if (op?.sheetId && op.rowId && op.columnId) {
        applyToSheet(projectId, op.sheetId, (sheet) => ({
          ...sheet,
          rows: sheet.rows.map((r) =>
            r.id !== op.rowId
              ? r
              : { ...r, cellStyles: { ...(r.cellStyles ?? {}), [op.columnId!]: op.style as never } },
          ),
        }));
      }
      break;
    }
    case 'sheet.metadata.update': {
      // Sheet-level view metadata (activeView, viewGroupColumnId, ...)
      // patch — peers see Kanban / Calendar / Gantt switches and the
      // grouping-column pick in real-time. The patch object mirrors
      // SheetMetadataPatch on the sender side; we apply it as a
      // partial over the sheet record, skipping rows / columns / id
      // defensively (server already filters those).
      const op = msg.op as {
        sheetId?: string;
        patch?: Record<string, unknown>;
      } | null;
      if (op?.sheetId && op.patch) {
        const patch = op.patch;
        applyToSheet(projectId, op.sheetId, (sheet) => {
          const next = { ...sheet } as typeof sheet & Record<string, unknown>;
          for (const [key, value] of Object.entries(patch)) {
            if (key === 'id' || key === 'rows' || key === 'columns') continue;
            next[key] = value;
          }
          return next;
        });
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
    case 'row.update': {
      const op = msg.op as {
        sheetId?: string;
        rowId?: string;
        patch?: Record<string, unknown>;
      } | null;
      if (op?.sheetId && op.rowId && op.patch) {
        const patch = op.patch;
        applyToSheet(projectId, op.sheetId, (sheet) => ({
          ...sheet,
          rows: sheet.rows.map((r) => {
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
    case 'tree.rename': {
      // tree.rename was extended on 2026-05-10 to carry an optional
      // newIcon patch alongside newName (ADR 0018 v2.1). Either or
      // both may be present — peer apply has to walk the tree once
      // and patch whichever fields landed in the op.
      const op = msg.op as {
        treeKind?: 'SHEET';
        nodeId?: string;
        newName?: string;
        newIcon?: string;
      } | null;
      if (!op?.nodeId || !op.treeKind) break;
      if (op.newName === undefined && op.newIcon === undefined) break;
      const treeKey = treeFieldFor(op.treeKind);
      if (!treeKey) break;
      const patchNode = (nodes: TreeNode[]): TreeNode[] =>
        nodes.map((n) => {
          if (n.id === op.nodeId) {
            return {
              ...n,
              ...(op.newName !== undefined ? { name: op.newName } : {}),
              ...(op.newIcon !== undefined
                ? { icon: op.newIcon === '' ? undefined : op.newIcon }
                : {}),
            };
          }
          return n.children ? { ...n, children: patchNode(n.children) } : n;
        });
      useProjectStore.setState((state) => ({
        projects: state.projects.map((p) =>
          p.id !== projectId
            ? p
            : withDerivedFolders({
                ...p,
                [treeKey]: patchNode(
                  (p[treeKey] as TreeNode[] | undefined) ?? [],
                ),
              }),
        ),
      }));
      break;
    }
    case 'tree.add': {
      const op = msg.op as {
        treeKind?: 'SHEET';
        parentId?: string | null;
        position?: number;
        node?: TreeNode;
        // Cross-region cargo (ADR 0008 v2.1): when node.type === 'sheet'
        // backend appends an empty Sheet shell to projects.data and
        // ships it inline so peers can grow sheets[] in the same
        // setState as the leaf insertion. Doc leaves have no analogue
        // — the document body lives on the Hocuspocus channel.
        sheetShell?: Sheet;
        newDataVersion?: number;
      } | null;
      if (!op?.treeKind || !op.node?.id) break;
      const treeKey = treeFieldFor(op.treeKind);
      if (!treeKey) break;
      const newNode = op.node;
      const parentId = op.parentId ?? null;
      const position = typeof op.position === 'number' ? op.position : 0;
      const sheetShell = op.treeKind === 'SHEET' ? op.sheetShell ?? null : null;
      useProjectStore.setState((state) => ({
        projects: state.projects.map((p) => {
          if (p.id !== projectId) return p;
          const nextTree = insertNodeAt(
            (p[treeKey] as TreeNode[] | undefined) ?? [],
            parentId,
            position,
            newNode,
          );
          // Echo dedup: if the sender's own broadcast comes back,
          // p.sheets[] already has the shell. Skip the duplicate
          // append so list ordering and reference identity stay
          // stable. Doc leaves have no body to inject here.
          const sheetAlreadyPresent =
            !!sheetShell && p.sheets.some((s) => s.id === sheetShell.id);
          const nextSheets =
            sheetShell && !sheetAlreadyPresent
              ? [...p.sheets, sheetShell]
              : p.sheets;
          return withDerivedFolders({ ...p, [treeKey]: nextTree, sheets: nextSheets });
        }),
      }));
      break;
    }
    case 'tree.delete': {
      const op = msg.op as {
        treeKind?: 'SHEET';
        nodeId?: string;
      } | null;
      if (!op?.nodeId || !op.treeKind) break;
      const treeKey = treeFieldFor(op.treeKind);
      if (!treeKey) break;
      useProjectStore.setState((state) => ({
        projects: state.projects.map((p) =>
          p.id !== projectId
            ? p
            : withDerivedFolders({
                ...p,
                [treeKey]: removeNodeFromTree(
                  (p[treeKey] as TreeNode[] | undefined) ?? [],
                  op.nodeId!,
                ),
              }),
        ),
      }));
      break;
    }
    case 'tree.move': {
      const op = msg.op as {
        treeKind?: 'SHEET';
        nodeId?: string;
        newParentId?: string | null;
        newPosition?: number;
      } | null;
      if (!op?.nodeId || !op.treeKind) break;
      const treeKey = treeFieldFor(op.treeKind);
      if (!treeKey) break;
      const newParentId = op.newParentId ?? null;
      const newPosition = typeof op.newPosition === 'number' ? op.newPosition : 0;
      useProjectStore.setState((state) => ({
        projects: state.projects.map((p) =>
          p.id !== projectId
            ? p
            : withDerivedFolders({
                ...p,
                [treeKey]: moveNodeInTreeRaw(
                  (p[treeKey] as TreeNode[] | undefined) ?? [],
                  op.nodeId!,
                  newParentId,
                  newPosition,
                ),
              }),
        ),
      }));
      break;
    }
    default:
      break;
  }
}

/**
 * Map an ADR 0008 treeKind onto the matching Project field name. The
 * tree.* broadcast handlers use this to resolve the mutation target.
 */
type TreeFieldKey = 'sheetTree';
function treeFieldFor(kind: 'SHEET' | undefined): TreeFieldKey | null {
  if (kind === 'SHEET') return 'sheetTree';
  return null;
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
      next[idx] = withDerivedFolders({ ...next[idx], sheets, sheetTree });
      return { projects: next };
    }
    const now = Date.now();
    return {
      projects: [
        ...state.projects,
        withDerivedFolders({ id: projectId, name: '', sheets, sheetTree, createdAt: now, updatedAt: now }),
      ],
    };
  });
}
