/**
 * Project sync wiring — connects {@link useProjectSync} to the
 * module-level write queue and the zustand project store
 * (ADR 0018 Stages B + D).
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
 *   4. Apply broadcast frames (peer ops) back into the project store
 *      with origin='remote' so the local UI mirrors remote edits and
 *      the dual-write guard prevents the store from echoing them
 *      back to the socket.
 *
 * Store apply is currently wired only for {@code cell.update} —
 * matches Stage C's outbound surface (the cellSlice.updateCell
 * dual-write). Other broadcast variants only update the version
 * counter; the store-apply for row / column / tree ops lands with
 * the corresponding outbound stage.
 */

import { useEffect } from 'react';

import { useProjectSync, type ServerMsg, type SyncFullPayload } from './useProjectSync';
import { setSyncSender, setVersions, bumpVersion } from '@/lib/sync/writeQueue';
import { useProjectStore } from '@/stores/projectStore';
import type { CellValue, Sheet } from '@balruno/shared';

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
      // projectId enters the handler's closure here so the apply
      // path can call store actions scoped to this project.
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

/**
 * Translate inbound frames into writeQueue version updates and
 * store-apply calls. Kept at module scope (not inline) so it can be
 * unit-tested without rendering React; the hook passes projectId in
 * as an argument rather than capturing it via closure.
 */
function handleServerMsg(msg: ServerMsg, projectId: string): void {
  switch (msg.type) {
    case 'sync.full':
      setVersions(msg.versions);
      hydrateProjectFromSyncFull(projectId, msg);
      break;
    case 'op.acked':
      // op.acked carries only clientMsgId + version. Without a
      // pending-ops tracker we cannot route to one region, so bump
      // all three monotonically; bumpVersion's Math.max guard keeps
      // it race-safe.
      bumpVersion('data', msg.version);
      bumpVersion('sheetTree', msg.version);
      bumpVersion('docTree', msg.version);
      break;
    case 'conflict':
      // sync.full will follow per ADR 0018 Stage E; let that reset
      // the versions and rehydrate the store.
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

  // Store apply — cell.update + row.{add,delete,move} so far. The
  // sender's own ops come back as broadcasts too (ADR 0008 v2.0 Q7);
  // re-applying them with origin='remote' is idempotent thanks to
  // the duplicate-id drop in addRowInDoc / deleteRowInDoc / the
  // isSameValue guard in updateCell.
  const store = useProjectStore.getState();
  if (msg.type === 'cell.update') {
    const op = msg.op as {
      sheetId?: string;
      rowId?: string;
      columnId?: string;
      value?: CellValue;
    } | null;
    if (op?.sheetId && op.rowId && op.columnId) {
      store.updateCell(
        projectId,
        op.sheetId,
        op.rowId,
        op.columnId,
        op.value as CellValue,
        { origin: 'remote' },
      );
    }
  } else if (msg.type === 'row.add') {
    const op = msg.op as {
      sheetId?: string;
      row?: { id?: string; cells?: Record<string, CellValue> };
    } | null;
    if (op?.sheetId && op.row?.id) {
      store.addRow(projectId, op.sheetId, op.row.cells ?? {}, {
        origin: 'remote',
        rowId: op.row.id,
      });
    }
  } else if (msg.type === 'row.delete') {
    const op = msg.op as { sheetId?: string; rowId?: string } | null;
    if (op?.sheetId && op.rowId) {
      store.deleteRow(projectId, op.sheetId, op.rowId, { origin: 'remote' });
    }
  } else if (msg.type === 'row.move') {
    const op = msg.op as { sheetId?: string; rowId?: string; toIndex?: number } | null;
    if (op?.sheetId && op.rowId && typeof op.toIndex === 'number') {
      store.reorderRow(projectId, op.sheetId, op.rowId, op.toIndex, {
        origin: 'remote',
      });
    }
  }
}

/**
 * Hydrate the project store from a sync.full envelope (ADR 0018
 * Stage E.1). The backend's projects.data JSONB is a Sheet[] (the
 * shape SheetCellOpService mutates with `sheets[?id].rows[?id]
 * .cells[?columnId]`), which is wire-compatible with the local
 * Project.sheets type, so the cast is intentional and not lossy.
 *
 * If the project already exists in the store (e.g. the page's
 * resolve effect seeded metadata first), only sheets are replaced.
 * If it does not exist, a minimal Project is inserted — the page's
 * effect will fill name / description on its own pass; if the
 * effect ran first it wins, and this branch becomes the no-op
 * "sheets-only" update on the next sync.full.
 *
 * Doc tree / doc bodies are NOT hydrated here — those land in Stage
 * G alongside the Hocuspocus wiring. This commit's scope is the
 * sheets surface that Stage C / D already reach.
 *
 * Exported for unit testing — the function is pure with respect to
 * its inputs (msg + projectId) and the side-effect channel
 * (useProjectStore.setState).
 */
export function hydrateProjectFromSyncFull(
  projectId: string,
  msg: SyncFullPayload,
): void {
  const sheets: Sheet[] = Array.isArray(msg.data) ? (msg.data as Sheet[]) : [];
  useProjectStore.setState((state) => {
    const idx = state.projects.findIndex((p) => p.id === projectId);
    if (idx >= 0) {
      const next = [...state.projects];
      next[idx] = { ...next[idx], sheets };
      return { projects: next };
    }
    const now = Date.now();
    return {
      projects: [
        ...state.projects,
        { id: projectId, name: '', sheets, createdAt: now, updatedAt: now },
      ],
    };
  });
}
