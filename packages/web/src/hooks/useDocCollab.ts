/**
 * Doc collaboration hook — returns Tiptap extensions + the Y.Doc bound to a remote
 * Hocuspocus session via {@link useDocYjsCloudSync}.
 *
 * Usage:
 *   const { extensions, doc, status } = useDocCollab(documentId);
 *   const editor = useEditor({ extensions: [...baseExtensions, ...extensions], ... });
 *
 * When `documentId` is null or the backend isn't configured, the hook returns an
 * empty extension list so the editor falls back to local-only (HTML string) mode.
 */

import { useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import type { Extensions } from '@tiptap/react';
import { useDocYjsCloudSync, type SyncStatus } from './useDocYjsCloudSync';
import { useAuthStore } from '@/stores/authStore';

export function useDocCollab(documentId: string | null): {
  extensions: Extensions;
  doc: Y.Doc | null;
  status: SyncStatus;
} {
  const docRef = useRef<Y.Doc | null>(null);
  const [, force] = useState(0);

  if (documentId && !docRef.current) {
    docRef.current = new Y.Doc();
    queueMicrotask(() => force((n) => n + 1));
  } else if (!documentId && docRef.current) {
    docRef.current.destroy();
    docRef.current = null;
  }

  const { status } = useDocYjsCloudSync({ documentId, doc: docRef.current });
  const user = useAuthStore((s) => s.user);

  const extensions = useMemo<Extensions>(() => {
    const ydoc = docRef.current;
    if (!documentId || !ydoc) return [];
    const fragment = ydoc.getXmlFragment('default');
    const exts: Extensions = [
      Collaboration.configure({ fragment }),
    ];
    if (user) {
      exts.push(
        CollaborationCursor.configure({
          // Awareness object comes from a y-websocket-style provider; the Hocuspocus client
          // attaches one. When using only useDocYjsCloudSync's raw socket we can omit it
          // and rely on the upcoming Hocuspocus migration to provide awareness.
          provider: { awareness: { setLocalStateField: () => {}, on: () => {}, off: () => {}, getStates: () => new Map() } } as never,
          user: { name: user.name, color: hashColor(user.id) },
        }),
      );
    }
    return exts;
  }, [documentId, user]);

  return { extensions, doc: docRef.current, status };
}

function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}
