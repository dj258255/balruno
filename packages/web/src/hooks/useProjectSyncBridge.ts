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
    case 'tree.rename': {
      const op = msg.op as {
        treeKind?: 'SHEET' | 'DOC';
        nodeId?: string;
        newName?: string;
      } | null;
      if (op?.nodeId && op.newName && op.treeKind === 'SHEET') {
        useProjectStore.setState((state) => ({
          projects: state.projects.map((p) =>
            p.id !== projectId
              ? p
              : { ...p, sheetTree: renameNodeInTreeBroadcast(p.sheetTree ?? [], op.nodeId!, op.newName!) },
          ),
        }));
      }
      break;
    }
    case 'tree.add': {
      const op = msg.op as {
        treeKind?: 'SHEET' | 'DOC';
        parentId?: string | null;
        position?: number;
        node?: TreeNode;
        // Cross-region cargo (ADR 0008 v2.1): when node.type === 'sheet'
        // backend appends an empty Sheet shell to projects.data and
        // ships it inline so peers can grow sheets[] in the same
        // setState as the leaf insertion.
        sheetShell?: Sheet;
        newDataVersion?: number;
      } | null;
      if (op?.treeKind === 'SHEET' && op.node?.id) {
        const newNode = op.node;
        const parentId = op.parentId ?? null;
        const position = typeof op.position === 'number' ? op.position : 0;
        const sheetShell = op.sheetShell ?? null;
        useProjectStore.setState((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            const nextTree = insertNodeIntoTreeBroadcast(
              p.sheetTree ?? [],
              parentId,
              position,
              newNode,
            );
            // Echo dedup: if the sender's own broadcast comes back,
            // p.sheets[] already has the shell. Skip the duplicate
            // append so list ordering and reference identity stay
            // stable.
            const sheetAlreadyPresent =
              !!sheetShell && p.sheets.some((s) => s.id === sheetShell.id);
            const nextSheets =
              sheetShell && !sheetAlreadyPresent
                ? [...p.sheets, sheetShell]
                : p.sheets;
            return { ...p, sheetTree: nextTree, sheets: nextSheets };
          }),
        }));
      }
      break;
    }
    case 'tree.delete': {
      const op = msg.op as {
        treeKind?: 'SHEET' | 'DOC';
        nodeId?: string;
      } | null;
      if (op?.treeKind === 'SHEET' && op.nodeId) {
        useProjectStore.setState((state) => ({
          projects: state.projects.map((p) =>
            p.id !== projectId
              ? p
              : { ...p, sheetTree: removeNodeFromTreeBroadcast(p.sheetTree ?? [], op.nodeId!) },
          ),
        }));
      }
      break;
    }
    case 'tree.move': {
      const op = msg.op as {
        treeKind?: 'SHEET' | 'DOC';
        nodeId?: string;
        newParentId?: string | null;
        newPosition?: number;
      } | null;
      if (op?.treeKind === 'SHEET' && op.nodeId) {
        const newParentId = op.newParentId ?? null;
        const newPosition = typeof op.newPosition === 'number' ? op.newPosition : 0;
        useProjectStore.setState((state) => ({
          projects: state.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  sheetTree: moveNodeInTreeBroadcast(
                    p.sheetTree ?? [],
                    op.nodeId!,
                    newParentId,
                    newPosition,
                  ),
                },
          ),
        }));
      }
      break;
    }
    default:
      // doc tree branches land with Stage G.
      break;
  }
}

function renameNodeInTreeBroadcast(
  tree: TreeNode[],
  nodeId: string,
  newName: string,
): TreeNode[] {
  return tree.map((node) => {
    if (node.id === nodeId) return { ...node, name: newName };
    if (node.children && node.children.length > 0) {
      const renamed = renameNodeInTreeBroadcast(node.children, nodeId, newName);
      if (renamed !== node.children) return { ...node, children: renamed };
    }
    return node;
  });
}

function insertNodeIntoTreeBroadcast(
  tree: TreeNode[],
  parentId: string | null,
  position: number,
  node: TreeNode,
): TreeNode[] {
  // sender's own echo — drop the duplicate to keep idempotency.
  if (containsNodeId(tree, node.id)) return tree;
  if (parentId === null) {
    const next = [...tree];
    const clamped = Math.max(0, Math.min(next.length, position));
    next.splice(clamped, 0, node);
    return next;
  }
  return tree.map((n) => {
    if (n.id === parentId) {
      const children = n.children ?? [];
      const clamped = Math.max(0, Math.min(children.length, position));
      const next = [...children];
      next.splice(clamped, 0, node);
      return { ...n, children: next };
    }
    if (n.children && n.children.length > 0) {
      const updated = insertNodeIntoTreeBroadcast(n.children, parentId, position, node);
      if (updated !== n.children) return { ...n, children: updated };
    }
    return n;
  });
}

function removeNodeFromTreeBroadcast(tree: TreeNode[], nodeId: string): TreeNode[] {
  const next: TreeNode[] = [];
  let changed = false;
  for (const node of tree) {
    if (node.id === nodeId) {
      changed = true;
      continue;
    }
    if (node.children && node.children.length > 0) {
      const filtered = removeNodeFromTreeBroadcast(node.children, nodeId);
      if (filtered !== node.children) {
        next.push({ ...node, children: filtered });
        changed = true;
        continue;
      }
    }
    next.push(node);
  }
  return changed ? next : tree;
}

/**
 * Apply a tree.move broadcast: extract the subtree by nodeId, then
 * insert under newParentId at newPosition. Naturally idempotent for
 * the sender's own echo (the subtree is already at the target slot,
 * so extract+insert lands in the same place). Cycle guard for safety
 * even though the server has already validated.
 */
function moveNodeInTreeBroadcast(
  tree: TreeNode[],
  nodeId: string,
  newParentId: string | null,
  newPosition: number,
): TreeNode[] {
  const subtree = findTreeNode(tree, nodeId);
  if (!subtree) return tree;
  if (newParentId !== null && (newParentId === nodeId || containsNodeId(subtree.children ?? [], newParentId))) {
    return tree;
  }
  const without = removeNodeFromTreeBroadcast(tree, nodeId);
  return insertNodeRawIntoTree(without, newParentId, newPosition, subtree);
}

function findTreeNode(tree: TreeNode[], nodeId: string): TreeNode | null {
  for (const node of tree) {
    if (node.id === nodeId) return node;
    if (node.children && node.children.length > 0) {
      const found = findTreeNode(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Insert a subtree at parentId/position without the echo-dedup that
 * insertNodeIntoTreeBroadcast does — used by the tree.move path
 * where the subtree was just removed by removeNodeFromTreeBroadcast,
 * so containsNodeId would falsely block re-insertion.
 */
function insertNodeRawIntoTree(
  tree: TreeNode[],
  parentId: string | null,
  position: number,
  node: TreeNode,
): TreeNode[] {
  if (parentId === null) {
    const next = [...tree];
    const clamped = Math.max(0, Math.min(next.length, position));
    next.splice(clamped, 0, node);
    return next;
  }
  return tree.map((n) => {
    if (n.id === parentId) {
      const children = n.children ?? [];
      const clamped = Math.max(0, Math.min(children.length, position));
      const next = [...children];
      next.splice(clamped, 0, node);
      return { ...n, children: next };
    }
    if (n.children && n.children.length > 0) {
      const updated = insertNodeRawIntoTree(n.children, parentId, position, node);
      if (updated !== n.children) return { ...n, children: updated };
    }
    return n;
  });
}

function containsNodeId(tree: TreeNode[], nodeId: string): boolean {
  for (const node of tree) {
    if (node.id === nodeId) return true;
    if (node.children && node.children.length > 0 && containsNodeId(node.children, nodeId)) {
      return true;
    }
  }
  return false;
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
