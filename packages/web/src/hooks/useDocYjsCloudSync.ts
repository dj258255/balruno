/**
 * Document yjs cloud sync — wraps {@link HocuspocusProvider} so a
 * Tiptap-bound Y.Doc round-trips through the Hocuspocus container
 * (ADR 0008 v2.0 §3.2 / ADR 0017 §1 — pattern B).
 *
 * Flow:
 *   1. Fetch a short-lived collab token from Spring (lib/backend/collab.ts).
 *   2. Open a HocuspocusProvider against {@link collabBaseUrl} with the
 *      token; the provider speaks Hocuspocus's auth + sync protocol on
 *      top of yjs binary updates.
 *   3. Provider events → SyncStatus → connectionStore (drives the
 *      ConnectionStatus indicator).
 *   4. Token refresh: shortly before {@code expiresAt} we destroy the
 *      provider and re-create it with a fresh token. Hocuspocus
 *      reauths transparently from the client's POV.
 *
 * Local-only mode: when {@link isBackendConfigured} is false (no
 * NEXT_PUBLIC_BALRUNO_API_URL) the hook stays idle and the Y.Doc
 * remains a pure local CRDT — same shape as before, no breakage for
 * desktop builds without a backend.
 */

import { useEffect, useRef, useState } from 'react';
import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider';
import * as Y from 'yjs';

import { collabBaseUrl, fetchCollabToken, isBackendConfigured } from '@/lib/backend';
import { useConnectionStore } from '@/stores/connectionStore';

export type SyncStatus = 'idle' | 'connecting' | 'connected' | 'offline' | 'error';

interface UseDocYjsCloudSyncOptions {
  documentId: string | null;
  doc: Y.Doc | null;
  /** When false, the hook stays idle (local-only mode, no backend, etc.). */
  enabled?: boolean;
}

export function useDocYjsCloudSync({
  documentId,
  doc,
  enabled = true,
}: UseDocYjsCloudSyncOptions): {
  status: SyncStatus;
  reconnect: () => void;
} {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const cleanupTimer = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };

    const cleanupProvider = () => {
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
    };

    const connect = async () => {
      try {
        const { collabToken, expiresAt } = await fetchCollabToken(documentId);
        if (cancelled) return;

        const provider = new HocuspocusProvider({
          url: collabBaseUrl(),
          name: documentId,
          document: doc,
          token: collabToken,
          // Reconnect is handled by the provider; we only kill it on
          // token expiry to force a fresh handshake with a new JWT.
          forceSyncInterval: false,
        });
        providerRef.current = provider;

        provider.on('status', (event: { status: WebSocketStatus }) => {
          if (cancelled) return;
          const next = mapStatus(event.status);
          setStatus(next);
          reportToStore(documentId, next);
        });

        provider.on('authenticationFailed', () => {
          if (cancelled) return;
          setStatus('error');
          reportToStore(documentId, 'error');
        });

        // Token-driven refresh — schedule a destroy+reconnect ~60s
        // before expiry so the new provider opens before the old token
        // is rejected. Min 60s prevents a tight reconnect loop on a
        // mis-clocked server.
        const expiry = expiresAt ? new Date(expiresAt).getTime() : Date.now() + 14 * 60_000;
        const refreshIn = Math.max(60_000, expiry - Date.now() - 60_000);
        refreshTimerRef.current = setTimeout(() => {
          if (cancelled) return;
          cleanupProvider();
          void connect();
        }, refreshIn);
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        reportToStore(documentId, 'error');
        // eslint-disable-next-line no-console
        console.warn('[useDocYjsCloudSync] connect failed', e);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      cleanupTimer();
      cleanupProvider();
    };
  }, [documentId, doc, enabled, reportToStore]);

  const reconnect = () => {
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }
    // Flicker the status so the indicator shows something is happening;
    // the effect's deps haven't changed, so explicit reconnect requires
    // the user to either change documentId or call this from a parent
    // that re-mounts the hook.
    setStatus('connecting');
  };

  return { status, reconnect };
}

function mapStatus(ws: WebSocketStatus): SyncStatus {
  switch (ws) {
    case WebSocketStatus.Connecting:    return 'connecting';
    case WebSocketStatus.Connected:     return 'connected';
    case WebSocketStatus.Disconnected:  return 'offline';
    default:                            return 'offline';
  }
}
