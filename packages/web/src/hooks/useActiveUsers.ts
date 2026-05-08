/**
 * Active-users abstraction — unifies presence across the two sync channels.
 *
 *   { kind: 'sheet', sheetId } → cell-event WebSocket presence broadcasts (custom protocol)
 *   { kind: 'doc',   docId   } → yjs awareness on the document Y.Doc
 *
 * Returns the same shape regardless of channel so UI components (UserAvatarStack,
 * RemoteCursor, CellPresenceBadge) don't need to know.
 *
 * Until the backend is wired up the hook returns the local user only — useful for
 * developing the UI without a running server.
 */

import { useEffect, useMemo, useState } from 'react';
import { usePresenceStore, type PresenceUser } from '@/stores/presenceStore';
import { useAuthStore } from '@/stores/authStore';

export type PresenceScope =
  | { kind: 'sheet'; sheetId: string }
  | { kind: 'doc'; docId: string };

export function useActiveUsers(scope: PresenceScope | null): PresenceUser[] {
  const presenceMap = usePresenceStore((s) => s.byScope);
  const localUser = useAuthStore((s) => s.user);

  const key = scope ? `${scope.kind}:${'sheetId' in scope ? scope.sheetId : scope.docId}` : null;

  const remote = useMemo<PresenceUser[]>(() => {
    if (!key) return [];
    return Array.from(presenceMap[key]?.values() ?? []);
  }, [presenceMap, key]);

  // Always include the local user at the head so UI shows "self" without server.
  const local: PresenceUser | null = localUser
    ? {
        userId: localUser.id,
        displayName: localUser.name,
        color: hashColor(localUser.id),
        isSelf: true,
      }
    : null;

  return useMemo(() => (local ? [local, ...remote.filter((u) => u.userId !== local.userId)] : remote), [local, remote]);
}

/** Stable hue per userId — same color across presence mediums. */
function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 70% 55%)`;
}

/** Wire-up helper invoked by the sync hooks. UI should not call this directly. */
export function useReportPresenceConsumer(scope: PresenceScope | null): void {
  const _ = scope;
  // Reserved for the upcoming useDocYjsCloudSync / useProjectSync wiring —
  // they push into usePresenceStore which this hook reads.
  useEffect(() => {
    // no-op; logic lives in the sync hooks themselves.
  }, [_]);
}
