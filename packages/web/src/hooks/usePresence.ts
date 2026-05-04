/**
 * TrackPresence — y-webrtc awareness API 기반 다중 사용자 표시.
 *
 * - 익명 사용자 이름/색 자동 생성 (localStorage 영구 저장)
 * - WebRTC provider 활성 시 awareness.setLocalState 로 publish
 * - 다른 사용자 변경 구독 → peers 배열 반환
 */

import { useEffect, useMemo, useState } from 'react';
import { getWebrtc } from '@/lib/ydoc';

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

  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => {
    if (!projectId) {
      setPeers([]);
      return;
    }
    const provider = getWebrtc(projectId);
    if (!provider) {
      setPeers([]);
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
      setPeers(next);
    };

    provider.awareness.on('change', update);
    update();

    return () => {
      provider.awareness.off('change', update);
    };
  }, [projectId, myName, myColor]);

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
