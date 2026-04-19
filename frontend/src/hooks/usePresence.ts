'use client';

/**
 * Track 8 Presence — y-webrtc awareness API 기반 다중 사용자 표시.
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

export interface Peer {
  id: number;
  name: string;
  color: string;
}

export function usePresence(projectId: string | null): {
  peers: Peer[];
  myName: string;
  myColor: string;
} {
  const myName = useMemo(
    () =>
      getOrCreate(NAME_KEY, () => {
        const animal = ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)];
        const num = Math.floor(Math.random() * 1000);
        return `${animal}-${num}`;
      }),
    []
  );
  const myColor = useMemo(
    () =>
      getOrCreate(COLOR_KEY, () => PALETTE[Math.floor(Math.random() * PALETTE.length)]),
    []
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
        const user = (state as { user?: { name?: string; color?: string } }).user;
        next.push({
          id,
          name: user?.name ?? 'Anonymous',
          color: user?.color ?? '#94a3b8',
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

  return { peers, myName, myColor };
}
