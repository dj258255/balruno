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

export type ProjectSyncStatus = 'idle' | 'connecting' | 'connected' | 'offline' | 'error';

// ── client → server ────────────────────────────────────────────────
// Mirrors the Java records in com.balruno.sync.SyncMessage. Field
// names are identical so JSON.stringify produces the exact wire shape
// the backend's Jackson 3 polymorphic deserialiser expects.

export type ClientOp =
  | { type: 'cell.update'; sheetId: string; rowId: string; columnId: string; value: unknown;
      baseVersion: number; clientMsgId: string }
  | { type: 'row.add'; sheetId: string; row: unknown; baseVersion: number; clientMsgId: string }
  | { type: 'row.delete'; sheetId: string; rowId: string; baseVersion: number; clientMsgId: string }
  | { type: 'row.move'; sheetId: string; rowId: string; toIndex: number;
      baseVersion: number; clientMsgId: string }
  | { type: 'column.add'; sheetId: string; column: unknown; baseVersion: number; clientMsgId: string }
  | { type: 'column.update'; sheetId: string; columnId: string; patch: unknown;
      baseVersion: number; clientMsgId: string }
  | { type: 'column.delete'; sheetId: string; columnId: string;
      baseVersion: number; clientMsgId: string }
  | { type: 'tree.add'; treeKind: 'SHEET' | 'DOC'; parentId: string | null; position: number;
      node: unknown; baseVersion: number; clientMsgId: string }
  | { type: 'tree.move'; treeKind: 'SHEET' | 'DOC'; nodeId: string;
      newParentId: string | null; newPosition: number;
      baseVersion: number; clientMsgId: string }
  | { type: 'tree.delete'; treeKind: 'SHEET' | 'DOC'; nodeId: string;
      baseVersion: number; clientMsgId: string }
  | { type: 'tree.rename'; treeKind: 'SHEET' | 'DOC'; nodeId: string; newName: string;
      baseVersion: number; clientMsgId: string }
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
    | 'cell.update' | 'row.add' | 'row.delete' | 'row.move'
    | 'column.add' | 'column.update' | 'column.delete'
    | 'tree.add' | 'tree.move' | 'tree.delete' | 'tree.rename';
  version: number;
  userId: string;
  ts: number;
  op: unknown;
}

export type ServerMsg = SyncFullPayload | OpAckedPayload | ConflictPayload | BroadcastPayload;

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
    setStatus('connecting');
    reportToStore(projectId, 'connecting');

    // Build the WS URL — flip http(s) → ws(s) to keep the same host.
    // Browser sends balruno_session cookie automatically (apex domain).
    const apiUrl = backendBaseUrl();
    const wsUrl = apiUrl.replace(/^http/, 'ws') + `/ws/projects/${encodeURIComponent(projectId)}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      setStatus('error');
      reportToStore(projectId, 'error');
      // eslint-disable-next-line no-console
      console.warn('[useProjectSync] WebSocket constructor failed', e);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      if (cancelled) return;
      setStatus('connected');
      reportToStore(projectId, 'connected');
      // Backend sends sync.full as the first frame automatically (Stage B.6).
    };

    ws.onmessage = (event) => {
      if (cancelled) return;
      const data = event.data;
      if (typeof data !== 'string') return;
      let msg: ServerMsg;
      try {
        msg = JSON.parse(data) as ServerMsg;
      } catch {
        return; // drop malformed
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
    };

    return () => {
      cancelled = true;
      ws.close();
      wsRef.current = null;
    };
  }, [projectId, enabled, reportToStore]);

  const send = useCallback((op: ClientOp) => {
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
