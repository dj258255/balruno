/**
 * Project-scoped op-log WebSocket — sheet cell + sheet tree + doc tree
 * (ADR 0008 v2.0 §2). One connection per project, three regions ride
 * the same channel; document body lives on the separate Hocuspocus
 * provider in {@link useDocYjsCloudSync}.
 *
 * Wire protocol matches the Spring sealed types
 * {@code com.balruno.sync.SyncMessage}:
 *   - client → server: cell.update / row.* / column.* / tree.* / presence
 *   - server → client: sync.full (first frame after connect),
 *     op.acked / conflict for the sender, broadcast op echo for siblings
 *
 * Auth uses the {@code balruno_session} cookie automatically — the
 * browser ferries the cookie cross-origin to {@code api.balruno.com}
 * because the cookie domain is the apex. Non-cookie clients (Electron)
 * fall back to {@code ?token=} on the URL.
 *
 * Local-only mode (no backend configured) keeps the hook idle so a
 * desktop build without a backend doesn't spam reconnect attempts.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { backendBaseUrl, isBackendConfigured } from '@/lib/backend';
import { useConnectionStore } from '@/stores/connectionStore';
import { makeLog } from '@/lib/log';

const log = makeLog('sync.ws');

export type ProjectSyncStatus = 'idle' | 'connecting' | 'connected' | 'offline' | 'error';

// ── client → server ────────────────────────────────────────────────
// Mirrors the Java records in com.balruno.sync.SyncMessage. Field
// names are identical so JSON.stringify produces the exact wire shape
// the backend's Jackson 3 polymorphic deserialiser expects.

/**
 * Optional undo metadata attached to each non-presence ClientOp
 * (ADR 0021 v2.3 Phase 5 — Pattern C). Backend reads these to fill
 * V14 op_idempotency columns and serve the /undo + /redo endpoints.
 *
 * forward + inverse are arrays so multi-op cascades (link bidirectional
 * column add/delete, deleteRow with row.add + row.move snapshot) fit
 * one envelope. Each item is the same wire-format ClientOp shape
 * minus baseVersion + clientMsgId (filled in at apply time).
 */
export interface UndoMeta {
  forward: unknown[];
  inverse: unknown[];
  actionGroupId: string;
  clientSessionId: string;
}

export type ClientOp =
  | { type: 'cell.update'; sheetId: string; rowId: string; columnId: string; value: unknown;
      baseVersion: number; clientMsgId: string; undo?: UndoMeta }
  | { type: 'cell.style.update'; sheetId: string; rowId: string; columnId: string; style: unknown;
      baseVersion: number; clientMsgId: string; undo?: UndoMeta }
  | { type: 'sheet.metadata.update'; sheetId: string; patch: unknown;
      baseVersion: number; clientMsgId: string; undo?: UndoMeta }
  | { type: 'row.add'; sheetId: string; row: unknown; baseVersion: number; clientMsgId: string;
      undo?: UndoMeta }
  | { type: 'row.delete'; sheetId: string; rowId: string; baseVersion: number; clientMsgId: string;
      undo?: UndoMeta }
  | { type: 'row.move'; sheetId: string; rowId: string; toIndex: number;
      baseVersion: number; clientMsgId: string; undo?: UndoMeta }
  | { type: 'column.add'; sheetId: string; column: unknown; baseVersion: number; clientMsgId: string;
      undo?: UndoMeta }
  | { type: 'column.update'; sheetId: string; columnId: string; patch: unknown;
      baseVersion: number; clientMsgId: string; undo?: UndoMeta }
  | { type: 'column.delete'; sheetId: string; columnId: string;
      baseVersion: number; clientMsgId: string; undo?: UndoMeta }
  | { type: 'tree.add'; treeKind: 'SHEET' | 'DOC'; parentId: string | null; position: number;
      node: unknown; baseVersion: number; clientMsgId: string; undo?: UndoMeta }
  | { type: 'tree.move'; treeKind: 'SHEET' | 'DOC'; nodeId: string;
      newParentId: string | null; newPosition: number;
      baseVersion: number; clientMsgId: string; undo?: UndoMeta }
  | { type: 'tree.delete'; treeKind: 'SHEET' | 'DOC'; nodeId: string;
      baseVersion: number; clientMsgId: string; undo?: UndoMeta }
  | { type: 'tree.rename'; treeKind: 'SHEET' | 'DOC'; nodeId: string; newName: string;
      baseVersion: number; clientMsgId: string; undo?: UndoMeta }
  | { type: 'presence'; userId: string; cursor?: unknown };

// ── server → client ────────────────────────────────────────────────

export interface SyncFullPayload {
  type: 'sync.full';
  data: unknown;
  sheetTree: unknown;
  docTree: unknown;
  versions: { data: number; sheetTree: number; docTree: number };
}

export interface OpAckedPayload {
  type: 'op.acked';
  clientMsgId: string;
  version: number;
}

export interface ConflictPayload {
  type: 'conflict';
  serverVersion: number;
}

export interface BroadcastPayload {
  type:
    | 'cell.update' | 'cell.style.update' | 'sheet.metadata.update'
    | 'row.add' | 'row.delete' | 'row.move'
    | 'column.add' | 'column.update' | 'column.delete'
    | 'tree.add' | 'tree.move' | 'tree.delete' | 'tree.rename';
  version: number;
  userId: string;
  ts: number;
  op: unknown;
}

/**
 * Presence broadcast — fire-and-forget peer cursor update. No
 * version, no op envelope. cursor is whatever the sender packed
 * (sheet cell focus, doc selection range, …); shape is open so
 * future presence channels (file editor, kanban, …) can ride the
 * same frame without a backend schema change.
 */
export interface PresencePayload {
  type: 'presence';
  userId: string;
  ts: number;
  cursor: unknown;
}

export type ServerMsg =
  | SyncFullPayload
  | OpAckedPayload
  | ConflictPayload
  | BroadcastPayload
  | PresencePayload;

interface UseProjectSyncOptions {
  projectId: string | null;
  /** When false the hook stays idle (local-only mode, no backend, etc.). */
  enabled?: boolean;
  onMessage?: (msg: ServerMsg) => void;
}

export function useProjectSync({
  projectId,
  enabled = true,
  onMessage,
}: UseProjectSyncOptions): {
  status: ProjectSyncStatus;
  send: (op: ClientOp) => boolean;
  reconnect: () => void;
} {
  const [status, setStatus] = useState<ProjectSyncStatus>('idle');
  const wsRef = useRef<WebSocket | null>(null);

  // Latest onMessage in a ref so it doesn't re-trigger the effect on every
  // re-render; callers can pass an inline closure freely.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const reportToStore = useConnectionStore((s) => s.setSheetStatus);

  useEffect(() => {
    if (!enabled || !projectId || !isBackendConfigured()) {
      setStatus('idle');
      reportToStore(projectId ?? null, 'idle');
      return;
    }

    let cancelled = false;
    let retryAttempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let manualClose = false;

    const apiUrl = backendBaseUrl();
    const wsUrl = apiUrl.replace(/^http/, 'ws') + `/ws/projects/${encodeURIComponent(projectId)}`;

    // Reconnect with exponential backoff: 1s, 2s, 4s, ..., capped at
    // 60s. Resets to 1s on successful onopen so a healthy session
    // doesn't carry over its retry counter into the next disconnect.
    // The `manualClose` flag suppresses retry on component unmount;
    // server-initiated close (1006/1001/1011/idle timeout) re-arms.
    const scheduleRetry = () => {
      if (cancelled || retryTimer !== null) return;
      const delay = Math.min(60_000, 1_000 * Math.pow(2, retryAttempt));
      retryAttempt += 1;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        manualClose = false;
        connect();
      }, delay);
    };

    const connect = () => {
      if (cancelled) return;
      setStatus('connecting');
      reportToStore(projectId, 'connecting');

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (e) {
        setStatus('error');
        reportToStore(projectId, 'error');
        log.warn('WebSocket constructor failed', e);
        scheduleRetry();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        retryAttempt = 0;
        setStatus('connected');
        reportToStore(projectId, 'connected');
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        const data = event.data;
        if (typeof data !== 'string') return;
        let msg: ServerMsg;
        try {
          msg = JSON.parse(data) as ServerMsg;
        } catch {
          return;
        }
        onMessageRef.current?.(msg);
      };

      ws.onerror = () => {
        if (cancelled) return;
        setStatus('error');
        reportToStore(projectId, 'error');
      };

      ws.onclose = () => {
        if (cancelled) return;
        setStatus('offline');
        reportToStore(projectId, 'offline');
        if (!manualClose) scheduleRetry();
      };
    };

    connect();

    return () => {
      cancelled = true;
      manualClose = true;
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [projectId, enabled, reportToStore]);

  const send = useCallback((op: ClientOp) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(op));
    return true;
  }, []);

  // Manual reconnect — closes the current socket; the onclose handler's
  // scheduleRetry path picks it up and reconnects with the active
  // backoff sequence. If the caller is rage-clicking a retry button
  // it's the right shape: each click resets the cycle by closing.
  const reconnect = useCallback(() => {
    wsRef.current?.close();
  }, []);

  return { status, send, reconnect };
}
