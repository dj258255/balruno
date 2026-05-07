/**
 * TrackPresence — peer awareness for SheetTable.
 *
 * Two source channels merge into one Peer[] view:
 *
 *   1. y-webrtc awareness — local mode peers (no backend). Carries
 *      the rich state (activeCell + selectedCells + isEditing).
 *   2. presenceStore — server-canonical peers via wss broadcast
 *      (Stage B.5). Carries activeCell only; selectedCells /
 *      isEditing arrive as empty until the wss presence schema
 *      grows.
 *
 * Self stays out of the peer list (the local cursor is rendered
 * directly, not through the peer pipeline). Both channels run in
 * parallel; their peer ids don't collide because WebRTC clientIDs
 * are numeric and presenceStore userIds are UUIDs — we hash UUID →
 * negative number for the Peer.id field so React keys stay stable.
 */

import { useEffect, useMemo, useState } from 'react';
import { getWebrtc } from '@/lib/ydoc';
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

  const [webrtcPeers, setWebrtcPeers] = useState<Peer[]>([]);

  useEffect(() => {
    if (!projectId) {
      setWebrtcPeers([]);
      return;
    }
    const provider = getWebrtc(projectId);
    if (!provider) {
      setWebrtcPeers([]);
      return;
    }

    // 내 정보 publish
    provider.awareness.setLocalState({
      user: { name: myName, color: myColor },
    });

    const myId = provider.awareness.clientID;

    const update = () => {
      const next: Peer[] = [];
      provider.awareness.getStates().forEach((state, id) => {
        if (id === myId) return;
        const s = state as {
          user?: { name?: string; color?: string };
          activeCell?: PeerCellRef | null;
          selectedCells?: PeerCellRef[];
          isEditing?: boolean;
        };
        next.push({
          id,
          name: s.user?.name ?? 'Anonymous',
          color: s.user?.color ?? '#94a3b8',
          activeCell: s.activeCell ?? null,
          selectedCells: s.selectedCells ?? [],
          isEditing: s.isEditing ?? false,
        });
      });
      setWebrtcPeers(next);
    };

    provider.awareness.on('change', update);
    update();

    return () => {
      provider.awareness.off('change', update);
    };
  }, [projectId, myName, myColor]);

  // Server-canonical peers from presenceStore. Scope key is the
  // sheet leaf id (sheet:<id>) for sheet rendering; SheetTable
  // doesn't know which sheet a peer is on at the hook level, so
  // we flatten every "sheet:*" scope and pass the per-cell filter
  // up to the renderer (which already filters by sheet.id +
  // rowId + columnId in SheetTable). This keeps the hook signature
  // compatible without a per-sheet hook variant.
  const presenceMap = usePresenceStore((s) => s.byScope);
  const wssPeers = useMemo<Peer[]>(() => {
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

  const peers = useMemo(() => [...webrtcPeers, ...wssPeers], [webrtcPeers, wssPeers]);

  const mergeLocalState = (patch: Record<string, unknown>) => {
    if (!projectId) return;
    const provider = getWebrtc(projectId);
    if (!provider) return;
    const prev = (provider.awareness.getLocalState() ?? {}) as Record<string, unknown>;
    provider.awareness.setLocalState({
      ...prev,
      user: prev.user ?? { name: myName, color: myColor },
      ...patch,
    });
  };

  const publishActiveCell = (cell: PeerCellRef | null) => mergeLocalState({ activeCell: cell });
  const publishSelectedCells = (cells: PeerCellRef[]) => mergeLocalState({ selectedCells: cells });
  const publishEditing = (editing: boolean) => mergeLocalState({ isEditing: editing });

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
