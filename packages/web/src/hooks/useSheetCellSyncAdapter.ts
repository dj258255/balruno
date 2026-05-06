/**
 * Sheet Y.Doc → cell-event adapter (v0.5 stage, Stage D.4 rewire).
 *
 * Bridges the existing per-project Y.Doc (lib/ydoc.ts) to the new
 * project-scoped op-log socket {@link useProjectSync}. Local Y.js
 * mutations are translated into {@link ClientOp}s and shipped on the
 * shared project channel; server broadcasts for this sheet are
 * applied back to the Y.Doc inside an "applyingRemote" guard so the
 * local observer doesn't echo them.
 *
 * Project-scoped channel notes:
 *   - One socket per project carries every sheet, sheet-tree, and
 *     doc-tree change. Sheet filtering is the client's job here —
 *     broadcasts whose op.sheetId differs from this hook's sheetId
 *     are ignored.
 *   - Server frames are wrapped as {@link BroadcastPayload}
 *     ({type, version, userId, ts, op}); op-acked/conflict are
 *     sender-only and don't carry an `op` envelope.
 *
 * v0.6+ will retire the Y.Doc bridge entirely in favour of direct
 * Zustand + IndexedDB writes that emit {@link ClientOp}s themselves.
 */

import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { newId } from '@/lib/uuid';
import { getProjectDoc } from '@/lib/ydoc';
import { useProjectSync, type ClientOp, type ServerMsg } from './useProjectSync';

interface UseSheetCellSyncAdapterOptions {
  projectId: string | null;
  sheetId: string | null;
  enabled?: boolean;
}

type CellValue = string | number | boolean | null;

export function useSheetCellSyncAdapter({
  projectId,
  sheetId,
  enabled = true,
}: UseSheetCellSyncAdapterOptions) {
  const lastVersionRef = useRef<number>(0);
  const applyingRemoteRef = useRef(false);

  const { status, send } = useProjectSync({
    projectId,
    enabled,
    onMessage: (msg) => handleServerMessage(msg, projectId, sheetId, lastVersionRef, applyingRemoteRef),
  });

  // Observe the project's Y.Doc and emit cell ops for local changes.
  useEffect(() => {
    if (!enabled || !projectId || !sheetId) return;

    const doc = getProjectDoc(projectId);
    const sheets = doc.getArray<Y.Map<unknown>>('sheets');

    const onUpdate = (events: Y.YEvent<Y.AbstractType<unknown>>[], txn: Y.Transaction) => {
      // Avoid loops: server-applied updates are wrapped in `applyingRemoteRef`.
      if (applyingRemoteRef.current) return;
      if (txn.local === false) return;

      for (const event of events) {
        const op = mapYEventToCellOp(event, sheetId, lastVersionRef.current);
        if (op) send(op);
      }
    };

    sheets.observeDeep(onUpdate);
    return () => sheets.unobserveDeep(onUpdate);
  }, [projectId, sheetId, enabled, send]);

  return { status };
}

/**
 * Translate a Y.js change event into the project op-log protocol op.
 *
 * Only handles single-cell value updates in this v0.5 adapter; richer
 * events (row insert/delete/move, column edits) are deferred until the
 * v0.6 direct-Zustand path replaces this bridge.
 */
function mapYEventToCellOp(
  event: Y.YEvent<Y.AbstractType<unknown>>,
  expectedSheetId: string,
  baseVersion: number,
): ClientOp | null {
  const path = event.path;
  // path looks like [sheetIdx, 'rows', rowIdx, 'cells', columnId]
  const [, _sheetsKey, , _rowsKey, , cellsKey, columnId] = path as (string | number)[];
  if (cellsKey !== 'cells' || typeof columnId !== 'string') return null;

  const target = event.target as Y.Map<unknown>;
  const row = target.parent as Y.Map<unknown> | null;
  const rowId = row?.get('id') as string | undefined;
  if (!rowId) return null;

  const sheet = row?.parent?.parent as Y.Map<unknown> | null;
  const observedSheetId = sheet?.get('id') as string | undefined;
  if (observedSheetId !== expectedSheetId) return null;

  const value = target.get(columnId) as CellValue;
  return {
    type: 'cell.update',
    sheetId: expectedSheetId,
    rowId,
    columnId,
    value,
    baseVersion,
    clientMsgId: newId(),
  };
}

function handleServerMessage(
  msg: ServerMsg,
  projectId: string | null,
  expectedSheetId: string | null,
  versionRef: { current: number },
  applyingRef: { current: boolean },
) {
  if (!projectId) return;

  switch (msg.type) {
    case 'sync.full':
      // Initial state hydrate is handled by useYDocSync + REST snapshot
      // in v0.5; we only track the version for subsequent baseVersion checks.
      versionRef.current = msg.versions.data;
      break;

    case 'op.acked':
      versionRef.current = msg.version;
      break;

    case 'conflict':
      versionRef.current = msg.serverVersion;
      console.warn('[sheet-sync-adapter] conflict', msg);
      break;

    case 'cell.update': {
      versionRef.current = msg.version;
      const opPayload = msg.op as {
        sheetId?: string;
        rowId?: string;
        columnId?: string;
        value?: CellValue;
      } | null;
      if (!opPayload || opPayload.sheetId !== expectedSheetId) return;
      const { rowId, columnId, value } = opPayload;
      if (!rowId || !columnId) return;

      const doc = getProjectDoc(projectId);
      applyingRef.current = true;
      try {
        doc.transact(() => {
          const sheets = doc.getArray<Y.Map<unknown>>('sheets');
          for (let i = 0; i < sheets.length; i++) {
            const s = sheets.get(i);
            if (s.get('id') !== opPayload.sheetId) continue;
            const rows = s.get('rows') as Y.Array<Y.Map<unknown>>;
            for (let j = 0; j < rows.length; j++) {
              const r = rows.get(j);
              if (r.get('id') !== rowId) continue;
              const cells = r.get('cells') as Y.Map<unknown>;
              cells.set(columnId, value as CellValue);
              return;
            }
          }
        }, 'remote');
      } finally {
        applyingRef.current = false;
      }
      break;
    }

    default:
      // Other broadcast types (row.*, column.*, tree.*) are not
      // mirrored back into the Y.Doc in v0.5 — the v0.6 direct-Zustand
      // path handles them without going through Y.
      if ('version' in msg && typeof msg.version === 'number') {
        versionRef.current = msg.version;
      }
      break;
  }
}
