/**
 * TrackPresence — peer awareness for SheetTable.
 *
 * Single source — presenceStore, fed by the server-canonical wss
 * broadcast in useProjectSyncBridge (Stage B.5). The earlier
 * y-webrtc fallback path was retired in v0.6 cleanup along with the
 * rest of the local-mode plumbing.
 *
 * Self stays out of the peer list (the local cursor is rendered
 * directly, not through the peer pipeline). Peer.id stays a number
 * for React keys — UUID userIds hash into negative ints so they
 * can't collide with anything still expecting numeric ids
 * elsewhere.
 *
 * publishActiveCell / publishSelectedCells / publishEditing are
 * now no-ops kept for call-site compatibility — the actual cursor
 * emit goes through writeQueue.emitPresence in SheetTable's effect.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePresenceStore } from '@/stores/presenceStore';

const NAME_KEY = 'balruno:user-name';
const COLOR_KEY = 'balruno:user-color';

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#06b6d4',
];

const ANIMAL_NAMES = [
  'Tiger', 'Eagle', 'Wolf', 'Bear', 'Fox', 'Hawk', 'Otter', 'Lynx',
  'Falcon', 'Panda', 'Owl', 'Raven', 'Koala', 'Sable',
];

function getOrCreate(key: string, generate: () => string): string {
  if (typeof window === 'undefined') return generate();
  const stored = localStorage.getItem(key);
  if (stored) return stored;
  const fresh = generate();
  localStorage.setItem(key, fresh);
  return fresh;
}

/** 사용자 이름/색상을 외부에서 변경. localStorage + awareness 동기화. */
export function setUserIdentity(name: string, color: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NAME_KEY, name);
  localStorage.setItem(COLOR_KEY, color);
  // 활성 awareness 가 있으면 즉시 반영하기 위해 'change' 이벤트 dispatch
  // (hooks 의 useEffect 가 dependency 로 안 잡히므로 storage 이벤트 활용)
  window.dispatchEvent(new Event('balruno:user-identity-changed'));
}

export interface PeerCellRef {
  sheetId: string;
  rowId: string;
  columnId: string;
}

export interface Peer {
  id: number;
  name: string;
  color: string;
  /** 현재 활성 (단일) 셀 — 단일 클릭·키보드 포커스 */
  activeCell?: PeerCellRef | null;
  /** 드래그/Shift 로 선택된 셀 범위 — 다중 선택 시각화용 */
  selectedCells?: PeerCellRef[];
  /** 현재 편집 모드 (타이핑 중) — cell typing indicator */
  isEditing?: boolean;
}

export function usePresence(projectId: string | null): {
  peers: Peer[];
  myName: string;
  myColor: string;
  /** 단일 활성 셀 publish */
  publishActiveCell: (cell: PeerCellRef | null) => void;
  /** 다중 선택 범위 publish */
  publishSelectedCells: (cells: PeerCellRef[]) => void;
  /** 편집 모드 on/off publish */
  publishEditing: (editing: boolean) => void;
} {
  const [identityVersion, setIdentityVersion] = useState(0);

  // 외부에서 setUserIdentity 호출 시 재계산
  useEffect(() => {
    const handler = () => setIdentityVersion((v) => v + 1);
    window.addEventListener('balruno:user-identity-changed', handler);
    return () => window.removeEventListener('balruno:user-identity-changed', handler);
  }, []);

  const myName = useMemo(
    () =>
      getOrCreate(NAME_KEY, () => {
        const animal = ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)];
        const num = Math.floor(Math.random() * 1000);
        return `${animal}-${num}`;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [identityVersion]
  );
  const myColor = useMemo(
    () =>
      getOrCreate(COLOR_KEY, () => PALETTE[Math.floor(Math.random() * PALETTE.length)]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [identityVersion]
  );

  // Server-canonical peers from presenceStore. Scope key is the
  // sheet leaf id (sheet:<id>) for sheet rendering; SheetTable
  // filters per-cell at render time so flattening every "sheet:*"
  // scope here keeps the hook signature stable.
  const presenceMap = usePresenceStore((s) => s.byScope);
  const peers = useMemo<Peer[]>(() => {
    const next: Peer[] = [];
    for (const [scope, users] of Object.entries(presenceMap)) {
      if (!scope.startsWith('sheet:')) continue;
      const sheetId = scope.slice('sheet:'.length);
      for (const user of users.values()) {
        if (user.isSelf) continue;
        next.push({
          id: hashStringToInt(user.userId),
          name: user.displayName,
          color: user.color,
          activeCell: user.cellKey
            ? { sheetId, rowId: user.cellKey.rowId, columnId: user.cellKey.columnId }
            : null,
          selectedCells: [],
          isEditing: false,
        });
      }
    }
    return next;
  }, [presenceMap]);

  // publish* functions are no-ops post v0.6 cleanup. The actual
  // cursor emit lives in SheetTable's effect via
  // writeQueue.emitPresence — these stubs only exist so existing
  // call sites compile. They can be removed once SheetTable drops
  // its publishActiveCell call.
  //
  // CRITICAL: keep these references stable. SheetTable subscribes
  // them in a `[selectedCell, sheet.id, publishActiveCell]` effect
  // dep array, and the effect mutates commentSelectionStore. If the
  // hook returns a fresh closure each render, the effect re-fires
  // every time the parent re-renders, the store update triggers
  // another parent re-render, and React #185 (max update depth)
  // fires within a few cycles. Stable refs break that loop.
  const publishActiveCell = useCallback((_cell: PeerCellRef | null) => {
    void _cell;
  }, []);
  const publishSelectedCells = useCallback((_cells: PeerCellRef[]) => {
    void _cells;
  }, []);
  const publishEditing = useCallback((_editing: boolean) => {
    void _editing;
  }, []);

  return { peers, myName, myColor, publishActiveCell, publishSelectedCells, publishEditing };
}

/**
 * Stable hash UUID → 32-bit signed int so server-canonical peers
 * can ride the same React-key field as WebRTC clientIDs (which are
 * already numbers). The negative-number sign separates them from
 * WebRTC ids — useful for debugging in React DevTools.
 */
function hashStringToInt(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h * 31) + seed.charCodeAt(i)) | 0;
  return -Math.abs(h) - 1; // always negative + non-zero
}
