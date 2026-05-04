/**
 * Sheet Y.Doc → cell-event adapter (v0.5 stage).
 *
 * Observes the existing Y.Doc that backs sheets in {@link ydoc.ts} and mirrors
 * cell/row/column changes to a sheet WebSocket via {@link useSheetCellSync}.
 *
 * In the other direction, server broadcasts arrive through `useSheetCellSync.onMessage`
 * and are applied back to the Y.Doc using the existing helpers (addRowInDoc,
 * setCellInDoc, etc.). The hook is intentionally read-mostly here: the actual
 * write helpers live in `lib/ydoc.ts` and are invoked when the server tells us
 * a remote peer changed something.
 *
 * v0.6+ will replace the Y.Doc bridge with direct Zustand + IndexedDB writes.
 */

import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { newId } from '@/lib/uuid';
import {
  useSheetCellSync,
  type ClientCellOp,
  type ServerCellMsg,
  type CellValue,
} from './useSheetCellSync';
import { getProjectDoc } from '@/lib/ydoc';

interface UseSheetCellSyncAdapterOptions {
  projectId: string | null;
  sheetId: string | null;
  enabled?: boolean;
}

export function useSheetCellSyncAdapter({
  projectId,
  sheetId,
  enabled = true,
}: UseSheetCellSyncAdapterOptions) {
  const lastVersionRef = useRef<number>(0);
  const applyingRemoteRef = useRef(false);

  const { status, send } = useSheetCellSync({
    sheetId,
    enabled,
    onMessage: (msg) => handleServerMessage(msg, projectId, lastVersionRef, applyingRemoteRef),
  });

  // Observe the project's Y.Doc and emit cell events for local changes.
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
 * Translate a Y.js change event into the cell-event protocol op.
 *
 * Only handles single-cell value updates and row insert/delete in this v0.5
 * adapter; richer events (column edits, row reorders) are deferred until the
 * v0.6 direct-Zustand path replaces this bridge.
 */
function mapYEventToCellOp(
  event: Y.YEvent<Y.AbstractType<unknown>>,
  expectedSheetId: string,
  baseVersion: number,
): ClientCellOp | null {
  const path = event.path;
  // path looks like [sheetIdx, 'rows', rowIdx, 'cells', columnId]
  const [, _sheetsKey, , _rowsKey, , cellsKey, columnId] = path as (string | number)[];
  if (cellsKey !== 'cells' || typeof columnId !== 'string') return null;

  const target = event.target as Y.Map<unknown>;
  const row = target.parent as Y.Map<unknown> | null;
  const rowId = row?.get('id') as string | undefined;
  if (!rowId) return null;

  const sheet = row?.parent?.parent as Y.Map<unknown> | null;
  const sheetId = sheet?.get('id') as string | undefined;
  if (sheetId !== expectedSheetId) return null;

  const value = target.get(columnId) as CellValue;
  return {
    type: 'cell.update',
    rowId,
    columnId,
    value,
    baseVersion,
    clientMsgId: newId(),
  };
}

function handleServerMessage(
  msg: ServerCellMsg,
  projectId: string | null,
  versionRef: { current: number },
  applyingRef: { current: boolean },
) {
  if ('version' in msg && typeof msg.version === 'number') {
    versionRef.current = msg.version;
  }
  if (!projectId) return;

  switch (msg.type) {
    case 'sync.full':
      // Initial hydrate is handled by useYDocSync + REST snapshot — no-op here for v0.5.
      break;
    case 'cell.update': {
      // Apply remote cell update to the Y.Doc.
      const { sheetId, rowId, columnId, value } = msg as unknown as {
        sheetId: string;
        rowId: string;
        columnId: string;
        value: CellValue;
      };
      const doc = getProjectDoc(projectId);
      applyingRef.current = true;
      try {
        doc.transact(() => {
          const sheets = doc.getArray<Y.Map<unknown>>('sheets');
          for (let i = 0; i < sheets.length; i++) {
            const s = sheets.get(i);
            if (s.get('id') !== sheetId) continue;
            const rows = s.get('rows') as Y.Array<Y.Map<unknown>>;
            for (let j = 0; j < rows.length; j++) {
              const r = rows.get(j);
              if (r.get('id') !== rowId) continue;
              const cells = r.get('cells') as Y.Map<unknown>;
              cells.set(columnId, value);
              return;
            }
          }
        }, 'remote');
      } finally {
        applyingRef.current = false;
      }
      break;
    }
    case 'conflict':
      // eslint-disable-next-line no-console
      console.warn('[sheet-sync] conflict', msg);
      break;
    case 'error':
      // eslint-disable-next-line no-console
      console.warn('[sheet-sync] error', msg);
      break;
    default:
      break;
  }
}
