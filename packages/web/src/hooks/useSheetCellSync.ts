/**
 * Sheet cell-event WebSocket sync — Baserow-style protocol.
 *
 * Spec: docs/backend/decisions/0008-sheet-sync-algorithm.md, 04-api-spec.md §11.1.
 *
 * v0.5 stage (current): thin adapter — observes the existing Y.Doc sheet helpers
 * and translates their changes into cell events on the wire. Server applies via
 * jsonb_set to projects.data with last-write-wins (data_version check).
 *
 * v0.6+ (planned): drop Y.Doc for sheets entirely; cell/sheetSlice writes directly
 * to Zustand + IndexedDB and emits events to this hook.
 *
 * For now the hook supports the protocol surface (connect/auth/send/recv) and
 * leaves the bridge into Y.Doc as a no-op when there's no backend configured.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { isBackendConfigured } from '@/lib/backend';

export type SheetSyncStatus = 'idle' | 'connecting' | 'connected' | 'offline' | 'error';

export type CellValue = string | number | boolean | null;

export type ClientCellOp =
  | { type: 'cell.update'; rowId: string; columnId: string; value: CellValue; baseVersion: number; clientMsgId: string }
  | { type: 'row.add'; row: { id: string; cells: Record<string, CellValue> }; position: number; baseVersion: number; clientMsgId: string }
  | { type: 'row.delete'; rowId: string; baseVersion: number; clientMsgId: string }
  | { type: 'row.move'; rowId: string; toIndex: number; baseVersion: number; clientMsgId: string }
  | { type: 'column.add'; column: unknown; position: number; baseVersion: number; clientMsgId: string }
  | { type: 'column.update'; columnId: string; patch: Record<string, unknown>; baseVersion: number; clientMsgId: string }
  | { type: 'column.delete'; columnId: string; baseVersion: number; clientMsgId: string }
  | { type: 'presence'; cellKey?: { rowId: string; columnId: string }; cursor?: { x: number; y: number } }
  | { type: 'sync.request' };

export type ServerCellMsg =
  | { type: 'cell.update' | 'row.add' | 'row.delete' | 'row.move' | 'column.add' | 'column.update' | 'column.delete'; version: number; userId: string; ts: number; clientMsgId?: string; [k: string]: unknown }
  | { type: 'sync.full'; state: unknown; version: number }
  | { type: 'conflict'; op: ClientCellOp; reason: 'version_mismatch' | 'row_deleted' | 'column_deleted'; serverVersion: number; serverState?: unknown; clientMsgId: string }
  | { type: 'presence'; userId: string; cellKey?: { rowId: string; columnId: string }; cursor?: { x: number; y: number }; ts: number; action: 'enter' | 'leave' | 'update' }
  | { type: 'error'; code: string; message: string; clientMsgId?: string };

interface UseSheetCellSyncOptions {
  sheetId: string | null;
  /** When false, hook stays idle (local mode). */
  enabled?: boolean;
  onMessage?: (msg: ServerCellMsg) => void;
}

export function useSheetCellSync({ sheetId, enabled = true, onMessage }: UseSheetCellSyncOptions): {
  status: SheetSyncStatus;
  send: (op: ClientCellOp) => boolean;
  reconnect: () => void;
} {
  const [status, setStatus] = useState<SheetSyncStatus>('idle');
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const reportToStore = useConnectionStore((s) => s.setSheetStatus);

  useEffect(() => {
    if (!enabled || !sheetId || !isBackendConfigured()) {
      setStatus('idle');
      reportToStore(sheetId ?? null, 'idle');
      return;
    }

    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      setStatus('idle');
      reportToStore(sheetId, 'idle');
      return;
    }

    let cancelled = false;
    setStatus('connecting');
    reportToStore(sheetId, 'connecting');

    const baseWs = process.env.NEXT_PUBLIC_WS_URL?.replace(/\/$/, '') ?? 'ws://localhost:8080/ws';
    const url = `${baseWs}/sheets/${encodeURIComponent(sheetId)}?token=${encodeURIComponent(accessToken)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (cancelled) return;
      setStatus('connected');
      reportToStore(sheetId, 'connected');
      ws.send(JSON.stringify({ type: 'sync.request' } satisfies ClientCellOp));
    };

    ws.onmessage = (event) => {
      if (cancelled) return;
      try {
        const msg = JSON.parse(event.data as string) as ServerCellMsg;
        onMessageRef.current?.(msg);
      } catch {
        // ignore malformed
      }
    };

    ws.onerror = () => {
      if (cancelled) return;
      setStatus('error');
      reportToStore(sheetId, 'error');
    };

    ws.onclose = () => {
      if (cancelled) return;
      setStatus('offline');
      reportToStore(sheetId, 'offline');
    };

    return () => {
      cancelled = true;
      ws.close();
      wsRef.current = null;
    };
  }, [sheetId, enabled, reportToStore]);

  const send = useCallback((op: ClientCellOp) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(op));
    return true;
  }, []);

  const reconnect = useCallback(() => {
    wsRef.current?.close();
  }, []);

  return { status, send, reconnect };
}
