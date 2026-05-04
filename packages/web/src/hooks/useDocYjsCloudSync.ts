/**
 * Document yjs cloud sync — connects a Y.Doc to the Hocuspocus sidecar.
 *
 * Flow (docs/backend/03-sync-strategy.md v1.1 §4):
 *   1. Fetch a short-lived collab token from Spring (POST /api/auth/collab-token).
 *   2. Open a y-websocket-style WebSocket to collab.balruno.com (or NEXT_PUBLIC_WS_URL/docs/{id}).
 *   3. Hocuspocus authenticates the token via webhook, then syncs Y.Doc binary.
 *   4. Tiptap collaboration extension binds to the same Y.Doc XmlFragment.
 *
 * Status surfaces three states (used by ConnectionStatus indicator):
 *   - 'idle'        — no doc selected
 *   - 'connecting'  — fetching token / opening socket
 *   - 'connected'   — synced
 *   - 'offline'     — disconnected, falls back to local cache
 *   - 'error'       — auth/permission failure
 */

import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { collabApi } from '@/lib/api/collab';
import { useConnectionStore } from '@/stores/connectionStore';
import { isBackendConfigured } from '@/lib/api/client';

export type SyncStatus = 'idle' | 'connecting' | 'connected' | 'offline' | 'error';

interface UseDocYjsCloudSyncOptions {
  documentId: string | null;
  doc: Y.Doc | null;
  /** When false, the hook stays idle (local-only mode, no backend configured, etc.). */
  enabled?: boolean;
}

export function useDocYjsCloudSync({ documentId, doc, enabled = true }: UseDocYjsCloudSyncOptions): {
  status: SyncStatus;
  reconnect: () => void;
} {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const wsRef = useRef<WebSocket | null>(null);
  const tokenRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reportToStore = useConnectionStore((s) => s.setDocStatus);

  useEffect(() => {
    if (!enabled || !documentId || !doc || !isBackendConfigured()) {
      setStatus('idle');
      reportToStore(documentId ?? null, 'idle');
      return;
    }

    let cancelled = false;
    setStatus('connecting');
    reportToStore(documentId, 'connecting');

    (async () => {
      try {
        const { collabToken, expiresAt } = await collabApi.getToken(documentId);
        if (cancelled) return;

        const baseWs =
          process.env.NEXT_PUBLIC_WS_URL?.replace(/\/$/, '') ?? 'ws://localhost:1234';
        const url = `${baseWs}/docs/${encodeURIComponent(documentId)}?token=${encodeURIComponent(collabToken)}`;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
          if (cancelled) return;
          setStatus('connected');
          reportToStore(documentId, 'connected');
        };

        ws.onmessage = (event) => {
          if (cancelled) return;
          if (event.data instanceof ArrayBuffer) {
            try {
              Y.applyUpdate(doc, new Uint8Array(event.data));
            } catch (e) {
              // eslint-disable-next-line no-console
              console.warn('[useDocYjsCloudSync] applyUpdate failed', e);
            }
          }
        };

        ws.onerror = () => {
          if (cancelled) return;
          setStatus('error');
          reportToStore(documentId, 'error');
        };

        ws.onclose = () => {
          if (cancelled) return;
          setStatus('offline');
          reportToStore(documentId, 'offline');
        };

        const observer = (update: Uint8Array, origin: unknown) => {
          if (origin === 'remote') return;
          if (ws.readyState === WebSocket.OPEN) ws.send(update);
        };
        doc.on('update', observer);

        // Refresh token shortly before it expires (default 14 min if expiresAt unparseable)
        const expiry = expiresAt ? new Date(expiresAt).getTime() : Date.now() + 14 * 60_000;
        const refreshIn = Math.max(60_000, expiry - Date.now() - 60_000);
        tokenRefreshTimer.current = setTimeout(() => {
          if (!cancelled) ws.close(4001, 'token-refresh');
        }, refreshIn);

        return () => {
          doc.off('update', observer);
        };
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        reportToStore(documentId, 'error');
        // eslint-disable-next-line no-console
        console.warn('[useDocYjsCloudSync] connect failed', e);
      }
    })();

    return () => {
      cancelled = true;
      if (tokenRefreshTimer.current) clearTimeout(tokenRefreshTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [documentId, doc, enabled, reportToStore]);

  const reconnect = () => {
    wsRef.current?.close();
  };

  return { status, reconnect };
}
